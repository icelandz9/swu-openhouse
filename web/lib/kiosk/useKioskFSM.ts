'use client';

import { useReducer, useCallback } from 'react';
import { KioskFSMState } from '../contracts';
import { kioskFSMReducer, KioskEvent } from './kioskStateMachine';

export function useKioskFSM(initialState: KioskFSMState = 'IDLE') {
  const [state, dispatch] = useReducer(kioskFSMReducer, initialState);

  const send = useCallback((event: KioskEvent) => {
    dispatch(event);
  }, []);

  return {
    state,
    send,
    isIdle: state === 'IDLE',
    isDetecting: state === 'DETECTING_HAND',
    isCountingDown: state === 'COUNTDOWN_ACTIVE',
    isCapturing: state === 'FLASH_CAPTURE',
    isPreviewing: state === 'PREVIEW_RETAKE',
    isUploading: state === 'UPLOADING',
    isWaitingNetwork: state === 'WAITING_NETWORK',
    isShowingQR: state === 'SHOW_QR_CLEAN',
    isCoolingDown: state === 'RESET_COOLDOWN',
  };
}
