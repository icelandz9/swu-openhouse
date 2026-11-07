"""Export trained weights to JSON so the web kiosk can load them.

Task AI-01 (Dev 1: AI & Computer Vision Engineer)
- Loads `gesture_classifier.joblib`
- Extracts weight matrices and intercepts from MLP
- Writes output to `web/public/models/gesture_weights.json`
- Provides sample client-side forward pass logic
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import sys

try:
    import joblib
    import numpy as np
except ImportError:
    print(
        "Missing dependencies! Please run:\n"
        "  pip install joblib numpy\n"
    )
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
MODEL_INPUT_PATH = os.path.join(SCRIPT_DIR, "gesture_classifier.joblib")
WEB_MODELS_DIR = os.path.join(PROJECT_ROOT, "web", "public", "models")
OUTPUT_JSON_PATH = os.path.join(WEB_MODELS_DIR, "gesture_weights.json")


def main() -> None:
    print("=" * 60)
    print("📦 SWU Open House — Model Weights Exporter (Dev 1)")
    print("=" * 60)

    if not os.path.exists(MODEL_INPUT_PATH):
        print(f"❌ Error: Trained model not found at {MODEL_INPUT_PATH}")
        print("Please run `train_gesture_classifier.py` first.")
        return

    clf = joblib.load(MODEL_INPUT_PATH)
    print(f"✓ Loaded model: {type(clf).__name__}")

    if not hasattr(clf, "coefs_") or not hasattr(clf, "intercepts_"):
        print("❌ Error: Loaded model is not an MLPClassifier with coefs_ and intercepts_.")
        return

    # Extract weights and biases
    layers = []
    for idx, (w, b) in enumerate(zip(clf.coefs_, clf.intercepts_)):
        layers.append({
            "layerIndex": idx,
            "weights": np.round(w, 6).tolist(),
            "biases": np.round(b, 6).tolist(),
            "inputDim": int(w.shape[0]),
            "outputDim": int(w.shape[1]),
        })

    classes = [str(c) for c in clf.classes_]

    payload = {
        "modelType": "MLPClassifier",
        "exportedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "classes": classes,
        "inputDimension": 63,
        "layers": layers,
        "activation": clf.activation,
        "outputActivation": clf.out_activation_,
    }

    os.makedirs(WEB_MODELS_DIR, exist_ok=True)
    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"✅ Exported {len(layers)} layers to: {OUTPUT_JSON_PATH}")
    print(f"   Classes: {classes}")
    print(f"   File size: {os.path.getsize(OUTPUT_JSON_PATH) / 1024:.2f} KB")


if __name__ == "__main__":
    main()
