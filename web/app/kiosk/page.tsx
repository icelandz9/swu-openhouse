'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hand,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Camera,
  Pause,
  Sliders,
  Check,
  RotateCcw,
  Cog,
  HardHat,
  Wrench,
  Hammer,
} from 'lucide-react';
import { useKioskFSM } from '@/lib/kiosk/useKioskFSM';
import { ScreenSyncEvent, CROP_DIMENSIONS_4_3, SCREEN_SYNC_CHANNEL, DEFAULT_PRODUCTION_APP_URL } from '@/lib/contracts';
import { generateShortCode } from '@/lib/mobile/shortCodeGenerator';
import { classifyGesture, LandmarkPoint } from '@/lib/ai-vision/gestureRules';
import { isHandInForeground } from '@/lib/ai-vision/depthAreaFilter';
import { calculate43Crop } from '@/lib/kiosk/centerCropper';
import { HandMesh } from '@/components/HandMesh';
import { CpeLogo } from '@/components/CpeLogo';
import { ConsoleCaps, GameMenu, PixelSkyline } from '@/components/PixelScene';

export default function KioskCapturePage() {
  const {
    send,
    state,
    isIdle,
    isDetecting,
    isCountingDown,
    isCapturing,
    isPreviewing,
  } = useKioskFSM();

  const channelRef = useRef<BroadcastChannel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const initCameraRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleConfirmUploadRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // Palm hold, preview timer, keyboard, button and staff command can all confirm; only the first one uploads.
  const uploadInFlightRef = useRef<boolean>(false);

  // Camera & Stream state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isAiVisionReady, setIsAiVisionReady] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 16, height: 9 });
  const [handAreaThreshold, setHandAreaThreshold] = useState<number>(0.035);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // Gesture detection & tracking
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [liveLandmarks, setLiveLandmarks] = useState<LandmarkPoint[] | undefined>(undefined);
  const [detectedGestureText, setDetectedGestureText] = useState<string>('NONE');
  const [handAreaRatio, setHandAreaRatio] = useState<number>(0);
  const [isForeground, setIsForeground] = useState<boolean>(true);
  const holdStartTimeRef = useRef<number | null>(null);
  const lastPalmSeenTimeRef = useRef<number>(0);
  const prevDetectedGestureRef = useRef<string>('NONE');
  const prevIsForegroundRef = useRef<boolean>(false);
  const lastLandmarkUpdateRef = useRef<number>(0);
  const prevHoldProgressIntRef = useRef<number>(0);
  const previewGestureLockRef = useRef<boolean>(false);
  const previewEnterTimeRef = useRef<number>(0);

  const [countdown, setCountdown] = useState<number>(3);
  const defaultCountdownRef = useRef<number>(3);
  const [previewSeconds, setPreviewSeconds] = useState<number>(10);
  const [retakeCount, setRetakeCount] = useState<number>(0);

  // Captured snapshot URL
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const [syncedCode, setSyncedCode] = useState<string>('');
  const [staffPinModal, setStaffPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');

  // MediaPipe references
  const landmarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Real-time FPS & AI latency tracking (zero overhead, in-memory refs)
  const fpsCounterRef = useRef<{ frames: number; lastTime: number; currentFps: number }>({
    frames: 0,
    lastTime: typeof performance !== 'undefined' ? performance.now() : 0,
    currentFps: 60,
  });
  const lastAiLatencyRef = useRef<number>(11);

  // Sound synthesizer (reusable singleton context to prevent Chrome audio context limits)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playBeep = useCallback((frequency: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      osc.type = 'sine';
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };
    } catch {}
  }, []);

  // Initialize BroadcastChannel & listen to admin / display events
  useEffect(() => {
    const channel = new BroadcastChannel(SCREEN_SYNC_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<ScreenSyncEvent>) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'SCREEN1_RESET') {
        send({ type: 'FORCE_RESET' });
        holdStartTimeRef.current = null;
        setHoldProgress(0);
        previewGestureLockRef.current = false;
        setIsPaused(false);
      } else if (data.type === 'STAFF_TRIGGER_CAPTURE') {
        send({ type: 'STAFF_TRIGGER' });
      } else if (data.type === 'KIOSK_COMMAND') {
        if (data.command === 'RESET_STANDBY') {
          send({ type: 'FORCE_RESET' });
          setHoldProgress(0);
          holdStartTimeRef.current = null;
          setIsPaused(false);
        } else if (data.command === 'SKIP_PREVIEW') {
          if (isPreviewing) {
            handleConfirmUploadRef.current();
          }
        } else if (data.command === 'PAUSE_BOOTH') {
          setIsPaused(true);
        } else if (data.command === 'RESUME_BOOTH') {
          setIsPaused(false);
        } else if (data.command === 'RELOAD_CAMERA') {
          initCameraRef.current();
        } else if (data.command === 'CANCEL_COUNTDOWN') {
          send({ type: 'FORCE_RESET' });
          setCountdown(3);
          setHoldProgress(0);
          holdStartTimeRef.current = null;
        } else if (data.command === 'SET_COUNTDOWN') {
          if (typeof data.value === 'number') {
            defaultCountdownRef.current = data.value;
            setCountdown(data.value);
          }
        } else if (data.command === 'SET_THRESHOLD') {
          if (typeof data.value === 'number') {
            setHandAreaThreshold(data.value);
          }
        } else if (data.command === 'SET_PUBLIC_DOMAIN') {
          if (typeof window !== 'undefined') {
            const val = typeof data.value === 'string' ? data.value.trim() : '';
            if (val) {
              localStorage.setItem('swu_booth_host', val);
            } else {
              localStorage.removeItem('swu_booth_host');
            }
          }
        }
      } else if (data.type === 'HEARTBEAT_PING') {
        const video = videoRef.current;
        const resText = video && video.videoWidth > 0 ? `${video.videoWidth}x${video.videoHeight}` : '1080p';
        channelRef.current?.postMessage({
          type: 'HEARTBEAT_PONG',
          sender: 'KIOSK',
          timestamp: Date.now(),
          pingTimestamp: data.timestamp,
          status: {
            state: state,
            isPaused,
            cameraActive,
            fps: fpsCounterRef.current.currentFps || 60,
            resolution: resText,
            aiLatencyMs: lastAiLatencyRef.current || 11,
            threshold: handAreaThreshold,
          },
        });
      }
    };

    return () => {
      channel.close();
    };
  }, [send, isPreviewing]);

  // Snapshot capture function (1440x1080 center-crop of 16:9 video feed)
  const takeCenterCropSnapshot = useCallback(() => {
    try {
      const canvas = offscreenCanvasRef.current || document.createElement('canvas');
      canvas.width = CROP_DIMENSIONS_4_3.width;
      canvas.height = CROP_DIMENSIONS_4_3.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        if (videoRef.current && cameraActive && videoRef.current.videoWidth > 0) {
          const video = videoRef.current;
          const crop = calculate43Crop(video.videoWidth, video.videoHeight);

          // Mirror horizontally for natural selfie perspective
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(
            video,
            crop.sx,
            crop.sy,
            crop.sWidth,
            crop.sHeight,
            0,
            0,
            canvas.width,
            canvas.height
          );
        } else {
          // Studio fallback simulation
          ctx.fillStyle = '#0A0A0A';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          grad.addColorStop(0, '#262B36');
          grad.addColorStop(0.5, '#CE1126');
          grad.addColorStop(1, '#0A0A0A');
          ctx.fillStyle = grad;
          ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 54px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SWU OPEN HOUSE 2026', canvas.width / 2, canvas.height / 2 - 20);

          ctx.font = '28px "JetBrains Mono", monospace';
          ctx.fillStyle = '#06B6D4';
          ctx.fillText('CPE • AI PHOTO BOOTH CAPTURE', canvas.width / 2, canvas.height / 2 + 40);

          ctx.font = '20px "JetBrains Mono", monospace';
          ctx.fillStyle = '#94A3B8';
          ctx.fillText(new Date().toLocaleString('th-TH'), canvas.width / 2, canvas.height / 2 + 90);
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedPhotoUrl(dataUrl);
        return dataUrl;
      }
    } catch (err) {
      console.error('Error taking snapshot:', err);
    }
    return capturedPhotoUrl;
  }, [cameraActive, capturedPhotoUrl]);

  // Confirm photo, post to API, broadcast to Screen 2, and reset
  const handleConfirmUpload = useCallback(async () => {
    if (uploadInFlightRef.current || isSyncingRef.current) return;
    uploadInFlightRef.current = true;
    isSyncingRef.current = true;
    send({ type: 'CONFIRM_UPLOAD' });
    setIsSyncing(true);

    try {
      let code = generateShortCode();
      setSyncedCode(code);
      const rawOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const isLocal = rawOrigin.includes('localhost') || rawOrigin.includes('127.0.0.1');
      const origin = isLocal ? DEFAULT_PRODUCTION_APP_URL : rawOrigin;
      let serverToken: string | undefined = undefined;
      let qrUrl = `${origin}/p/${code}`;
      let finalPhotoUrl = capturedPhotoUrl;

      // Check if custom booth host configured in localStorage
      let hasCustomHost = false;
      let configuredHost = '';
      if (typeof window !== 'undefined') {
        let rawHost = localStorage.getItem('swu_booth_host');
        if (rawHost && rawHost.includes('swu-openhouse.vercel.app')) {
          rawHost = DEFAULT_PRODUCTION_APP_URL;
          localStorage.setItem('swu_booth_host', DEFAULT_PRODUCTION_APP_URL);
        }
        if (rawHost && rawHost.trim()) {
          configuredHost = rawHost.trim().replace(/\/+$/, '');
          const baseHost = /^https?:\/\//i.test(configuredHost)
            ? configuredHost
            : `${window.location.protocol}//${configuredHost}`;
          qrUrl = `${baseHost}/p/${code}`;
          hasCustomHost = true;
        }
      }

      // 1. Post to API for storage
      try {
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: capturedPhotoUrl,
            code,
            customHost: configuredHost || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          // The server may pick another code if this one was already taken.
          if (data.code && data.code !== code) {
            code = data.code;
            setSyncedCode(code);
          }
          if (data.photoUrl) finalPhotoUrl = data.photoUrl;
          if (data.token) serverToken = data.token;
          if (data.qrUrl && !hasCustomHost) {
            qrUrl = data.qrUrl;
          } else if (data.token && !qrUrl.includes('?t=')) {
            qrUrl = `${qrUrl}?t=${data.token}`;
          }
        }
      } catch (err) {
        console.warn('Backend storage offline, syncing via local event bus:', err);
      }

      // 2. Prepare event payload
      const syncEvent: ScreenSyncEvent = {
        type: 'PHOTO_READY_FOR_DISPLAY',
        code,
        qrUrl,
        photoUrl: finalPhotoUrl,
        token: serverToken,
        createdAt: new Date().toISOString(),
      };

      // 3. Broadcast to Screen 2 & 3 via BroadcastChannel
      channelRef.current?.postMessage(syncEvent);

      // 4. Save to localStorage for cross-window / tab reliability
      if (typeof window !== 'undefined') {
        try {
          const safePhotoUrl = finalPhotoUrl.startsWith('data:') ? `/api/photos/${code}/file` : finalPhotoUrl;
          const storageItem = { ...syncEvent, photoUrl: safePhotoUrl };
          localStorage.setItem('swu_latest_photo', JSON.stringify(storageItem));
          const rawGallery = localStorage.getItem('swu_photo_gallery') || '[]';
          const gallery = JSON.parse(rawGallery);
          gallery.unshift(storageItem);
          localStorage.setItem('swu_photo_gallery', JSON.stringify(gallery.slice(0, 50)));
        } catch (e) {
          console.warn('LocalStorage save error (quota protected):', e);
        }
      }

      // 5. Success feedback & smooth reset
      send({ type: 'UPLOAD_SUCCESS' });
      setTimeout(() => {
        setIsSyncing(false);
        isSyncingRef.current = false;
        previewGestureLockRef.current = false;
        setRetakeCount(0);
        uploadInFlightRef.current = false;
        send({ type: 'COOLDOWN_EXPIRED' });
      }, 1500);
    } catch (err) {
      console.error('Error during photo upload:', err);
      send({ type: 'UPLOAD_SUCCESS' });
      setTimeout(() => {
        setIsSyncing(false);
        isSyncingRef.current = false;
        previewGestureLockRef.current = false;
        setRetakeCount(0);
        uploadInFlightRef.current = false;
        send({ type: 'COOLDOWN_EXPIRED' });
      }, 1500);
    }
  }, [capturedPhotoUrl, send]);

  const handleRetake = useCallback(() => {
    previewGestureLockRef.current = false;
    setHoldProgress(0);
    holdStartTimeRef.current = null;
    setCountdown(3);
    setPreviewSeconds(10);
    send({ type: 'GESTURE_RETAKE_FIST' });
  }, [send]);

  // Initialize WebRTC Camera
  const initCamera = useCallback(async () => {
    try {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach((track) => track.stop());
        currentStreamRef.current = null;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebRTC not supported');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user',
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('1080p camera constraint failed, attempting basic video constraint:', firstErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      currentStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            setVideoDimensions({
              width: videoRef.current.videoWidth || 16,
              height: videoRef.current.videoHeight || 9,
            });
          }
        };
        await videoRef.current.play().catch(() => {});
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('WebRTC camera unavailable, using simulation mode:', err.message);
      setCameraActive(false);
    }
  }, []);

  // Keep callback refs continuously synced
  initCameraRef.current = initCamera;
  handleConfirmUploadRef.current = handleConfirmUpload;

  useEffect(() => {
    initCamera();
    return () => {
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach((track) => track.stop());
        currentStreamRef.current = null;
      }
    };
  }, [initCamera]);

  // Initialize MediaPipe HandLandmarker dynamically (Client-Only)
  useEffect(() => {
    let active = true;

    async function initMediaPipe() {
      try {
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');

        if (!active) return;

        let landmarker: any = null;
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
          });
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe/hand_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
          });
        }

        if (active && landmarker) {
          landmarkerRef.current = landmarker;
          setIsAiVisionReady(true);
        }
      } catch (err) {
        console.warn('MediaPipe initialization fallback (mouse/touch active):', err);
      }
    }

    initMediaPipe();

    return () => {
      active = false;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {}
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Real-time Gesture Detection Animation Frame Loop (Using Updated 3D Hand Model)
  useEffect(() => {
    let animId: number;

    const detectLoop = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      const nowPerf = performance.now();
      fpsCounterRef.current.frames++;
      if (nowPerf - fpsCounterRef.current.lastTime >= 1000) {
        fpsCounterRef.current.currentFps = Math.max(
          1,
          Math.round((fpsCounterRef.current.frames * 1000) / (nowPerf - fpsCounterRef.current.lastTime))
        );
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = nowPerf;
      }

      if (video && video.readyState >= 2 && landmarker && !isPaused) {
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          try {
            const tStart = performance.now();
            const results = landmarker.detectForVideo(video, tStart);
            lastAiLatencyRef.current = Math.max(1, Math.round(performance.now() - tStart));
            if (results && results.landmarks && results.landmarks.length > 0) {
              const primaryHand = results.landmarks[0];
              const worldHand = results.worldLandmarks?.[0];
              const handedness = results.handedness?.[0]?.[0]?.categoryName ?? 'Right';
              const aspect = video.videoWidth > 0 && video.videoHeight > 0
                ? video.videoWidth / video.videoHeight
                : 4 / 3;

              // Run the updated 5-finger palm facing model
              const detected = classifyGesture(primaryHand, worldHand, handedness, aspect);
              if (prevDetectedGestureRef.current !== detected) {
                prevDetectedGestureRef.current = detected;
                setDetectedGestureText(detected);
              }

              // Depth & Area Filter: reject distant background passers-by (>= 3.5% required)
              const inForeground = isHandInForeground(primaryHand, handAreaThreshold);
              if (prevIsForegroundRef.current !== inForeground) {
                prevIsForegroundRef.current = inForeground;
                setIsForeground(inForeground);
              }

              let minX = 1;
              let maxX = 0;
              let minY = 1;
              let maxY = 0;
              for (const pt of primaryHand) {
                if (pt.x < minX) minX = pt.x;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.y > maxY) maxY = pt.y;
              }

              // Throttle React state allocations to 30 FPS to prevent heap leaks during 8-hour events
              const nowLoop = performance.now();
              if (nowLoop - lastLandmarkUpdateRef.current > 33) {
                lastLandmarkUpdateRef.current = nowLoop;
                setLiveLandmarks(primaryHand);
                setHandAreaRatio(Math.max(0, (maxX - minX) * (maxY - minY)));
              }

              if (isIdle || isDetecting) {
                if (detected === 'OPEN_PALM' && inForeground) {
                  lastPalmSeenTimeRef.current = performance.now();
                  if (holdStartTimeRef.current === null) {
                    holdStartTimeRef.current = performance.now();
                    send({ type: 'HAND_DETECTED' });
                  }
                  const elapsed = performance.now() - holdStartTimeRef.current;
                  const progress = Math.min(100, (elapsed / 1500) * 100);
                  const pInt = Math.floor(progress);
                  if (pInt !== prevHoldProgressIntRef.current) {
                    prevHoldProgressIntRef.current = pInt;
                    setHoldProgress(progress);
                  }

                  if (elapsed >= 1500) {
                    holdStartTimeRef.current = null;
                    setHoldProgress(100);
                    send({ type: 'TRIGGER_ACTIVATED' });
                  }
                } else {
                  const timeSinceLast = performance.now() - (lastPalmSeenTimeRef.current || 0);
                  if (timeSinceLast > 250) {
                    if (holdStartTimeRef.current !== null) {
                      holdStartTimeRef.current = null;
                      setHoldProgress(0);
                      send({ type: 'HAND_LOST' });
                    }
                  }
                }
              } else if (isPreviewing && !previewGestureLockRef.current) {
                const timeInPreview = performance.now() - previewEnterTimeRef.current;
                // Grace period: ignore first 1.2s of preview so lingering posing hand does not accidentally trigger upload
                if (timeInPreview > 1200) {
                  if (detected === 'FIST') {
                    previewGestureLockRef.current = true;
                    handleRetake();
                  } else if (detected === 'OPEN_PALM') {
                    // Require deliberate hold (800ms) during preview to confirm
                    if (holdStartTimeRef.current === null) {
                      holdStartTimeRef.current = performance.now();
                    }
                    const palmHold = performance.now() - holdStartTimeRef.current;
                    if (palmHold >= 800) {
                      previewGestureLockRef.current = true;
                      handleConfirmUploadRef.current();
                    }
                  } else {
                    holdStartTimeRef.current = null;
                  }
                }
              }
            } else {
              setLiveLandmarks(undefined);
              setDetectedGestureText('NONE');
              setHandAreaRatio(0);
              setIsForeground(true);
              const timeSinceLast = performance.now() - (lastPalmSeenTimeRef.current || 0);
              if (timeSinceLast > 250) {
                if (holdStartTimeRef.current !== null) {
                  holdStartTimeRef.current = null;
                  setHoldProgress(0);
                  if (isIdle || isDetecting) {
                    send({ type: 'HAND_LOST' });
                  }
                }
              }
            }
          } catch {}
        }
      }

      animId = requestAnimationFrame(detectLoop);
    };

    animId = requestAnimationFrame(detectLoop);
    return () => cancelAnimationFrame(animId);
  }, [isIdle, isDetecting, isPreviewing, isPaused, send, handleRetake, handleConfirmUpload]);

  // Countdown timer logic (3..2..1 pose freely)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCountingDown) {
      playBeep(countdown === 1 ? 1040 : 760);
      timer = setTimeout(() => {
        if (countdown > 1) {
          setCountdown((prev) => prev - 1);
        } else {
          takeCenterCropSnapshot();
          send({ type: 'COUNTDOWN_COMPLETE' });
          playBeep(1200);
          setCountdown(3);
        }
      }, 1000);
    } else {
      setCountdown(3);
    }
    return () => clearTimeout(timer);
  }, [isCountingDown, countdown, send, takeCenterCropSnapshot, playBeep]);

  // Flash duration (150ms)
  useEffect(() => {
    if (isCapturing) {
      const flashTimer = setTimeout(() => {
        send({ type: 'CAPTURE_FLASH_DONE' });
        setPreviewSeconds(10);
      }, 150);
      return () => clearTimeout(flashTimer);
    }
  }, [isCapturing, send]);

  // Preview countdown timer (10s auto-proceed) & Grace Period initialization
  useEffect(() => {
    let previewInterval: NodeJS.Timeout;
    if (isPreviewing) {
      previewEnterTimeRef.current = performance.now();
      previewGestureLockRef.current = false;
      let remaining = 10;
      setPreviewSeconds(remaining);

      // Keep the upload out of the setState updater: React may run updaters twice (Strict Mode),
      // which uploaded every photo twice under two different codes.
      previewInterval = setInterval(() => {
        remaining -= 1;
        setPreviewSeconds(Math.max(remaining, 0));
        if (remaining <= 0) {
          clearInterval(previewInterval);
          handleConfirmUploadRef.current();
        }
      }, 1000);
    }
    return () => clearInterval(previewInterval);
  }, [isPreviewing, handleConfirmUpload]);

  // Keyboard shortcut testing (P = Palm, F = Fist, S = Staff Trigger, R = Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'p') {
        if (isIdle || isDetecting) {
          send({ type: 'TRIGGER_ACTIVATED' });
        } else if (isPreviewing) {
          handleConfirmUploadRef.current();
        }
      } else if (key === 'f') {
        if (isPreviewing) {
          handleRetake();
        }
      } else if (key === 's') {
        send({ type: 'STAFF_TRIGGER' });
      } else if (key === 'r') {
        send({ type: 'FORCE_RESET' });
        setHoldProgress(0);
        previewGestureLockRef.current = false;
        setIsPaused(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIdle, isDetecting, isPreviewing, send, handleRetake, handleConfirmUpload]);

  const showLiveFeed = !isPreviewing && state !== 'FLASH_CAPTURE' && state !== 'UPLOADING' && state !== 'RESET_COOLDOWN';

  return (
    <main className="kiosk-shell relative grid h-dvh w-screen place-items-center overflow-hidden bg-black select-none">
      <div className="kiosk-stage relative aspect-video h-auto max-h-dvh w-full max-w-[calc(100dvh*16/9)] overflow-hidden">
        {/* Live Camera Feed */}
        <video
          ref={videoRef}
          muted
          playsInline
          className={`absolute inset-0 h-full w-full scale-x-[-1] object-cover transition-opacity duration-300 ${
            showLiveFeed && cameraActive ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Fallback Simulation View if camera not open */}
        {!cameraActive && showLiveFeed && (
          <div className="absolute inset-0 h-full w-full flex items-center justify-center z-10">
            <PixelSkyline className="opacity-70" />
            {/* Title screen, like the poster: ENGINEERING / BUILD YOUR OWN FUTURE / Start Game */}
            <div className="relative z-10 flex max-w-2xl flex-col items-center px-6 text-center">
              <h3 className="px-title text-[clamp(1.6rem,4.6vw,5rem)]">ENGINEERING</h3>
              <p className="font-pixel px-menu-item mt-[1.2vw] -rotate-2 text-[clamp(.6rem,1.4vw,1.5rem)]">BUILD YOUR OWN FUTURE</p>
              <GameMenu className="mt-[2.4vw] text-[clamp(.55rem,1vw,1.1rem)]" />
              <p className="mt-[2vw] text-sm font-semibold text-white [text-shadow:2px_2px_0_#1a0306]">
                กำลังรอกล้อง · อนุญาตการใช้กล้องในเบราว์เซอร์ หรือกดปุ่มด้านล่าง
              </p>
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => initCamera()}
                  className="px-btn px-btn-red px-corners px-5 py-2.5 text-xs"
                >
                  <Camera className="size-4" />
                  <span>เชื่อมต่อกล้องทันที</span>
                </button>
              </div>
              <div className="pt-3 text-[11px] text-[var(--px-cream)]/70">
                โหมดทดสอบ: กดปุ่ม P เพื่อจำลองแบมือ หรือ S เพื่อถ่ายภาพ
              </div>
            </div>
          </div>
        )}

        {/* Captured 4:3 Snapshot in Preview / Sent States */}
        {!showLiveFeed && (
          <div className="absolute inset-y-0 left-[12.5%] h-full w-3/4 overflow-hidden bg-black flex items-center justify-center z-15">
            <img
              src={capturedPhotoUrl}
              alt="ภาพถ่ายตัวอย่าง"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* 4:3 Capture Zone Overlay & Bracket Boundaries */}
        <div className="kiosk-capture-zone pointer-events-none absolute inset-y-0 left-[12.5%] z-20 w-3/4 border-x-[1.5px] border-[#CE1126]/60" />
        <div className="font-pixel pointer-events-none absolute left-1/2 top-[1.4%] z-30 -translate-x-1/2 px-corners bg-[var(--px-red)] px-[.9vw] py-[.45vw] text-[clamp(.34rem,.42vw,.52rem)] text-white shadow-[inset_2px_2px_0_var(--px-red-hi),inset_-2px_-3px_0_var(--px-red-dark)]">
          ▶ PLAYER 1 · READY
        </div>

        {/* Left grip of the console: the logo straight on the grey body, title, player status */}
        <aside className="kiosk-pillar px-panel absolute inset-y-0 left-0 z-[28] flex w-[12.5%] flex-col items-center px-[1.1%] py-[2.6vw] [--cap-h:2.1vw] [--cap-w:3.2vw] [&>*:not(.px-cap)]:relative [&>*:not(.px-cap)]:z-[2]">
          <ConsoleCaps corners={['bl']} />
          <div className="flex flex-1 flex-col items-center justify-center gap-[1.6vw] text-center">
            {/* Dark pixel outline + drop shadow so the red gear and white PE stand off the grey */}
            <div className="w-[92%]">
              <CpeLogo className="px-logo-pop h-auto max-w-full" />
            </div>
            <div>
              <p className="px-title text-[clamp(.5rem,.8vw,1rem)]">ENGINEERING</p>
              <p className="font-pixel px-menu-item mt-[.7vw] text-[clamp(.32rem,.46vw,.56rem)] leading-[1.9]">
                BUILD YOUR
                <br />
                OWN FUTURE
              </p>
            </div>
            <p className="font-pixel text-[clamp(.3rem,.42vw,.52rem)] leading-[1.8] text-[var(--px-cream)] [text-shadow:2px_2px_0_#2e2d33]">
              SWU OPEN HOUSE
              <br />
              14-15 NOV 2026
            </p>
          </div>

          {/* Player status, in words a visitor understands */}
          <div className="px-screen w-full px-[.65vw] py-[.7vw]">
            <p className="font-pixel text-[clamp(.32rem,.44vw,.54rem)] text-[var(--px-gold)]">PLAYER 1</p>
            <div className="mt-[.6vw] space-y-[.45vw] text-[clamp(.55rem,.72vw,.88rem)] leading-tight">
              <div className="flex items-center gap-[.45vw]">
                <span className={`size-[.5vw] shrink-0 ${cameraActive ? 'bg-[var(--px-green)]' : 'bg-[var(--px-gold)] animate-pulse'}`} />
                <span className="text-white">{cameraActive ? 'กล้องพร้อม' : 'รอกล้อง'}</span>
              </div>
              <div className="flex items-center gap-[.45vw]">
                <span className={`size-[.5vw] shrink-0 ${liveLandmarks ? 'bg-[var(--px-green)]' : 'bg-[var(--px-steel-hi)]'}`} />
                <span className="text-white">{liveLandmarks ? 'เห็นมือแล้ว' : 'ยังไม่เห็นมือ'}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right grip: the gear / hard hat / wrench / hammer buttons, as on the poster */}
        <aside className="kiosk-pillar px-panel absolute inset-y-0 right-0 z-[28] flex w-[12.5%] flex-col items-center justify-center px-[1.1%] py-[2.6vw] [--cap-h:2.1vw] [--cap-w:3.2vw] [&>*:not(.px-cap)]:relative [&>*:not(.px-cap)]:z-[2]">
          <ConsoleCaps corners={['br']} />
          <div className="grid w-fit grid-cols-3 grid-rows-3 gap-[.4vw]" aria-hidden>
            <span />
            <span className="px-round size-[3.2vw]"><Cog className="size-[1.4vw]" /></span>
            <span />
            <span className="px-round size-[3.2vw]"><HardHat className="size-[1.4vw]" /></span>
            <span />
            <span className="px-round size-[3.2vw]"><Wrench className="size-[1.4vw]" /></span>
            <span />
            <span className="px-round size-[3.2vw]"><Hammer className="size-[1.4vw]" /></span>
            <span />
          </div>
        </aside>

        {/* Full-Screen Real-Time 1:1 Hand Mesh Overlay */}
        {(isIdle || isDetecting) && showLiveFeed && liveLandmarks && (
          <HandMesh
            active={holdProgress > 0 || isDetecting}
            landmarks={liveLandmarks}
            holdProgress={holdProgress}
            mode="overlay"
            handAreaRatio={handAreaRatio}
            isForeground={isForeground}
            gestureText={detectedGestureText}
            videoDimensions={videoDimensions}
          />
        )}

        {/* Player prompt at the bottom of the viewfinder: what to do now, and the hold-to-start meter */}
        {(isIdle || isDetecting) && showLiveFeed && cameraActive && (
          <div className="pointer-events-none absolute bottom-[3.5%] left-1/2 z-30 w-[min(46%,34rem)] -translate-x-1/2">
            <div className="px-panel px-corners flex items-center gap-[1vw] px-[1.2vw] py-[.8vw]">
              <span className={`px-round size-[3vw] shrink-0 ${holdProgress > 0 ? '' : 'animate-pulse'}`}>
                <Hand className="size-[1.5vw]" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-[.6vw]">
                  <span className="truncate text-[clamp(.8rem,1.25vw,1.5rem)] font-bold leading-tight text-white [text-shadow:2px_2px_0_#1a0306]">
                    {holdProgress > 0
                      ? 'ค้างไว้อีกนิด...'
                      : liveLandmarks && !isForeground
                        ? 'เข้ามาใกล้กล้องอีกนิด'
                        : 'แบมือค้างไว้ เพื่อเริ่มถ่าย'}
                  </span>
                  <span className="font-pixel shrink-0 text-[clamp(.4rem,.6vw,.72rem)] text-[var(--px-gold)]">
                    {holdProgress > 0 ? `${Math.round(holdProgress)}%` : 'PRESS START'}
                  </span>
                </div>
                <div className="px-meter mt-[.5vw]">
                  <span style={{ width: `${Math.max(0, Math.min(100, holdProgress))}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Countdown Active State (3..2..1) */}
        {isCountingDown && (
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
            <div className="px-screen px-corners relative flex h-44 w-44 items-center justify-center">
              <span className="px-title text-7xl tabular-nums">
                {countdown}
              </span>
            </div>
            <div className="mt-6 px-panel px-corners px-6 py-2 text-sm font-bold text-white">
              <span className="font-pixel mr-2 text-[var(--px-gold)]">READY?</span> โพสท่าอิสระได้เลย!
            </div>
          </div>
        )}

        {/* Shutter Flash (150ms) */}
        {isCapturing && (
          <div className="kiosk-flash pointer-events-none absolute inset-0 z-50 bg-white" />
        )}

        {/* Preview State: Review & Retake Controls - Clean, Formal & No Emojis */}
        {isPreviewing && (
          <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center justify-end pb-8">
            <div className="flex items-center gap-6 px-panel px-corners px-7 py-4">
              {/* Fist: Retake Button (Unlimited Retakes) */}
              <button
                type="button"
                onClick={handleRetake}
                className="group px-btn px-corners gap-3 px-5 py-2.5"
              >
                <div className="flex size-9 items-center justify-center bg-black/30 text-white group-hover:rotate-[-45deg] transition-transform">
                  <RotateCcw className="size-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white">กำมือ เพื่อถ่ายใหม่</div>
                  <div className="font-pixel-sm text-[10px] text-white/80">CONTINUE?</div>
                </div>
              </button>

              {/* Center Timer */}
              <div className="px-screen flex flex-col items-center px-4 py-2 min-w-[80px]">
                <div className="font-pixel text-xl text-[var(--px-gold)] tabular-nums">
                  {previewSeconds}s
                </div>
                <div className="font-pixel-sm text-[9px] font-bold text-[var(--px-muted)] uppercase">
                  TIME
                </div>
              </div>

              {/* Palm: Confirm Button */}
              <button
                type="button"
                onClick={handleConfirmUpload}
                className="group px-btn px-btn-red px-corners gap-3 px-6 py-2.5"
              >
                <div className="flex size-9 items-center justify-center bg-black/25 text-white">
                  <Check className="size-5" strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white">แบมือ ยืนยันรูปนี้</div>
                  <div className="font-pixel-sm text-[10px] text-white/90">PRESS START</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Uploading & Success Notification */}
        {isSyncing && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[#0c0305]/90">
            <div className="text-center space-y-4">
              <CheckCircle2 className="size-20 text-[var(--px-green)] mx-auto animate-bounce" />
              <p className="px-title text-4xl">STAGE CLEAR!</p>
              <h2 className="text-3xl font-black text-white">ส่งรูปเรียบร้อย!</h2>
              <p className="text-base text-slate-300">
                เชิญสแกนรับรูปที่ <b>จอหมายเลข 2 (Showcase)</b> รหัสรูป: <span className="font-pixel text-[var(--px-gold)]">{syncedCode}</span>
              </p>
            </div>
          </div>
        )}

        {/* Kiosk Paused Overlay */}
        {isPaused && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0c0305]/92">
            <div className="text-center space-y-3">
              <Pause className="size-16 text-[var(--px-gold)] mx-auto" />
              <p className="font-pixel px-blink text-lg text-white">PAUSED</p>
              <h2 className="text-2xl font-bold text-white">พักบูธชั่วคราว</h2>
              <p className="text-xs text-slate-400">สตาฟกำลังดูแลความเรียบร้อย หรือจัดคิว</p>
              <button
                onClick={() => setIsPaused(false)}
                className="px-btn px-btn-red px-corners mt-4 px-4 py-2 text-xs"
              >
                เปิดใช้งานต่อ
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
