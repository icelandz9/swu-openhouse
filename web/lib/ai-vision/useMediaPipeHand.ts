'use client';

import { useEffect, useRef, useState } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { LandmarkPoint } from './gestureRules';

// Served from public/mediapipe/ by scripts/setup-assets.mjs (works offline)
const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/hand_landmarker.task';

/**
 * Loads MediaPipe Hand Landmarker (GPU, falls back to CPU) and runs it on every
 * video frame. Returns the 21 landmarks of each detected hand for the latest frame.
 */
export function useMediaPipeHand(video: HTMLVideoElement | null, enabled: boolean) {
  const [hands, setHands] = useState<LandmarkPoint[][]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        const create = (delegate: 'GPU' | 'CPU') =>
          HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_PATH, delegate },
            runningMode: 'VIDEO',
            numHands: 2,
          });
        const landmarker = await create('GPU').catch(() => create('CPU'));
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setIsModelReady(true);
      } catch {
        if (!cancelled) setModelError('โหลดโมเดลจับมือไม่สำเร็จ — รัน npm run dev ใหม่');
      }
    }

    load();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !isModelReady || !video) return;
    let frameId = 0;
    let lastTime = -1;

    const loop = () => {
      const landmarker = landmarkerRef.current;
      if (landmarker && video.readyState >= 2 && video.currentTime !== lastTime) {
        lastTime = video.currentTime;
        const result = landmarker.detectForVideo(video, performance.now());
        setHands(result.landmarks as LandmarkPoint[][]);
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [enabled, isModelReady, video]);

  return { hands, isModelReady, modelError };
}
