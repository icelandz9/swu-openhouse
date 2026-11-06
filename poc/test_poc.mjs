/**
 * Proof of Concept (PoC) Verification Suite for Task 00
 * SWU Open House - Photo Booth System
 *
 * Verifies 4 core risk mitigations:
 * 1. AI Keypoint Hand Gesture Recognition Logic (Landmark 21-point geometric heuristics)
 * 2. Debounce & Gesture Hold Duration Logic (prevents false positive triggers)
 * 3. Short Code (OPH-XXXX) & QR URL Payload Generation
 * 4. PDPA Auto-Retention Expiry Date Calculation (7-day TTL)
 */

import assert from "node:assert";

console.log("=================================================");
console.log("🧪 RUNNING POC VERIFICATION: SWU PHOTO BOOTH CORE");
console.log("=================================================\n");

// ----------------------------------------------------------------------
// Risk 1: Keypoint Detection Heuristics (MediaPipe 21 Hand Landmarks)
// ----------------------------------------------------------------------
console.log("▶ [Test 1] Testing Keypoint Gesture Recognition Logic...");

function classifyHandGesture(landmarks) {
  if (!landmarks || landmarks.length !== 21) return "UNKNOWN";

  const isThumbUp = landmarks[4].y < landmarks[3].y;
  const isIndexExtended = landmarks[8].y < landmarks[6].y;
  const isMiddleExtended = landmarks[12].y < landmarks[10].y;
  const isRingExtended = landmarks[16].y < landmarks[14].y;
  const isPinkyExtended = landmarks[20].y < landmarks[18].y;

  // Open Palm: All 4 main fingers extended
  if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
    return "OPEN_PALM";
  }

  // Peace / V-Sign: Index and Middle extended, Ring and Pinky curled
  if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    return "PEACE_SIGN";
  }

  // Thumbs Up: Thumb up, other 4 fingers curled
  if (isThumbUp && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    return "THUMBS_UP";
  }

  return "UNKNOWN";
}

// Mock landmark data for Open Palm
const mockOpenPalmLandmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
mockOpenPalmLandmarks[8] = { x: 0.45, y: 0.2, z: 0 };  // Index Tip (extended high)
mockOpenPalmLandmarks[6] = { x: 0.45, y: 0.4, z: 0 };  // Index PIP
mockOpenPalmLandmarks[12] = { x: 0.55, y: 0.2, z: 0 }; // Middle Tip (extended high)
mockOpenPalmLandmarks[10] = { x: 0.55, y: 0.4, z: 0 }; // Middle PIP
mockOpenPalmLandmarks[16] = { x: 0.65, y: 0.2, z: 0 }; // Ring Tip (extended high)
mockOpenPalmLandmarks[14] = { x: 0.65, y: 0.4, z: 0 }; // Ring PIP
mockOpenPalmLandmarks[20] = { x: 0.75, y: 0.2, z: 0 }; // Pinky Tip (extended high)
mockOpenPalmLandmarks[18] = { x: 0.75, y: 0.4, z: 0 }; // Pinky PIP

const detectedGesture = classifyHandGesture(mockOpenPalmLandmarks);
assert.strictEqual(detectedGesture, "OPEN_PALM", "Should correctly classify Open Palm");
console.log(`  ✓ Open Palm classified correctly: ${detectedGesture}`);

// ----------------------------------------------------------------------
// Risk 2: Debounce & Hold Duration Logic (prevents accidental trigger)
// ----------------------------------------------------------------------
console.log("\n▶ [Test 2] Testing Gesture Debounce & Hold Duration Trigger...");

class GestureTriggerController {
  constructor(holdDurationMs = 1500) {
    this.holdDurationMs = holdDurationMs;
    this.activeGesture = null;
    this.gestureStartTime = null;
    this.isTriggered = false;
  }

  update(currentGesture, nowTimestamp) {
    if (currentGesture === "UNKNOWN" || !currentGesture) {
      this.activeGesture = null;
      this.gestureStartTime = null;
      return { triggering: false, progress: 0 };
    }

    if (this.activeGesture !== currentGesture) {
      this.activeGesture = currentGesture;
      this.gestureStartTime = nowTimestamp;
      this.isTriggered = false;
      return { triggering: false, progress: 0 };
    }

    const elapsed = nowTimestamp - this.gestureStartTime;
    const progress = Math.min(1.0, elapsed / this.holdDurationMs);

    if (elapsed >= this.holdDurationMs && !this.isTriggered) {
      this.isTriggered = true;
      return { triggering: true, progress: 1.0 };
    }

    return { triggering: false, progress };
  }
}

const controller = new GestureTriggerController(1500); // 1.5 seconds hold
const t0 = 1000;
let res = controller.update("OPEN_PALM", t0);
assert.strictEqual(res.triggering, false, "Instant gesture should not trigger immediately");

// After 800ms
res = controller.update("OPEN_PALM", t0 + 800);
assert.strictEqual(res.triggering, false, "800ms gesture should not trigger yet");
assert(res.progress > 0.5, "Progress should be > 50%");

// After 1550ms
res = controller.update("OPEN_PALM", t0 + 1550);
assert.strictEqual(res.triggering, true, "1550ms continuous hold must fire trigger");
console.log(`  ✓ Debounce & Hold duration validated (Triggered at progress: ${res.progress * 100}%)`);

// ----------------------------------------------------------------------
// Risk 3: Short Code (OPH-XXXX) & Routing Generation
// ----------------------------------------------------------------------
console.log("\n▶ [Test 3] Testing Short Code & QR Routing Generation (OPH Prefix)...");

function generateShortCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous 0, O, 1, I
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `OPH-${code}`;
}

const codeSample = generateShortCode();
assert(/^OPH-[A-Z0-9]{4}$/.test(codeSample), "Short code should match format OPH-XXXX");
const expectedDownloadUrl = `https://booth.swu.ac.th/p/${codeSample}`;
console.log(`  ✓ Generated Short Code: ${codeSample}`);
console.log(`  ✓ Generated Download URL: ${expectedDownloadUrl}`);

// ----------------------------------------------------------------------
// Risk 4: PDPA 7-day Retention Auto-Purge Policy Calculation
// ----------------------------------------------------------------------
console.log("\n▶ [Test 4] Testing PDPA 7-day Auto-Purge Lifecycle...");

function calculateExpiryTimestamp(createdAt, retentionDays = 7) {
  const msInDay = 24 * 60 * 60 * 1000;
  return new Date(createdAt.getTime() + retentionDays * msInDay);
}

function isExpired(expiryDate, now) {
  return now.getTime() >= expiryDate.getTime();
}

const createdAt = new Date("2026-11-07T10:00:00Z");
const expiryDate = calculateExpiryTimestamp(createdAt, 7);
assert.strictEqual(
  expiryDate.toISOString(),
  "2026-11-14T10:00:00.000Z",
  "Expiry should be exactly 7 days after creation"
);
assert.strictEqual(isExpired(expiryDate, new Date("2026-11-10T10:00:00Z")), false);
assert.strictEqual(isExpired(expiryDate, new Date("2026-11-15T10:00:00Z")), true);
console.log(`  ✓ Created: ${createdAt.toISOString()}`);
console.log(`  ✓ Expiry Date (PDPA 7-day TTL): ${expiryDate.toISOString()}`);

console.log("\n=================================================");
console.log("🎉 ALL POC TESTS PASSED SUCCESSFULLY (4/4 PASS)");
console.log("=================================================");
