"""Just-for-fun photo booth: do a meme gesture and the meme pops up beside your cheek,
live, like an AR sticker. It goes away as soon as the gesture ends.

Put your GIFs in the gifs/ folder next to this script, using these names:
  gifs/scooba.gif       Scooba: pinch your nose
  gifs/scare.gif        Open your eyes wide
  gifs/fist.gif         Fist
A missing GIF is replaced by an animated placeholder, so the demo always runs.
GIFs with a transparent background look best: only the meme itself sits on the picture.

Hold an open palm for a moment to start a 3-second countdown and take a photo. A meme
showing at that moment is in the photo too. Photos are saved to captures/ and never
committed.

Press 'q' or Esc to quit.
"""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass
import math
import os
import time
from typing import List, Optional, Sequence, Tuple

import cv2
import mediapipe as mp
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision import (
    drawing_styles,
    drawing_utils,
    face_landmarker,
    hand_landmarker,
    pose_landmarker,
)
from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode
import numpy as np

from fivepalm_shutter import (
    COOLDOWN_SECONDS,
    COUNTDOWN_SECONDS,
    DEBOUNCE_HOLD_SECONDS,
    FLASH_DURATION_SECONDS,
    GESTURE_COLORS,
    GESTURE_SMOOTHING_FRAMES,
    INDEX_TIP,
    MAX_CONSECUTIVE_READ_FAILURES,
    MODEL_PATH,
    THUMB_TIP,
    Gesture,
    ShutterState,
    classify_gesture,
    ensure_model,
    logger,
    save_capture_frame,
)

Point = Tuple[float, float]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GIF_DIR = os.path.join(SCRIPT_DIR, "gifs")
# Photos go to captures/ only (see AGENTS.md)
CAPTURES_DIR = os.path.join(SCRIPT_DIR, "captures")

POSE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
)
POSE_MODEL_PATH = os.path.join(SCRIPT_DIR, "pose_landmarker_lite.task")
FACE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
FACE_MODEL_PATH = os.path.join(SCRIPT_DIR, "face_landmarker.task")
POSE_NOSE = 0
POSE_LEFT_EAR = 7
POSE_RIGHT_EAR = 8
# The slower pose and face models take turns, so neither runs on every frame.
SLOW_MODEL_CYCLE = 3
POSE_TURN = 1
FACE_TURN = 2
# Ear-to-ear shrinks when the head turns; keep a floor relative to the frame height.
MIN_FACE_WIDTH_RATIO = 0.08

SCOOBA = "SCOOBA"
SCARE = "SCARE"
GESTURE_COLORS = {**GESTURE_COLORS, SCOOBA: (255, 200, 0), SCARE: (200, 0, 255)}
GIF_FILES = {
    SCOOBA: "scooba.gif",
    SCARE: "scare.gif",
    Gesture.FIST: "fist.gif",
}

# Scooba: thumb and index fingertips pinched together on the nose, in face widths (ear to ear)
PINCH_MAX_DISTANCE = 0.6        # Thumb tip to index tip
NOSE_MAX_DISTANCE = 0.8         # Pinch to nose
SCOOBA_HOLD_SECONDS = 0.0       # No hold: the meme shows only while the gesture is seen

# Wide-eyes thresholds, on the average of MediaPipe's eyeWideLeft and eyeWideRight (0 to 1)
EYES_WIDE_ON = 0.02
EYES_WIDE_OFF = 0.01          # Lower than ON, so a score near the line doesn't flicker
EYES_WIDE_MIN_SECONDS = 0.2   # Longer than a quick flutter of the eyelids
EYES_WIDE_HOLD_SECONDS = 0.0  # No hold: the meme shows only while the gesture is seen

DEFAULT_FRAME_MS = 100
DISPLAY_HEIGHT = 480
GIF_MAX_SIDE = 480              # GIF frames are kept up to this size, then scaled to the face
MEME_FACE_SCALE = 1.3           # Meme height, relative to the face height
MEME_GAP_RATIO = 0.08           # Gap between face and meme, relative to the face width
MEME_MIN_FACE_RATIO = 0.6       # Never narrower than this; overlaps the face when there is no room
FACE_MEMORY_SECONDS = 1.5       # A hand can hide the face; its last place is used this long
MEME_LINGER_SECONDS = 0.0       # Gone as soon as the gesture ends
SAVED_NOTICE_SECONDS = 2.0
WINDOW_NAME = "Gesture Photo Booth"


