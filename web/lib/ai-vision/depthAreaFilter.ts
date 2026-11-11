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
 * Filter hand bounding box area to reject background people walking past.
 * Calibrated distance guidelines:
 * - Close distance (< 1.2m): occupies ~4.0% - 7.0%+
 * - Standard distance (1.2m - 1.8m): occupies ~2.2% - 3.5%
 * - Long / Group distance (1.8m - 3.0m): occupies ~1.0% - 2.0%
 * Default threshold set to 0.025 (2.5%) for responsive detection up to ~2m.
 */
export function isHandInForeground(
  landmarks: LandmarkPoint[],
  minAreaRatio: number = 0.025
): boolean {
  const area = calculateHandAreaRatio(landmarks);
  return area >= minAreaRatio;
}
