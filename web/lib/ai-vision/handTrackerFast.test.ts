import assert from 'node:assert/strict';
import { AdaptiveHandSmoother, computeObjectCoverTransform } from './handTrackerFast.ts';
import type { LandmarkPoint } from './gestureRules.ts';

function makeHand(cx: number, cy: number): LandmarkPoint[] {
  return Array.from({ length: 21 }, (_, i) => ({
    x: cx + (i % 5) * 0.01,
    y: cy + Math.floor(i / 5) * 0.01,
    z: 0,
  }));
}

// 1. Object-cover transform for 16:9 video into 4:3 container
{
  const t = computeObjectCoverTransform(1920, 1080, 4 / 3);
  // 16/9 / (4/3) = 4/3 = 1.3333
  assert.ok(Math.abs(t.scaleX - 4 / 3) < 1e-6, 'scaleX should be 4/3');
  assert.equal(t.scaleY, 1, 'scaleY should be 1');
  // Center point (0.5, 0.5) must map to (0.5, 0.5)
  const centerX = t.offsetX + 0.5 * t.scaleX;
  const centerY = t.offsetY + 0.5 * t.scaleY;
  assert.ok(Math.abs(centerX - 0.5) < 1e-6, 'center X maps to 0.5');
  assert.ok(Math.abs(centerY - 0.5) < 1e-6, 'center Y maps to 0.5');
}

// 2. AdaptiveHandSmoother: immediate snap on initial frame
{
  const smoother = new AdaptiveHandSmoother();
  const h1 = makeHand(0.4, 0.5);
  const out1 = smoother.update(h1, 1000);
  assert.equal(out1.length, 21);
  assert.ok(Math.abs(out1[9].x - h1[9].x) < 1e-6, 'first frame snaps immediately');
}

// 3. AdaptiveHandSmoother: fast movement tracks closely (>= 92% of step)
{
  const smoother = new AdaptiveHandSmoother();
  const h1 = makeHand(0.3, 0.5);
  smoother.update(h1, 1000);
  // Move by 0.12 in 16ms -> fast swipe (speed = 0.0075 / ms > velocityScale)
  const h2 = makeHand(0.42, 0.5);
  const out2 = smoother.update(h2, 1016);
  const ratio = (out2[9].x - h1[9].x) / (h2[9].x - h1[9].x);
  assert.ok(ratio >= 0.92, `fast swipe should track >= 92% immediately, got ${ratio}`);
}

// 4. AdaptiveHandSmoother: sub-frame interpolation advances smoothly along velocity
{
  const smoother = new AdaptiveHandSmoother();
  smoother.update(makeHand(0.4, 0.5), 1000);
  const afterUpdate = smoother.update(makeHand(0.44, 0.5), 1033);
  const updateX = afterUpdate[9].x;
  const sampled = smoother.sample(1041); // 8ms later (60Hz intermediate frame)
  assert.ok(sampled !== null);
  assert.ok(sampled![9].x > updateX, 'interpolated sample should advance in direction of motion');
}

// 5. AdaptiveHandSmoother: teleport jump (> 22%) snaps 100% without dragging
{
  const smoother = new AdaptiveHandSmoother();
  smoother.update(makeHand(0.2, 0.2), 1000);
  const jumped = makeHand(0.75, 0.75);
  const out = smoother.update(jumped, 1016);
  assert.ok(Math.abs(out[9].x - jumped[9].x) < 1e-6, 'teleport jump snaps 100%');
}

console.log('handTrackerFast: all 5 test suites passed');
