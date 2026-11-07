"""Just-for-fun demo: do a meme gesture and see the meme beside you.

Put your GIFs in the gifs/ folder next to this script, using these names:
  gifs/scooba.gif       Scuba Dance: pinch your nose with one hand, wave the other
  gifs/scare.gif        Open your eyes wide
  gifs/open_palm.gif    open palm
  gifs/fist.gif         fist

A missing GIF is replaced by an animated placeholder, so the demo always runs.

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
    GESTURE_COLORS,
    GESTURE_SMOOTHING_FRAMES,
    INDEX_TIP,
    MAX_CONSECUTIVE_READ_FAILURES,
    MIDDLE_MCP,
    MODEL_PATH,
    THUMB_TIP,
    Gesture,
    classify_gesture,
    ensure_model,
    logger,
)

Point = Tuple[float, float]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GIF_DIR = os.path.join(SCRIPT_DIR, "gifs")

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
    Gesture.OPEN_PALM: "open_palm.gif",
    Gesture.FIST: "fist.gif",
}

# Scooba thresholds, in face widths (ear to ear)
PINCH_MAX_DISTANCE = 0.6      # Thumb tip to index tip
NOSE_MAX_DISTANCE = 0.8       # Pinch to nose
WAVE_MAX_DISTANCE = 3.0       # Waving hand to nose
WAVE_MIN_SWING = 0.25         # Movement that counts as one swing
WAVE_MIN_REVERSALS = 2
WAVE_WINDOW_SECONDS = 1.5
SCOOBA_HOLD_SECONDS = 0.5     # Stays detected this long, to ride out tracking gaps

# Wide-eyes thresholds, on the average of MediaPipe's eyeWideLeft and eyeWideRight (0 to 1)
EYES_WIDE_ON = 0.02
EYES_WIDE_OFF = 0.01          # Lower than ON, so a score near the line doesn't flicker
EYES_WIDE_MIN_SECONDS = 0.2   # Longer than a quick flutter of the eyelids
EYES_WIDE_HOLD_SECONDS = 0.5  # Stays detected this long, to ride out tracking gaps

# Keep the GIF up briefly after the gesture ends, so tracking hiccups don't make it blink.
GIF_LINGER_SECONDS = 1.0
DEFAULT_FRAME_MS = 100
# 480p tall fits camera + GIF panel on a 1366px wide laptop screen.
DISPLAY_HEIGHT = 480
PANEL_SIZE = DISPLAY_HEIGHT
PANEL_BACKGROUND = (30, 30, 30)
WINDOW_NAME = "Gesture GIF Demo"


def _distance(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def count_reversals(values: Sequence[float], min_swing: float) -> int:
    """Counts direction changes, ignoring movements smaller than min_swing."""
    if not values:
        return 0
    reversals = 0
    direction = 0
    extreme = values[0]
    for value in values[1:]:
        change = value - extreme
        if direction == 0:
            if abs(change) >= min_swing:
                direction = 1 if change > 0 else -1
                extreme = value
        elif change * direction > 0:
            extreme = value  # Still moving the same way
        elif abs(change) >= min_swing:
            direction = -direction
            extreme = value
            reversals += 1
    return reversals


class ScoobaDetector:
    """Detects one hand pinching the nose while the other waves near the face."""

    def __init__(self) -> None:
        self.wave_points: deque = deque()
        self.last_detected = -math.inf
        self.nose_plugged = False
        self.reversals = 0

    def update(
        self,
        hands: Sequence[Sequence[Point]],
        nose: Optional[Point],
        face_width: float,
        now: float,
    ) -> bool:
        """Takes each hand's landmarks in pixels. Returns whether the gesture is on."""
        while self.wave_points and now - self.wave_points[0][0] > WAVE_WINDOW_SECONDS:
            self.wave_points.popleft()

        self.nose_plugged = False
        if nose is not None and face_width > 0:
            pinching_hand = self._find_pinching_hand(hands, nose, face_width)
            self.nose_plugged = pinching_hand is not None
            if self.nose_plugged and len(hands) >= 2:
                palm = hands[1 - pinching_hand][MIDDLE_MCP]
                if _distance(palm, nose) <= WAVE_MAX_DISTANCE * face_width:
                    # Face widths, so the gesture measures the same at any distance
                    self.wave_points.append((now, palm[0] / face_width, palm[1] / face_width))

        self.reversals = max(
            count_reversals([p[1] for p in self.wave_points], WAVE_MIN_SWING),
            count_reversals([p[2] for p in self.wave_points], WAVE_MIN_SWING),
        )
        if self.nose_plugged and self.reversals >= WAVE_MIN_REVERSALS:
            self.last_detected = now
        return now - self.last_detected <= SCOOBA_HOLD_SECONDS

    @staticmethod
    def _find_pinching_hand(hands, nose: Point, face_width: float) -> Optional[int]:
        closest = None
        closest_distance = NOSE_MAX_DISTANCE * face_width
        for index, hand in enumerate(hands):
            thumb, finger = hand[THUMB_TIP], hand[INDEX_TIP]
            if _distance(thumb, finger) > PINCH_MAX_DISTANCE * face_width:
                continue
            pinch = ((thumb[0] + finger[0]) / 2, (thumb[1] + finger[1]) / 2)
            distance = _distance(pinch, nose)
            if distance <= closest_distance:
                closest, closest_distance = index, distance
        return closest


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


