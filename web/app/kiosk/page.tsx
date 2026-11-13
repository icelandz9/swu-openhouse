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
  Sparkles,
} from 'lucide-react';
import { useKioskFSM } from '@/lib/kiosk/useKioskFSM';
import { ScreenSyncEvent, SCREEN_SYNC_CHANNEL, DEFAULT_PRODUCTION_APP_URL, PHOTO_ASPECT_RATIO, PhotoRatio, toPhotoRatio, FRAME_PHOTO_ASPECT } from '@/lib/contracts';
import { generateShortCode } from '@/lib/mobile/shortCodeGenerator';
import { classifyGesture } from '@/lib/ai-vision/gestureRules';
import { isHandInForeground } from '@/lib/ai-vision/depthAreaFilter';
import { pickNearestHandInCapture, type CaptureArea } from '@/lib/ai-vision/handPicker';
import { AdaptiveHandSmoother, drawHandMeshOnCanvas } from '@/lib/ai-vision/handTrackerFast';
import { calculateCrop } from '@/lib/kiosk/centerCropper';
import { HandMesh } from '@/components/HandMesh';
import { CpeLogo } from '@/components/CpeLogo';
import { SafeErrorBoundary } from '@/components/SafeErrorBoundary';
import {
  IndustrialScrew,
  BoltIcon,
  StereoSpeakerGrille,
  LeftWingHeader,
  RightWingHeader,
  TwinConsolePills,
  TwinStatusLeds,
  MechaGearDrive,
  MechaPixelAccent,
} from '@/components/ConsoleArtwork';

// The console screen is always 4:3. In frame mode the 934:1023 capture box sits centred in it:
// box width = (934/1023) / (4/3) = 68.5% of the screen, 15.8% dimmed on each side.
const CAPTURE_BOX_PCT = (FRAME_PHOTO_ASPECT / (4 / 3)) * 100;
const CAPTURE_SIDE_PCT = (100 - CAPTURE_BOX_PCT) / 2;

/** The capture crop as fractions of the camera frame: the area the kiosk screen marks as the photo. */
function captureAreaOf(videoWidth: number, videoHeight: number, ratio: PhotoRatio): CaptureArea {
  const vw = videoWidth || 1920;
  const vh = videoHeight || 1080;
  const crop = calculateCrop(vw, vh, ratio);
  return { left: crop.sx / vw, right: (crop.sx + crop.sWidth) / vw, top: crop.sy / vh, bottom: (crop.sy + crop.sHeight) / vh };
}

/** Camera picked by default when several are plugged in. Override with ?cam=<part of the name>. */
const DEFAULT_CAMERA_NAME = 'c922';

/**
 * Finds the camera whose name contains ?cam= (default "c922") and returns its deviceId,
 * or undefined so the browser uses its default camera.
 */
