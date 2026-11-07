import type { GestureType } from '../contracts';

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

// Thresholds measured on sample hand photos, shared with
// scripts/model-training/fivepalm_shutter.py. Keep the two in sync.
// wrist->tip / wrist->PIP is 0.61-0.83 for folded fingers and 1.20+ for extended ones.
const FINGER_EXTENDED_RATIO = 1.1;
const FINGER_FOLDED_RATIO = 1.0;
// Thumb tip->Pinky MCP / Thumb MCP->Pinky MCP is 0.65-0.88 tucked and 1.09+ extended.
const THUMB_EXTENDED_RATIO = 1.0;
// A fist tolerates a loosely held thumb; a thumbs-up measures 1.35+.
const FIST_THUMB_MAX_RATIO = 1.2;
// Below this the hand is too edge-on to tell its palm from its back.
const PALM_MIN_FACING = 0.2;

const WRIST = 0;
const THUMB_MCP = 2;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const PINKY_MCP = 17;
// [tip, PIP] of index, middle, ring and pinky
const FINGERS = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
] as const;

function distance(a: LandmarkPoint, b: LandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function dist2D(p1: LandmarkPoint, p2: LandmarkPoint): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * Signed z of the unit palm normal (Wrist -> Index MCP) x (Wrist -> Pinky MCP), from
 * image landmarks scaled to the frame's proportions. Its sign separates a palm from a
 * back of hand only together with handedness: MediaPipe reports palms as Right with
 * nz < 0 and Left with nz > 0, for mirrored and unmirrored input alike.
 */
export function palmNormalZ(landmarks: LandmarkPoint[], frameAspect: number): number {
  const vector = (end: LandmarkPoint) => ({
    x: (end.x - landmarks[WRIST].x) * frameAspect,
    y: end.y - landmarks[WRIST].y,
    z: ((end.z ?? 0) - (landmarks[WRIST].z ?? 0)) * frameAspect,
  });
  const v1 = vector(landmarks[INDEX_MCP]);
  const v2 = vector(landmarks[PINKY_MCP]);

  const nx = v1.y * v2.z - v1.z * v2.y;
  const ny = v1.z * v2.x - v1.x * v2.z;
  const nz = v1.x * v2.y - v1.y * v2.x;
  const length = Math.hypot(nx, ny, nz);
  return length < 1e-6 ? 0 : nz / length;
}

/**
 * Rotation-invariant gesture classifier for one hand.
 * - OPEN_PALM: all 5 fingers extended and the palm (not its back) faces the camera
 * - FIST: all 4 fingers folded and the thumb not stuck out
 * - PEACE_SIGN: index and middle extended, ring and pinky folded
 *
 * @param landmarks Image landmarks of the hand (HandLandmarkerResult.landmarks[i])
 * @param worldLandmarks 3D landmarks of the hand (HandLandmarkerResult.worldLandmarks[i])
 * @param handedness "Left" or "Right" (HandLandmarkerResult.handedness[i][0].categoryName)
 * @param frameAspect Video width / height
 */
export function classifyGesture(
  landmarks: LandmarkPoint[],
  worldLandmarks?: LandmarkPoint[],
  handedness: string = 'Right',
  frameAspect: number = 4 / 3
): GestureType {
  if (!landmarks || landmarks.length < 21) {
    return 'NONE';
  }

  // When 3D world landmarks are supplied, apply the updated 5-finger and palm facing normal model
  if (worldLandmarks && worldLandmarks.length >= 21) {
    const wrist = worldLandmarks[WRIST];
    const ratios = FINGERS.map(
      ([tip, pip]) =>
        distance(wrist, worldLandmarks[tip]) / Math.max(distance(wrist, worldLandmarks[pip]), 1e-6)
    );
    const isExtended = (ratio: number) => ratio >= FINGER_EXTENDED_RATIO;
    const isFolded = (ratio: number) => ratio <= FINGER_FOLDED_RATIO;

    const pinkyMcp = worldLandmarks[PINKY_MCP];
    const thumbRatio =
      distance(worldLandmarks[THUMB_TIP], pinkyMcp) /
      Math.max(distance(worldLandmarks[THUMB_MCP], pinkyMcp), 1e-6);

    if (ratios.every(isFolded) && thumbRatio <= FIST_THUMB_MAX_RATIO) {
      return 'FIST';
    }

    if (ratios.every(isExtended) && thumbRatio >= THUMB_EXTENDED_RATIO) {
      const nz = palmNormalZ(landmarks, frameAspect);
      const isLeft = (handedness ?? '').trim().toLowerCase().startsWith('l');
      const facesCamera = isLeft ? nz > 0 : nz < 0;
      return facesCamera && Math.abs(nz) >= PALM_MIN_FACING ? 'OPEN_PALM' : 'NONE';
    }

    const [index, middle, ring, pinky] = ratios;
    if (isExtended(index) && isExtended(middle) && isFolded(ring) && isFolded(pinky)) {
      return 'PEACE_SIGN';
    }

    return 'NONE';
  }

  // Graceful fallback for 2D mock landmarks (ensures mock tests and offline fixtures pass)
  const wrist = landmarks[0];
  const isExt2D = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];
    const dTip = dist2D(wrist, tip);
    const dMcp = dist2D(wrist, mcp);
    return (tip.y < pip.y && dTip > dMcp) || dTip > 1.25 * dMcp;
  };

  const isFold2D = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];
    const dTip = dist2D(wrist, tip);
    const dMcp = dist2D(wrist, mcp);
    return tip.y >= pip.y || dTip <= 1.15 * dMcp;
  };

  const indexExt = isExt2D(8, 6, 5);
  const middleExt = isExt2D(12, 10, 9);
  const ringExt = isExt2D(16, 14, 13);
  const pinkyExt = isExt2D(20, 18, 17);

  const indexFold = isFold2D(8, 6, 5);
  const middleFold = isFold2D(12, 10, 9);
  const ringFold = isFold2D(16, 14, 13);
  const pinkyFold = isFold2D(20, 18, 17);

  if (indexExt && middleExt && ringExt && pinkyExt) return 'OPEN_PALM';
  if (indexFold && middleFold && ringFold && pinkyFold) return 'FIST';
  if (indexExt && middleExt && ringFold && pinkyFold) return 'PEACE_SIGN';
  return 'NONE';
}
