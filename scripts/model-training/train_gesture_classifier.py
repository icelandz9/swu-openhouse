"""Train a small gesture classifier (MLP / Random Forest) from data/gestures.csv.

Task AI-01 (Dev 1: AI & Computer Vision Engineer)
- Loads 21-point hand landmark features (63 normalized values)
- Splits train/test (80/20 stratified)
- Trains MLP / Random Forest classifier
- Evaluates per-class Precision, Recall, F1, and Overall Accuracy
- Verifies target accuracy >= 95%, overall and for OPEN_PALM
- Saves the trained model to gesture_classifier.joblib for weight export
"""

from __future__ import annotations

import os
import sys

try:
    import joblib
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import classification_report, confusion_matrix
    from sklearn.model_selection import train_test_split
    from sklearn.neural_network import MLPClassifier
except ImportError:
    print(
        "Missing dependencies! Please run:\n"
        "  pip install scikit-learn pandas numpy joblib\n"
    )
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
CSV_PATH = os.path.join(DATA_DIR, "gestures.csv")
MODEL_OUTPUT_PATH = os.path.join(SCRIPT_DIR, "gesture_classifier.joblib")

LABELS = ["OPEN_PALM", "FIST", "NONE"]
MIN_SAMPLES_PER_CLASS = 5
TARGET_ACCURACY = 95.0


def main() -> None:
    print("=" * 60)
    print("🧠 SWU Open House — Gesture Classifier Trainer (Dev 1)")
    print("=" * 60)

    if not os.path.exists(CSV_PATH):
        print(f"❌ Error: Dataset not found at {CSV_PATH}")
        print("Please run `dataset_collector.py` first to collect training samples.")
        return

    # Load data
    df = pd.read_csv(CSV_PATH)
    print(f"📄 Loaded dataset with {len(df)} samples.")
    print("Class distribution:")
    print(df["label"].value_counts())

    counts = df["label"].value_counts()
    too_few = [lbl for lbl in LABELS if counts.get(lbl, 0) < MIN_SAMPLES_PER_CLASS]
    if too_few:
        print(f"❌ Error: Each of {too_few} needs at least {MIN_SAMPLES_PER_CLASS} samples.")
        print("Please run `dataset_collector.py` to collect more.")
        return

    # Prepare features and labels
    feature_cols = [c for c in df.columns if c != "label"]
    if len(feature_cols) != 63:
        print(f"❌ Error: Expected 63 feature columns, found {len(feature_cols)}")
        return

    X = df[feature_cols].values
    y = df["label"].values

    # Train / Test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"\nTrain set: {len(X_train)} samples | Test set: {len(X_test)} samples")

    # Train MLP Classifier (Neural Network suited for web weight export)
    print("\nTraining MLP Classifier (64x32 hidden units)...")
    clf = MLPClassifier(
        hidden_layer_sizes=(64, 32),
        activation="relu",
        max_iter=500,
        random_state=42,
        early_stopping=True,
    )
    clf.fit(X_train, y_train)

    # Evaluate
    train_acc = clf.score(X_train, y_train) * 100
    test_acc = clf.score(X_test, y_test) * 100

    print(f"\n📈 Results:")
    print(f"  - Training Accuracy: {train_acc:.2f}%")
    print(f"  - Test Accuracy    : {test_acc:.2f}%")

    y_pred = clf.predict(X_test)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))

    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # Check Acceptance Criteria (Accuracy >= 95%, overall and for OPEN_PALM)
    report = classification_report(y_test, y_pred, zero_division=0, output_dict=True)
    palm_recall = report["OPEN_PALM"]["recall"] * 100
    print(f"\n  - OPEN_PALM Recall : {palm_recall:.2f}%")
    if test_acc >= TARGET_ACCURACY and palm_recall >= TARGET_ACCURACY:
        print("\n✅ PASSED Acceptance Criteria: Accuracy and OPEN_PALM recall >= 95%!")
    else:
        print("\nℹ️ Below the 95% target. Collect more diverse hand samples.")

    # Save trained model
    joblib.dump(clf, MODEL_OUTPUT_PATH)
    print(f"\n💾 Model successfully saved to: {MODEL_OUTPUT_PATH}")
    print("Next step: Run `export_model_weights.py` to convert to JSON for web kiosk.")


if __name__ == "__main__":
    main()