async function findPreferredCamera(): Promise<string | undefined> {
  try {
    const wanted = (new URLSearchParams(window.location.search).get('cam') || DEFAULT_CAMERA_NAME).toLowerCase();
    const listCameras = async () =>
      (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');

    let cams = await listCameras();
    // Camera names stay hidden until the page has camera permission, so ask once and list again.
    if (cams.length > 0 && cams.every((d) => !d.label)) {
      const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      probe.getTracks().forEach((t) => t.stop());
      cams = await listCameras();
    }

    console.info('[kiosk] cameras:', cams.map((d) => d.label));
    const camId = cams.find((d) => d.label.toLowerCase().includes(wanted))?.deviceId;
    console.info('[kiosk] want:', wanted, '→', camId ? 'found' : 'not found, using default');
    return camId;
  } catch (err) {
    console.warn('[kiosk] could not list cameras, using default:', err);
    return undefined;
  }
}
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
  const handAreaThresholdRef = useRef<number>(0.025);
  handAreaThresholdRef.current = handAreaThreshold;
  // 'frame' (default: the CPE frames' photo shape, 986x1080) or 4:3 landscape (wide, for groups); staff switch it in /admin
  const [photoRatio, setPhotoRatio] = useState<PhotoRatio>(PHOTO_ASPECT_RATIO);
  // Read by the hand-tracking loop, which does not re-subscribe when the ratio changes
  const photoRatioRef = useRef<PhotoRatio>(PHOTO_ASPECT_RATIO);
  photoRatioRef.current = photoRatio;
  const currentStreamRef = useRef<MediaStream | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const isPausedRef = useRef<boolean>(isPaused);
  isPausedRef.current = isPaused;
  const cameraActiveRef = useRef<boolean>(cameraActive);
  cameraActiveRef.current = cameraActive;
  const isPreviewingRef = useRef<boolean>(isPreviewing);
  isPreviewingRef.current = isPreviewing;

  // Gesture detection & tracking (Direct Canvas 2D + Fast Pipeline: zero per-frame React state churn)
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const holdProgressRef = useRef<number>(0);
  const holdBarFillRef = useRef<HTMLSpanElement | null>(null);
  const [hasHand, setHasHand] = useState<boolean>(false);
  const prevHasHandRef = useRef<boolean>(false);
  const [detectedGestureText, setDetectedGestureText] = useState<string>('NONE');
  const [isForeground, setIsForeground] = useState<boolean>(true);
  const handCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handSmootherRef = useRef<AdaptiveHandSmoother>(new AdaptiveHandSmoother());
  const inferenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);
  const lastPalmSeenTimeRef = useRef<number>(0);
  const prevDetectedGestureRef = useRef<string>('NONE');
  const prevIsForegroundRef = useRef<boolean>(true);
  const prevHoldProgressIntRef = useRef<number>(0);
  const previewGestureLockRef = useRef<boolean>(false);
  const previewEnterTimeRef = useRef<number>(0);
  const fistHoldStartTimeRef = useRef<number | null>(null);

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
            handAreaThresholdRef.current = parsed;
            setHandAreaThreshold(parsed);
          }
        }
        const savedCountdown = localStorage.getItem('swu_countdown_seconds');
        if (savedCountdown) {
          const parsedCd = parseInt(savedCountdown, 10);
          if (!isNaN(parsedCd) && parsedCd >= 1 && parsedCd <= 15) {
            defaultCountdownRef.current = parsedCd;
            setCountdown(parsedCd);
          }
        }
        const savedRatio = localStorage.getItem('swu_photo_ratio');
        const ratio = toPhotoRatio(savedRatio);
        if (ratio) setPhotoRatio(ratio);
      } catch {}
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'swu_hand_threshold' && e.newValue) {
        const parsed = parseFloat(e.newValue);
        if (!isNaN(parsed) && parsed >= 0.005 && parsed <= 0.1) {
          handAreaThresholdRef.current = parsed;
          setHandAreaThreshold(parsed);
        }
      } else if (e.key === 'swu_countdown_seconds' && e.newValue) {
        const parsedCd = parseInt(e.newValue, 10);
        if (!isNaN(parsedCd) && parsedCd >= 1 && parsedCd <= 15) {
          defaultCountdownRef.current = parsedCd;
          setCountdown(parsedCd);
        }
      } else if (e.key === 'swu_photo_ratio' && e.newValue) {
        const ratio = toPhotoRatio(e.newValue);
        if (ratio) setPhotoRatio(ratio);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
    }

    const channel = new BroadcastChannel(SCREEN_SYNC_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<ScreenSyncEvent>) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'SCREEN1_RESET') {
        send({ type: 'FORCE_RESET' });
        holdStartTimeRef.current = null;
        fistHoldStartTimeRef.current = null;
        holdProgressRef.current = 0;
        prevHoldProgressIntRef.current = 0;
        setHoldProgress(0);
        setCountdown(defaultCountdownRef.current);
        previewGestureLockRef.current = false;
        setIsPaused(false);
      } else if (data.type === 'STAFF_TRIGGER_CAPTURE') {
        setIsPaused(false);
        setCountdown(defaultCountdownRef.current);
        send({ type: 'STAFF_TRIGGER' });
      } else if (data.type === 'KIOSK_COMMAND') {
        if (data.command === 'STAFF_TRIGGER' || data.command === 'TRIGGER_SHUTTER') {
          setIsPaused(false);
          setCountdown(defaultCountdownRef.current);
          send({ type: 'STAFF_TRIGGER' });
        } else if (data.command === 'RESET_STANDBY') {
          send({ type: 'FORCE_RESET' });
          holdProgressRef.current = 0;
          prevHoldProgressIntRef.current = 0;
          setHoldProgress(0);
          setCountdown(defaultCountdownRef.current);
          holdStartTimeRef.current = null;
          fistHoldStartTimeRef.current = null;
          previewGestureLockRef.current = false;
          setIsPaused(false);
        } else if (data.command === 'SKIP_PREVIEW') {
          if (isPreviewingRef.current) {
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
          setCountdown(defaultCountdownRef.current);
          holdProgressRef.current = 0;
          prevHoldProgressIntRef.current = 0;
          setHoldProgress(0);
          holdStartTimeRef.current = null;
        } else if (data.command === 'SET_COUNTDOWN') {
          if (typeof data.value === 'number' && data.value >= 1 && data.value <= 15) {
            defaultCountdownRef.current = data.value;
            setCountdown(data.value);
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('swu_countdown_seconds', data.value.toString()); } catch {}
            }
          }
        } else if (data.command === 'SET_THRESHOLD') {
          if (typeof data.value === 'number' && data.value >= 0.005 && data.value <= 0.1) {
            handAreaThresholdRef.current = data.value;
            setHandAreaThreshold(data.value);
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('swu_hand_threshold', data.value.toString()); } catch {}
            }
          }
        } else if (data.command === 'SET_PHOTO_RATIO') {
          const ratio = toPhotoRatio(data.value);
          if (ratio) {
            setPhotoRatio(ratio);
            if (typeof window !== 'undefined') {
              try { localStorage.setItem('swu_photo_ratio', ratio); } catch {}
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
              state: stateRef.current,
              isPaused: isPausedRef.current,
              cameraActive: cameraActiveRef.current,
              fps: fpsCounterRef.current.currentFps || 60,
              resolution: resText,
              aiLatencyMs: lastAiLatencyRef.current || 11,
              threshold: handAreaThresholdRef.current,
              countdownSeconds: defaultCountdownRef.current,
              photoRatio: photoRatioRef.current,
            },
          });
        } catch {}
      }
    };

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
      }
      try {
        channel.close();
      } catch {}
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [send]);

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
    holdProgressRef.current = 0;
    prevHoldProgressIntRef.current = 0;
    setHoldProgress(0);
    holdStartTimeRef.current = null;
    fistHoldStartTimeRef.current = null;
    setCountdown(defaultCountdownRef.current);
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

      const camId = await findPreferredCamera();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60, min: 30 },
            ...(camId ? { deviceId: { exact: camId } } : { facingMode: 'user' }),
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('1080p camera constraint failed, attempting basic video constraint:', firstErr);
        stream = await navigator.mediaDevices
          .getUserMedia({ video: camId ? { deviceId: { exact: camId } } : true, audio: false })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
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
            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 720;

            // Fast Pipeline: Downsample high-res video to a 640px-wide offscreen canvas (up to 9x fewer pixels to upload/process)
            let inferenceSource: HTMLVideoElement | HTMLCanvasElement = video;
            if (vw > 640 && typeof document !== 'undefined') {
              let infCanvas = inferenceCanvasRef.current;
              if (!infCanvas) {
                infCanvas = document.createElement('canvas');
                inferenceCanvasRef.current = infCanvas;
              }
              const targetW = 640;
              const targetH = Math.max(360, Math.round((vh / vw) * targetW));
              if (infCanvas.width !== targetW || infCanvas.height !== targetH) {
                infCanvas.width = targetW;
                infCanvas.height = targetH;
              }
              const infCtx = infCanvas.getContext('2d', { alpha: false });
              if (infCtx) {
                infCtx.drawImage(video, 0, 0, targetW, targetH);
                inferenceSource = infCanvas;
              }
            }

            const tStart = performance.now();
            const results = landmarker.detectForVideo(inferenceSource, tStart);
            lastAiLatencyRef.current = Math.max(1, Math.round(performance.now() - tStart));

            // Only hands inside the capture area count, and of those the nearest one
            const pickIdx = results?.landmarks?.length
              ? pickNearestHandInCapture(results.landmarks, captureAreaOf(vw, vh, photoRatioRef.current))
              : -1;

            if (pickIdx >= 0) {
              const primaryHand = results.landmarks[pickIdx];
              const worldHand = results.worldLandmarks?.[pickIdx];
              const handedness = results.handedness?.[pickIdx]?.[0]?.categoryName ?? 'Right';
              const aspect = vw > 0 && vh > 0 ? vw / vh : 4 / 3;

              // Update velocity-aware smoother immediately (zero React state re-render)
              handSmootherRef.current.update(primaryHand, nowPerf);
              if (!prevHasHandRef.current) {
                prevHasHandRef.current = true;
                setHasHand(true);
              }

              // Run the updated 5-finger palm facing model
              const detected = classifyGesture(primaryHand, worldHand, handedness, aspect);
              if (prevDetectedGestureRef.current !== detected) {
                prevDetectedGestureRef.current = detected;
                setDetectedGestureText(detected);
              }

              // Depth & Area Filter: reject distant background passers-by
              const inForeground = isHandInForeground(primaryHand, handAreaThresholdRef.current);
              if (prevIsForegroundRef.current !== inForeground) {
                prevIsForegroundRef.current = inForeground;
                setIsForeground(inForeground);
              }

              if (isIdle || isDetecting) {
                if (detected === 'OPEN_PALM' && inForeground) {
                  lastPalmSeenTimeRef.current = nowPerf;
                  if (holdStartTimeRef.current === null) {
                    holdStartTimeRef.current = nowPerf;
                    send({ type: 'HAND_DETECTED' });
                  }
                } else {
                  const timeSinceLast = nowPerf - (lastPalmSeenTimeRef.current || 0);
                  if (timeSinceLast > 500) {
                    if (holdStartTimeRef.current !== null) {
                      holdStartTimeRef.current = null;
                      holdProgressRef.current = 0;
                      prevHoldProgressIntRef.current = 0;
                      setHoldProgress(0);
                      send({ type: 'HAND_LOST' });
                    }
                  }
                }
              } else if (isPreviewing && !previewGestureLockRef.current) {
                const timeInPreview = nowPerf - previewEnterTimeRef.current;
                // Grace period: ignore first 1.5s of preview so lingering posing hand does not accidentally trigger retake/confirm
                if (timeInPreview > 1500) {
                  if (detected === 'FIST') {
                    holdStartTimeRef.current = null;
                    if (fistHoldStartTimeRef.current === null) {
                      fistHoldStartTimeRef.current = nowPerf;
                    }
                    const fistHold = nowPerf - fistHoldStartTimeRef.current;
                    if (fistHold >= 800) {
                      previewGestureLockRef.current = true;
                      fistHoldStartTimeRef.current = null;
                      handleRetake();
                    }
                  } else if (detected === 'OPEN_PALM') {
                    fistHoldStartTimeRef.current = null;
                    // Require deliberate hold (800ms) during preview to confirm
                    if (holdStartTimeRef.current === null) {
                      holdStartTimeRef.current = nowPerf;
                    }
                    const palmHold = nowPerf - holdStartTimeRef.current;
                    if (palmHold >= 800) {
                      previewGestureLockRef.current = true;
                      holdStartTimeRef.current = null;
                      handleConfirmUploadRef.current();
                    }
                  } else {
                    fistHoldStartTimeRef.current = null;
                    holdStartTimeRef.current = null;
                  }
                }
              }
            } else {
              handSmootherRef.current.reset();
              if (prevHasHandRef.current) {
                prevHasHandRef.current = false;
                setHasHand(false);
              }
              if (prevDetectedGestureRef.current !== 'NONE') {
                prevDetectedGestureRef.current = 'NONE';
                setDetectedGestureText('NONE');
              }
              if (!prevIsForegroundRef.current) {
                prevIsForegroundRef.current = true;
                setIsForeground(true);
              }
              const timeSinceLast = nowPerf - (lastPalmSeenTimeRef.current || 0);
              if (timeSinceLast > 500) {
                if (holdStartTimeRef.current !== null) {
                  holdStartTimeRef.current = null;
                  holdProgressRef.current = 0;
                  prevHoldProgressIntRef.current = 0;
                  setHoldProgress(0);
                  if (isIdle || isDetecting) {
                    send({ type: 'HAND_LOST' });
                  }
                }
              }
            }
          } catch {}
        }

        // 60/120Hz Continuous Hold Progress + Direct Canvas 2D Skeleton Rendering (runs every monitor refresh)
        if ((isIdle || isDetecting) && holdStartTimeRef.current !== null && prevHasHandRef.current && prevDetectedGestureRef.current === 'OPEN_PALM' && prevIsForegroundRef.current) {
          const elapsed = nowPerf - holdStartTimeRef.current;
          const progress = Math.min(100, (elapsed / 1500) * 100);
          holdProgressRef.current = progress;
          if (holdBarFillRef.current) {
            holdBarFillRef.current.style.width = `${progress}%`;
          }
          const pInt = Math.floor(progress);
          if (pInt !== prevHoldProgressIntRef.current) {
            prevHoldProgressIntRef.current = pInt;
            setHoldProgress(progress);
          }
          if (elapsed >= 1500) {
            holdStartTimeRef.current = null;
            holdProgressRef.current = 100;
            setHoldProgress(100);
            send({ type: 'TRIGGER_ACTIVATED' });
          }
        } else if (holdStartTimeRef.current === null && holdProgressRef.current !== 0) {
          holdProgressRef.current = 0;
          if (holdBarFillRef.current) {
            holdBarFillRef.current.style.width = '0%';
          }
        } else if (holdBarFillRef.current && holdProgressRef.current > 0) {
          holdBarFillRef.current.style.width = `${holdProgressRef.current}%`;
        }

        const overlayCanvas = handCanvasRef.current;
        if (overlayCanvas) {
          const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
          const targetW = Math.round(overlayCanvas.clientWidth * dpr);
          const targetH = Math.round(overlayCanvas.clientHeight * dpr);
          if (targetW > 0 && targetH > 0 && (overlayCanvas.width !== targetW || overlayCanvas.height !== targetH)) {
            overlayCanvas.width = targetW;
            overlayCanvas.height = targetH;
          }
          const ctx = overlayCanvas.getContext('2d');
          if (ctx) {
            const activePoints =
              (isIdle || isDetecting) && prevHasHandRef.current
                ? handSmootherRef.current.sample(nowPerf)
                : null;
            drawHandMeshOnCanvas(ctx, overlayCanvas.width, overlayCanvas.height, {
              landmarks: activePoints,
              holdProgress: holdProgressRef.current,
              isForeground: prevIsForegroundRef.current,
              videoWidth: video.videoWidth || 16,
              videoHeight: video.videoHeight || 9,
              containerAspect: 4 / 3,
            });
          }
        }
      }

      animId = requestAnimationFrame(detectLoop);
    };

    animId = requestAnimationFrame(detectLoop);
    return () => cancelAnimationFrame(animId);
  }, [isIdle, isDetecting, isPreviewing, isPaused, send, handleRetake, handleConfirmUpload]);

  // Countdown timer logic (3..2..1 or 5..1 / 8..1 configured by /admin)
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
          setCountdown(defaultCountdownRef.current);
        }
      }, 1000);
    } else {
      setCountdown(defaultCountdownRef.current);
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
      holdStartTimeRef.current = null;
      fistHoldStartTimeRef.current = null;
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
        holdProgressRef.current = 0;
        prevHoldProgressIntRef.current = 0;
        setHoldProgress(0);
        setCountdown(defaultCountdownRef.current);
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
        <div className="kc-body kc-px absolute inset-[.8cqw]">
          {/* Crimson corner plates with authentic industrial screws */}
          <div className="kc-cap kc-px kc-cap-tl" aria-hidden>
            <IndustrialScrew className="absolute left-[1.6cqw] top-[1.6cqw] size-[1.4cqw]" />
          </div>
          <div className="kc-cap kc-px kc-cap-tr" aria-hidden>
            <IndustrialScrew className="absolute right-[1.6cqw] top-[1.6cqw] size-[1.4cqw]" />
          </div>
          <div className="kc-cap kc-px kc-cap-bl" aria-hidden>
            <IndustrialScrew className="absolute bottom-[1.6cqw] left-[1.6cqw] size-[1.4cqw]" />
          </div>
          <div className="kc-cap kc-px kc-cap-br" aria-hidden>
            <IndustrialScrew className="absolute bottom-[1.6cqw] right-[1.6cqw] size-[1.4cqw]" />
          </div>

          {/* Left Wing: Perfectly Symmetrical 6-Tier Console Layout */}
          <div className="absolute inset-y-0 left-0 flex w-[17cqw] flex-col items-center justify-between pt-[2.6cqw] pb-[4.4cqw] px-[1cqw]">
            {/* Tier 1: Header (SMO Engineering Logo + Slogan) */}
            <div className="flex h-[5.4cqw] items-center justify-center">
              <LeftWingHeader />
            </div>

            {/* Tier 2: Primary Controls (Tactile 3D D-Pad in Recessed Well) */}
            <div className="relative flex size-[8.6cqw] shrink-0 items-center justify-center rounded-full bg-[#141720] border border-[#2b3140] shadow-[inset_0_2px_5px_rgba(0,0,0,0.85),0_1px_0_rgba(255,255,255,0.05)]" aria-hidden>
              <div className="relative size-[7.6cqw]">
                <span className="kc-dpad absolute left-1/2 top-0 h-full w-[33%] -translate-x-1/2 rounded-[.1cqw]" />
                <span className="kc-dpad absolute left-0 top-1/2 h-[33%] w-full -translate-y-1/2 rounded-[.1cqw]" />
                <span className="absolute left-1/2 top-1/2 size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4a0810] border border-[#6b0f19] shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)]" />
              </div>
            </div>

            {/* Tier 3: Secondary Controls (Tactile Console Pills: SELECT / START) */}
            <div className="flex h-[2.8cqw] items-center justify-center">
              <TwinConsolePills pill1="SELECT" pill2="START" />
            </div>

            {/* Tier 4: Stereo Acoustic Speaker Grille & Status LEDs (CAM / HAND) */}
            <div className="flex flex-col items-center gap-[.8cqw]">
              <StereoSpeakerGrille />
              <TwinStatusLeds
                led1={{ label: 'CAM', on: cameraActive, color: 'bg-[#10b981]', shadow: 'shadow-[0_0_8px_#10b981,inset_0_1px_1px_#a7f3d0]' }}
                led2={{ label: 'HAND', on: hasHand, color: 'bg-[#06b6d4]', shadow: 'shadow-[0_0_8px_#06b6d4,inset_0_1px_1px_#a5f3fc]' }}
              />
            </div>

            {/* Tier 5: Signature Anchor Artwork (Mecha Gear Drive) */}
            <div className="flex items-end justify-center">
              <MechaGearDrive />
            </div>
          </div>

          {/* Right Wing: Perfectly Symmetrical 6-Tier Console Layout */}
          <div className="absolute inset-y-0 right-0 flex w-[17cqw] flex-col items-center justify-between pt-[2.6cqw] pb-[4.4cqw] px-[1cqw]">
            {/* Tier 1: Header (SWU Open House Badge + Slogan) */}
            <div className="flex h-[5.4cqw] items-center justify-center">
              <RightWingHeader />
            </div>

            {/* Tier 2: Primary Controls (4 Engineering Action Buttons in Recessed Well) */}
            <div className="relative flex size-[8.6cqw] shrink-0 items-center justify-center rounded-full bg-[#141720] border border-[#2b3140] shadow-[inset_0_2px_5px_rgba(0,0,0,0.85),0_1px_0_rgba(255,255,255,0.05)]" aria-hidden>
              <div className="grid grid-cols-3 grid-rows-3 gap-[.25cqw] size-[7.6cqw]">
                <span />
                <span className="kc-btn size-[2.35cqw]" title="Gear (Cog)"><Cog className="size-[1.3cqw] drop-shadow" /></span>
                <span />
                <span className="kc-btn size-[2.35cqw]" title="Safety Helmet"><HardHat className="size-[1.3cqw] drop-shadow" /></span>
                <span />
                <span className="kc-btn size-[2.35cqw]" title="Wrench"><Wrench className="size-[1.3cqw] drop-shadow" /></span>
                <span />
                <span className="kc-btn size-[2.35cqw]" title="Screw / Bolt"><BoltIcon className="size-[1.3cqw] drop-shadow" /></span>
                <span />
              </div>
            </div>

            {/* Tier 3: Secondary Controls (Tactile Console Pills: RESET / TURBO) */}
            <div className="flex h-[2.8cqw] items-center justify-center">
              <TwinConsolePills pill1="RESET" pill2="TURBO" />
            </div>

            {/* Tier 4: Stereo Acoustic Speaker Grille & Status LEDs (LIVE / AI) */}
            <div className="flex flex-col items-center gap-[.8cqw]">
              <StereoSpeakerGrille />
              <TwinStatusLeds
                led1={{ label: 'LIVE', on: cameraActive, color: 'bg-[#ef4444]', shadow: 'shadow-[0_0_8px_#ef4444,inset_0_1px_1px_#fca5a5]' }}
                led2={{ label: 'AI', on: Boolean(hasHand || isDetecting), color: 'bg-[#f59e0b]', shadow: 'shadow-[0_0_8px_#f59e0b,inset_0_1px_1px_#fde68a]' }}
              />
            </div>

            {/* Tier 5: Signature Anchor Artwork (Mecha Mascot) */}
            <div className="flex items-end justify-center">
              <MechaPixelAccent />
            </div>
          </div>

          {/* Screen bezel */}
          <div
            style={{ width: '66cqw' }}
            className="kc-bezel kc-px absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center px-[1.8cqw] pb-[.6cqw] pt-[.6cqw]">
            <div className="flex items-center justify-between w-full px-[.6cqw] mb-[.45cqw] font-pixel text-[.74cqw]">
              <span className="text-[#cbd5e1] tracking-wider">
                SWU OPEN HOUSE <span className="text-[var(--px-red-hi)]">2026</span>
              </span>
              <span className="text-[#64748b] text-[.6cqw]">· FACULTY OF ENGINEERING ·</span>
              <span className="text-[#94a3b8] text-[.62cqw]">14-15 NOV</span>
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

              {/* Direct GPU Canvas 2D Hand Skeleton Overlay (Zero React Re-render per frame) */}
              {(isIdle || isDetecting) && showLiveFeed && (
                <HandMesh
                  canvasRef={handCanvasRef}
                  active={hasHand}
                  mode="overlay"
                  containerAspect={4 / 3}
                />
              )}

              {/* HUD: player + lives, LIVE, camera tool, viewfinder corners */}
              {showLiveFeed && cameraActive && (
                <>
                  {/* PLAYER 1 + Hearts (Top-Left Badge) */}
                  <div
                    style={photoRatio === 'frame' ? { left: `calc(${CAPTURE_SIDE_PCT}% + 3.8cqw)`, top: '1.4cqw' } : { left: '1.2cqw', top: '1.1cqw' }}
                    className="kc-hud-pill font-pixel pointer-events-none absolute z-30 flex items-center gap-[.45cqw] px-[.65cqw] py-[.35cqw] text-[.64cqw] text-white rounded-[.35cqw]"
                  >
                    <span className="tracking-wider">PLAYER 1</span>
                    <span className="flex gap-[.18cqw] text-[var(--px-red-hi)]">
                      {[0, 1, 2].map((i) => (
                        <Heart key={i} className="size-[.68cqw] drop-shadow-[0_0_4px_#ff2a4b]" fill="currentColor" strokeWidth={0} />
                      ))}
                    </span>
                  </div>

                  {/* Top-Center Camera Quick-Control Pill (as seen in Image 1) */}
                  <div
                    style={{ left: '50%', top: '1.4cqw' }}
                    className="kc-hud-pill pointer-events-auto absolute z-30 flex -translate-x-1/2 items-center gap-[.4cqw] px-[.6cqw] py-[.3cqw] rounded-[.35cqw]"
                  >
                    <button
                      type="button"
                      onClick={() => initCamera()}
                      title="สลับกล้อง / เชื่อมต่อใหม่"
                      className="flex items-center justify-center p-[.2cqw] text-[#cbd5e1] hover:text-white transition-colors"
                    >
                      <Camera className="size-[1.1cqw]" />
                    </button>
                    <span className="h-[1cqw] w-px bg-white/20" />
                    <div className="flex items-center gap-[.2cqw] text-[.55cqw] font-pixel text-[#94a3b8]">
                      <Sparkles className="size-[.9cqw] text-[var(--px-gold)]" />
                    </div>
                  </div>

                  {/* LIVE Status Badge (Top-Right Badge) */}
                  <div
                    style={photoRatio === 'frame' ? { right: `calc(${CAPTURE_SIDE_PCT}% + 3.8cqw)`, top: '1.4cqw' } : { right: '1.2cqw', top: '1.1cqw' }}
                    className="kc-hud-pill font-pixel pointer-events-none absolute z-30 flex items-center gap-[.4cqw] px-[.65cqw] py-[.35cqw] text-[.64cqw] text-white rounded-[.35cqw]"
                  >
                    <span className="size-[.55cqw] animate-pulse rounded-[.1cqw] bg-[#ff2a4b] shadow-[0_0_8px_#ff2a4b]" />
                    <span className="tracking-widest">LIVE</span>
                  </div>

                  {photoRatio === 'frame' ? (
                    <>
                      {/* Capture area. Frame crop (934:1023) is centered with dimmed pillarboxes */}
                      <div style={{ width: `${CAPTURE_SIDE_PCT}%` }} className="pointer-events-none absolute inset-y-0 left-0 z-20 bg-black/60 backdrop-blur-[1px]" aria-hidden />
                      <div style={{ width: `${CAPTURE_SIDE_PCT}%` }} className="pointer-events-none absolute inset-y-0 right-0 z-20 bg-black/60 backdrop-blur-[1px]" aria-hidden />
                      <div
                        style={{ left: `${CAPTURE_SIDE_PCT}%`, width: `${CAPTURE_BOX_PCT}%` }}
                        className="pointer-events-none absolute inset-y-0 z-20 shadow-[inset_0_0_0_.25cqw_rgba(255,255,255,.9)]"
                        aria-hidden
                      >
                        <div className="kc-brackets absolute inset-[1.2cqw]" />
                      </div>
                    </>
                  ) : (
                    <div className="kc-brackets pointer-events-none absolute inset-x-[3cqw] bottom-[9.5cqw] top-[4cqw] z-20" aria-hidden />
                  )}
                </>
              )}

              {/* Dialog box: what to do now (Image 1 Composition) */}
              {(isIdle || isDetecting) && showLiveFeed && cameraActive && (
                <div
                  style={
                    photoRatio === 'frame'
                      ? { left: `calc(${CAPTURE_SIDE_PCT}% + 1.6cqw)`, right: `calc(${CAPTURE_SIDE_PCT}% + 1.6cqw)` }
                      : { left: '3cqw', right: '3cqw' }
                  }
                  className="kc-dialog kc-px pointer-events-none absolute bottom-[2.2cqw] z-30 flex items-center gap-[.9cqw] px-[1cqw] py-[.7cqw]"
                >
                  <span className="flex size-[2.8cqw] shrink-0 items-center justify-center rounded-[.5cqw] bg-gradient-to-br from-[#e63946] to-[#8b1522] shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_3px_8px_rgba(0,0,0,0.6)]">
                    <Hand className="size-[1.7cqw] text-white drop-shadow" strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[1.25cqw] font-bold leading-tight text-white drop-shadow">
                      {holdProgress > 0
                        ? 'ค้างไว้อีกนิด...'
                        : hasHand && !isForeground
                          ? 'เข้ามาใกล้กล้องอีกนิด'
                          : 'ชูมือ 5 นิ้ว เพื่อเริ่มถ่ายรูป'}
                    </p>
                    {holdProgress > 0 ? (
                      <div className="px-meter mt-[.35cqw] h-[.8cqw] w-full overflow-hidden bg-[#0d1017] border border-[#333d4e] rounded-[.25cqw] p-[.1cqw]">
                        <span
                          ref={holdBarFillRef}
                          className="block h-full rounded-[.15cqw] bg-gradient-to-r from-[#ef4444] via-[#f59e0b] to-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.55)]"
                          style={{ width: `${Math.max(0, Math.min(100, holdProgress))}%`, backgroundSize: '100% 100%' }}
                        />
                      </div>
                    ) : (
                      <p className="font-pixel mt-[.3cqw] truncate text-[.52cqw] text-[#94a3b8] tracking-wider">RAISE YOUR HAND TO START</p>
                    )}
                  </div>
                  <span
                    className={`font-pixel shrink-0 text-[.68cqw] tabular-nums ${
                      holdProgress > 0
                        ? 'text-[var(--px-gold)] [text-shadow:0_0_8px_rgba(255,204,0,0.85)]'
                        : 'text-[var(--px-gold)] animate-pulse [text-shadow:0_0_8px_rgba(255,204,0,0.6)]'
                    }`}
                  >
                    {holdProgress > 0 ? `${Math.round(holdProgress)}%` : 'PRESS START'}
                  </span>
                </div>
              )}

              {/* Countdown 3..2..1 */}
              {isCountingDown && (
                <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/25">
                  <span className="px-title text-[12cqw] leading-none tabular-nums">{countdown}</span>
                  <div className="kc-dialog kc-px mt-[1.6cqw] px-[1.6cqw] py-[.7cqw] text-[1.3cqw] font-bold text-white">
                    <span className="font-pixel mr-[.8cqw] text-[1cqw] text-[var(--px-gold)]">READY?</span>
                    โพสท่าอิสระได้เลย!
                  </div>
                </div>
              )}

              {/* Shutter flash */}
              {isCapturing && <div className="kiosk-flash pointer-events-none absolute inset-0 z-50 bg-white" />}

              {/* Review: retake / timer / confirm */}
              {isPreviewing && (
                // Compact review bar, kept inside the photo (which is centred in the screen in frame mode)
                <div
                  style={
                    photoRatio === 'frame'
                      ? { left: `calc(${CAPTURE_SIDE_PCT}% + 1.6cqw)`, right: `calc(${CAPTURE_SIDE_PCT}% + 1.6cqw)` }
                      : { left: '3cqw', right: '3cqw' }
                  }
                  className="kc-dialog kc-px absolute bottom-[2.2cqw] z-40 flex items-center justify-between gap-[.8cqw] px-[.8cqw] py-[.6cqw]"
                >
                  <button type="button" onClick={handleRetake} className="group px-btn px-corners gap-[.5cqw] px-[.8cqw] py-[.5cqw]">
                    <RotateCcw className="size-[1cqw] transition-transform group-hover:rotate-[-45deg]" />
                    <span className="text-left">
                      <span className="block text-[.8cqw] font-bold text-white">กำมือ เพื่อถ่ายใหม่</span>
                      <span className="font-pixel-sm block text-[.5cqw] text-white/80">CONTINUE?</span>
                    </span>
                  </button>
                  <div className="text-center">
                    <div className="font-pixel text-[1.15cqw] text-[var(--px-gold)] tabular-nums">{previewSeconds}s</div>
                    <div className="font-pixel-sm text-[.48cqw] font-bold text-white/70">TIME</div>
                  </div>
                  <button type="button" onClick={handleConfirmUpload} className="px-btn px-btn-red px-corners gap-[.5cqw] px-[.9cqw] py-[.5cqw]">
                    <Check className="size-[1.1cqw]" strokeWidth={2.5} />
                    <span className="text-left">
                      <span className="block text-[.8cqw] font-bold text-white">แบมือ ยืนยันรูปนี้</span>
                      <span className="font-pixel-sm block text-[.5cqw] text-white/90">PRESS START</span>
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