def _distance(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


class ScoobaDetector:
    """Detects a hand pinching the nose with the thumb and index finger."""

    def __init__(self) -> None:
        self.last_detected = -math.inf
        self.nose_pinched = False

    def update(
        self,
        hands: Sequence[Tuple[Sequence, Sequence, str]],
        nose: Optional[Point],
        face_width: float,
        now: float,
        frame_size: Tuple[int, int],
    ) -> bool:
        """Takes (world landmarks, image landmarks, handedness) per hand. Returns whether it is on."""
        width, height = frame_size
        self.nose_pinched = False
        if nose is not None and face_width > 0:
            for _, image, _ in hands:
                thumb = (image[THUMB_TIP].x * width, image[THUMB_TIP].y * height)
                finger = (image[INDEX_TIP].x * width, image[INDEX_TIP].y * height)
                if _distance(thumb, finger) > PINCH_MAX_DISTANCE * face_width:
                    continue
                pinch = ((thumb[0] + finger[0]) / 2, (thumb[1] + finger[1]) / 2)
                if _distance(pinch, nose) <= NOSE_MAX_DISTANCE * face_width:
                    self.nose_pinched = True
                    break

        if self.nose_pinched:
            self.last_detected = now
        return now - self.last_detected <= SCOOBA_HOLD_SECONDS


class EyesWideDetector:
    """Detects eyes held wide open for a moment."""

    def __init__(self) -> None:
        self.wide_since: Optional[float] = None
        self.last_detected = -math.inf

    def update(self, score: Optional[float], now: float) -> bool:
        """Takes the wide-eyes score, or None without a face. Returns whether it is on."""
        if score is None or score < EYES_WIDE_OFF:
            self.wide_since = None
        elif score >= EYES_WIDE_ON and self.wide_since is None:
            self.wide_since = now

        if self.wide_since is not None and now - self.wide_since >= EYES_WIDE_MIN_SECONDS:
            self.last_detected = now
        return now - self.last_detected <= EYES_WIDE_HOLD_SECONDS


def read_eyes_wide_score(result) -> Optional[float]:
    """Returns the average wide-eyes score of the first face, or None without a face."""
    if not result.face_blendshapes:
        return None
    scores = {shape.category_name: shape.score for shape in result.face_blendshapes[0]}
    return (scores["eyeWideLeft"] + scores["eyeWideRight"]) / 2


class PalmShutter:
    """Open palm held -> countdown -> photo -> cooldown, as in fivepalm_shutter.py."""

    def __init__(self) -> None:
        self.state = ShutterState.IDLE
        self.since = 0.0

    def update(self, palm_held: bool, now: float) -> bool:
        """Returns True on the frame the photo should be taken."""
        elapsed = now - self.since
        if self.state == ShutterState.IDLE:
            if palm_held:
                self.state, self.since = ShutterState.DEBOUNCING, now
        elif self.state == ShutterState.DEBOUNCING:
            if not palm_held:
                self.state = ShutterState.IDLE
            elif elapsed >= DEBOUNCE_HOLD_SECONDS:
                self.state, self.since = ShutterState.COUNTDOWN, now
                logger.info("🎯 Palm held. Starting the countdown.")
        elif self.state == ShutterState.COUNTDOWN:
            if elapsed >= COUNTDOWN_SECONDS:
                self.state, self.since = ShutterState.COOLDOWN, now
                return True
        elif self.state == ShutterState.COOLDOWN and elapsed >= COOLDOWN_SECONDS:
            self.state = ShutterState.IDLE
        return False

    def hold_progress(self, now: float) -> float:
        return min(1.0, (now - self.since) / DEBOUNCE_HOLD_SECONDS)

    def countdown_left(self, now: float) -> float:
        return max(0.0, COUNTDOWN_SECONDS - (now - self.since))


def draw_shutter(view: np.ndarray, shutter: PalmShutter, now: float) -> None:
    """Draws the hold bar and the countdown number."""
    height, width = view.shape[:2]
    if shutter.state == ShutterState.DEBOUNCING:
        left, top, bar_width = 20, height - 70, width - 40
        cv2.rectangle(view, (left, top), (left + bar_width, top + 14), (50, 50, 50), -1)
        cv2.rectangle(view, (left, top), (left + int(bar_width * shutter.hold_progress(now)), top + 14), (0, 255, 120), -1)
        cv2.putText(view, "Hold palm to take a photo", (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 120), 2, cv2.LINE_AA)
    elif shutter.state == ShutterState.COUNTDOWN:
        number = str(max(1, math.ceil(shutter.countdown_left(now))))
        center = (width // 2, height // 2)
        cv2.circle(view, center, 70, (0, 0, 0), -1, cv2.LINE_AA)
        cv2.circle(view, center, 70, (0, 220, 255), 4, cv2.LINE_AA)
        (text_width, text_height), _ = cv2.getTextSize(number, cv2.FONT_HERSHEY_SIMPLEX, 2.8, 6)
        cv2.putText(view, number, (center[0] - text_width // 2, center[1] + text_height // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 2.8, (0, 220, 255), 6, cv2.LINE_AA)


@dataclass
class Gif:
    frames: List[np.ndarray]  # BGR, or BGRA when the GIF has transparency
    durations_ms: List[int]

    def frame_at(self, elapsed_ms: float) -> np.ndarray:
        """Returns the frame showing at this time, looping forever."""
        position = elapsed_ms % sum(self.durations_ms)
        for frame, duration in zip(self.frames, self.durations_ms):
            position -= duration
            if position < 0:
                return frame
        return self.frames[-1]


Box = Tuple[float, float, float, float]  # x0, y0, x1, y1 in pixels
Rect = Tuple[int, int, int, int]  # x, y, width, height in pixels


def shrink_to_max_side(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    scale = GIF_MAX_SIDE / max(image.shape[:2])
    if scale >= 1:
        return image
    return cv2.resize(image, (max(1, round(image.shape[1] * scale)), max(1, round(image.shape[0] * scale))))


def place_beside_face(frame_size: Tuple[int, int], face: Box, meme_size: Tuple[int, int]) -> Rect:
    """Puts the meme next to the cheek, on the side with more room, scaled to the face."""
    frame_width, frame_height = frame_size
    x0, y0, x1, y1 = face
    face_width, face_height = x1 - x0, y1 - y0
    height = face_height * MEME_FACE_SCALE
    width = height * meme_size[0] / meme_size[1]

    gap = face_width * MEME_GAP_RATIO
    room_right, room_left = frame_width - x1 - gap, x0 - gap
    on_right = room_right >= room_left
    room = room_right if on_right else room_left
    if width > room:  # Shrink to the room, but not into a speck
        scale = max(room, face_width * MEME_MIN_FACE_RATIO) / width
        width, height = width * scale, height * scale
    width = max(1, min(int(width), frame_width))
    height = max(1, min(int(height), frame_height))

    x = x1 + gap if on_right else x0 - gap - width
    y = (y0 + y1) / 2 - height / 2  # Centered on the cheek
    x = int(min(max(x, 0), frame_width - width))
    y = int(min(max(y, 0), frame_height - height))
    return x, y, width, height


def overlay(image: np.ndarray, meme: np.ndarray, rect: Rect) -> None:
    """Draws the meme into the image in place, honoring its transparency."""
    x, y, width, height = rect
    sticker = cv2.resize(meme, (width, height))
    area = image[y:y + height, x:x + width]
    if sticker.shape[2] == 4:
        alpha = sticker[:, :, 3:4].astype(np.float32) / 255.0
        area[:] = (sticker[:, :, :3] * alpha + area * (1.0 - alpha)).astype(np.uint8)
    else:
        area[:] = sticker


def face_box_from_landmarks(landmarks, frame_width: int, frame_height: int) -> Box:
    xs = [p.x * frame_width for p in landmarks]
    ys = [p.y * frame_height for p in landmarks]
    return min(xs), min(ys), max(xs), max(ys)


def make_placeholder(gesture: str, filename: str) -> Gif:
    """Draws a pulsing circle on a transparent background, telling which file to add."""
    size = 300
    color = GESTURE_COLORS[gesture]
    frames = []
    for radius in (70, 85, 100, 115, 100, 85):
        frame = np.zeros((size, size, 4), dtype=np.uint8)
        cv2.circle(frame, (size // 2, size // 2), radius, (*color, 255), -1, cv2.LINE_AA)
        for text, y, scale in ((gesture, size // 2 + 8, 0.9), (filename, size // 2 + 40, 0.5)):
            (text_width, _), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, 2)
            cv2.putText(frame, text, ((size - text_width) // 2, y), cv2.FONT_HERSHEY_SIMPLEX, scale,
                        (255, 255, 255, 255), 2, cv2.LINE_AA)
        frames.append(frame)
    return Gif(frames, [DEFAULT_FRAME_MS] * len(frames))


def load_gif(path: str) -> Optional[Gif]:
    """Loads a GIF, keeping its transparency. Returns None if it is missing or unreadable."""
    if not os.path.exists(path):
        return None
    ok, animation = cv2.imreadanimation(path)
    if not ok or not animation.frames:
        logger.warning(f"Could not read GIF: {path}")
        return None
    # Some GIFs store a 0 delay, which players treat as a default speed.
    durations = [int(d) if int(d) > 0 else DEFAULT_FRAME_MS for d in animation.durations]
    return Gif([shrink_to_max_side(frame) for frame in animation.frames], durations)


def load_gifs(gif_dir: str) -> dict:
    gifs = {}
    for gesture, filename in GIF_FILES.items():
        gif = load_gif(os.path.join(gif_dir, filename))
        if gif is None:
            logger.info(f"No gifs/{filename} yet: using a placeholder for {gesture}.")
            gif = make_placeholder(gesture, filename)
        else:
            logger.info(f"Loaded gifs/{filename} ({len(gif.frames)} frames) for {gesture}.")
        gifs[gesture] = gif
    return gifs


def main(camera_index: int = 0, gif_dir: str = GIF_DIR, captures_dir: str = CAPTURES_DIR) -> None:
    models_ready = (
        ensure_model()
        and ensure_model(POSE_MODEL_PATH, POSE_MODEL_URL)
        and ensure_model(FACE_MODEL_PATH, FACE_MODEL_URL)
    )
    if not models_ready:
        return

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        logger.error(f"❌ Failed to open camera {camera_index}. Is another app using it?")
        return
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    gifs = load_gifs(gif_dir)

    hand_detector = hand_landmarker.HandLandmarker.create_from_options(
        hand_landmarker.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=VisionTaskRunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.6,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    )
    pose_detector = pose_landmarker.PoseLandmarker.create_from_options(
        pose_landmarker.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=POSE_MODEL_PATH),
            running_mode=VisionTaskRunningMode.VIDEO,
        )
    )

    face_detector = face_landmarker.FaceLandmarker.create_from_options(
        face_landmarker.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=FACE_MODEL_PATH),
            running_mode=VisionTaskRunningMode.VIDEO,
            output_face_blendshapes=True,
        )
    )

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_AUTOSIZE)
    recent_gestures: deque = deque(maxlen=GESTURE_SMOOTHING_FRAMES)
    scooba = ScoobaDetector()
    shutter = PalmShutter()
    flash_until = 0.0
    saved_name, saved_at = "", -math.inf
    eyes_wide = EyesWideDetector()
    eyes_score: Optional[float] = None
    last_timestamp_ms = -1
    read_failures = 0
    frame_count = 0
    nose: Optional[Point] = None
    face_width = 0.0
    face_box: Optional[Box] = None
    face_seen_at = -math.inf
    active_meme: Optional[str] = None
    meme_start = 0.0
    meme_seen_at = -math.inf

    try:
        while True:
            ret, raw_frame = cap.read()
            if not ret or raw_frame is None:
                read_failures += 1
                if read_failures >= MAX_CONSECUTIVE_READ_FAILURES:
                    logger.error("❌ Camera stopped sending frames.")
                    break
                continue
            read_failures = 0
            frame_count += 1

            now = time.monotonic()
            frame = cv2.flip(raw_frame, 1)
            frame_height, frame_width = frame.shape[:2]
            camera_width = round(frame_width * DISPLAY_HEIGHT / frame_height)

            clean_frame = frame.copy()  # For the photo: no skeleton or labels
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            last_timestamp_ms = max(last_timestamp_ms + 1, int(now * 1000))
            results = hand_detector.detect_for_video(mp_image, last_timestamp_ms)

            if frame_count % SLOW_MODEL_CYCLE == FACE_TURN:
                face_result = face_detector.detect_for_video(mp_image, last_timestamp_ms)
                eyes_score = read_eyes_wide_score(face_result)
                if face_result.face_landmarks:
                    face_box = face_box_from_landmarks(face_result.face_landmarks[0], frame_width, frame_height)
                    face_seen_at = now

            if frame_count % SLOW_MODEL_CYCLE == POSE_TURN:
                pose = pose_detector.detect_for_video(mp_image, last_timestamp_ms)
                if pose.pose_landmarks:
                    body = pose.pose_landmarks[0]
                    to_pixels = lambda p: (p.x * frame_width, p.y * frame_height)
                    nose = to_pixels(body[POSE_NOSE])
                    face_width = max(
                        _distance(to_pixels(body[POSE_LEFT_EAR]), to_pixels(body[POSE_RIGHT_EAR])),
                        MIN_FACE_WIDTH_RATIO * frame_height,
                    )
                else:
                    nose = None

            raw_gesture = Gesture.NONE
            hands_seen = []
            for index, landmarks in enumerate(results.hand_landmarks):
                label = results.handedness[index][0].category_name if results.handedness[index] else "Right"
                world = results.hand_world_landmarks[index]
                hands_seen.append((world, landmarks, label))
                if index == 0:
                    raw_gesture, _ = classify_gesture(world, landmarks, label, frame_width, frame_height)
                drawing_utils.draw_landmarks(
                    frame,
                    landmarks,
                    hand_landmarker.HandLandmarksConnections.HAND_CONNECTIONS,
                    drawing_styles.get_default_hand_landmarks_style(),
                    drawing_styles.get_default_hand_connections_style(),
                )

            recent_gestures.append(raw_gesture)
            gesture = Counter(recent_gestures).most_common(1)[0][0]
            # Face gestures win over a hand that happens to be in view; Scooba is the most specific.
            scare_on = eyes_wide.update(eyes_score, now)
            if scooba.update(hands_seen, nose, face_width, now, (frame_width, frame_height)):
                gesture = SCOOBA
            elif scare_on:
                gesture = SCARE

            # The meme pops up at once and stays MEME_LINGER_SECONDS after the gesture was last seen
            if gesture in gifs:
                if gesture != active_meme:
                    active_meme, meme_start = gesture, now
                    logger.info(f"Showing {gesture}")
                meme_seen_at = now
            elif active_meme is not None and now - meme_seen_at > MEME_LINGER_SECONDS:
                active_meme = None

            sticker = None
            if active_meme is not None:
                # Where the face is: the face model, else the body model's nose (a hand over
                # the face hides it from the face model), else the middle of the frame
                if face_box is not None and now - face_seen_at <= FACE_MEMORY_SECONDS:
                    where = face_box
                elif nose is not None and face_width > 0:
                    where = (nose[0] - face_width / 2, nose[1] - face_width * 0.7,
                             nose[0] + face_width / 2, nose[1] + face_width * 0.6)
                else:
                    where = (frame_width * 0.4, frame_height * 0.25, frame_width * 0.6, frame_height * 0.6)
                still = gifs[active_meme].frame_at((now - meme_start) * 1000)
                rect = place_beside_face((frame_width, frame_height), where, (still.shape[1], still.shape[0]))
                sticker = (still, rect)
                overlay(frame, still, rect)

            if shutter.update(gesture == Gesture.OPEN_PALM, now):
                photo = clean_frame.copy()
                if sticker is not None:
                    overlay(photo, *sticker)
                saved_name = os.path.basename(save_capture_frame(photo, captures_dir))
                saved_at = now
                flash_until = now + FLASH_DURATION_SECONDS

            camera_view = cv2.resize(frame, (camera_width, DISPLAY_HEIGHT))
            draw_shutter(camera_view, shutter, now)
            cv2.putText(
                camera_view, gesture, (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, GESTURE_COLORS.get(gesture, (160, 160, 160)), 2, cv2.LINE_AA,
            )
            status = (
                f"Nose pinch: {'OK' if scooba.nose_pinched else '--'}   "
                f"Eyes: {'--' if eyes_score is None else f'{eyes_score:.2f}'}/{EYES_WIDE_ON:.2f}"
            )
            cv2.putText(
                camera_view, status, (20, DISPLAY_HEIGHT - 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA,
            )
            if now - saved_at < SAVED_NOTICE_SECONDS:
                cv2.putText(
                    camera_view, f"Saved {saved_name}", (20, 75),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 120), 2, cv2.LINE_AA,
                )
            display = camera_view
            if now < flash_until:
                display = cv2.addWeighted(display, 0.15, np.full_like(display, 255), 0.85, 0)
            cv2.imshow(WINDOW_NAME, display)

            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), ord("Q"), 27):
                break
            if cv2.getWindowProperty(WINDOW_NAME, cv2.WND_PROP_VISIBLE) < 1:
                break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        hand_detector.close()
        pose_detector.close()
        face_detector.close()


if __name__ == "__main__":
    main()
