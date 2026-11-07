"""Collect 21-point hand landmarks (63 values) for OPEN_PALM, FIST and NONE into a CSV.

Task AI-01 (Dev 1: AI & Computer Vision Engineer)
- Opens the webcam with OpenCV and runs the MediaPipe HandLandmarker
- Normalises every point against the wrist (landmark 0), scaled by wrist -> Middle MCP (9)
- Press a key to label the current frame and append it to data/gestures.csv

Controls (hold a key to record many frames):
  o = OPEN_PALM    f = FIST    n = NONE    q / Esc = quit
"""

from __future__ import annotations

from collections import Counter
import csv
import math
import os
import sys
import time
from typing import List, Sequence, Tuple

try:
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python.core.base_options import BaseOptions
    from mediapipe.tasks.python.vision import drawing_styles, drawing_utils, hand_landmarker
    from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode
except ImportError:
    print(
        "Missing dependencies! Please run:\n"
        "  pip install -r scripts/model-training/requirements.txt\n"
    )
    sys.exit(1)

from fivepalm_shutter import MODEL_PATH, ensure_model

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "data", "gestures.csv")

LABEL_KEYS = {ord("o"): "OPEN_PALM", ord("f"): "FIST", ord("n"): "NONE"}
CSV_COLUMNS = ["label"] + [f"{axis}{i}" for i in range(21) for axis in ("x", "y", "z")]
MAX_CONSECUTIVE_READ_FAILURES = 30
WINDOW_NAME = "Gesture Dataset Collector"


def normalize_landmarks(points: Sequence[Tuple[float, float, float]]) -> List[float]:
    """Returns 63 values relative to the wrist, scaled by wrist -> Middle MCP distance."""
    base_x, base_y, base_z = points[0]
    relative = [(x - base_x, y - base_y, z - base_z) for x, y, z in points]

    scale = math.sqrt(sum(value * value for value in relative[9]))
    if scale < 1e-6:
        scale = 1.0

    return [round(value / scale, 6) for point in relative for value in point]


def load_label_counts(csv_path: str) -> Counter:
    """Counts the samples already saved, so a new session continues from them."""
    if not os.path.exists(csv_path):
        return Counter()
    with open(csv_path, newline="", encoding="utf-8") as f:
        return Counter(row["label"] for row in csv.DictReader(f))


def append_sample(csv_path: str, label: str, features: Sequence[float]) -> None:
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    is_new_file = not os.path.exists(csv_path)
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if is_new_file:
            writer.writerow(CSV_COLUMNS)
        writer.writerow([label, *features])


def draw_status(frame, counts: Counter, hand_found: bool) -> None:
    cv2.rectangle(frame, (16, 16), (560, 104), (20, 20, 20), -1)
    summary = "  ".join(f"{label}:{counts[label]}" for label in LABEL_KEYS.values())
    cv2.putText(frame, summary, (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)

    hint = "o=OPEN_PALM  f=FIST  n=NONE  q=quit" if hand_found else "No hand detected - nothing to record"
    color = (0, 255, 120) if hand_found else (60, 60, 255)
    cv2.putText(frame, hint, (30, 86), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA)


def main(camera_index: int = 0, csv_path: str = CSV_PATH) -> None:
    if not ensure_model():
        return

    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        print(f"❌ Error: Could not open camera at index {camera_index}.")
        return
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    detector = hand_landmarker.HandLandmarker.create_from_options(
        hand_landmarker.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=VisionTaskRunningMode.VIDEO,
            num_hands=1,
            min_hand_detection_confidence=0.7,
            min_hand_presence_confidence=0.6,
            min_tracking_confidence=0.6,
        )
    )

    counts = load_label_counts(csv_path)
    last_timestamp_ms = -1
    read_failures = 0
    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_AUTOSIZE)

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                read_failures += 1
                if read_failures >= MAX_CONSECUTIVE_READ_FAILURES:
                    print("❌ Error: Camera stopped sending frames. Is another app using it?")
                    break
                continue
            read_failures = 0

            # Detect on the unmirrored frame, as the kiosk does; only the preview is mirrored.
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            last_timestamp_ms = max(last_timestamp_ms + 1, int(time.monotonic() * 1000))
            result = detector.detect_for_video(mp_image, last_timestamp_ms)

            hand = result.hand_landmarks[0] if result.hand_landmarks else None
            if hand is not None:
                drawing_utils.draw_landmarks(
                    frame,
                    hand,
                    hand_landmarker.HandLandmarksConnections.HAND_CONNECTIONS,
                    drawing_styles.get_default_hand_landmarks_style(),
                    drawing_styles.get_default_hand_connections_style(),
                )

            preview = cv2.flip(frame, 1)
            draw_status(preview, counts, hand is not None)
            cv2.imshow(WINDOW_NAME, preview)

            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
            if cv2.getWindowProperty(WINDOW_NAME, cv2.WND_PROP_VISIBLE) < 1:
                break
            if key in LABEL_KEYS and hand is not None:
                label = LABEL_KEYS[key]
                append_sample(csv_path, label, normalize_landmarks([(p.x, p.y, p.z) for p in hand]))
                counts[label] += 1
    finally:
        cap.release()
        cv2.destroyAllWindows()
        detector.close()

    print(f"✅ Saved samples to: {csv_path}")
    print(f"   Totals: {dict(counts)}")


if __name__ == "__main__":
    main()
