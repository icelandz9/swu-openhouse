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
} from 'lucide-react';
import { useKioskFSM } from '@/lib/kiosk/useKioskFSM';
import { ScreenSyncEvent, CROP_DIMENSIONS_4_3, SCREEN_SYNC_CHANNEL } from '@/lib/contracts';
import { generateShortCode } from '@/lib/mobile/shortCodeGenerator';
import { classifyGesture, LandmarkPoint } from '@/lib/ai-vision/gestureRules';
import { isHandInForeground } from '@/lib/ai-vision/depthAreaFilter';
import { calculate43Crop } from '@/lib/kiosk/centerCropper';
import { HandMesh } from '@/components/HandMesh';

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
  const previewGestureLockRef = useRef<boolean>(false);

  const [countdown, setCountdown] = useState<number>(3);
  const [previewSeconds, setPreviewSeconds] = useState<number>(10);
  const [retakeCount, setRetakeCount] = useState<number>(0);

  // Captured snapshot URL
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string>('/sample-photo.jpg');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncedCode, setSyncedCode] = useState<string>('');
  const [staffPinModal, setStaffPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');

  // MediaPipe references
  const landmarkerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  // Sound synthesizer
  const playBeep = useCallback((frequency: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
      osc.onended = () => void ctx.close();
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
          if (data.value && typeof window !== 'undefined') {
            localStorage.setItem('swu_booth_host', data.value);
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
        } else {
          // Studio fallback simulation
          ctx.fillStyle = '#06080D';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          grad.addColorStop(0, '#0D111A');
          grad.addColorStop(0.5, '#CE1126');
          grad.addColorStop(1, '#06080D');
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
    send({ type: 'CONFIRM_UPLOAD' });
    setIsSyncing(true);

    try {
      const code = generateShortCode();
      setSyncedCode(code);
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      let qrUrl = `${origin}/p/${code}`;
      let finalPhotoUrl = capturedPhotoUrl;

      // Check if custom booth host configured in localStorage
      if (typeof window !== 'undefined') {
        const customHost = localStorage.getItem('swu_booth_host');
        if (customHost) {
          const proto = window.location.protocol;
          qrUrl = `${proto}//${customHost}/p/${code}`;
        }
      }

      // 1. Post to API for storage
      try {
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: capturedPhotoUrl, code }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.photoUrl) finalPhotoUrl = data.photoUrl;
          if (data.qrUrl) qrUrl = data.qrUrl;
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
        previewGestureLockRef.current = false;
        setRetakeCount(0);
        send({ type: 'COOLDOWN_EXPIRED' });
      }, 1500);
    } catch (err) {
      console.error('Error during photo upload:', err);
      send({ type: 'UPLOAD_SUCCESS' });
      setTimeout(() => {
        setIsSyncing(false);
        previewGestureLockRef.current = false;
        setRetakeCount(0);
        send({ type: 'COOLDOWN_EXPIRED' });
      }, 1500);
    }
  }, [capturedPhotoUrl, send]);

  const handleRetake = useCallback(() => {
    if (retakeCount >= 1) {
      handleConfirmUploadRef.current();
      return;
    }
    setRetakeCount((prev) => prev + 1);
    previewGestureLockRef.current = false;
    setHoldProgress(0);
    holdStartTimeRef.current = null;
    setCountdown(3);
    setPreviewSeconds(10);
    send({ type: 'GESTURE_RETAKE_FIST' });
  }, [retakeCount, send, handleConfirmUpload]);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user',
        },
        audio: false,
      });
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

  useEffect(() => {
    initCameraRef.current();
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

      if (video && video.readyState >= 2 && landmarker && !isPaused) {
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          try {
            const results = landmarker.detectForVideo(video, performance.now());
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
                if (detected === 'FIST') {
                  previewGestureLockRef.current = true;
                  handleRetake();
                } else if (detected === 'OPEN_PALM') {
                  previewGestureLockRef.current = true;
                  handleConfirmUploadRef.current();
                }
              }
            } else {
              setLiveLandmarks(undefined);
              setDetectedGestureText('NONE');
              setHandAreaRatio(0);
              setIsForeground(true);
              const timeSinceLast = performance.now() - (lastPalmSeenTimeRef.current || 0);
              if (timeSinceLast > 250) {
                if ((isIdle || isDetecting) && holdStartTimeRef.current !== null) {
                  holdStartTimeRef.current = null;
                  setHoldProgress(0);
                  send({ type: 'HAND_LOST' });
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

  // Preview countdown timer (10s auto-proceed)
  useEffect(() => {
    let previewInterval: NodeJS.Timeout;
    if (isPreviewing) {
      previewInterval = setInterval(() => {
        setPreviewSeconds((prev) => {
          if (prev <= 1) {
            handleConfirmUploadRef.current();
            return 0;
          }
          return prev - 1;
        });
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
      <div className="kiosk-stage relative aspect-video h-auto max-h-dvh w-full max-w-[calc(100dvh*16/9)] overflow-hidden bg-[#090D16]">
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
          <div className="absolute inset-0 h-full w-full bg-[#06080D] flex items-center justify-center">
            <div className="engineering-grid absolute inset-0 opacity-40" />
            <div className="text-center space-y-3 z-10">
              <Camera className="size-16 text-[#CE1126] mx-auto animate-pulse" />
              <h3 className="text-xl font-bold text-white">STUDIO CAMERA SIMULATION</h3>
              <p className="text-xs text-slate-400">กดปุ่ม <b>P</b> เพื่อจำลองแบมือ หรือ <b>S</b> เพื่อเริ่มถ่าย</p>
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
        <div className="mono pointer-events-none absolute left-1/2 top-[1.4%] z-30 -translate-x-1/2 border border-[#CE1126]/40 bg-[#090D16]/85 px-[.9vw] py-[.38vw] text-[clamp(.38rem,.48vw,.58rem)] tracking-[.14em] text-white/90 backdrop-blur">
          4:3 CAPTURE ZONE · 1440×1080 RAW
        </div>

        {/* Left Pillar (12.5%): Branding & Telemetry */}
        <aside className="kiosk-pillar absolute inset-y-0 left-0 z-20 flex w-[12.5%] flex-col justify-between border-r border-white/10 bg-[rgba(9,13,22,.88)] p-[1.65%] backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid aspect-square w-[2.4vw] max-w-11 min-w-7 place-items-center bg-[#CE1126] text-[clamp(.48rem,.67vw,.78rem)] font-extrabold tracking-[-.06em] text-white">
                SWU
              </div>
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

        {/* Right Pillar (12.5%): Gesture Guide & Instructions with Top-to-Bottom Processing Flow */}
        <aside className="kiosk-pillar absolute inset-y-0 right-0 z-20 flex w-[12.5%] flex-col justify-between border-l border-white/10 bg-[rgba(9,13,22,.88)] p-[1.45%] backdrop-blur-md overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-[clamp(.43rem,.52vw,.62rem)] font-bold tracking-[.16em] text-slate-400">
              PROCESS FLOW
            </div>
            {holdProgress > 0 && (
              <span className="mono text-[clamp(.36rem,.44vw,.52rem)] text-cyan-400 font-bold animate-pulse">
                {Math.round(holdProgress)}%
              </span>
            )}
          </div>

          {/* Vertical 3-Step Flow Pipeline */}
          <div className="relative flex flex-1 flex-col justify-center gap-[1.8vw] my-2">
            {/* Background vertical circuit rail with downward laser flow */}
            <div className="absolute left-[0.4vw] top-[5%] bottom-[5%] w-[2px] bg-white/10 rounded-full overflow-hidden">
              <div
                className={`w-full bg-gradient-to-b from-[#22D3EE] via-[#CE1126] to-[#10B981] transition-all duration-300 ${
                  holdProgress > 0 ? 'h-full animate-pulse' : isCountingDown ? 'h-2/3' : isPreviewing ? 'h-full' : 'h-1/3 opacity-50'
                }`}
                style={{
                  boxShadow: '0 0 8px rgba(34, 211, 238, 0.8)',
                }}
              />
            </div>

            {[
              {
                icon: Hand,
                line1: 'แบมือค้าง',
                line2: '1.5 วินาที',
                english: 'HOLD TO START',
              },
              {
                icon: Timer,
                line1: 'โพสอิสระ',
                line2: 'ช่วง 3..2..1',
                english: 'POSE FREELY',
              },
              {
                icon: QrCode,
                line1: 'รับรูปที่',
                line2: 'จอหมายเลข 2',
                english: 'SCAN AT SCREEN 2',
              },
            ].map((step, index) => {
              const GuideIcon = step.icon;

              const isCurrent =
                (index === 0 && (isIdle || isDetecting)) ||
                (index === 1 && (isCountingDown || isCapturing)) ||
                (index === 2 && (isPreviewing || isSyncing || state === 'RESET_COOLDOWN'));

              const isCompleted =
                (index === 0 && (isCountingDown || isCapturing || isPreviewing || isSyncing || state === 'RESET_COOLDOWN')) ||
                (index === 1 && (isPreviewing || isSyncing || state === 'RESET_COOLDOWN'));

              return (
                <div
                  key={step.english}
                  className={`relative pl-[1.4vw] transition-all duration-300 rounded-lg p-[0.6vw] ${
                    isCurrent
                      ? 'bg-gradient-to-r from-white/10 to-transparent border-l-2 border-[#22D3EE] shadow-lg'
                      : isCompleted
                      ? 'opacity-80'
                      : 'opacity-40'
                  }`}
                >
                  {/* Top-to-bottom progress wash inside Step 1 during palm hold */}
                  {index === 0 && isCurrent && holdProgress > 0 && (
                    <div
                      className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 via-cyan-400/10 to-transparent pointer-events-none transition-all duration-75 rounded-lg"
                      style={{ height: `${holdProgress}%` }}
                    />
                  )}

                  <div className="mb-[.5vw] flex items-center justify-between">
                    <div className="flex items-center gap-[.5vw]">
                      <span
                        className={`mono text-[clamp(.4rem,.48vw,.58rem)] font-bold ${
                          isCompleted
                            ? 'text-emerald-400'
                            : isCurrent
                            ? 'text-cyan-400'
                            : 'text-[#CE1126]'
                        }`}
                      >
                        {isCompleted ? '✓ 0' : '0'}{index + 1}
                      </span>
                      <span className="h-px w-[2vw] bg-white/10" />
                    </div>
                    {isCurrent && (
                      <span className="size-1.5 rounded-full bg-cyan-400 animate-ping" />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <GuideIcon
                      className={`size-[clamp(1.15rem,1.55vw,1.85rem)] transition-colors duration-200 ${
                        isCompleted
                          ? 'text-emerald-400'
                          : isCurrent
                          ? index === 1
                            ? 'text-[#CE1126] animate-bounce'
                            : 'text-cyan-300 animate-pulse'
                          : 'text-white/60'
                      }`}
                      strokeWidth={1.5}
                    />
                    {index === 1 && isCountingDown && (
                      <span className="mono text-[clamp(.7rem,.95vw,1.15rem)] font-black text-white tabular-nums animate-pulse">
                        {countdown}s
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-[clamp(.5rem,.62vw,.75rem)] font-semibold leading-[1.4] text-slate-100">
                    {step.line1}
                    <br />
                    {step.line2}
                  </div>

                  <div className="mt-0.5 text-[clamp(.33rem,.38vw,.45rem)] font-bold tracking-[.08em] text-slate-500">
                    {isCompleted ? 'COMPLETED' : isCurrent ? (index === 0 && holdProgress > 0 ? `PROCESSING ${Math.round(holdProgress)}%` : 'IN PROGRESS') : step.english}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mono text-[clamp(.34rem,.4vw,.48rem)] leading-relaxed text-slate-500">
            KEY: [P]ALM [F]IST [S]TAFF
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

        {/* Dynamic Tracking Status Badge - Positioned on the Side (Non-intrusive HUD Telemetry) */}
        {(isIdle || isDetecting) && showLiveFeed && liveLandmarks && (
          <div className="pointer-events-none absolute left-[13.8%] bottom-[3%] z-30 flex items-center">
            <div className="mono flex items-center gap-2 rounded-full bg-[#090D16]/90 border border-cyan-400/30 px-3.5 py-1.5 text-[clamp(.36rem,.46vw,.55rem)] text-slate-300 backdrop-blur-md shadow-lg transition-all duration-200">
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
            <div className="countdown-rings relative flex h-44 w-44 items-center justify-center rounded-full bg-[#06080D]/80 border-2 border-white/20 backdrop-blur-md">
              <span className="mono text-7xl font-black text-white tabular-nums">
                {countdown}
              </span>
            </div>
            <div className="mt-6 rounded-full bg-[#06080D]/80 border border-white/10 px-6 py-2 text-sm font-bold text-white backdrop-blur">
              โพสท่าอิสระได้เลย!
            </div>
          </div>
        )}

        {/* Shutter Flash (150ms) */}
        {isCapturing && (
          <div className="kiosk-flash pointer-events-none absolute inset-0 z-50 bg-white" />
        )}

        {/* Preview State: Review & Retake Controls */}
        {isPreviewing && (
          <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center justify-end pb-8">
            <div className="flex items-center gap-6 rounded-2xl bg-[#090D16]/95 border border-white/10 px-8 py-5 shadow-2xl backdrop-blur-md">
              {/* Fist: Retake Button */}
              <button
                onClick={handleRetake}
                className="group flex items-center gap-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 transition-all"
              >
                <span className="text-2xl">✊</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-white">กำมือ เพื่อถ่ายใหม่</div>
                  <div className="mono text-[10px] text-slate-400">
                    RETAKE ({1 - retakeCount} LEFT)
                  </div>
                </div>
              </button>

              {/* Center Timer */}
              <div className="flex flex-col items-center px-4">
                <div className="mono text-2xl font-black text-cyan-400 tabular-nums">
                  {previewSeconds}s
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">AUTO PROCEED</div>
              </div>

              {/* Palm: Confirm Button */}
              <button
                onClick={handleConfirmUpload}
                className="group flex items-center gap-3 rounded-xl bg-[#CE1126] hover:bg-[#e1132b] px-6 py-3 transition-all shadow-lg"
              >
                <span className="text-2xl">✋</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-white">แบมือ ยืนยันรูปนี้</div>
                  <div className="mono text-[10px] text-white/80">PROCEED TO SCREEN 2</div>
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