@dataclass
class Gif:
    frames: List[np.ndarray]
    durations_ms: List[int]

    def frame_at(self, elapsed_ms: float) -> np.ndarray:
        """Returns the frame showing at this time, looping forever."""
        position = elapsed_ms % sum(self.durations_ms)
        for frame, duration in zip(self.frames, self.durations_ms):
            position -= duration
            if position < 0:
                return frame
        return self.frames[-1]


def fit_to_panel(image: np.ndarray) -> np.ndarray:
    """Scales an image to fit a square panel, centered, keeping its proportions."""
    height, width = image.shape[:2]
    scale = PANEL_SIZE / max(height, width)
    resized = cv2.resize(image, (max(1, round(width * scale)), max(1, round(height * scale))))
    new_height, new_width = resized.shape[:2]

    panel = np.full((PANEL_SIZE, PANEL_SIZE, 3), PANEL_BACKGROUND, dtype=np.uint8)
    top = (PANEL_SIZE - new_height) // 2
    left = (PANEL_SIZE - new_width) // 2
    area = panel[top:top + new_height, left:left + new_width]

    if resized.ndim == 2:
        resized = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR)
    if resized.shape[2] == 4:  # Transparent GIF: blend over the panel
        alpha = resized[:, :, 3:4].astype(np.float32) / 255.0
        area[:] = (resized[:, :, :3] * alpha + area * (1.0 - alpha)).astype(np.uint8)
    else:
        area[:] = resized
    return panel


