import { LandmarkPoint } from './gestureRules';

/**
 * Filter hand bounding box area to reject background people walking past
 * Hands of visitors standing in front of the kiosk should occupy >= 3.5% of frame area
 */
export function isHandInForeground(
  landmarks: LandmarkPoint[],
  minAreaRatio: number = 0.035
): boolean {
  if (!landmarks || landmarks.length < 21) return false;

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
  const areaRatio = width * height;

  return areaRatio >= minAreaRatio;
}
