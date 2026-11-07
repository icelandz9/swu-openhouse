'use client';

import { useState, useRef, useCallback } from 'react';
import { GestureType, HandDetectionState } from '../contracts';

const HOLD_REQUIRED_MS = 1500;

export function useGestureTrigger(onTrigger?: () => void) {
  const [detectionState, setDetectionState] = useState<HandDetectionState>({
    isCameraReady: false,
    cameraError: null,
    isHandPresent: false,
    detectedGesture: 'NONE',
    confidence: 0,
    holdDurationMs: 0,
    holdProgress: 0,
    isTriggerReady: false,
  });

  const holdStartRef = useRef<number | null>(null);
  const triggeredRef = useRef<boolean>(false);

  const processGestureFrame = useCallback(
    (gesture: GestureType, confidence: number, isHandPresent: boolean) => {
      const now = performance.now();

      if (gesture === 'OPEN_PALM' && isHandPresent) {
        if (holdStartRef.current === null) {
          holdStartRef.current = now;
          triggeredRef.current = false;
        }

        const elapsed = Math.min(HOLD_REQUIRED_MS, now - holdStartRef.current);
        const progress = Math.min(100, Math.round((elapsed / HOLD_REQUIRED_MS) * 100));
        const isTriggerReady = elapsed >= HOLD_REQUIRED_MS;

        setDetectionState((prev) => ({
          ...prev,
          isHandPresent: true,
          detectedGesture: gesture,
          confidence,
          holdDurationMs: elapsed,
          holdProgress: progress,
          isTriggerReady,
        }));

        if (isTriggerReady && !triggeredRef.current) {
          triggeredRef.current = true;
          onTrigger?.();
        }
      } else {
        holdStartRef.current = null;
        triggeredRef.current = false;
        setDetectionState((prev) => ({
          ...prev,
          isHandPresent,
          detectedGesture: gesture,
          confidence,
          holdDurationMs: 0,
          holdProgress: 0,
          isTriggerReady: false,
        }));
      }
    },
    [onTrigger]
  );

  const resetTrigger = useCallback(() => {
    holdStartRef.current = null;
    triggeredRef.current = false;
    setDetectionState((prev) => ({
      ...prev,
      holdDurationMs: 0,
      holdProgress: 0,
      isTriggerReady: false,
    }));
  }, []);

  return {
    detectionState,
    processGestureFrame,
    resetTrigger,
  };
}
