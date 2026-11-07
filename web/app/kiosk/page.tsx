'use client';

import { useState, useEffect, useRef } from 'react';
import { useKioskFSM } from '@/lib/kiosk/useKioskFSM';
import { ScreenSyncEvent } from '@/lib/contracts';

export default function KioskCapturePage() {
  const {
    state,
    send,
    isIdle,
    isDetecting,
    isCountingDown,
    isCapturing,
    isPreviewing,
  } = useKioskFSM();

  const channelRef = useRef<BroadcastChannel | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [previewSeconds, setPreviewSeconds] = useState<number>(10);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string>(
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1440&q=80'
  );

  // Initialize BroadcastChannel to synchronize with Screen 2
  useEffect(() => {
    channelRef.current = new BroadcastChannel('swu_photobooth_bus');
    return () => {
      channelRef.current?.close();
    };
  }, []);

  // Countdown controller
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCountingDown) {
      setCountdown(3);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            send({ type: 'COUNTDOWN_COMPLETE' });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isCountingDown, send]);

  // Flash capture controller
  useEffect(() => {
    if (isCapturing) {
      const timer = setTimeout(() => {
        send({ type: 'CAPTURE_FLASH_DONE' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isCapturing, send]);

  // Preview 10s timer controller
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPreviewing) {
      setPreviewSeconds(10);
      timer = setInterval(() => {
        setPreviewSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleConfirmUpload();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPreviewing]);

  // Confirm photo, broadcast to Screen 2, and reset Screen 1 immediately
  const handleConfirmUpload = () => {
    send({ type: 'CONFIRM_UPLOAD' });
    const code = 'OPH-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const event: ScreenSyncEvent = {
      type: 'PHOTO_READY_FOR_DISPLAY',
      code,
      qrUrl: `http://192.168.1.10:3000/p/${code}`,
      photoUrl: capturedPhotoUrl,
      createdAt: new Date().toISOString(),
    };

    channelRef.current?.postMessage(event);

    setTimeout(() => {
      send({ type: 'UPLOAD_SUCCESS' });
      setTimeout(() => {
        send({ type: 'COOLDOWN_EXPIRED' });
      }, 1000);
    }, 400);
  };

  const handleRetake = () => {
    send({ type: 'GESTURE_RETAKE_FIST' });
  };

  const handleSimulateGestureStart = () => {
    send({ type: 'HAND_DETECTED' });
    setTimeout(() => {
      send({ type: 'TRIGGER_ACTIVATED' });
    }, 1500);
  };

  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center bg-[#06080D] text-white select-none overflow-hidden">
      {/* 150ms Pure White Shutter Flash */}
      {isCapturing && (
        <div className="absolute inset-0 z-50 bg-white pointer-events-none animate-out fade-out duration-150" />
      )}

      {/* 16:9 Viewfinder Canvas with 4:3 Center Crop Focus */}
      <div className="relative flex aspect-video w-full h-full max-w-[1920px] max-h-[1080px] items-center justify-center overflow-hidden bg-black">
        {/* Active Camera View / Live Stream Background */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-300"
          style={{ backgroundImage: `url('${capturedPhotoUrl}')` }}
        />
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />

        {/* Semi-transparent 12.5% Pillarbox Masks on Left & Right */}
        <div className="absolute inset-y-0 left-0 w-[12.5%] bg-[#06080D]/85 backdrop-blur-md z-10 border-r border-white/5" />
        <div className="absolute inset-y-0 right-0 w-[12.5%] bg-[#06080D]/85 backdrop-blur-md z-10 border-l border-white/5" />

        {/* Center 4:3 Crop Active Zone (75% Width) */}
        <div className="relative flex h-full w-[75%] items-center justify-center z-20">
          {/* Subtle Crop Corner L-Brackets */}
          <div className="absolute top-6 left-6 w-6 h-6 border-t-2 border-l-2 border-[#CE1126] pointer-events-none opacity-80" />
          <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-[#CE1126] pointer-events-none opacity-80" />
          <div className="absolute bottom-6 left-6 w-6 h-6 border-b-2 border-l-2 border-[#CE1126] pointer-events-none opacity-80" />
          <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-[#CE1126] pointer-events-none opacity-80" />

          {/* STATE 1: IDLE / HAND DETECTION (Ultra-Clean Floating Pill) */}
          {(isIdle || isDetecting) && (
            <div className="absolute bottom-10 flex flex-col items-center">
              <div
                onClick={handleSimulateGestureStart}
                className="cursor-pointer bg-black/60 hover:bg-black/75 backdrop-blur-xl border border-white/10 px-6 py-3.5 rounded-full flex items-center gap-3.5 shadow-2xl transition-all"
              >
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <svg className="w-8 h-8 -rotate-90">
                    <circle cx="16" cy="16" r="13" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" fill="transparent" />
                    <circle
                      cx="16"
                      cy="16"
                      r="13"
                      stroke="#CE1126"
                      strokeWidth="2.5"
                      strokeDasharray="81.68"
                      strokeDashoffset={isDetecting ? '0' : '81.68'}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <span className="absolute text-base">🖐️</span>
                </div>
                <div className="text-sm font-medium text-white tracking-wide">
                  แบมือค้างไว้ 1.5 วินาที เพื่อเริ่มถ่ายรูป
                </div>
              </div>
            </div>
          )}

          {/* STATE 2: COUNTDOWN 3..2..1 */}
          {isCountingDown && (
            <div className="flex flex-col items-center justify-center">
              <div className="text-[140px] font-extrabold text-white tracking-tighter drop-shadow-2xl tabular-nums animate-pulse">
                {countdown}
              </div>
              <div className="text-xs font-medium text-white/90 bg-black/40 border border-white/10 px-4 py-1.5 rounded-full backdrop-blur-md mt-2">
                เปลี่ยนท่าโพสได้ตามสบาย (เอามือลงได้)
              </div>
            </div>
          )}

          {/* STATE 3: PREVIEW 10 SECONDS (TOUCHLESS CONTROLS) */}
          {isPreviewing && (
            <div className="absolute inset-4 rounded-xl overflow-hidden flex flex-col justify-between p-6 bg-[#06080D]/95 border border-white/10 shadow-2xl">
              {/* Top Countdown Timer Bar */}
              <div className="w-full flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-white/90 font-medium px-1">
                  <span>พรีวิวรูปถ่ายของคุณ</span>
                  <span className="font-mono text-[#F59E0B] font-bold">{previewSeconds}s</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F59E0B] transition-all duration-1000 ease-linear"
                    style={{ width: `${(previewSeconds / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Pure 4:3 Photo Preview Center */}
              <div className="flex-1 my-3 rounded-lg overflow-hidden border border-white/10 relative">
                <img
                  src={capturedPhotoUrl}
                  alt="Captured Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Two High-Contrast Touchless Action Pills */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <button
                  onClick={handleRetake}
                  className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 flex items-center justify-center gap-2 text-xs font-semibold text-white transition-all"
                >
                  <span className="text-base">✊</span> กำมือ = ถ่ายใหม่
                </button>
                <button
                  onClick={handleConfirmUpload}
                  className="py-3 px-4 rounded-xl bg-[#CE1126] hover:bg-[#E11D48] flex items-center justify-center gap-2 text-xs font-semibold text-white transition-all shadow-lg"
                >
                  <span className="text-base">🖐️</span> แบมือ = ยืนยันไปต่อ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
