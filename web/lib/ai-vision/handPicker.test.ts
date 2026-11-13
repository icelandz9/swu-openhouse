// Run: npx tsx lib/ai-vision/handPicker.test.ts
import assert from 'node:assert/strict';
import { pickNearestHandInCapture, type CaptureArea } from './handPicker';

// A 21-point hand: a square of side `size` centred on (cx, cy); landmark 9 is the centre.
function hand(cx: number, cy: number, size: number) {
  const pts = Array.from({ length: 21 }, (_, i) => ({
    x: cx + (i % 2 === 0 ? -size / 2 : size / 2),
    y: cy + (i % 4 < 2 ? -size / 2 : size / 2),
  }));
  pts[9] = { x: cx, y: cy };
  return pts;
}

// Frame mode on a 1920x1080 camera: crop 986 px wide, centred -> x 0.243..0.757
const frame: CaptureArea = { left: 467 / 1920, right: (467 + 986) / 1920, top: 0, bottom: 1 };

// 1. Hand outside the capture area is ignored
assert.equal(pickNearestHandInCapture([hand(0.1, 0.5, 0.2)], frame), -1, 'hand at the left edge must be ignored');
// 2. Hand inside is picked
assert.equal(pickNearestHandInCapture([hand(0.5, 0.5, 0.1)], frame), 0);
// 3. Two hands inside: the bigger (nearer) one wins, whatever the order
assert.equal(pickNearestHandInCapture([hand(0.4, 0.5, 0.08), hand(0.6, 0.5, 0.15)], frame), 1);
assert.equal(pickNearestHandInCapture([hand(0.6, 0.5, 0.15), hand(0.4, 0.5, 0.08)], frame), 0);
// 4. A big hand outside loses to a small hand inside
assert.equal(pickNearestHandInCapture([hand(0.9, 0.5, 0.4), hand(0.5, 0.5, 0.05)], frame), 1);
// 5. A near foreground user standing slightly on the border (x=0.20) beats a tiny distant passer-by (x=0.5, size 0.08)
assert.equal(pickNearestHandInCapture([hand(0.20, 0.5, 0.2), hand(0.5, 0.5, 0.08)], frame), 0, 'near user on border beats smaller hand');
// 6. Incomplete hands are skipped
assert.equal(pickNearestHandInCapture([[{ x: 0.5, y: 0.5 }]], frame), -1);
// 7. Crowd noise floor: when minAreaRatio is set to 0.04 (4.0% close mode), distant background hands (area = 0.08^2 = 0.0064 < 0.018) are completely rejected
assert.equal(
  pickNearestHandInCapture([hand(0.5, 0.5, 0.08), hand(0.4, 0.5, 0.09)], frame, { minAreaRatio: 0.04 }),
  -1,
  'background crowd hands smaller than noise floor must be rejected in 4.0% mode'
);
// 8. Target Lock Hysteresis: while user 0 (size 0.18 -> area 3.24%) is holding at (0.45, 0.5), user 1 raising a slightly larger hand (size 0.19 -> area 3.61%) at (0.65, 0.5) does NOT hijack the lock
assert.equal(
  pickNearestHandInCapture(
    [hand(0.45, 0.5, 0.18), hand(0.65, 0.5, 0.19)],
    frame,
    { minAreaRatio: 0.025, lockedPalm: { x: 0.46, y: 0.5 } }
  ),
  0,
  'locked foreground hand must not be hijacked by another person in the group'
);

console.log('handPicker: all 9 checks passed');
