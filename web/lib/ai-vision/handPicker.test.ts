// Run: node lib/ai-vision/handPicker.test.ts
import assert from 'node:assert/strict';
import { pickNearestHandInCapture, type CaptureArea } from './handPicker.ts';

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
// 5. Incomplete hands are skipped
assert.equal(pickNearestHandInCapture([[{ x: 0.5, y: 0.5 }]], frame), -1);

console.log('handPicker: all 6 checks passed');
