import { KioskFSMState } from '../contracts';

export type KioskEvent =
  | { type: 'HAND_DETECTED' }
  | { type: 'HAND_LOST' }
  | { type: 'TRIGGER_ACTIVATED' }
  | { type: 'COUNTDOWN_TICK'; remainingSeconds: number }
  | { type: 'COUNTDOWN_COMPLETE' }
  | { type: 'CAPTURE_FLASH_DONE' }
  | { type: 'RETAKE_CLICKED' }
  | { type: 'CONFIRM_UPLOAD' }
  | { type: 'UPLOAD_SUCCESS' }
  | { type: 'UPLOAD_FAILED_OFFLINE' }
  | { type: 'NETWORK_RESTORED' }
  | { type: 'STAFF_BYPASS_PIN' }
  | { type: 'QR_TIMEOUT' }
  | { type: 'NEXT_PERSON_CLICKED' }
  | { type: 'COOLDOWN_EXPIRED' };

/**
 * Pure Finite State Machine Reducer for the Photo Booth Kiosk
 * Framework-agnostic, zero React dependency, 100% unit-testable
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
      if (event.type === 'RETAKE_CLICKED') return 'COUNTDOWN_ACTIVE';
      if (event.type === 'CONFIRM_UPLOAD') return 'UPLOADING';
      return state;

    case 'UPLOADING':
      if (event.type === 'UPLOAD_SUCCESS') return 'SHOW_QR_CLEAN';
      if (event.type === 'UPLOAD_FAILED_OFFLINE') return 'WAITING_NETWORK';
      return state;

    case 'WAITING_NETWORK':
      if (event.type === 'NETWORK_RESTORED') return 'UPLOADING';
      if (event.type === 'STAFF_BYPASS_PIN') return 'RESET_COOLDOWN';
      return state;

    case 'SHOW_QR_CLEAN':
      if (event.type === 'QR_TIMEOUT' || event.type === 'NEXT_PERSON_CLICKED') {
        return 'RESET_COOLDOWN';
      }
      return state;

    case 'RESET_COOLDOWN':
      if (event.type === 'COOLDOWN_EXPIRED') return 'IDLE';
      return state;

    default:
      return state;
  }
}
