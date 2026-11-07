import { GestureType } from '../contracts';

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Pure mathematical heuristic to detect gestures from 21 MediaPipe landmarks
 * - OPEN_PALM: Index, Middle, Ring, Pinky tips extended above PIP joints
 * - FIST: All 4 finger tips folded below MCP / PIP joints
 * - PEACE_SIGN: Index and Middle extended, Ring and Pinky folded
 */
export function classifyGesture(landmarks: LandmarkPoint[]): GestureType {
  if (!landmarks || landmarks.length < 21) {
    return 'NONE';
  }

  // Fingertip vs PIP landmark indices:
  // Index: tip 8 vs PIP 6
  // Middle: tip 12 vs PIP 10
  // Ring: tip 16 vs PIP 14
  // Pinky: tip 20 vs PIP 18
  const isIndexExtended = landmarks[8].y < landmarks[6].y;
  const isMiddleExtended = landmarks[12].y < landmarks[10].y;
  const isRingExtended = landmarks[16].y < landmarks[14].y;
  const isPinkyExtended = landmarks[20].y < landmarks[18].y;

  // Open Palm: all 4 main fingers extended
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
    return 'OPEN_PALM';
  }

  // Fist: all 4 main fingers folded
  const isIndexFolded = landmarks[8].y > landmarks[6].y;
  const isMiddleFolded = landmarks[12].y > landmarks[10].y;
  const isRingFolded = landmarks[16].y > landmarks[14].y;
  const isPinkyFolded = landmarks[20].y > landmarks[18].y;

  if (isIndexFolded && isMiddleFolded && isRingFolded && isPinkyFolded) {
    return 'FIST';
  }

  // Peace sign: Index and Middle extended, Ring and Pinky folded
  if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    return 'PEACE_SIGN';
  }

  return 'NONE';
}
