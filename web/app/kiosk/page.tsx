'use client';

import { useEffect, useRef } from 'react';
import { useKioskFSM } from '@/lib/kiosk/useKioskFSM';
import { PHOTO_ASPECT_RATIO, CROP_DIMENSIONS_4_3, ScreenSyncEvent } from '@/lib/contracts';

export default function KioskCapturePage() {
  const { state, send } = useKioskFSM();
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    channelRef.current = new BroadcastChannel('swu_photobooth_bus');
    return () => {
      channelRef.current?.close();
    };
  }, []);

  // Simulating photo capture confirmation and sending to Screen 2
  const handleSimulateCaptureComplete = (samplePhotoUrl: string = '/sample-photo.jpg') => {
    const code = 'OPH-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const event: ScreenSyncEvent = {
      type: 'PHOTO_READY_FOR_DISPLAY',
      code,
      qrUrl: `http://localhost:3000/p/${code}`,
      photoUrl: samplePhotoUrl,
      createdAt: new Date().toISOString(),
    };

    channelRef.current?.postMessage(event);
    send({ type: 'UPLOAD_SUCCESS' });
  };

  return (
    <main className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white select-none overflow-hidden">
      {/* Top Bar */}
      <header className="absolute top-4 left-6 z-20 flex items-center space-x-3 text-sm opacity-80">
        <span className="font-bold text-red-600">SWU Open House</span>
        <span>|</span>
        <span>Screen 1: Camera & Touchless Capture</span>
        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
          Ratio {PHOTO_ASPECT_RATIO} ({CROP_DIMENSIONS_4_3.width}x{CROP_DIMENSIONS_4_3.height})
        </span>
      </header>

      {/* Main 16:9 Viewfinder Container with 4:3 Guides */}
      <div className="relative flex aspect-video w-full max-w-7xl items-center justify-center overflow-hidden border border-neutral-800 bg-neutral-950">
        {/* Left & Right 4:3 Crop Pillarboxes (240px each side) */}
        <div className="absolute inset-y-0 left-0 w-[12.5%] bg-black/75 z-10 flex items-center justify-center text-xs text-neutral-600 font-mono">
          CROP
        </div>
        <div className="absolute inset-y-0 right-0 w-[12.5%] bg-black/75 z-10 flex items-center justify-center text-xs text-neutral-600 font-mono">
          CROP
        </div>

        {/* Center 4:3 Active Zone */}
        <div className="relative flex h-full w-[75%] items-center justify-center border-x-2 border-red-500/40">
          <div className="text-center p-6">
            <div className="text-xs uppercase tracking-widest text-neutral-400">Screen 1 State</div>
            <div className="mt-2 text-4xl font-extrabold tracking-wider text-red-500">{state}</div>

            {state === 'IDLE' && (
              <p className="mt-4 text-sm text-neutral-400 animate-pulse">
                🖐️ แบมือค้าง 1.5 วินาที เพื่อเริ่มถ่ายภาพ
              </p>
            )}

            {state === 'PREVIEW_RETAKE' && (
              <div className="mt-4 space-y-2">
                <div className="text-lg font-semibold text-yellow-400">พรีวิวรูปภาพ (10 วินาที)</div>
                <div className="flex justify-center space-x-4 text-xs text-neutral-300">
                  <span className="rounded bg-neutral-800 px-3 py-1.5 border border-neutral-700">
                    ✊ กำมือ = ถ่ายใหม่
                  </span>
                  <span className="rounded bg-red-900/50 px-3 py-1.5 border border-red-700 text-red-200">
                    🖐️ แบมือ = ยืนยันไปต่อ
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
