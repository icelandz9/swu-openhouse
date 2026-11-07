'use client';

import { useEffect, useRef, useState } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import type { LandmarkPoint } from './gestureRules';

// Served from public/mediapipe/ by scripts/setup-assets.mjs (works offline)
const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/hand_landmarker.task';

/**
 * Loads MediaPipe Hand Landmarker (GPU, falls back to CPU) and runs it on every
 * video frame. Returns, per detected hand in the latest frame, what classifyGesture
 * needs: the 21 image landmarks, the 21 world landmarks, and "Left" or "Right".
 */
export function useMediaPipeHand(video: HTMLVideoElement | null, enabled: boolean) {
  const [frame, setFrame] = useState<{
    hands: LandmarkPoint[][];
    worldHands: LandmarkPoint[][];
    handedness: string[];
  }>({ hands: [], worldHands: [], handedness: [] });
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
        if (!cancelled) setModelError('โหลดโมเดลจับมือไม่สำเร็จ — กำลังใช้โหมดสำรอง');
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
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          setFrame({
            hands: result.landmarks as LandmarkPoint[][],
            worldHands: result.worldLandmarks as LandmarkPoint[][],
            handedness: result.handedness.map((categories) => categories[0]?.categoryName ?? ''),
          });
        } catch {}
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [enabled, isModelReady, video]);

  return { ...frame, isModelReady, modelError, landmarkerRef };
}
