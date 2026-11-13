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
 *
 * Algorithm improvements:
 * 1. Soft Boundary Margin: Adds a soft interactive margin (+12% X, +8% Y) around the crop box
 *    so users standing in front of the camera whose hands extend slightly sideways are NOT dropped.
 * 2. Foreground Dominance: A large hand in the foreground (nearest the camera) is given priority
 *    over tiny background passers-by, preventing distant hands from hijacking the booth.
 * 3. Far-edge rejection: Hands outside the interactive zone (< 4% or > 96% frame width) are rejected.
 */
export function pickNearestHandInCapture(
  hands: { x: number; y: number }[][],
  area: CaptureArea
): number {
  if (!hands || hands.length === 0) return -1;

  const SOFT_MARGIN_X = 0.12;
  const SOFT_MARGIN_Y = 0.08;
  const interactiveLeft = Math.max(0.04, area.left - SOFT_MARGIN_X);
  const interactiveRight = Math.min(0.96, area.right + SOFT_MARGIN_X);
  const interactiveTop = Math.max(0.02, area.top - SOFT_MARGIN_Y);
  const interactiveBottom = Math.min(0.98, area.bottom + SOFT_MARGIN_Y);

  let best = -1;
  let bestScore = 0;

  hands.forEach((hand, i) => {
    if (!hand || hand.length < 21) return;
    const palm = hand[9];
    if (!palm) return;

    // Reject hands strictly outside the interactive capture region
    if (
      palm.x < interactiveLeft ||
      palm.x > interactiveRight ||
      palm.y < interactiveTop ||
      palm.y > interactiveBottom
    ) {
      return;
    }

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
    const size = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);

    // Is the palm strictly inside the photo frame crop?
    const isStrictlyInside =
      palm.x >= area.left &&
      palm.x <= area.right &&
      palm.y >= area.top &&
      palm.y <= area.bottom;

    // Weighting:
    // Core crop hands get full score (1.0).
    // Hands in the soft boundary margin get 0.85 if they are a large foreground hand (size >= 0.03),
    // or 0.35 if they are small distant background hands.
    let score = size;
    if (!isStrictlyInside) {
      score = size >= 0.03 ? size * 0.85 : size * 0.35;
    }

    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });

  return best;
}
