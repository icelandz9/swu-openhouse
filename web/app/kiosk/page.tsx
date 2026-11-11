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
  Heart,
} from 'lucide-react';
import { useKioskFSM } from '@/lib/kiosk/useKioskFSM';
import { ScreenSyncEvent, SCREEN_SYNC_CHANNEL, DEFAULT_PRODUCTION_APP_URL, PHOTO_ASPECT_RATIO, PhotoRatio } from '@/lib/contracts';
import { generateShortCode } from '@/lib/mobile/shortCodeGenerator';
import { classifyGesture, LandmarkPoint } from '@/lib/ai-vision/gestureRules';
import { isHandInForeground } from '@/lib/ai-vision/depthAreaFilter';
import { calculateCrop } from '@/lib/kiosk/centerCropper';
import { HandMesh } from '@/components/HandMesh';
import { CpeLogo } from '@/components/CpeLogo';
import { SafeErrorBoundary } from '@/components/SafeErrorBoundary';
import { GameMenu, PixelSkyline } from '@/components/PixelScene';

function KioskCapturePageContent() {
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
  const [handAreaThreshold, setHandAreaThreshold] = useState<number>(0.025);
  // 3:4 portrait (default, fills the frames) or 4:3 landscape (wide, for groups); staff switch it in /admin
  const [photoRatio, setPhotoRatio] = useState<PhotoRatio>(PHOTO_ASPECT_RATIO);
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
    if (typeof window !== 'undefined') {
      try {
        const savedThreshold = localStorage.getItem('swu_hand_threshold');
        if (savedThreshold) {
          const parsed = parseFloat(savedThreshold);
          if (!isNaN(parsed) && parsed >= 0.005 && parsed <= 0.1) {
            setHandAreaThreshold(parsed);
          }
        }
        const savedRatio = localStorage.getItem('swu_photo_ratio');
        if (savedRatio === '3:4' || savedRatio === '4:3') {
          setPhotoRatio(savedRatio);
        }
      } catch {}
    }

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
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('swu_hand_threshold', data.value.toString()); } catch {}
            }
          }
        } else if (data.command === 'SET_PHOTO_RATIO') {
          if (data.value === '3:4' || data.value === '4:3') {
            setPhotoRatio(data.value);
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('swu_photo_ratio', data.value); } catch {}
            }
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
        try {
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
        } catch {}
      }
    };

    return () => {
      try {
        channel.close();
      } catch {}
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [send, isPreviewing]);

  // Snapshot: centre crop of the camera feed at the current ratio (1440x1080 or 1080x1440)
  const takeCenterCropSnapshot = useCallback(() => {
    try {
      const canvas = offscreenCanvasRef.current || document.createElement('canvas');
      const video = videoRef.current;
      const crop = calculateCrop(
        video && video.videoWidth > 0 ? video.videoWidth : 1920,
        video && video.videoHeight > 0 ? video.videoHeight : 1080,
        photoRatio
      );
      canvas.width = crop.dWidth;
      canvas.height = crop.dHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        if (video && cameraActive && video.videoWidth > 0) {

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
  }, [cameraActive, capturedPhotoUrl, photoRatio]);

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
      try {
        channelRef.current?.postMessage(syncEvent);
      } catch {}

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

        const landmarkerOptions = {
          baseOptions: {
            modelAssetPath: '/mediapipe/hand_landmarker.task',
            delegate: 'GPU' as const,
          },
          runningMode: 'VIDEO' as const,
          numHands: 2,
          minHandDetectionConfidence: 0.35,
          minHandPresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
        };

        let landmarker: any = null;
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, landmarkerOptions);
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            ...landmarkerOptions,
            baseOptions: {
              ...landmarkerOptions.baseOptions,
              delegate: 'CPU',
            },
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
      {/* 16:9 stage; everything inside is sized in cqw (1% of the stage width) so it scales as one console */}
      <div className="kiosk-stage relative aspect-video h-auto max-h-dvh w-full max-w-[calc(100dvh*16/9)] overflow-hidden [container-type:inline-size]">
        {/* Handheld console body */}
        <div className="kc-body absolute inset-[.8cqw]">
          <span className="kc-cap kc-cap-tl" aria-hidden />
          <span className="kc-cap kc-cap-tr" aria-hidden />
          <span className="kc-cap kc-cap-bl" aria-hidden />
          <span className="kc-cap kc-cap-br" aria-hidden />

          {/* Left: logo, D-pad, SELECT / START */}
          <div className="absolute inset-y-0 left-0 flex w-[14.2cqw] flex-col items-center pt-[8.4cqw]">
            <div className="w-[10.4cqw]">
              <CpeLogo className="px-logo-pop h-auto max-w-full" />
            </div>
            <p className="font-pixel mt-[1.1cqw] text-center text-[.78cqw] leading-[1.7] text-[#3a3a40]">
              BUILD YOUR
              <br />
              OWN FUTURE
            </p>
            <div className="relative mt-[3.8cqw] size-[8.4cqw]" aria-hidden>
              <span className="kc-dpad absolute left-1/2 top-0 h-full w-[34%] -translate-x-1/2" />
              <span className="kc-dpad absolute left-0 top-1/2 h-[34%] w-full -translate-y-1/2" />
              <span className="absolute left-1/2 top-1/2 size-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--px-red-dark)] shadow-[inset_0_.2cqw_.3cqw_rgba(0,0,0,.5)]" />
            </div>
            <div className="mt-[3cqw] flex gap-[1.2cqw]" aria-hidden>
              {['SELECT', 'START'].map((label) => (
                <div key={label} className="flex flex-col items-center gap-[.5cqw]">
                  <span className="kc-pill h-[1.1cqw] w-[3.8cqw]" />
                  <span className="font-pixel-sm text-[.62cqw] font-bold text-[#4a4a52]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: gear / hard hat / wrench / hammer buttons and the speaker grille */}
          <div className="absolute inset-y-0 right-0 flex w-[14.2cqw] flex-col items-center pt-[13cqw]">
            <div className="grid grid-cols-3 grid-rows-3 gap-[.35cqw]" aria-hidden>
              <span />
              <span className="px-round size-[3.8cqw]"><Cog className="size-[2cqw]" /></span>
              <span />
              <span className="px-round size-[3.8cqw]"><HardHat className="size-[2cqw]" /></span>
              <span />
              <span className="px-round size-[3.8cqw]"><Wrench className="size-[2cqw]" /></span>
              <span />
              <span className="px-round size-[3.8cqw]"><Hammer className="size-[2cqw]" /></span>
              <span />
            </div>
            <div className="mt-[3.6cqw] ml-[2cqw] flex gap-[.8cqw]" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="kc-grille h-[5cqw] w-[.6cqw]" />
              ))}
            </div>
          </div>

          {/* Screen bezel */}
          <div
            className="kc-bezel absolute left-1/2 top-1/2 flex w-[65.5cqw] -translate-x-1/2 -translate-y-1/2 flex-col items-center px-[1.8cqw] pb-[.8cqw] pt-[.8cqw]">
            <p className="font-pixel mb-[.45cqw] text-[.78cqw] text-[#b9b9c2]">
              SWU OPEN HOUSE <span className="text-[var(--px-red-hi)]">2026</span> · 14-15 NOV
            </p>

            {/* LEDs on the bezel, left of the screen */}
            <div className="absolute -left-[2.6cqw] top-1/2 flex -translate-y-1/2 flex-col items-center gap-[1.4cqw]" aria-hidden>
              {[
                ['CAM', cameraActive],
                ['HAND', Boolean(liveLandmarks)],
              ].map(([label, on]) => (
                <div key={label as string} className="flex flex-col items-center gap-[.3cqw]">
                  <span className={`size-[.8cqw] ${on ? 'bg-[var(--px-green)] shadow-[0_0_.6cqw_var(--px-green)]' : 'bg-[#6a6a72]'}`} />
                  <span className="font-pixel-sm text-[.55cqw] font-bold text-[#4a4a52]">{label as string}</span>
                </div>
              ))}
            </div>

            {/* The 4:3 screen = exactly what gets captured */}
            <div className="kc-screen relative aspect-[4/3] w-full overflow-hidden">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`absolute inset-0 h-full w-full scale-x-[-1] object-cover transition-opacity duration-300 ${
                  showLiveFeed && cameraActive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Title screen while the camera is not connected */}
              {!cameraActive && showLiveFeed && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <PixelSkyline className="opacity-80" />
                  <div className="relative flex flex-col items-center px-[2cqw] text-center">
                    <h3 className="px-title text-[4.4cqw]">ENGINEERING</h3>
                    <p className="font-pixel px-menu-item mt-[1cqw] -rotate-2 text-[1.3cqw]">BUILD YOUR OWN FUTURE</p>
                    <GameMenu className="mt-[2cqw] text-[1cqw]" />
                    <p className="mt-[1.8cqw] text-[1.05cqw] font-semibold text-white [text-shadow:2px_2px_0_#1a0306]">
                      กำลังรอกล้อง · อนุญาตการใช้กล้องในเบราว์เซอร์ หรือกดปุ่มด้านล่าง
                    </p>
                    <button
                      type="button"
                      onClick={() => initCamera()}
                      className="px-btn px-btn-red px-corners mt-[1.2cqw] px-[1.6cqw] py-[.8cqw] text-[.95cqw]"
                    >
                      <Camera className="size-[1.2cqw]" />
                      <span>เชื่อมต่อกล้องทันที</span>
                    </button>
                    <p className="mt-[.9cqw] text-[.8cqw] text-[var(--px-cream)]/75">
                      โหมดทดสอบ: กดปุ่ม P เพื่อจำลองแบมือ หรือ S เพื่อถ่ายภาพ
                    </p>
                  </div>
                </div>
              )}

              {/* Captured photo while reviewing / sending */}
              {!showLiveFeed && (
                <img src={capturedPhotoUrl} alt="ภาพถ่ายตัวอย่าง" className="absolute inset-0 z-10 h-full w-full bg-black object-contain" />
              )}

              {/* Hand skeleton, mapped to this 4:3 screen */}
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
                  containerAspect={4 / 3}
                />
              )}

              {/* HUD: player + lives, LIVE, viewfinder corners */}
              {showLiveFeed && cameraActive && (
                <>
                  <div className="font-pixel pointer-events-none absolute left-[1.2cqw] top-[1.1cqw] z-20 flex items-center gap-[.6cqw] bg-black/55 px-[.7cqw] py-[.45cqw] text-[.85cqw] text-white">
                    PLAYER 1
                    <span className="flex gap-[.2cqw] text-[var(--px-red-hi)]">
                      {[0, 1, 2].map((i) => (
                        <Heart key={i} className="size-[.9cqw]" fill="currentColor" strokeWidth={0} />
                      ))}
                    </span>
                  </div>
                  <div className="font-pixel pointer-events-none absolute right-[1.2cqw] top-[1.1cqw] z-20 flex items-center gap-[.5cqw] bg-black/55 px-[.7cqw] py-[.45cqw] text-[.85cqw] text-white">
                    <span className="size-[.65cqw] animate-pulse bg-[var(--px-red-hi)]" />
                    LIVE
                  </div>
                  {photoRatio === '3:4' ? (
                    <>
                      {/* 3:4 capture area. The camera's 4:3 view is 1440 px wide, the 3:4 crop 810 px:
                          810 / 1440 = 56.25% of the screen width, centred (21.875% each side). */}
                      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[21.875%] bg-black/55" aria-hidden />
                      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[21.875%] bg-black/55" aria-hidden />
                      <div className="pointer-events-none absolute inset-y-0 left-[21.875%] z-20 w-[56.25%] shadow-[inset_0_0_0_.25cqw_rgba(255,255,255,.9)]" aria-hidden>
                        <div className="kc-brackets absolute inset-[1.2cqw]" />
                        <span className="font-pixel absolute bottom-[9.6cqw] left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/60 px-[.6cqw] py-[.3cqw] text-[.7cqw] text-white">
                          3:4 · พื้นที่ถ่าย
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="kc-brackets pointer-events-none absolute inset-x-[3cqw] bottom-[9.5cqw] top-[4cqw] z-20" aria-hidden />
                  )}
                </>
              )}

              {/* Dialog box: what to do now */}
              {(isIdle || isDetecting) && showLiveFeed && cameraActive && (
                <div className="kc-dialog pointer-events-none absolute inset-x-[1.2cqw] bottom-[1.2cqw] z-30 flex items-center gap-[1.2cqw] px-[1.2cqw] py-[1cqw]">
                  <span className="flex size-[3.6cqw] shrink-0 items-center justify-center rounded-[.5cqw] bg-[var(--px-red)]">
                    <Hand className="size-[2.2cqw] text-white" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1.75cqw] font-bold leading-tight text-white">
                      {holdProgress > 0
                        ? 'ค้างไว้อีกนิด...'
                        : liveLandmarks && !isForeground
                          ? 'เข้ามาใกล้กล้องอีกนิด'
                          : 'ชูมือ 5 นิ้ว เพื่อเริ่มถ่ายรูป'}
                    </p>
                    {holdProgress > 0 ? (
                      <div className="px-meter mt-[.5cqw]">
                        <span style={{ width: `${Math.max(0, Math.min(100, holdProgress))}%` }} />
                      </div>
                    ) : (
                      <p className="font-pixel mt-[.4cqw] text-[.66cqw] text-white/55">RAISE YOUR HAND TO START</p>
                    )}
                  </div>
                  <span className="font-pixel shrink-0 text-[.8cqw] text-[var(--px-gold)]">
                    {holdProgress > 0 ? `${Math.round(holdProgress)}%` : 'PRESS START'}
                  </span>
                </div>
              )}

              {/* Countdown 3..2..1 */}
              {isCountingDown && (
                <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/25">
                  <span className="px-title text-[12cqw] leading-none tabular-nums">{countdown}</span>
                  <div className="kc-dialog mt-[1.6cqw] px-[1.6cqw] py-[.7cqw] text-[1.3cqw] font-bold text-white">
                    <span className="font-pixel mr-[.8cqw] text-[1cqw] text-[var(--px-gold)]">READY?</span>
                    โพสท่าอิสระได้เลย!
                  </div>
                </div>
              )}

              {/* Shutter flash */}
              {isCapturing && <div className="kiosk-flash pointer-events-none absolute inset-0 z-50 bg-white" />}

              {/* Review: retake / timer / confirm */}
              {isPreviewing && (
                <div className="kc-dialog absolute inset-x-[1.2cqw] bottom-[1.2cqw] z-40 flex items-center justify-between gap-[1.2cqw] px-[1.2cqw] py-[.9cqw]">
                  <button type="button" onClick={handleRetake} className="group px-btn px-corners gap-[.8cqw] px-[1.2cqw] py-[.7cqw]">
                    <RotateCcw className="size-[1.4cqw] transition-transform group-hover:rotate-[-45deg]" />
                    <span className="text-left">
                      <span className="block text-[1.05cqw] font-bold text-white">กำมือ เพื่อถ่ายใหม่</span>
                      <span className="font-pixel-sm block text-[.7cqw] text-white/80">CONTINUE?</span>
                    </span>
                  </button>
                  <div className="text-center">
                    <div className="font-pixel text-[1.6cqw] text-[var(--px-gold)] tabular-nums">{previewSeconds}s</div>
                    <div className="font-pixel-sm text-[.65cqw] font-bold text-white/70">TIME</div>
                  </div>
                  <button type="button" onClick={handleConfirmUpload} className="px-btn px-btn-red px-corners gap-[.8cqw] px-[1.4cqw] py-[.7cqw]">
                    <Check className="size-[1.6cqw]" strokeWidth={2.5} />
                    <span className="text-left">
                      <span className="block text-[1.05cqw] font-bold text-white">แบมือ ยืนยันรูปนี้</span>
                      <span className="font-pixel-sm block text-[.7cqw] text-white/90">PRESS START</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            <p className="font-pixel mt-[.45cqw] text-[.68cqw] tracking-[.2em] text-[#8a8a94]">COMPUTER ENGINEERING</p>
          </div>
        </div>

        {/* Sent */}
        {isSyncing && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-[#0c0305]/90">
            <div className="space-y-[1.2cqw] text-center">
              <CheckCircle2 className="mx-auto size-[6cqw] animate-bounce text-[var(--px-green)]" />
              <p className="px-title text-[3.4cqw]">STAGE CLEAR!</p>
              <h2 className="text-[2.4cqw] font-black text-white">ส่งรูปเรียบร้อย!</h2>
              <p className="text-[1.3cqw] text-[var(--px-cream)]">
                เชิญสแกนรับรูปที่ <b>จอหมายเลข 2</b> รหัสรูป: <span className="font-pixel text-[var(--px-gold)]">{syncedCode}</span>
              </p>
            </div>
          </div>
        )}

        {/* Paused by staff */}
        {isPaused && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0c0305]/92">
            <div className="space-y-3 text-center">
              <Pause className="mx-auto size-16 text-[var(--px-gold)]" />
              <p className="font-pixel px-blink text-lg text-white">PAUSED</p>
              <h2 className="text-2xl font-bold text-white">พักบูธชั่วคราว</h2>
              <p className="text-xs text-[var(--px-cream)]/80">สตาฟกำลังดูแลความเรียบร้อย หรือจัดคิว</p>
              <button onClick={() => setIsPaused(false)} className="px-btn px-btn-red px-corners mt-4 px-4 py-2 text-xs">
                เปิดใช้งานต่อ
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function KioskCapturePage() {
  return (
    <SafeErrorBoundary fallbackTitle="หน้าจอสัมผัส Kiosk พบข้อขัดข้องชั่วคราว">
      <KioskCapturePageContent />
    </SafeErrorBoundary>
  );
}
