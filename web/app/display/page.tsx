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
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
];

export default function DisplayShowcasePage() {
  const [activePhoto, setActivePhoto] = useState<ActivePhoto>({
    code: '8884',
    qrUrl: 'http://192.168.1.10:3000/p/8884',
    photoUrl: INITIAL_GALLERY[0],
    createdAt: new Date().toISOString(),
  });

  const [galleryPhotos, setGalleryPhotos] = useState<string[]>(INITIAL_GALLERY.slice(1));
  const [currentTime, setCurrentTime] = useState<string>('17:40');

  useEffect(() => {
    // Dynamic live time update
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Listen for broadcast events from Screen 1 (Kiosk) on the same machine
    const channel = new BroadcastChannel('swu_photobooth_bus');

    channel.onmessage = (event: MessageEvent<ScreenSyncEvent>) => {
      const data = event.data;
      if (data.type === 'PHOTO_READY_FOR_DISPLAY') {
        const cleanCode = data.code.replace('OPH-', '');
        const newPhoto: ActivePhoto = {
          code: cleanCode,
          qrUrl: data.qrUrl,
          photoUrl: data.photoUrl,
          createdAt: data.createdAt,
        };
        setActivePhoto(newPhoto);
        setGalleryPhotos((prev) => [activePhoto.photoUrl, ...prev.slice(0, 15)]);
      }
    };

    return () => {
      channel.close();
    };
  }, [activePhoto.photoUrl]);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#06080D] text-white select-none">
      {/* ============================================================== */}
      {/* LEFT COLUMN (~35%): LATEST SHOT & QR CODE STATION              */}
      {/* ============================================================== */}
      <section className="flex w-[36%] flex-col justify-between border-r border-[#1E2536]/60 bg-[#080C14] p-7">
        <div className="flex flex-col">
          {/* Top Status Row: LATEST SHOT + Clock */}
          <div className="flex items-center justify-between pb-1">
            <span className="font-mono text-xs font-semibold tracking-wider text-[#2DD4BF] uppercase">
              LATEST SHOT
            </span>
            <span className="font-mono text-xs font-medium text-slate-500">
              {currentTime}
            </span>
          </div>

          {/* Heading */}
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
            รูปล่าสุด
          </h1>

          {/* Polaroid Frame Card */}
          <div className="mt-4 rounded-xl bg-white p-3.5 shadow-2xl transition-all">
            {/* The 4:3 Photo */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm bg-neutral-900">
              <img
                src={activePhoto.photoUrl}
                alt="Latest Shot"
                className="h-full w-full object-cover"
              />
              {/* Bottom Photo Overlay */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-1.5 backdrop-blur-xs text-[10px] text-white/90">
                <span className="font-bold tracking-wide">
                  <span className="text-[#CE1126]">CPE</span> OPEN HOUSE
                </span>
                <span className="text-white/70">วิศวกรรมคอมพิวเตอร์ • 7 พ.ย. 2026</span>
              </div>
            </div>

            {/* Bottom Polaroid Chin Info */}
            <div className="pt-2.5 pb-1 text-center">
              <div className="text-xs font-bold tracking-tight text-slate-800">
                CPE OPEN HOUSE
              </div>
              <div className="text-[10px] font-medium text-slate-400">
                07.11.2026
              </div>
            </div>
          </div>

          {/* White Rounded Pill/Card: QR Station */}
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-2xl">
            {/* QR Code */}
            <div className="flex aspect-square w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                  activePhoto.qrUrl
                )}`}
                alt="QR Code"
                className="h-full w-full object-contain"
              />
            </div>

            {/* Content Beside QR */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-slate-900">
                <span>←</span>
                <span>สแกนรับรูป</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-700">
                เปิดกล้องมือถือแล้วสแกน
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                ต้องต่อ WiFi เดียวกับบูธ
              </p>
              <div className="mt-1 font-mono text-xs font-bold text-slate-400 tracking-wider">
                #{activePhoto.code}
              </div>
            </div>
          </div>
        </div>

        {/* Minimal PDPA Notice at Bottom */}
        <div className="text-[10px] text-slate-600">
          🔒 รูปจะถูกลบใน 7 วันตาม PDPA
        </div>
      </section>

      {/* ============================================================== */}
      {/* RIGHT COLUMN (~64%): CPE OPEN HOUSE & PREVIOUS GALLERY         */}
      {/* ============================================================== */}
      <section className="flex flex-1 flex-col p-8 bg-[#06080D]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E2536]/50">
          <div className="text-3xl font-extrabold tracking-tight">
            <span className="text-[#2DD4BF]">CPE</span>{' '}
            <span className="text-white">OPEN HOUSE</span>
          </div>
          <div className="text-sm font-medium text-slate-400">
            ถ่ายไปแล้ว {galleryPhotos.length + 1} รูป
          </div>
        </div>

        {/* Previous Photos Subheader */}
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#2DD4BF]">
            ภาพก่อนหน้า
          </span>
        </div>

        {/* Horizontal Row of Previous Photos */}
        <div className="mt-3 grid grid-cols-3 gap-3.5">
          {galleryPhotos.slice(0, 3).map((photoUrl, idx) => (
            <div
              key={idx}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-md transition-all hover:border-[#2DD4BF]/50"
            >
              <img
                src={photoUrl}
                alt={`Previous Shot ${idx + 1}`}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Bottom Subtle Watermark */}
              <div className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-xs">
                CPE OPEN HOUSE
              </div>
            </div>
          ))}
        </div>

        {/* Spacious Clean Dark Backdrop below maintaining luxury studio aesthetic */}
        <div className="flex-1" />
      </section>
    </main>
  );
}
