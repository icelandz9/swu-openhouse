import { GestureType } from '../contracts';

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Pure mathematical heuristic to detect Open Palm from 21 MediaPipe landmarks
 * Index, Middle, Ring, Pinky tips extended above PIP joints
 */
export function classifyGesture(landmarks: LandmarkPoint[]): GestureType {
  if (!landmarks || landmarks.length < 21) {
    return 'NONE';
  }

  // Fingertip vs PIP landmark indices:
  // Thumb: 4 vs 3 (or 2)
  // Index: 8 vs 6
  // Middle: 12 vs 10
  // Ring: 16 vs 14
  // Pinky: 20 vs 18
  const isIndexExtended = landmarks[8].y < landmarks[6].y;
  const isMiddleExtended = landmarks[12].y < landmarks[10].y;
  const isRingExtended = landmarks[16].y < landmarks[14].y;
  const isPinkyExtended = landmarks[20].y < landmarks[18].y;

  // Open Palm: all 4 main fingers extended
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
    return 'OPEN_PALM';
  }

  // Extra gestures (Peace, Mini Heart) are future scope — see docs/decisions.md
  return 'NONE';
}
