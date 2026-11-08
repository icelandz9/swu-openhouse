import type { LandmarkPoint } from './gestureRules';

/**
 * Meme stickers: a meme gesture makes a GIF pop up beside the cheek, live.
 * Same rules and thresholds as scripts/model-training/gesture_gif_demo.py. Keep the two in sync.
 *
 * All positions here are normalized to the unmirrored video frame (0..1), as MediaPipe
 * returns them. Mirroring for the screen and the photo happens where they are drawn.
 */

export type MemeName = 'SCOOBA' | 'SCARE';

/** GIFs are served from public/memes/ (the same files as scripts/model-training/gifs/). */
export const MEME_FILES: Record<MemeName, string> = {
  SCOOBA: '/memes/scooba.gif',
  SCARE: '/memes/scare.gif',
};

// Scooba: thumb and index fingertips pinched together on the nose, in face widths
export const PINCH_MAX_DISTANCE = 0.6;
export const NOSE_MAX_DISTANCE = 0.8;
// Wide eyes: average of MediaPipe's eyeWideLeft and eyeWideRight (0 to 1)
export const EYES_WIDE_ON = 0.02;
export const EYES_WIDE_OFF = 0.01; // Lower than ON, so a score near the line doesn't flicker
export const EYES_WIDE_MIN_MS = 200; // Longer than a quick flutter of the eyelids
// Sticker
export const MEME_LINGER_MS = 0; // Gone as soon as the gesture ends
export const FACE_MEMORY_MS = 1500; // A hand can hide the face; its last place is used this long
export const MEME_FACE_SCALE = 1.3; // Meme height, relative to the face height
export const MEME_GAP_RATIO = 0.08; // Gap between face and meme, relative to the face width
export const MEME_MIN_FACE_RATIO = 0.6; // Never narrower; overlaps the face when there is no room

// Face landmark indices (MediaPipe Face Mesh)
const NOSE_TIP = 1;
const FACE_LEFT_EDGE = 234;
const FACE_RIGHT_EDGE = 454;
// Hand landmark indices
const THUMB_TIP = 4;
const INDEX_TIP = 8;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceInfo {
  box: Box;
  nose: { x: number; y: number };
  /** Ear-to-ear width in video pixels */
  widthPx: number;
}

export function readFace(landmarks: LandmarkPoint[], videoWidth: number, videoHeight: number): FaceInfo {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of landmarks) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  const left = landmarks[FACE_LEFT_EDGE];
  const right = landmarks[FACE_RIGHT_EDGE];
  return {
    box: { x0, y0, x1, y1 },
    nose: { x: landmarks[NOSE_TIP].x, y: landmarks[NOSE_TIP].y },
    widthPx: Math.hypot((left.x - right.x) * videoWidth, (left.y - right.y) * videoHeight),
  };
}

/** True when any hand pinches the nose with its thumb and index fingertips. */
export function isNosePinched(
  hands: LandmarkPoint[][],
  face: FaceInfo | null,
  videoWidth: number,
  videoHeight: number
): boolean {
  if (!face || face.widthPx <= 0) return false;
  const nose = { x: face.nose.x * videoWidth, y: face.nose.y * videoHeight };
  return hands.some((hand) => {
    if (!hand || hand.length < 21) return false;
    const thumb = { x: hand[THUMB_TIP].x * videoWidth, y: hand[THUMB_TIP].y * videoHeight };
    const finger = { x: hand[INDEX_TIP].x * videoWidth, y: hand[INDEX_TIP].y * videoHeight };
    if (Math.hypot(thumb.x - finger.x, thumb.y - finger.y) > PINCH_MAX_DISTANCE * face.widthPx) return false;
    const pinch = { x: (thumb.x + finger.x) / 2, y: (thumb.y + finger.y) / 2 };
    return Math.hypot(pinch.x - nose.x, pinch.y - nose.y) <= NOSE_MAX_DISTANCE * face.widthPx;
  });
}

/** Average wide-eyes score of a face's blendshapes, or null without them. */
export function eyesWideScore(categories?: { categoryName: string; score: number }[]): number | null {
  if (!categories?.length) return null;
  const score = (name: string) => categories.find((c) => c.categoryName === name)?.score;
  const left = score('eyeWideLeft');
  const right = score('eyeWideRight');
  return left === undefined || right === undefined ? null : (left + right) / 2;
}

/** Eyes held wide for a moment, with hysteresis. */
export class EyesWideTracker {
  private wideSince: number | null = null;

  update(score: number | null, nowMs: number): boolean {
    if (score === null || score < EYES_WIDE_OFF) {
      this.wideSince = null;
    } else if (score >= EYES_WIDE_ON && this.wideSince === null) {
      this.wideSince = nowMs;
    }
    return this.wideSince !== null && nowMs - this.wideSince >= EYES_WIDE_MIN_MS;
  }
}

/** Which meme shows: a new one at once, gone MEME_LINGER_MS after the gesture was last seen. */
export class MemeTracker {
  active: MemeName | null = null;
  startedAt = 0;
  private seenAt = -Infinity;

  update(detected: MemeName | null, nowMs: number): MemeName | null {
    if (detected) {
      if (detected !== this.active) {
        this.active = detected;
        this.startedAt = nowMs;
      }
      this.seenAt = nowMs;
    } else if (this.active && nowMs - this.seenAt > MEME_LINGER_MS) {
      this.active = null;
    }
    return this.active;
  }
}

/**
 * Puts the meme next to the cheek, on the side with more room, scaled to the face,
 * kept inside `zone` (the part of the frame that ends up in the photo).
 * Works in pixel-proportional units, so the GIF keeps its shape.
 */
export function placeBesideFace(face: Box, zone: Box, memeAspect: number, videoAspect: number): Rect {
  const X = (x: number) => x * videoAspect;
  const [fx0, fx1, zx0, zx1] = [X(face.x0), X(face.x1), X(zone.x0), X(zone.x1)];
  const faceWidth = fx1 - fx0;
  const faceHeight = face.y1 - face.y0;
  const zoneWidth = zx1 - zx0;
  const zoneHeight = zone.y1 - zone.y0;

  let height = faceHeight * MEME_FACE_SCALE;
  let width = height * memeAspect;
  const gap = faceWidth * MEME_GAP_RATIO;
  const roomRight = zx1 - fx1 - gap;
  const roomLeft = fx0 - gap - zx0;
  const onRight = roomRight >= roomLeft;
  const room = onRight ? roomRight : roomLeft;
  if (width > room) {
    const scale = Math.max(room, faceWidth * MEME_MIN_FACE_RATIO) / width;
    width *= scale;
    height *= scale;
  }
  width = Math.min(width, zoneWidth);
  height = Math.min(height, zoneHeight);

  let x = onRight ? fx1 + gap : fx0 - gap - width;
  let y = (face.y0 + face.y1) / 2 - height / 2; // Centered on the cheek
  x = Math.min(Math.max(x, zx0), zx1 - width);
  y = Math.min(Math.max(y, zone.y0), zone.y1 - height);
  return { x: x / videoAspect, y, w: width / videoAspect, h: height };
}
