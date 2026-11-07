"""Real-Time "FivePalm" Gesture Camera Shutter System.

Autonomous, edge-based "Show Palm" gesture-triggered camera shutter
feature (similar to Samsung Camera's 5-finger palm selfie trigger)
built with Python, OpenCV, and Google MediaPipe Hands.

Architecture & Features:
1. Video Ingestion: OpenCV webcam stream (1280x720, mirrored, RGB).
2. Landmark Pipeline: Pre-trained MediaPipe HandLandmarker task (VIDEO running mode, num_hands=1).
   The model file is downloaded next to this script on first run.
3. Geometric Gesture Classification (rotation-invariant, on 3D world landmarks):
   - Finger extended / folded: distance wrist -> tip compared with wrist -> PIP.
   - Thumb extended: tip further from Pinky MCP (17) than Thumb MCP (2) is.
   - Palm Normal Vector: Cross product of (Wrist -> Index MCP) x (Wrist -> Pinky MCP),
     combined with handedness, to reject dorsal (back-of-hand) poses.
   - Result: OPEN_PALM, FIST, BACK_OF_HAND or NONE. Only OPEN_PALM triggers the shutter.
4. State Machine:
   - IDLE -> DEBOUNCE (0.8s continuous hold, 0% to 100% visual feedback, instant reset if dropped)
   - COUNTDOWN (3s visual countdown: 3.. 2.. 1..)
   - CAPTURE (Flash + saves clean frame as captures/capture_<date>_<time>.jpg)
   - COOLDOWN (3.0s lockout preventing accidental re-triggers)
5. HUD & Controls: Color-coded UI (Green hold, Yellow countdown, Red cooldown), 'q' to quit.
"""

from __future__ import annotations

from collections import Counter, deque
from datetime import datetime
import logging
import os
import sys
import time
from typing import Dict, Optional, Tuple
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision import drawing_styles, drawing_utils, hand_landmarker
from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("FivePalmShutter")

# Landmark Index Constants for MediaPipe Hands
WRIST = 0
THUMB_CMC = 1
THUMB_MCP = 2
THUMB_IP = 3
THUMB_TIP = 4

INDEX_MCP = 5
INDEX_PIP = 6
INDEX_DIP = 7
INDEX_TIP = 8

MIDDLE_MCP = 9
MIDDLE_PIP = 10
MIDDLE_DIP = 11
MIDDLE_TIP = 12

RING_MCP = 13
RING_PIP = 14
RING_DIP = 15
RING_TIP = 16

PINKY_MCP = 17
PINKY_PIP = 18
PINKY_DIP = 19
PINKY_TIP = 20

# HandLandmarker model (same model the web app uses, see web/scripts/setup-assets.mjs)
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hand_landmarker.task")

# Configuration & Thresholds
DEBOUNCE_HOLD_SECONDS = 0.8
COUNTDOWN_SECONDS = 3.0
COOLDOWN_SECONDS = 3.0
FLASH_DURATION_SECONDS = 0.15
MAX_CONSECUTIVE_READ_FAILURES = 30

# Gesture thresholds, measured on sample hand photos:
# wrist->tip / wrist->PIP is 0.61-0.83 for folded fingers and 1.20+ for extended ones.
FINGER_EXTENDED_RATIO = 1.10
FINGER_FOLDED_RATIO = 1.00
# Thumb tip->Pinky MCP / Thumb MCP->Pinky MCP is 0.65-0.88 tucked and 1.09+ extended.
THUMB_EXTENDED_RATIO = 1.00
# A fist tolerates a loosely held thumb; a thumbs-up measures 1.35+.
FIST_THUMB_MAX_RATIO = 1.20
# Below this the hand is too edge-on to tell its palm from its back.
PALM_MIN_FACING = 0.20
# Gesture is the majority vote of this many frames (about 0.17s at 30 fps).
GESTURE_SMOOTHING_FRAMES = 5

# HUD Colors (BGR)
COLOR_GREEN = (0, 255, 120)     # Active hold / valid detection
COLOR_YELLOW = (0, 220, 255)    # Countdown active
COLOR_RED = (60, 60, 255)       # Cooldown lockout
COLOR_ORANGE = (0, 150, 255)    # Fist detected
COLOR_WHITE = (255, 255, 255)   # Neutral text
COLOR_GRAY = (160, 160, 160)    # Inactive / details
COLOR_DARK_BG = (20, 20, 20)    # Backdrop box


class Gesture:
    OPEN_PALM = "OPEN_PALM"
    FIST = "FIST"
    BACK_OF_HAND = "BACK_OF_HAND"
    NONE = "NONE"


