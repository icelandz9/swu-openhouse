import assert from 'node:assert/strict';
import { kioskFSMReducer } from './kioskStateMachine';
import { KioskFSMState } from '../contracts';

function testHappyPathPalmCaptureUploadReset() {
  let state: KioskFSMState = 'IDLE';
  state = kioskFSMReducer(state, { type: 'HAND_DETECTED' });
  assert.equal(state, 'DETECTING_HAND');

  state = kioskFSMReducer(state, { type: 'TRIGGER_ACTIVATED' });
  assert.equal(state, 'COUNTDOWN_ACTIVE');

  // Lowering hand during countdown must NOT cancel the shot
  state = kioskFSMReducer(state, { type: 'HAND_LOST' });
  assert.equal(state, 'COUNTDOWN_ACTIVE');

  state = kioskFSMReducer(state, { type: 'COUNTDOWN_COMPLETE' });
  assert.equal(state, 'FLASH_CAPTURE');

  state = kioskFSMReducer(state, { type: 'CAPTURE_FLASH_DONE' });
  assert.equal(state, 'PREVIEW_RETAKE');

  state = kioskFSMReducer(state, { type: 'GESTURE_PROCEED_PALM' });
  assert.equal(state, 'UPLOADING');

  state = kioskFSMReducer(state, { type: 'UPLOAD_SUCCESS' });
  assert.equal(state, 'RESET_COOLDOWN');

  state = kioskFSMReducer(state, { type: 'COOLDOWN_EXPIRED' });
  assert.equal(state, 'IDLE');
}

function testPreviewFistRetakeReturnsIdleWithoutImmediateCountdown() {
  const afterFist = kioskFSMReducer('PREVIEW_RETAKE', { type: 'GESTURE_RETAKE_FIST' });
  assert.equal(afterFist, 'IDLE', 'Fist retake must return to IDLE rather than starting countdown immediately');
}

function testPreviewTimeoutAndManualConfirmProceedToUpload() {
  assert.equal(kioskFSMReducer('PREVIEW_RETAKE', { type: 'TIMEOUT_PROCEED' }), 'UPLOADING');
  assert.equal(kioskFSMReducer('PREVIEW_RETAKE', { type: 'CONFIRM_UPLOAD' }), 'UPLOADING');
}

function testOfflineFallbackAndRecovery() {
  let state = kioskFSMReducer('UPLOADING', { type: 'UPLOAD_FAILED_OFFLINE' });
  assert.equal(state, 'WAITING_NETWORK');

  state = kioskFSMReducer(state, { type: 'NETWORK_RESTORED' });
  assert.equal(state, 'UPLOADING');

  const bypassed = kioskFSMReducer('WAITING_NETWORK', { type: 'STAFF_BYPASS_PIN' });
  assert.equal(bypassed, 'RESET_COOLDOWN');
}

function testForceResetFromAnyStateReturnsIdle() {
  const allStates: KioskFSMState[] = [
    'IDLE',
    'DETECTING_HAND',
    'COUNTDOWN_ACTIVE',
    'FLASH_CAPTURE',
    'PREVIEW_RETAKE',
    'UPLOADING',
    'WAITING_NETWORK',
    'RESET_COOLDOWN',
  ];
  for (const s of allStates) {
    assert.equal(kioskFSMReducer(s, { type: 'FORCE_RESET' }), 'IDLE', `FORCE_RESET from ${s} must reach IDLE`);
  }
}

function testStaffTriggerOverridesIdleDetectingAndPreview() {
  assert.equal(kioskFSMReducer('IDLE', { type: 'STAFF_TRIGGER' }), 'COUNTDOWN_ACTIVE');
  assert.equal(kioskFSMReducer('DETECTING_HAND', { type: 'STAFF_TRIGGER' }), 'COUNTDOWN_ACTIVE');
  assert.equal(kioskFSMReducer('PREVIEW_RETAKE', { type: 'STAFF_TRIGGER' }), 'COUNTDOWN_ACTIVE');
  assert.equal(kioskFSMReducer('RESET_COOLDOWN', { type: 'STAFF_TRIGGER' }), 'COUNTDOWN_ACTIVE');
}

testHappyPathPalmCaptureUploadReset();
testPreviewFistRetakeReturnsIdleWithoutImmediateCountdown();
testPreviewTimeoutAndManualConfirmProceedToUpload();
testOfflineFallbackAndRecovery();
testForceResetFromAnyStateReturnsIdle();
testStaffTriggerOverridesIdleDetectingAndPreview();

console.log('kioskStateMachine: all 6 test suites passed');
