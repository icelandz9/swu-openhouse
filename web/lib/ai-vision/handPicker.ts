// Which detected hand the kiosk should follow.

export interface CaptureArea {
  /** Edges of the capture crop as fractions (0..1) of the full camera frame */
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Index of the hand to follow, or -1 if none qualifies.
 * A hand counts only if its palm centre (landmark 9) is inside the capture area, i.e. inside the part
 * of the camera the kiosk screen marks as the photo. Among those, the one with the biggest bounding box
 * wins: on a single camera the biggest hand is the one nearest to it.
 */
export function pickNearestHandInCapture(hands: { x: number; y: number }[][], area: CaptureArea): number {
  let best = -1;
  let bestArea = 0;
  hands.forEach((hand, i) => {
    if (!hand || hand.length < 21) return;
    const palm = hand[9];
    if (palm.x < area.left || palm.x > area.right || palm.y < area.top || palm.y > area.bottom) return;
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    for (const p of hand) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const size = (maxX - minX) * (maxY - minY);
    if (size > bestArea) {
      bestArea = size;
      best = i;
    }
  });
  return best;
}
