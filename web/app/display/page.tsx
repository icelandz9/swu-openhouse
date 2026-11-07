'use client';

import { useState, useEffect } from 'react';
import { ScreenSyncEvent } from '@/lib/contracts';

interface ActivePhoto {
  code: string;
  qrUrl: string;
  photoUrl: string;
  createdAt: string;
}

const INITIAL_GALLERY = [
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=400&q=80',
];

export default function DisplayShowcasePage() {
  const [activePhoto, setActivePhoto] = useState<ActivePhoto>({
    code: 'OPH-AB29',
    qrUrl: 'http://192.168.1.10:3000/p/OPH-AB29',
    photoUrl: INITIAL_GALLERY[0],
    createdAt: new Date().toISOString(),
  });

  const [galleryPhotos, setGalleryPhotos] = useState<string[]>(INITIAL_GALLERY);

  useEffect(() => {
    // Listen for broadcast events from Screen 1 (Kiosk) on the same machine
    const channel = new BroadcastChannel('swu_photobooth_bus');

    channel.onmessage = (event: MessageEvent<ScreenSyncEvent>) => {
      const data = event.data;
      if (data.type === 'PHOTO_READY_FOR_DISPLAY') {
        const newPhoto: ActivePhoto = {
          code: data.code,
          qrUrl: data.qrUrl,
          photoUrl: data.photoUrl,
          createdAt: data.createdAt,
        };
        setActivePhoto(newPhoto);
        setGalleryPhotos((prev) => [data.photoUrl, ...prev.slice(0, 47)]);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#06080D] text-white select-none">
      {/* LEFT 30%: QR CODE STATION (Clean & Refined) */}
      <section className="flex w-[30%] flex-col justify-between border-r border-[#1E2536] bg-[#0D111A] p-8 text-center">
        <div>
          <div className="text-xs font-semibold text-[#CE1126] tracking-wider uppercase">
            SWU OPEN HOUSE
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            รับรูปถ่ายของคุณ
          </h1>
          <p className="mt-1 text-xs text-[#8492A6]">
            สแกน QR Code ด้วยมือถือเพื่อเลือกฟิลเตอร์และกรอบรูป
          </p>

          {/* Crisp High-Contrast Vector QR Card */}
          <div className="mt-8 flex aspect-square max-w-[240px] items-center justify-center rounded-2xl bg-white p-5 shadow-2xl mx-auto">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                activePhoto.qrUrl
              )}`}
              alt="QR Code"
              className="h-full w-full object-contain"
            />
          </div>

          {/* Tabular Code Display */}
          <div className="mt-6">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#8492A6]">
              PHOTO CODE
            </div>
            <div className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-white">
              {activePhoto.code}
            </div>
          </div>
        </div>

        {/* Minimal Footnote */}
        <footer className="border-t border-[#1E2536] pt-4 text-[11px] text-[#8492A6]">
          🔒 รูปภาพจะถูกลบอัตโนมัติภายใน 7 วัน (PDPA)
        </footer>
      </section>

      {/* RIGHT 70%: LIVE PHOTO WALL (Pure 4:3 Raw Photos, Zero Frame Clutter) */}
      <section className="flex w-[70%] flex-col justify-between bg-[#06080D] p-6 overflow-hidden">
        {/* Gallery Header */}
        <header className="mb-4 flex items-center justify-between border-b border-[#1E2536] pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <h2 className="text-sm font-semibold tracking-wide text-white/90">
              Live Photo Wall • ประมวลภาพถ่ายสดในงาน
            </h2>
          </div>
          <div className="text-xs font-mono text-[#8492A6]">
            {galleryPhotos.length} รูปถ่ายล่าสุด
          </div>
        </header>

        {/* Pure 4:3 Raw Photo Grid */}
        <div className="flex-1 grid grid-cols-4 grid-rows-3 gap-3 overflow-hidden">
          {galleryPhotos.slice(0, 12).map((photoUrl, idx) => (
            <div
              key={idx}
              className={`relative rounded-xl overflow-hidden shadow-lg transition-transform duration-300 hover:scale-[1.02] ${
                idx === 0
                  ? 'border border-[#CE1126] shadow-[#CE1126]/20'
                  : 'border border-[#1E2536]'
              }`}
            >
              <img
                src={photoUrl}
                alt={`Live capture ${idx + 1}`}
                className="h-full w-full object-cover"
              />
              {idx === 0 && (
                <span className="absolute top-2 left-2 rounded bg-[#CE1126] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow">
                  LATEST
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
