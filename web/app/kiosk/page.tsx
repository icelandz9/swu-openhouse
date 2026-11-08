'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Hand,
  Timer,
  QrCode,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Camera,
  Pause,
  Sliders,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useKioskFSM } from '@/lib/kiosk/useKioskFSM';
import { ScreenSyncEvent, CROP_DIMENSIONS_4_3, SCREEN_SYNC_CHANNEL } from '@/lib/contracts';
import { generateShortCode } from '@/lib/mobile/shortCodeGenerator';
import { classifyGesture, LandmarkPoint } from '@/lib/ai-vision/gestureRules';
import { isHandInForeground } from '@/lib/ai-vision/depthAreaFilter';
import { calculate43Crop } from '@/lib/kiosk/centerCropper';
import { HandMesh } from '@/components/HandMesh';
import { MemeSticker } from '@/components/MemeSticker';
import {
  EyesWideTracker,
  FACE_MEMORY_MS,
  FaceInfo,
  MEME_FILES,
  MemeName,
  MemeTracker,
  Rect,
  eyesWideScore,
  isNosePinched,
  placeBesideFace,
  readFace,
} from '@/lib/ai-vision/memeRules';
import { CpeLogo } from '@/components/CpeLogo';

const CAMERA_STORAGE_KEY = 'kiosk.cameraId';
// Virtual cameras (OBS and similar) open fine but show nothing unless their app is
// running, so a real camera goes first unless staff picked one.
const VIRTUAL_CAMERA_PATTERN = /virtual/i;

