import { LandmarkPoint } from './gestureRules';

/**
 * Calculate the bounding box area of hand landmarks relative to frame area [0..1]
 */
export function calculateHandAreaRatio(landmarks: LandmarkPoint[]): number {
  if (!landmarks || landmarks.length < 21) return 0;

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const pt of landmarks) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  return width * height;
}

/**
 * Hard ceiling for hand detection distance: 1.5 meters (~2.5% bounding-box area).
 * Staff tuners cannot go below 0.025 so background attendees walking >1.5m behind never trigger the booth.
 */
export const MIN_FOREGROUND_AREA_RATIO = 0.025;
export const MAX_FOREGROUND_AREA_RATIO = 0.08;

export function clampForegroundThreshold(value: number): number {
  if (!Number.isFinite(value)) return MIN_FOREGROUND_AREA_RATIO;
  return Math.max(MIN_FOREGROUND_AREA_RATIO, Math.min(MAX_FOREGROUND_AREA_RATIO, value));
}

/**
 * Filter hand bounding box area to reject background people walking past.
 * Calibrated distance guidelines (locked to <= 1.5m):
 * - Close distance (< 0.8m): occupies ~4.0% - 7.0%+
 * - Mid distance (0.8m - 1.2m): occupies ~3.0% - 4.0%
 * - Max range (1.5m): occupies ~2.5%
 * Default threshold set to 0.025 (2.5%) for reliable detection up to 1.5m max.
 */
export function isHandInForeground(
  landmarks: LandmarkPoint[],
  minAreaRatio: number = MIN_FOREGROUND_AREA_RATIO
): boolean {
  const effectiveMin = clampForegroundThreshold(minAreaRatio);
  const area = calculateHandAreaRatio(landmarks);
  return area >= effectiveMin;
}
