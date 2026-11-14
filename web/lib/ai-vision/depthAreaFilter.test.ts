import assert from 'node:assert/strict';
import {
  calculateHandAreaRatio,
  clampForegroundThreshold,
  isHandInForeground,
  MAX_FOREGROUND_AREA_RATIO,
  MIN_FOREGROUND_AREA_RATIO,
} from './depthAreaFilter';
import { LandmarkPoint } from './gestureRules';

function makeBoxHand(area: number): LandmarkPoint[] {
  const side = Math.sqrt(Math.max(0, area));
  const minX = 0.5 - side / 2;
  const minY = 0.5 - side / 2;
  const pts: LandmarkPoint[] = [];
  for (let i = 0; i < 21; i++) {
    const t = i / 20;
    pts.push({
      x: minX + side * (i % 2 === 0 ? 0 : t),
      y: minY + side * (i % 2 === 1 ? 1 : t),
      z: 0,
    });
  }
  // Pin bounding box extrema exactly
  pts[0] = { x: minX, y: minY, z: 0 };
  pts[12] = { x: minX + side, y: minY + side, z: 0 };
  return pts;
}

function testClampEnforces150cmCeilingInvariant() {
  assert.equal(MIN_FOREGROUND_AREA_RATIO, 0.025);
  assert.equal(clampForegroundThreshold(0.008), 0.025);
  assert.equal(clampForegroundThreshold(0.015), 0.025);
  assert.equal(clampForegroundThreshold(0.0249), 0.025);
  assert.equal(clampForegroundThreshold(0.025), 0.025);
  assert.equal(clampForegroundThreshold(0.035), 0.035);
  assert.equal(clampForegroundThreshold(0.25), MAX_FOREGROUND_AREA_RATIO);
  assert.equal(clampForegroundThreshold(Number.NaN), 0.025);
  assert.equal(clampForegroundThreshold(Number.POSITIVE_INFINITY), 0.025);
}

function testPropertyRejectsFarHandsRegardlessOfRequestedThreshold() {
  // Property: for ANY requested minAreaRatio in [0.001..0.024], a distant (>1.5m) hand with area 0.019 MUST be rejected
  const distantHand = makeBoxHand(0.019);
  for (let th = 0.001; th <= 0.024; th += 0.001) {
    assert.equal(
      isHandInForeground(distantHand, th),
      false,
      `Distant hand (0.019) leaked through clamped threshold when caller requested ${th}`
    );
  }
}

function testAcceptsHandWithin150cmAndRespectsHigherThreshold() {
  const at150cmHand = makeBoxHand(0.026);
  const closeHand = makeBoxHand(0.045);

  assert.ok(Math.abs(calculateHandAreaRatio(at150cmHand) - 0.026) < 1e-6);
  assert.equal(isHandInForeground(at150cmHand, 0.025), true);
  assert.equal(isHandInForeground(at150cmHand, 0.04), false);
  assert.equal(isHandInForeground(closeHand, 0.04), true);
  assert.equal(isHandInForeground([], 0.025), false);
}

testClampEnforces150cmCeilingInvariant();
testPropertyRejectsFarHandsRegardlessOfRequestedThreshold();
testAcceptsHandWithin150cmAndRespectsHigherThreshold();

console.log('depthAreaFilter: all 3 test suites passed');