GESTURE_COLORS = {
    Gesture.OPEN_PALM: COLOR_GREEN,
    Gesture.FIST: COLOR_ORANGE,
    Gesture.BACK_OF_HAND: COLOR_RED,
    Gesture.NONE: COLOR_GRAY,
}


class ShutterState:
    IDLE = "IDLE"
    DEBOUNCING = "DEBOUNCING"
    COUNTDOWN = "COUNTDOWN"
    CAPTURE = "CAPTURE"
    COOLDOWN = "COOLDOWN"


def _distance(a, b) -> float:
    return float(np.linalg.norm([a.x - b.x, a.y - b.y, a.z - b.z]))


def finger_extension_ratio(world_landmarks, tip: int, pip: int) -> float:
    """Returns wrist->tip / wrist->PIP: above 1 when extended, below 1 when folded."""
    wrist = world_landmarks[WRIST]
    return _distance(wrist, world_landmarks[tip]) / max(_distance(wrist, world_landmarks[pip]), 1e-6)


def thumb_extension_ratio(world_landmarks) -> float:
    """Returns how far the thumb tip reaches from the palm, relative to its own base."""
    pinky_mcp = world_landmarks[PINKY_MCP]
    return _distance(world_landmarks[THUMB_TIP], pinky_mcp) / max(
        _distance(world_landmarks[THUMB_MCP], pinky_mcp), 1e-6
    )


def verify_palm_facing_camera(
    image_landmarks, handedness_label: str, frame_width: int, frame_height: int
) -> Tuple[bool, float]:
    """Computes the palm normal (Wrist -> Index MCP) x (Wrist -> Pinky MCP).

    Uses image landmarks in pixel-proportional units, because their x/y are what
    the camera directly observes. The normal alone cannot separate a palm from a
    back of hand, since one looks like a mirrored copy of the other. Handedness
    resolves it: on the sample photos the HandLandmarker reports palms as
    Right with nz < 0 and Left with nz > 0, and the back of a hand the opposite way.
    """
    def to_vector(start, end) -> np.ndarray:
        return np.array([
            (end.x - start.x) * frame_width,
            (end.y - start.y) * frame_height,
            (end.z - start.z) * frame_width,
        ], dtype=np.float32)

    wrist = image_landmarks[WRIST]
    normal = np.cross(to_vector(wrist, image_landmarks[INDEX_MCP]), to_vector(wrist, image_landmarks[PINKY_MCP]))
    norm_val = float(np.linalg.norm(normal))
    if norm_val < 1e-6:
        return False, 0.0

    nz = float(normal[2]) / norm_val
    is_front_facing = nz > 0.0 if handedness_label == "Left" else nz < 0.0
    return is_front_facing, nz


def classify_gesture(
    world_landmarks,
    image_landmarks,
    handedness_label: str,
    frame_width: int,
    frame_height: int,
) -> Tuple[str, Dict[str, bool]]:
    """Classifies a hand as OPEN_PALM, FIST, BACK_OF_HAND or NONE."""
    ratios = {
        "index": finger_extension_ratio(world_landmarks, INDEX_TIP, INDEX_PIP),
        "middle": finger_extension_ratio(world_landmarks, MIDDLE_TIP, MIDDLE_PIP),
        "ring": finger_extension_ratio(world_landmarks, RING_TIP, RING_PIP),
        "pinky": finger_extension_ratio(world_landmarks, PINKY_TIP, PINKY_PIP),
    }
    details = {name: ratio >= FINGER_EXTENDED_RATIO for name, ratio in ratios.items()}
    thumb_ratio = thumb_extension_ratio(world_landmarks)
    thumb_extended = thumb_ratio >= THUMB_EXTENDED_RATIO
    details["thumb"] = thumb_extended

    is_front_facing, nz = verify_palm_facing_camera(
        image_landmarks, handedness_label, frame_width, frame_height
    )
    is_flat_to_camera = abs(nz) >= PALM_MIN_FACING
    details["palm_facing"] = is_front_facing and is_flat_to_camera

    if all(ratio <= FINGER_FOLDED_RATIO for ratio in ratios.values()) and thumb_ratio <= FIST_THUMB_MAX_RATIO:
        return Gesture.FIST, details

    if all(ratio >= FINGER_EXTENDED_RATIO for ratio in ratios.values()) and thumb_extended and is_flat_to_camera:
        return (Gesture.OPEN_PALM if is_front_facing else Gesture.BACK_OF_HAND), details

    return Gesture.NONE, details


