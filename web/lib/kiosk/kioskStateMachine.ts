import { KioskFSMState } from '../contracts';

export type KioskEvent =
  | { type: 'HAND_DETECTED' }
  | { type: 'HAND_LOST' }
  | { type: 'TRIGGER_ACTIVATED' }
  | { type: 'COUNTDOWN_TICK'; remainingSeconds: number }
  | { type: 'COUNTDOWN_COMPLETE' }
  | { type: 'CAPTURE_FLASH_DONE' }
  | { type: 'RETAKE_CLICKED' }
  | { type: 'CONFIRM_PHOTO' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_FAILED' }
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
      // Free pose: withdrawing the hand does NOT cancel the countdown (docs/decisions.md)
      if (event.type === 'COUNTDOWN_COMPLETE') return 'FLASH_CAPTURE';
      return state;

    case 'FLASH_CAPTURE':
      if (event.type === 'CAPTURE_FLASH_DONE') return 'PREVIEW_RETAKE';
      return state;

    case 'PREVIEW_RETAKE':
      if (event.type === 'RETAKE_CLICKED') return 'COUNTDOWN_ACTIVE';
      if (event.type === 'CONFIRM_PHOTO') return 'SAVE_LOCAL';
      return state;

    case 'SAVE_LOCAL':
      // Saved on the kiosk disk -> show QR right away; R2 sync happens in the background
      if (event.type === 'SAVE_SUCCESS') return 'SHOW_QR_CLEAN';
      if (event.type === 'SAVE_FAILED') return 'RESET_COOLDOWN';
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
