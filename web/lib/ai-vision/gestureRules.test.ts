// Run: node web/lib/ai-vision/gestureRules.test.ts
import assert from 'node:assert/strict';
import { classifyGesture, palmNormalZ, type LandmarkPoint } from './gestureRules.ts';

// 1. Incomplete landmarks
assert.equal(classifyGesture([]), 'NONE', 'empty landmarks should return NONE');
assert.equal(classifyGesture(Array(10).fill({ x: 0, y: 0, z: 0 })), 'NONE', 'under 21 landmarks should return NONE');

// Helper to construct a 21-landmark 2D hand
function make2DHand(fingerExt: [boolean, boolean, boolean, boolean]) {
  const pts: LandmarkPoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
  pts[0] = { x: 0.5, y: 0.9, z: 0 }; // wrist

  const fingers = [
    { tip: 8, pip: 6, mcp: 5 },
    { tip: 12, pip: 10, mcp: 9 },
    { tip: 16, pip: 14, mcp: 13 },
    { tip: 20, pip: 18, mcp: 17 },
  ];

  fingers.forEach(({ tip, pip, mcp }, idx) => {
    const isExt = fingerExt[idx];
    pts[mcp] = { x: 0.4 + idx * 0.05, y: 0.6, z: 0 };
    if (isExt) {
      pts[pip] = { x: 0.4 + idx * 0.05, y: 0.4, z: 0 };
      pts[tip] = { x: 0.4 + idx * 0.05, y: 0.2, z: 0 };
    } else {
      pts[pip] = { x: 0.4 + idx * 0.05, y: 0.7, z: 0 };
      pts[tip] = { x: 0.4 + idx * 0.05, y: 0.8, z: 0 };
    }
  });

  return pts;
}

// 2. 2D fallback tests
const handOpen2D = make2DHand([true, true, true, true]);
assert.equal(classifyGesture(handOpen2D), 'OPEN_PALM', '2D all extended should be OPEN_PALM');

const handFist2D = make2DHand([false, false, false, false]);
assert.equal(classifyGesture(handFist2D), 'FIST', '2D all folded should be FIST');

const handPeace2D = make2DHand([true, true, false, false]);
assert.equal(classifyGesture(handPeace2D), 'PEACE_SIGN', '2D peace sign should be PEACE_SIGN');

// 3. 3D world landmarks & palm orientation tests
// Helper to construct 3D landmarks with wrist, MCPs, PIPs, Tips
function make3DHand(
  fingerExt: [boolean, boolean, boolean, boolean],
  thumbExt: boolean,
  facing: 'palm' | 'back' | 'edge',
  handedness: 'Right' | 'Left'
) {
  const imagePts: LandmarkPoint[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const worldPts: LandmarkPoint[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));

  // Wrist
  imagePts[0] = { x: 0.5, y: 0.8, z: 0 };
  worldPts[0] = { x: 0, y: 0.1, z: 0 };

  // Set up index (5) and pinky (17) MCP for normal vector
  // In image landmarks (camera perspective):
  // When Right palm faces camera: thumb is on camera right, index is to the right of pinky -> nz < -0.12
  // When Left palm faces camera: thumb is on camera left, index is to the left of pinky -> nz > 0.12
  if (facing === 'palm') {
    if (handedness === 'Right') {
      imagePts[5] = { x: 0.55, y: 0.5, z: 0 }; // index MCP
      imagePts[17] = { x: 0.45, y: 0.55, z: 0 }; // pinky MCP
    } else {
      imagePts[5] = { x: 0.45, y: 0.5, z: 0 };
      imagePts[17] = { x: 0.55, y: 0.55, z: 0 };
    }
  } else if (facing === 'back') {
    if (handedness === 'Right') {
      imagePts[5] = { x: 0.45, y: 0.5, z: 0 };
      imagePts[17] = { x: 0.55, y: 0.55, z: 0 };
    } else {
      imagePts[5] = { x: 0.55, y: 0.5, z: 0 };
      imagePts[17] = { x: 0.45, y: 0.55, z: 0 };
    }
  } else {
    // Edge-on: index and pinky MCP aligned vertically
    imagePts[5] = { x: 0.5, y: 0.4, z: 0 };
    imagePts[17] = { x: 0.5, y: 0.6, z: 0 };
  }

  // Thumb
  worldPts[2] = { x: -0.03, y: 0.05, z: 0 }; // Thumb MCP
  worldPts[17] = { x: 0.05, y: 0.05, z: 0 }; // Pinky MCP
  if (thumbExt) {
    worldPts[4] = { x: -0.09, y: 0.02, z: 0 }; // Thumb tip far
  } else {
    worldPts[4] = { x: -0.01, y: 0.05, z: 0 }; // Thumb tip tucked
  }

  // 4 fingers
  const fingerIdxs = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  fingerIdxs.forEach(([tip, pip], idx) => {
    const isExt = fingerExt[idx];
    if (isExt) {
      worldPts[pip] = { x: (idx - 1.5) * 0.02, y: -0.02, z: 0 }; // dist ~ 0.12
      worldPts[tip] = { x: (idx - 1.5) * 0.02, y: -0.06, z: 0 }; // dist ~ 0.16 -> ratio ~ 1.33 >= 1.10
    } else {
      worldPts[pip] = { x: (idx - 1.5) * 0.02, y: 0.02, z: 0 }; // dist ~ 0.08
      worldPts[tip] = { x: (idx - 1.5) * 0.02, y: 0.05, z: 0 }; // dist ~ 0.05 -> ratio ~ 0.62 <= 1.0
    }
  });

  return { imagePts, worldPts };
}

// 4. Test intentional open palm facing camera
const rightPalm = make3DHand([true, true, true, true], true, 'palm', 'Right');
assert.equal(classifyGesture(rightPalm.imagePts, rightPalm.worldPts, 'Right'), 'OPEN_PALM', '3D Right palm facing camera must be OPEN_PALM');

const leftPalm = make3DHand([true, true, true, true], true, 'palm', 'Left');
assert.equal(classifyGesture(leftPalm.imagePts, leftPalm.worldPts, 'Left'), 'OPEN_PALM', '3D Left palm facing camera must be OPEN_PALM');

// 5. Test back of hand rejection
const rightBack = make3DHand([true, true, true, true], true, 'back', 'Right');
assert.equal(classifyGesture(rightBack.imagePts, rightBack.worldPts, 'Right'), 'NONE', '3D Right back of hand must be rejected (NONE)');

// 6. Test edge-on hand rejection (must NOT trigger OPEN_PALM)
const edgeOn = make3DHand([true, true, true, true], true, 'edge', 'Right');
assert.equal(classifyGesture(edgeOn.imagePts, edgeOn.worldPts, 'Right'), 'NONE', 'Edge-on hand must be rejected (NONE)');

// 7. Test FIST with 3D world landmarks
const fist3D = make3DHand([false, false, false, false], false, 'palm', 'Right');
assert.equal(classifyGesture(fist3D.imagePts, fist3D.worldPts, 'Right'), 'FIST', '3D all folded fingers + tucked thumb must be FIST');

// 8. Test PEACE_SIGN with 3D world landmarks
const peace3D = make3DHand([true, true, false, false], false, 'palm', 'Right');
assert.equal(classifyGesture(peace3D.imagePts, peace3D.worldPts, 'Right'), 'PEACE_SIGN', '3D index+middle extended must be PEACE_SIGN');

console.log('gestureRules: all 8 test suites passed');