def draw_hud(
    frame: np.ndarray,
    state: str,
    debounce_progress: float,
    countdown_remaining: float,
    cooldown_remaining: float,
    gesture: str,
    finger_details: Dict[str, bool],
    last_saved_path: Optional[str] = None,
) -> None:
    """Renders real-time HUD with color-coded status, progress bar, and countdown."""
    h, w, _ = frame.shape

    # 1. Top HUD Banner
    hud_bg_color = COLOR_DARK_BG
    cv2.rectangle(frame, (16, 16), (460, 195), hud_bg_color, -1)

    # Border color depends on state
    if state == ShutterState.DEBOUNCING or (state == ShutterState.IDLE and gesture == Gesture.OPEN_PALM):
        border_color = COLOR_GREEN
    elif state == ShutterState.COUNTDOWN:
        border_color = COLOR_YELLOW
    elif state == ShutterState.COOLDOWN:
        border_color = COLOR_RED
    else:
        border_color = COLOR_GRAY

    cv2.rectangle(frame, (16, 16), (460, 195), border_color, 2)

    # State Title
    cv2.putText(
        frame,
        f"STATE: {state}",
        (30, 48),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        border_color,
        2,
        cv2.LINE_AA,
    )

    # Finger & Palm Status Indicators
    status_y = 80
    items = [
        ("T", finger_details.get("thumb", False)),
        ("I", finger_details.get("index", False)),
        ("M", finger_details.get("middle", False)),
        ("R", finger_details.get("ring", False)),
        ("P", finger_details.get("pinky", False)),
        ("Face", finger_details.get("palm_facing", False)),
    ]

    x_offset = 30
    for label, ok in items:
        color = COLOR_GREEN if ok else COLOR_GRAY
        text = f"{label}:{'OK' if ok else '--'}"
        cv2.putText(frame, text, (x_offset, status_y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)
        x_offset += 68

    # Progress / Status subtext
    if state == ShutterState.DEBOUNCING:
        pct = int(debounce_progress * 100)
        cv2.putText(
            frame,
            f"Hold Palm: {pct}%",
            (30, 115),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            COLOR_GREEN,
            2,
            cv2.LINE_AA,
        )
        # Visual Progress Bar
        bar_x, bar_y, bar_w, bar_h = 30, 130, 400, 14
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (50, 50, 50), -1)
        fill_w = int(bar_w * debounce_progress)
        if fill_w > 0:
            cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), COLOR_GREEN, -1)
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (180, 180, 180), 1)

    elif state == ShutterState.COUNTDOWN:
        cv2.putText(
            frame,
            f"Shutter in: {countdown_remaining:.1f}s",
            (30, 125),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            COLOR_YELLOW,
            2,
            cv2.LINE_AA,
        )

    elif state == ShutterState.COOLDOWN:
        cv2.putText(
            frame,
            f"COOLDOWN... ({cooldown_remaining:.1f}s)",
            (30, 125),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            COLOR_RED,
            2,
            cv2.LINE_AA,
        )

    else:
        cv2.putText(
            frame,
            "Show open palm (5 fingers) to trigger",
            (30, 125),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            COLOR_WHITE,
            1,
            cv2.LINE_AA,
        )

    # Detected gesture
    cv2.putText(
        frame,
        f"GESTURE: {gesture}",
        (30, 180),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        GESTURE_COLORS[gesture],
        2,
        cv2.LINE_AA,
    )

    # 2. Large Central Countdown Display during COUNTDOWN state
    if state == ShutterState.COUNTDOWN:
        cd_num = str(max(1, int(np.ceil(countdown_remaining))))
        center_x, center_y = w // 2, h // 2

        # Draw dark circle badge
        cv2.circle(frame, (center_x, center_y), 90, (0, 0, 0), -1)
        cv2.circle(frame, (center_x, center_y), 90, COLOR_YELLOW, 4)

        # Centered number
        font_scale = 3.5
        thickness = 7
        (tw, th), _ = cv2.getTextSize(cd_num, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
        text_x = center_x - tw // 2
        text_y = center_y + th // 2
        cv2.putText(frame, cd_num, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, COLOR_YELLOW, thickness, cv2.LINE_AA)

    # 3. Notification of Saved Photo
    if last_saved_path:
        filename = os.path.basename(last_saved_path)
        msg = f"Captured: {filename}"
        cv2.rectangle(frame, (16, h - 55), (w - 16, h - 16), (20, 20, 20), -1)
        cv2.rectangle(frame, (16, h - 55), (w - 16, h - 16), COLOR_GREEN, 1)
        cv2.putText(frame, msg, (30, h - 28), cv2.FONT_HERSHEY_SIMPLEX, 0.55, COLOR_GREEN, 2, cv2.LINE_AA)

    # 4. Exit hint
    cv2.putText(
        frame,
        "Press 'q' to Exit",
        (w - 170, 36),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (200, 200, 200),
        1,
        cv2.LINE_AA,
    )


def save_capture_frame(clean_frame: np.ndarray, output_dir: str = ".") -> str:
    """Saves the clean camera frame as capture_YYYY-MM-DD_HH-MM-SS.jpg (adds _2, _3 on clashes)."""
    os.makedirs(output_dir, exist_ok=True)
    stem = f"capture_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}"
    filepath = os.path.join(output_dir, f"{stem}.jpg")
    suffix = 2
    while os.path.exists(filepath):
        filepath = os.path.join(output_dir, f"{stem}_{suffix}.jpg")
        suffix += 1

    # Save at high JPEG quality
    cv2.imwrite(filepath, clean_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    logger.info(f"📸 Captured photo successfully saved to: {filepath}")
    return filepath


def ensure_model(model_path: str = MODEL_PATH) -> bool:
    """Downloads the HandLandmarker model once. Returns False if it is unavailable."""
    if os.path.exists(model_path):
        return True

    logger.info(f"Downloading hand model to: {model_path}")
    temp_path = f"{model_path}.download"
    try:
        urllib.request.urlretrieve(MODEL_URL, temp_path)
        os.replace(temp_path, model_path)
    except OSError as exc:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        logger.error(
            f"❌ Failed to download hand model: {exc}. "
            f"Check your connection, or download {MODEL_URL} to {model_path} manually."
        )
        return False
    return True


def run_shutter_loop(camera_index: int = 0, output_dir: str = ".") -> None:
    """Main application loop for real-time FivePalm gesture camera shutter."""
    if not ensure_model():
        return

    logger.info("Initializing OpenCV VideoCapture...")
    cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        logger.error(
            f"❌ Failed to open video device at index {camera_index}. "
            "Please check camera connections, permissions, or try a different index."
        )
        return

    # Frame dimension setup (1280x720 preferred)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    logger.info(f"Camera opened successfully: {actual_w}x{actual_h}")

    # MediaPipe HandLandmarker setup
    hands_detector = hand_landmarker.HandLandmarker.create_from_options(
        hand_landmarker.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=VisionTaskRunningMode.VIDEO,
            num_hands=1,
            min_hand_detection_confidence=0.7,
            min_hand_presence_confidence=0.6,
            min_tracking_confidence=0.6,
        )
    )
    last_timestamp_ms = -1
    last_gesture = Gesture.NONE
    recent_gestures: deque = deque(maxlen=GESTURE_SMOOTHING_FRAMES)
    read_failures = 0

    # State variables
    current_state = ShutterState.IDLE
    debounce_start_time: Optional[float] = None
    countdown_start_time: Optional[float] = None
    cooldown_start_time: Optional[float] = None
    flash_start_time: Optional[float] = None
    last_saved_path: Optional[str] = None

    window_name = "FivePalm Gesture Camera Shutter"
    cv2.namedWindow(window_name, cv2.WINDOW_AUTOSIZE)

    logger.info("Ready. Show an open palm facing the camera to start shutter countdown. Press 'q' to exit.")

    try:
        while cap.isOpened():
            ret, raw_frame = cap.read()
            if not ret or raw_frame is None:
                read_failures += 1
                if read_failures >= MAX_CONSECUTIVE_READ_FAILURES:
                    logger.error("❌ Camera stopped sending frames. Is another app using it?")
                    break
                logger.warning("Empty frame received from webcam stream.")
                continue
            read_failures = 0

            now = time.time()

            # Mirror frame horizontally for natural selfie interaction
            frame = cv2.flip(raw_frame, 1)

            # Preserve pristine copy of the clean frame for photo capture (without HUD / skeleton)
            clean_capture_frame = frame.copy()

            # Convert to RGB for MediaPipe inference
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            # VIDEO mode requires strictly increasing timestamps
            last_timestamp_ms = max(last_timestamp_ms + 1, int(time.monotonic() * 1000))
            results = hands_detector.detect_for_video(mp_image, last_timestamp_ms)

            # Analyze hand landmarks
            gesture = Gesture.NONE
            finger_details: Dict[str, bool] = {}
            frame_height, frame_width = frame.shape[:2]

            for idx, hand_landmarks in enumerate(results.hand_landmarks):
                handedness_label = "Right"
                if idx < len(results.handedness) and results.handedness[idx]:
                    handedness_label = results.handedness[idx][0].category_name

                gesture, finger_details = classify_gesture(
                    results.hand_world_landmarks[idx],
                    hand_landmarks,
                    handedness_label,
                    frame_width,
                    frame_height,
                )

                # Draw landmarks on display frame
                drawing_utils.draw_landmarks(
                    frame,
                    hand_landmarks,
                    hand_landmarker.HandLandmarksConnections.HAND_CONNECTIONS,
                    drawing_styles.get_default_hand_landmarks_style(),
                    drawing_styles.get_default_hand_connections_style(),
                )

            recent_gestures.append(gesture)
            gesture = Counter(recent_gestures).most_common(1)[0][0]

            if gesture != last_gesture:
                logger.info(f"Gesture: {gesture}")
                last_gesture = gesture

            gesture_valid = gesture == Gesture.OPEN_PALM

            # --- State Machine Transitions ---
            debounce_progress = 0.0
            countdown_remaining = 0.0
            cooldown_remaining = 0.0

            if current_state == ShutterState.IDLE:
                if gesture_valid:
                    current_state = ShutterState.DEBOUNCING
                    debounce_start_time = now

            elif current_state == ShutterState.DEBOUNCING:
                if not gesture_valid:
                    # Posture dropped: instantly reset stability timer
                    current_state = ShutterState.IDLE
                    debounce_start_time = None
                else:
                    elapsed = now - (debounce_start_time or now)
                    debounce_progress = min(1.0, elapsed / DEBOUNCE_HOLD_SECONDS)
                    if elapsed >= DEBOUNCE_HOLD_SECONDS:
                        # Debounce stability window satisfied -> Trigger countdown
                        current_state = ShutterState.COUNTDOWN
                        countdown_start_time = now
                        logger.info("🎯 Palm held continuously for 0.8s! Starting 3-second countdown.")

            elif current_state == ShutterState.COUNTDOWN:
                elapsed_cd = now - (countdown_start_time or now)
                countdown_remaining = max(0.0, COUNTDOWN_SECONDS - elapsed_cd)

                if elapsed_cd >= COUNTDOWN_SECONDS:
                    # Countdown reached 0 -> Capture Photo!
                    current_state = ShutterState.CAPTURE
                    last_saved_path = save_capture_frame(clean_capture_frame, output_dir)
                    flash_start_time = now
                    current_state = ShutterState.COOLDOWN
                    cooldown_start_time = now
                    logger.info("⏱️ Cooldown lockout active for 3.0s.")

            elif current_state == ShutterState.COOLDOWN:
                elapsed_cooldown = now - (cooldown_start_time or now)
                cooldown_remaining = max(0.0, COOLDOWN_SECONDS - elapsed_cooldown)

                if elapsed_cooldown >= COOLDOWN_SECONDS:
                    current_state = ShutterState.IDLE
                    cooldown_start_time = None
                    debounce_start_time = None
                    logger.info("🔄 Cooldown complete. Ready for next palm gesture.")

            # --- Visual Shutter Flash Effect ---
            if flash_start_time is not None:
                flash_elapsed = now - flash_start_time
                if flash_elapsed < FLASH_DURATION_SECONDS:
                    # Screen flash white
                    alpha = 1.0 - (flash_elapsed / FLASH_DURATION_SECONDS)
                    white_overlay = np.full_like(frame, 255)
                    frame = cv2.addWeighted(white_overlay, alpha * 0.85, frame, 1.0 - (alpha * 0.85), 0)
                else:
                    flash_start_time = None

            # Render HUD overlays
            draw_hud(
                frame,
                current_state,
                debounce_progress,
                countdown_remaining,
                cooldown_remaining,
                gesture,
                finger_details,
                last_saved_path,
            )

            cv2.imshow(window_name, frame)

            # Keyboard controls: 'q' or ESC to exit
            key = cv2.waitKey(1) & 0xFF
            if key in [ord("q"), ord("Q"), 27]:
                logger.info("User requested exit ('q' pressed).")
                break

            # Closing the window with its X button also exits
            if cv2.getWindowProperty(window_name, cv2.WND_PROP_VISIBLE) < 1:
                logger.info("Window closed by user.")
                break

    except KeyboardInterrupt:
        logger.info("Process interrupted by user.")
    finally:
        # Graceful cleanup
        cap.release()
        cv2.destroyAllWindows()
        hands_detector.close()
        logger.info("Camera stream released and OpenCV windows destroyed cleanly.")


def main() -> None:
    """CLI Entry Point."""
    # Photos must stay in captures/, never next to the code, and are never committed (see AGENTS.md)
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "captures")
    run_shutter_loop(camera_index=0, output_dir=output_dir)


if __name__ == "__main__":
    main()