function readSavedCameraId(): string | undefined {
  try {
    return localStorage.getItem(CAMERA_STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function saveCameraId(deviceId: string) {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, deviceId);
  } catch {}
}

function describeCameraError(err: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return `เบราว์เซอร์ปิดกล้องเมื่อเปิดผ่าน IP — ให้เปิด http://localhost:${window.location.port || '3000'}/kiosk บนเครื่องที่ต่อกล้อง`;
  }
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'ไม่ได้รับสิทธิ์ใช้กล้อง — กดไอคอนกล้องที่แถบ URL แล้วเลือกอนุญาต';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'กล้องถูกโปรแกรมอื่นใช้อยู่ (เช่น OBS, Zoom, Teams หรือแท็บ /kiosk อีกแท็บ) — ปิดแล้วกดเชื่อมต่อใหม่';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'ไม่พบกล้อง — ต่อกล้องแล้วกดเชื่อมต่อใหม่';
  }
  return `เปิดกล้องไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`;
}

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
  const initCameraRef = useRef<(deviceId?: string) => Promise<void>>(() => Promise.resolve());
  const cameraRequestRef = useRef<number>(0);
  const handleConfirmUploadRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // Palm hold, preview timer, keyboard, button and staff command can all confirm; only the first one uploads.
  const uploadInFlightRef = useRef<boolean>(false);

  // Camera & Stream state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | undefined>(undefined);
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
  const previewGestureLockRef = useRef<boolean>(false);
  const previewEnterTimeRef = useRef<number>(0);

  const [countdown, setCountdown] = useState<number>(3);
  const [previewSeconds, setPreviewSeconds] = useState<number>(10);
  const [retakeCount, setRetakeCount] = useState<number>(0);

  // Captured snapshot URL
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string>('/sample-photo.jpg');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const [syncedCode, setSyncedCode] = useState<string>('');
  const [staffPinModal, setStaffPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');

  // MediaPipe references
  const landmarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Meme stickers: a meme gesture pops a GIF up beside the cheek (see lib/ai-vision/memeRules.ts)
  const faceLandmarkerRef = useRef<any>(null);
  const faceRef = useRef<FaceInfo | null>(null);
  const faceSeenAtRef = useRef<number>(-Infinity);
  const eyesScoreRef = useRef<number | null>(null);
  const eyesTrackerRef = useRef(new EyesWideTracker());
  const memeTrackerRef = useRef(new MemeTracker());
  const memeAspectRef = useRef<Partial<Record<MemeName, number>>>({});
  const memeStillRef = useRef<Partial<Record<MemeName, CanvasImageSource>>>({});
  const forceMemeUntilRef = useRef<number>(0);
  const faceFrameRef = useRef<number>(0);
  const stickerRef = useRef<{ meme: MemeName; rect: Rect } | null>(null);
  const [sticker, setSticker] = useState<{ meme: MemeName; rect: Rect } | null>(null);

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

          // A meme showing right now goes into the photo too, unmirrored
          const shown = stickerRef.current;
          const still = shown ? memeStillRef.current[shown.meme] : undefined;
          if (shown && still) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            const w = ((shown.rect.w * video.videoWidth) / crop.sWidth) * canvas.width;
            const h = ((shown.rect.h * video.videoHeight) / crop.sHeight) * canvas.height;
            const x = canvas.width - ((shown.rect.x * video.videoWidth - crop.sx) / crop.sWidth) * canvas.width - w;
            const y = ((shown.rect.y * video.videoHeight - crop.sy) / crop.sHeight) * canvas.height;
            ctx.drawImage(still, x, y, w, h);
          }
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
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      let qrUrl = `${origin}/p/${code}`;
      let finalPhotoUrl = capturedPhotoUrl;

      // Check if custom booth host configured in localStorage
      let hasCustomHost = false;
      let configuredHost = '';
      if (typeof window !== 'undefined') {
        const rawHost = localStorage.getItem('swu_booth_host');
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
          if (data.qrUrl && !hasCustomHost) qrUrl = data.qrUrl;
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
        createdAt: new Date().toISOString(),
      };

      // 3. Broadcast to Screen 2 & 3 via BroadcastChannel
      channelRef.current?.postMessage(syncEvent);

      // 4. Save to localStorage for cross-window / tab reliability
      if (typeof window !== 'undefined') {
        localStorage.setItem('swu_latest_photo', JSON.stringify(syncEvent));
        try {
          const rawGallery = localStorage.getItem('swu_photo_gallery') || '[]';
          const gallery = JSON.parse(rawGallery);
          gallery.unshift(syncEvent);
          localStorage.setItem('swu_photo_gallery', JSON.stringify(gallery.slice(0, 50)));
        } catch {}
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

  // Initialize WebRTC Camera. Pass a deviceId when staff pick a camera; it is remembered.
  const initCamera = useCallback(async (requestedId?: string) => {
    // React Strict Mode and the reconnect button can start overlapping attempts;
    // only the newest one may touch the video or the state.
    const request = ++cameraRequestRef.current;
    const isStale = () => request !== cameraRequestRef.current;

    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach((track) => track.stop());
      currentStreamRef.current = null;
    }
    setCameraActive(false);
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(describeCameraError(new Error('WebRTC not supported')));
      return;
    }
    if (requestedId) saveCameraId(requestedId);

    const listCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((d) => d.kind === 'videoinput');
      } catch {
        return [];
      }
    };
    const open = async (deviceId?: string) => {
      const device = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' };
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { ...device, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'OverconstrainedError') {
          return navigator.mediaDevices.getUserMedia({ video: device, audio: false });
        }
        throw err;
      }
    };

    // Try the chosen camera first, then real cameras, then virtual ones.
    // Before permission is granted, ids are hidden, so the browser default is tried instead.
    const found = await listCameras();
    const preferred = requestedId ?? readSavedCameraId();
    const ordered = [
      ...found.filter((d) => d.deviceId === preferred),
      ...found.filter((d) => !VIRTUAL_CAMERA_PATTERN.test(d.label)),
      ...found.filter((d) => VIRTUAL_CAMERA_PATTERN.test(d.label)),
    ];
    const candidates: (string | undefined)[] = [...new Set(ordered.map((d) => d.deviceId).filter(Boolean))];
    if (candidates.length === 0) candidates.push(undefined);

    let stream: MediaStream | null = null;
    let lastError: unknown = null;
    const tried = new Set<string | undefined>();
    for (let i = 0; i < candidates.length && !stream; i++) {
      tried.add(candidates[i]);
      try {
        stream = await open(candidates[i]);
      } catch (err) {
        lastError = err;
        console.warn('Camera failed to open:', candidates[i] ?? 'browser default', err);
        // The first attempt may have just been granted permission, revealing every camera.
        if (i === candidates.length - 1) {
          const revealed = (await listCameras())
            .sort((x, y) => Number(VIRTUAL_CAMERA_PATTERN.test(x.label)) - Number(VIRTUAL_CAMERA_PATTERN.test(y.label)))
            .map((d) => d.deviceId)
            .filter((id) => id && !tried.has(id));
          candidates.push(...revealed);
        }
      }
      if (isStale()) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }
    }

    setCameras(await listCameras());
    if (isStale()) {
      stream?.getTracks().forEach((track) => track.stop());
      return;
    }
    if (!stream) {
      setCameraError(describeCameraError(lastError));
      return;
    }

    currentStreamRef.current = stream;
    setActiveCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId);

    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        setVideoDimensions({
          width: video.videoWidth || 16,
          height: video.videoHeight || 9,
        });
      };
      await video.play().catch(() => {});
      if (isStale()) return;
      setCameraActive(true);
    }
  }, []);

  // Staff shortcut: C switches to the next camera.
  const switchToNextCamera = useCallback(() => {
    if (cameras.length < 2) return;
    const index = cameras.findIndex((d) => d.deviceId === activeCameraId);
    initCamera(cameras[(index + 1) % cameras.length].deviceId);
  }, [cameras, activeCameraId, initCamera]);
  const switchToNextCameraRef = useRef(switchToNextCamera);
  switchToNextCameraRef.current = switchToNextCamera;

  // Keep callback refs continuously synced
  initCameraRef.current = initCamera;
  handleConfirmUploadRef.current = handleConfirmUpload;

  useEffect(() => {
    initCamera();
    return () => {
      cameraRequestRef.current++;
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
        const { FilesetResolver, HandLandmarker, FaceLandmarker } = await import('@mediapipe/tasks-vision');
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

        // Face model for meme stickers (nose, wide eyes, where to place the GIF).
        // Optional: the booth works without it.
        try {
          const createFace = (delegate: 'GPU' | 'CPU') =>
            FaceLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate },
              runningMode: 'VIDEO',
              numFaces: 1,
              outputFaceBlendshapes: true,
            });
          const faceLandmarker = await createFace('GPU').catch(() => createFace('CPU'));
          if (active) faceLandmarkerRef.current = faceLandmarker;
          else faceLandmarker.close();
        } catch (err) {
          console.warn('Face model unavailable, meme stickers are off:', err);
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
      try {
        faceLandmarkerRef.current?.close();
      } catch {}
      faceLandmarkerRef.current = null;
    };
  }, []);

  // Load the meme GIFs: their shape for placing them, and a still frame for the photo
  useEffect(() => {
    let cancelled = false;
    (Object.keys(MEME_FILES) as MemeName[]).forEach(async (meme) => {
      try {
        const img = new Image();
        img.src = MEME_FILES[meme];
        await img.decode();
        if (cancelled || !img.naturalHeight) return;
        memeAspectRef.current[meme] = img.naturalWidth / img.naturalHeight;
        memeStillRef.current[meme] = img; // Canvas draws only the first frame of an <img> GIF

        // Prefer the middle frame for the photo: first frames are often blank
        const Decoder = (window as any).ImageDecoder;
        if (Decoder) {
          const data = await (await fetch(MEME_FILES[meme])).arrayBuffer();
          const decoder = new Decoder({ data, type: 'image/gif' });
          await decoder.tracks.ready;
          const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 1;
          const { image } = await decoder.decode({ frameIndex: Math.floor(frameCount / 2) });
          const bitmap = await createImageBitmap(image);
          image.close();
          decoder.close();
          if (!cancelled) memeStillRef.current[meme] = bitmap;
        }
      } catch {
        console.info(`Meme ${meme} is off: add the GIF at public${MEME_FILES[meme]}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time Gesture Detection Animation Frame Loop (Using Updated 3D Hand Model)
  useEffect(() => {
    let animId: number;

    // Meme stickers: which meme (if any) shows, and where beside the cheek
    const updateMemes = (video: HTMLVideoElement, hands: LandmarkPoint[][]) => {
      const now = performance.now();
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      // The face model runs on every other frame; it is the slowest part
      const faceLandmarker = faceLandmarkerRef.current;
      if (faceLandmarker && faceFrameRef.current++ % 2 === 0) {
        const faces = faceLandmarker.detectForVideo(video, now);
        if (faces?.faceLandmarks?.length) {
          faceRef.current = readFace(faces.faceLandmarks[0], vw, vh);
          faceSeenAtRef.current = now;
        }
        eyesScoreRef.current = eyesWideScore(faces?.faceBlendshapes?.[0]?.categories);
      }
      const face = now - faceSeenAtRef.current <= FACE_MEMORY_MS ? faceRef.current : null;

      const hasGif = (meme: MemeName) => memeAspectRef.current[meme] !== undefined;
      const eyesWide = eyesTrackerRef.current.update(eyesScoreRef.current, now);
      let detected: MemeName | null = null;
      if ((now < forceMemeUntilRef.current || isNosePinched(hands, face, vw, vh)) && hasGif('SCOOBA')) {
        detected = 'SCOOBA';
      } else if (eyesWide && hasGif('SCARE')) {
        detected = 'SCARE';
      }
      const meme = memeTrackerRef.current.update(detected, now);

      let next: { meme: MemeName; rect: Rect } | null = null;
      if (meme) {
        // Keep the meme inside the 4:3 part of the frame that ends up in the photo
        const crop = calculate43Crop(vw, vh);
        const zone = { x0: crop.sx / vw, y0: crop.sy / vh, x1: (crop.sx + crop.sWidth) / vw, y1: (crop.sy + crop.sHeight) / vh };
        const where = face?.box ?? { x0: 0.4, y0: 0.25, x1: 0.6, y1: 0.6 };
        next = { meme, rect: placeBesideFace(where, zone, memeAspectRef.current[meme] ?? 1, vw / vh) };
      }
      stickerRef.current = next;
      setSticker((prev) => (prev === null && next === null ? prev : next));
    };

    const detectLoop = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (video && video.readyState >= 2 && landmarker && !isPaused) {
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          try {
            const results = landmarker.detectForVideo(video, performance.now());
            updateMemes(video, (results?.landmarks ?? []) as LandmarkPoint[][]);
            if (results && results.landmarks && results.landmarks.length > 0) {
              const primaryHand = results.landmarks[0];
              const worldHand = results.worldLandmarks?.[0];
              const handedness = results.handedness?.[0]?.[0]?.categoryName ?? 'Right';
              const aspect = video.videoWidth > 0 && video.videoHeight > 0
                ? video.videoWidth / video.videoHeight
                : 4 / 3;

              // Run the updated 5-finger palm facing model
              const detected = classifyGesture(primaryHand, worldHand, handedness, aspect);
              setLiveLandmarks(primaryHand);
              setDetectedGestureText(detected);

              // Depth & Area Filter: reject distant background passers-by (>= 3.5% required)
              const inForeground = isHandInForeground(primaryHand, handAreaThreshold);
              setIsForeground(inForeground);

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
              setHandAreaRatio(Math.max(0, (maxX - minX) * (maxY - minY)));

              if (isIdle || isDetecting) {
                if (detected === 'OPEN_PALM' && inForeground) {
                  lastPalmSeenTimeRef.current = performance.now();
                  if (holdStartTimeRef.current === null) {
                    holdStartTimeRef.current = performance.now();
                    send({ type: 'HAND_DETECTED' });
                  }
                  const elapsed = performance.now() - holdStartTimeRef.current;
                  const progress = Math.min(100, (elapsed / 1500) * 100);
                  setHoldProgress(progress);

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

  // Keyboard shortcut testing (P = Palm, F = Fist, M = Meme, C = Camera, S = Staff Trigger, R = Reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'p') {
        if (isIdle || isDetecting) {
          send({ type: 'TRIGGER_ACTIVATED' });
        } else if (isPreviewing) {
          handleConfirmUploadRef.current();
        }
      } else if (key === 'm') {
        forceMemeUntilRef.current = performance.now() + 300; // Test: as if pinching the nose
      } else if (key === 'c') {
        switchToNextCameraRef.current();
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
      <div className="kiosk-stage relative aspect-video h-auto max-h-dvh w-full max-w-[calc(100dvh*16/9)] overflow-hidden bg-black">
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
          <div className="absolute inset-0 h-full w-full bg-black flex items-center justify-center z-10">
            <div className="engineering-grid absolute inset-0 opacity-40" />
            <div className="text-center space-y-4 z-10 max-w-md px-6">
              <div className="size-16 rounded-2xl bg-[#CE1126]/10 border border-[#CE1126]/30 flex items-center justify-center mx-auto text-[#CE1126]">
                <Camera className="size-8" strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  ระบบกล้องกำลังเชื่อมต่อ (Camera Standby)
                </h3>
                <p className={`text-xs mt-1 leading-relaxed ${cameraError ? 'text-amber-300' : 'text-slate-400'}`}>
                  {cameraError ?? 'กำลังเปิดกล้อง...'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => initCamera()}
                  className="rounded-xl bg-[#CE1126] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#8F0B20] transition-colors shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="size-4" />
                  <span>เชื่อมต่อกล้องทันที</span>
                </button>
              </div>
              {cameras.length > 1 && (
                <label className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span>กล้อง:</span>
                  <select
                    value={activeCameraId ?? ''}
                    onChange={(e) => initCamera(e.target.value)}
                    className="cursor-pointer rounded-lg border border-white/15 bg-black px-2 py-1.5 text-xs text-white"
                  >
                    {!activeCameraId && <option value="">เลือกกล้อง</option>}
                    {cameras.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `กล้อง ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="mono text-[11px] text-slate-500 pt-2">
                โหมดทดสอบ: กดปุ่ม P เพื่อจำลองแบมือ, S เพื่อถ่ายภาพ หรือ C เพื่อสลับกล้อง
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
        <div className="mono pointer-events-none absolute left-1/2 top-[1.4%] z-30 -translate-x-1/2 border border-[#CE1126]/40 bg-black/90 px-[.9vw] py-[.38vw] text-[clamp(.38rem,.48vw,.58rem)] tracking-[.14em] text-white/90 backdrop-blur">
          4:3 CAPTURE ZONE · 1440×1080 RAW
        </div>

        {/* Left Pillar (12.5%): Branding & Telemetry */}
        <aside className="kiosk-pillar absolute inset-y-0 left-0 z-20 flex w-[12.5%] flex-col justify-between border-r border-white/10 bg-[rgba(0,0,0,0.92)] p-[1.65%] backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <CpeLogo className="h-[clamp(1.4rem,2.2vw,2.6rem)] max-w-full" />
              <div className="h-px flex-1 bg-[#CE1126]/60" />
            </div>
            <p className="mt-[2.2vw] text-[clamp(.55rem,.76vw,.92rem)] font-bold leading-[1.45] tracking-[-.02em] text-white">
              SWU Computer
              <br />
              Engineering
            </p>
            <p className="mt-2 text-[clamp(.46rem,.57vw,.68rem)] font-semibold leading-relaxed tracking-[.08em] text-slate-400">
              OPEN HOUSE 2026
            </p>
          </div>

          <div className="space-y-[1.2vw]">
            <div className="border-l border-cyan-400/50 pl-[.7vw]">
              <div className="mono text-[clamp(.4rem,.52vw,.62rem)] text-cyan-300">1440×1080</div>
              <div className="mt-1 text-[clamp(.38rem,.45vw,.54rem)] font-bold tracking-[.12em] text-slate-500">
                RAW · 4:3
              </div>
            </div>
            <div className="border-l border-emerald-400/50 pl-[.7vw]">
              <div className="mono text-[clamp(.4rem,.52vw,.62rem)] text-emerald-300">
                {cameraActive ? '60 FPS' : 'STANDBY'}
              </div>
              <div className="mt-1 text-[clamp(.38rem,.45vw,.54rem)] font-bold tracking-[.08em] text-slate-500">
                VISION READY
              </div>
            </div>
            <div className="border-l border-cyan-400/50 pl-[.7vw]">
              <div className="mono text-[clamp(.4rem,.52vw,.62rem)] text-cyan-300 uppercase">
                {detectedGestureText}
              </div>
              <div className="mt-1 text-[clamp(.36rem,.43vw,.51rem)] font-bold tracking-[.08em] text-slate-500">
                AI MODEL ACTIVE
              </div>
            </div>
            <div className="mono flex items-center gap-2 text-[clamp(.38rem,.46vw,.55rem)] text-slate-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              BUS READY · 0ms
            </div>
          </div>
        </aside>

        {/* Right Pillar (12.5%): Gesture Guide & Instructions */}
        <aside className="kiosk-pillar absolute inset-y-0 right-0 z-20 flex w-[12.5%] flex-col justify-between border-l border-white/10 bg-[rgba(0,0,0,0.92)] p-[1.45%] backdrop-blur-md">
          <div className="text-[clamp(.43rem,.52vw,.62rem)] font-bold tracking-[.16em] text-slate-400">
            GESTURE GUIDE
          </div>

          <div className="flex flex-1 flex-col justify-center gap-[2.4vw]">
            {[
              { icon: Hand, line1: 'แบมือค้าง', line2: '1.5 วินาที', english: 'HOLD TO START' },
              { icon: Timer, line1: 'โพสอิสระ', line2: 'ช่วง 3..2..1', english: 'POSE FREELY' },
              { icon: QrCode, line1: 'รับรูปที่', line2: 'จอหมายเลข 2', english: 'SCAN AT SCREEN 2' },
            ].map((step, index) => {
              const GuideIcon = step.icon;
              return (
                <div key={step.english} className="relative">
                  <div className="mb-[.7vw] flex items-center gap-[.6vw]">
                    <span className="mono text-[clamp(.4rem,.48vw,.58rem)] text-[#CE1126] font-bold">
                      0{index + 1}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <GuideIcon
                    className="mb-[.7vw] size-[clamp(1.15rem,1.55vw,1.85rem)] text-white"
                    strokeWidth={1.25}
                  />
                  <div className="text-[clamp(.52rem,.65vw,.78rem)] font-semibold leading-[1.5] text-slate-100">
                    {step.line1}
                    <br />
                    {step.line2}
                  </div>
                  <div className="mt-1 text-[clamp(.35rem,.4vw,.48rem)] font-bold tracking-[.1em] text-slate-500">
                    {step.english}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mono text-[clamp(.34rem,.4vw,.48rem)] leading-relaxed text-slate-500">
            KEY: [P]ALM [F]IST [S]TAFF [M]EME
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

        {/* Meme sticker beside the cheek */}
        {showLiveFeed && cameraActive && sticker && (
          <MemeSticker src={MEME_FILES[sticker.meme]} rect={sticker.rect} videoDimensions={videoDimensions} />
        )}

        {/* Dynamic Tracking Status Badge - Positioned on the Side (Non-intrusive HUD Telemetry) */}
        {(isIdle || isDetecting) && showLiveFeed && liveLandmarks && (
          <div className="pointer-events-none absolute left-[13.8%] bottom-[3%] z-30 flex items-center">
            <div className="mono flex items-center gap-2 rounded-full bg-black/90 border border-cyan-400/30 px-3.5 py-1.5 text-[clamp(.36rem,.46vw,.55rem)] text-slate-300 backdrop-blur-md shadow-lg transition-all duration-200">
              <span className={`size-2 rounded-full ${isForeground ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>PRIMARY HAND · {isForeground ? `AREA ${(handAreaRatio * 100).toFixed(1)}% (OK)` : `< 3.5% (เข้าใกล้กล้องอีกนิด)`}</span>
              <span className="text-slate-500">|</span>
              <span className="text-cyan-300 font-bold">
                {holdProgress > 0 ? `OPEN_PALM ${Math.round(holdProgress)}%` : detectedGestureText}
              </span>
            </div>
          </div>
        )}

        {/* Countdown Active State (3..2..1) */}
        {isCountingDown && (
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
            <div className="countdown-rings relative flex h-44 w-44 items-center justify-center rounded-full bg-black/85 border-2 border-white/20 backdrop-blur-md">
              <span className="mono text-7xl font-black text-white tabular-nums">
                {countdown}
              </span>
            </div>
            <div className="mt-6 rounded-full bg-black/85 border border-white/10 px-6 py-2 text-sm font-bold text-white backdrop-blur">
              โพสท่าอิสระได้เลย!
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
            <div className="flex items-center gap-6 rounded-2xl bg-black/95 border border-white/15 px-7 py-3.5 shadow-2xl backdrop-blur-xl">
              {/* Fist: Retake Button (Unlimited Retakes) */}
              <button
                type="button"
                onClick={handleRetake}
                className="group flex items-center gap-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 px-5 py-2.5 transition-all cursor-pointer"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white group-hover:rotate-[-45deg] transition-transform">
                  <RotateCcw className="size-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white">กำมือ เพื่อถ่ายใหม่</div>
                  <div className="mono text-[10px] text-slate-400">RETAKE PHOTO</div>
                </div>
              </button>

              {/* Center Timer */}
              <div className="flex flex-col items-center px-4 min-w-[70px]">
                <div className="mono text-2xl font-black text-cyan-400 tabular-nums">
                  {previewSeconds}s
                </div>
                <div className="mono text-[9px] font-bold text-slate-400 tracking-wider uppercase">
                  AUTO PROCEED
                </div>
              </div>

              {/* Palm: Confirm Button */}
              <button
                type="button"
                onClick={handleConfirmUpload}
                className="group flex items-center gap-3 rounded-xl bg-[#CE1126] hover:bg-[#8F0B20] border border-[#CE1126]/60 px-6 py-2.5 transition-all shadow-[0_4px_20px_rgba(206,17,38,0.35)] cursor-pointer"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-black/25 text-white">
                  <Check className="size-5" strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white">แบมือ ยืนยันรูปนี้</div>
                  <div className="mono text-[10px] text-white/90">CONFIRM & CREATE QR</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Uploading & Success Notification */}
        {isSyncing && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
            <div className="text-center space-y-4">
              <CheckCircle2 className="size-20 text-[#10B981] mx-auto animate-bounce" />
              <h2 className="text-3xl font-black text-white">ส่งรูปเรียบร้อย!</h2>
              <p className="text-base text-slate-300">
                เชิญสแกนรับรูปที่ <b>จอหมายเลข 2 (Showcase)</b> รหัสรูป: <span className="mono text-cyan-400 font-bold">{syncedCode}</span>
              </p>
            </div>
          </div>
        )}

        {/* Kiosk Paused Overlay */}
        {isPaused && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="text-center space-y-3">
              <Pause className="size-16 text-amber-400 mx-auto" />
              <h2 className="text-2xl font-bold text-white">พักบูธชั่วคราว</h2>
              <p className="text-xs text-slate-400">สตาฟกำลังดูแลความเรียบร้อย หรือจัดคิว</p>
              <button
                onClick={() => setIsPaused(false)}
                className="mt-4 rounded bg-[#CE1126] px-4 py-2 text-xs font-bold text-white"
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
