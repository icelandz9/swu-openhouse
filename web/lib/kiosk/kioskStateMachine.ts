import { KioskFSMState } from '../contracts';

export type KioskEvent =
  | { type: 'HAND_DETECTED' }
  | { type: 'HAND_LOST' }
  | { type: 'TRIGGER_ACTIVATED' }
  | { type: 'COUNTDOWN_TICK'; remainingSeconds: number }
  | { type: 'COUNTDOWN_COMPLETE' }
  | { type: 'CAPTURE_FLASH_DONE' }
  | { type: 'GESTURE_RETAKE_FIST' }
  | { type: 'GESTURE_PROCEED_PALM' }
  | { type: 'TIMEOUT_PROCEED' }
  | { type: 'CONFIRM_UPLOAD' }
  | { type: 'UPLOAD_SUCCESS' }
  | { type: 'UPLOAD_FAILED_OFFLINE' }
  | { type: 'NETWORK_RESTORED' }
  | { type: 'STAFF_BYPASS_PIN' }
  | { type: 'COOLDOWN_EXPIRED' };

/**
 * Pure Finite State Machine Reducer for Screen 1 (Capture Kiosk)
 * Handles Hand Trigger -> Countdown -> Flash -> 10s Preview (Fist to Retake, Palm to Proceed)
 * Once uploaded, Screen 1 resets immediately so the next visitor can enter.
 */
export function kioskFSMReducer(state: KioskFSMState, event: KioskEvent): KioskFSMState {
  switch (state) {
    case 'IDLE':
      if (event.type === 'HAND_DETECTED') return 'DETECTING_HAND';
      return state;

    case 'DETECTING_HAND':
      if (event.type === 'HAND_LOST') return 'IDLE';
      if (event.type === 'TRIGGER_ACTIVATED') return 'COUNTDOWN_ACTIVE';
      return state;

    case 'COUNTDOWN_ACTIVE':
      if (event.type === 'HAND_LOST') return 'IDLE'; // Cancel if visitor leaves
      if (event.type === 'COUNTDOWN_COMPLETE') return 'FLASH_CAPTURE';
      return state;

    case 'FLASH_CAPTURE':
      if (event.type === 'CAPTURE_FLASH_DONE') return 'PREVIEW_RETAKE';
      return state;

    case 'PREVIEW_RETAKE':
      // Fist gesture triggers retake
      if (event.type === 'GESTURE_RETAKE_FIST') return 'COUNTDOWN_ACTIVE';
      // Palm gesture, manual proceed, or 10s timeout triggers upload
      if (
        event.type === 'GESTURE_PROCEED_PALM' ||
        event.type === 'CONFIRM_UPLOAD' ||
        event.type === 'TIMEOUT_PROCEED'
      ) {
        return 'UPLOADING';
      }
      return state;

    case 'UPLOADING':
      // When upload finishes, Screen 1 immediately resets to cooldown/idle for the next person
      // The QR Code is displayed on Screen 2 (30% split) via BroadcastChannel event
      if (event.type === 'UPLOAD_SUCCESS') return 'RESET_COOLDOWN';
      if (event.type === 'UPLOAD_FAILED_OFFLINE') return 'WAITING_NETWORK';
      return state;

    case 'WAITING_NETWORK':
      if (event.type === 'NETWORK_RESTORED') return 'UPLOADING';
      if (event.type === 'STAFF_BYPASS_PIN') return 'RESET_COOLDOWN';
      return state;

    case 'RESET_COOLDOWN':
      if (event.type === 'COOLDOWN_EXPIRED') return 'IDLE';
      return state;

    default:
      return state;
  }
}
