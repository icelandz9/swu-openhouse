'use client';

import { useKioskFSM } from '@/lib/kiosk/useKioskFSM';
import { PHOTO_ASPECT_RATIO, CROP_DIMENSIONS_4_3 } from '@/lib/contracts';

export default function KioskPage() {
  const { state, send } = useKioskFSM();

  return (
    <main className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white select-none overflow-hidden">
      <div className="absolute top-4 left-6 z-20 flex items-center space-x-3 text-sm opacity-80">
        <span className="font-bold text-red-600">SWU Open House</span>
        <span>|</span>
        <span>CPE AI Photo Booth</span>
        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
          Ratio {PHOTO_ASPECT_RATIO} ({CROP_DIMENSIONS_4_3.width}x{CROP_DIMENSIONS_4_3.height})
        </span>
      </div>

      <div className="relative flex aspect-video w-full max-w-7xl items-center justify-center overflow-hidden border border-neutral-800 bg-neutral-950">
        <div className="text-center">
          <div className="text-xl font-medium text-neutral-400">Current Kiosk State</div>
          <div className="mt-2 text-3xl font-extrabold tracking-wider text-red-500">{state}</div>
          <p className="mt-4 text-sm text-neutral-500">
            Kiosk UI Viewfinder, 4:3 Crop Guides, and MediaPipe Vision stream will attach here.
          </p>
        </div>
      </div>
    </main>
  );
}
