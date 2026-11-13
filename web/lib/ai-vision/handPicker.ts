// Which detected hand the kiosk should follow.

export interface CaptureArea {
  /** Edges of the capture crop as fractions (0..1) of the full camera frame */
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface HandPickerOptions {
  /**
   * Minimum foreground hand area ratio configured by staff in /admin (default 0.025 = 2.5%).
   * Hands smaller than 45% of this threshold (e.g. distant crowd passers-by walking behind the booth)
   * are strictly ignored so the skeleton never jumps to background people.
   */
  minAreaRatio?: number;
  /**
   * When a user is actively holding OPEN_PALM to trigger the shutter, pass their previous palm (landmark 9)
   * position. A hand that stays near `lockedPalm` and meets `minAreaRatio` gets a hysteresis lock bonus
   * so other people in a group shot cannot hijack the skeleton mid-countdown.
   */
  lockedPalm?: { x: number; y: number } | null;
}

/**
 * Index of the hand to follow, or -1 if none qualifies.
 *
 * Crowd-Proof Multi-Person Algorithm:
 * 1. Soft Boundary Margin: Adds a soft interactive margin (+12% X, +8% Y) around the crop box
 *    so users standing in front of the camera whose hands extend slightly sideways are NOT dropped.
 * 2. Hard Noise Floor: Hands tiny enough to be distant passers-by (< minAreaRatio * 0.45) are rejected
 *    immediately so the skeleton never jumps to people walking in the background when no foreground hand is raised.
 * 3. Foreground Threshold Dominance: Hands that meet `minAreaRatio` (foreground subjects) receive a 3.0x
 *    priority multiplier over sub-threshold hands, plus a smooth center-of-frame weight.
 * 4. Target Lock Hysteresis (Anti-Hijack in Group Shots): While a user is actively holding OPEN_PALM
 *    (`lockedPalm` is set), a hand within 14% screen distance of `lockedPalm` that meets `minAreaRatio`
 *    receives a 1.4x lock bonus so another friend raising their hand in a group photo doesn't reset the hold bar.
 */
export function pickNearestHandInCapture(
  hands: { x: number; y: number }[][],
  area: CaptureArea,
  options?: HandPickerOptions
): number {
  if (!hands || hands.length === 0) return -1;

  const minAreaRatio = options?.minAreaRatio ?? 0.025;
  // Reject tiny background noise hands (< 45% of threshold when options.minAreaRatio is explicitly provided)
  const noiseFloor = options?.minAreaRatio !== undefined ? minAreaRatio * 0.45 : 0.002;
  const lockedPalm = options?.lockedPalm ?? null;

  const SOFT_MARGIN_X = 0.12;
  const SOFT_MARGIN_Y = 0.08;
  const interactiveLeft = Math.max(0.04, area.left - SOFT_MARGIN_X);
  const interactiveRight = Math.min(0.96, area.right + SOFT_MARGIN_X);
  const interactiveTop = Math.max(0.02, area.top - SOFT_MARGIN_Y);
  const interactiveBottom = Math.min(0.98, area.bottom + SOFT_MARGIN_Y);

  const centerX = (area.left + area.right) / 2;
  const centerY = (area.top + area.bottom) / 2;

  let best = -1;
  let bestScore = 0;

  hands.forEach((hand, i) => {
    if (!hand || hand.length < 21) return;
    const palm = hand[9];
    if (!palm) return;

    // 1. Reject hands strictly outside the interactive capture region
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

    // 2. Reject distant background crowd hands below the noise floor
    if (size < noiseFloor) {
      return;
    }

    // Is the palm strictly inside the photo frame crop?
    const isStrictlyInside =
      palm.x >= area.left &&
      palm.x <= area.right &&
      palm.y >= area.top &&
      palm.y <= area.bottom;

    // 3. Base score from bounding-box area
    let score = size;
    if (!isStrictlyInside) {
      score = size >= minAreaRatio ? size * 0.85 : size * 0.3;
    }

    // 4. Foreground threshold dominance: hands that meet the configured distance threshold strongly beat sub-threshold hands
    if (size >= minAreaRatio) {
      score *= 2.5;
    }

    // 5. Gentle center-of-frame preference (up to +15% for hands near the middle of the capture frame)
    const distFromCenter = Math.hypot(palm.x - centerX, palm.y - centerY);
    const centerBonus = Math.max(0.85, 1.15 - distFromCenter * 0.4);
    score *= centerBonus;

    // 6. Target Lock Hysteresis during active palm hold (prevents hand-switching jitter in group shots)
    if (lockedPalm && size >= minAreaRatio * 0.85) {
      const distFromLocked = Math.hypot(palm.x - lockedPalm.x, palm.y - lockedPalm.y);
      if (distFromLocked <= 0.14) {
        score *= 1.45;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });

  return best;
}