def make_placeholder(gesture: str, filename: str) -> Gif:
    """Draws a pulsing circle telling which file to add."""
    color = GESTURE_COLORS[gesture]
    center = (PANEL_SIZE // 2, PANEL_SIZE // 2 - 30)
    frames = []
    for radius in (50, 65, 80, 95, 80, 65):
        panel = np.full((PANEL_SIZE, PANEL_SIZE, 3), PANEL_BACKGROUND, dtype=np.uint8)
        cv2.circle(panel, center, radius, color, -1, cv2.LINE_AA)
        cv2.putText(panel, gesture, (30, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 2, cv2.LINE_AA)
        cv2.putText(
            panel, f"Add gifs/{filename}", (30, PANEL_SIZE - 40),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 1, cv2.LINE_AA,
        )
        frames.append(panel)
    return Gif(frames, [DEFAULT_FRAME_MS] * len(frames))


def load_gif(path: str) -> Optional[Gif]:
    """Loads a GIF scaled to the panel. Returns None if it is missing or unreadable."""
    if not os.path.exists(path):
        return None
    ok, animation = cv2.imreadanimation(path)
    if not ok or not animation.frames:
        logger.warning(f"Could not read GIF: {path}")
        return None
    # Some GIFs store a 0 delay, which players treat as a default speed.
    durations = [int(d) if int(d) > 0 else DEFAULT_FRAME_MS for d in animation.durations]
    return Gif([fit_to_panel(frame) for frame in animation.frames], durations)


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


def make_idle_panel() -> np.ndarray:
    panel = np.full((PANEL_SIZE, PANEL_SIZE, 3), PANEL_BACKGROUND, dtype=np.uint8)
    lines = ("Pinch your nose + wave", "Open your eyes wide", "Open palm / fist")
    for y, text in zip((PANEL_SIZE // 2 - 40, PANEL_SIZE // 2, PANEL_SIZE // 2 + 40), lines):
        (width, _), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        cv2.putText(
            panel, text, ((PANEL_SIZE - width) // 2, y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (160, 160, 160), 2, cv2.LINE_AA,
        )
    return panel


def main(camera_index: int = 0, gif_dir: str = GIF_DIR) -> None:
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
    idle_panel = make_idle_panel()

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
    eyes_wide = EyesWideDetector()
    eyes_score: Optional[float] = None
    last_timestamp_ms = -1
    read_failures = 0
    frame_count = 0
    nose: Optional[Point] = None
    face_width = 0.0
    active_gesture: Optional[str] = None
    gif_start = 0.0
    last_seen = 0.0

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

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            last_timestamp_ms = max(last_timestamp_ms + 1, int(now * 1000))
            results = hand_detector.detect_for_video(mp_image, last_timestamp_ms)

            if frame_count % SLOW_MODEL_CYCLE == FACE_TURN:
                eyes_score = read_eyes_wide_score(
                    face_detector.detect_for_video(mp_image, last_timestamp_ms)
                )

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
            hands_in_pixels = []
            for index, landmarks in enumerate(results.hand_landmarks):
                hands_in_pixels.append([(p.x * frame_width, p.y * frame_height) for p in landmarks])
                if index == 0:
                    label = results.handedness[0][0].category_name if results.handedness[0] else "Right"
                    raw_gesture, _ = classify_gesture(
                        results.hand_world_landmarks[0], landmarks, label, frame_width, frame_height
                    )
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
            if scooba.update(hands_in_pixels, nose, face_width, now):
                gesture = SCOOBA
            elif scare_on:
                gesture = SCARE

            # A new gesture switches GIF at once; no gesture keeps the old one until it lingers out.
            if gesture in gifs:
                if gesture != active_gesture:
                    active_gesture = gesture
                    gif_start = now
                    logger.info(f"Showing GIF for {gesture}")
                last_seen = now
            elif active_gesture is not None and now - last_seen > GIF_LINGER_SECONDS:
                active_gesture = None

            if active_gesture is None:
                panel = idle_panel
            else:
                panel = gifs[active_gesture].frame_at((now - gif_start) * 1000)

            camera_view = cv2.resize(frame, (camera_width, DISPLAY_HEIGHT))
            cv2.putText(
                camera_view, gesture, (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, GESTURE_COLORS.get(gesture, (160, 160, 160)), 2, cv2.LINE_AA,
            )
            status = (
                f"Nose pinch: {'OK' if scooba.nose_plugged else '--'}   "
                f"Wave: {min(scooba.reversals, WAVE_MIN_REVERSALS)}/{WAVE_MIN_REVERSALS}   "
                f"Eyes: {'--' if eyes_score is None else f'{eyes_score:.2f}'}/{EYES_WIDE_ON:.2f}"
            )
            cv2.putText(
                camera_view, status, (20, DISPLAY_HEIGHT - 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA,
            )
            cv2.imshow(WINDOW_NAME, np.hstack((camera_view, panel)))

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
