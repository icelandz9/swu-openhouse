'use client';

import { useState, useEffect } from 'react';
import { PHOTO_ASPECT_RATIO } from '@/lib/contracts';
import { openScreenBus } from '@/lib/kiosk/broadcastBus';

interface ActivePhoto {
  code: string;
  qrUrl: string;
  photoUrl: string;
  createdAt: string;
}

export default function DisplayScreenPage() {
  const [activePhoto, setActivePhoto] = useState<ActivePhoto | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);

  useEffect(() => {
    // Listen for broadcast events from Screen 1 (Kiosk) on the same Laptop
    const bus = openScreenBus();

    bus.subscribe((data) => {
      if (data.type === 'PHOTO_READY_FOR_DISPLAY') {
        const newPhoto: ActivePhoto = {
          code: data.code,
          qrUrl: data.qrUrl,
          photoUrl: data.photoUrl,
          createdAt: data.createdAt,
        };
        setActivePhoto(newPhoto);

        // Prepend to live photo wall (pure 4:3 photos)
        setGalleryPhotos((prev) => [data.photoUrl, ...prev.slice(0, 49)]); // Keep latest 50
      }
    });

    return () => {
      bus.close();
    };
  }, []);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-black text-white select-none">
      {/* ฝั่งซ้าย 30%: พื้นที่แสดง QR Code ของน้องคนล่าสุด */}
      <section className="flex w-[30%] flex-col items-center justify-center border-r border-neutral-800 bg-neutral-950 p-6 text-center">
        <header className="mb-6">
          <span className="rounded-full bg-red-600/20 px-3 py-1 text-xs font-semibold text-red-400 border border-red-500/30">
            SWU OPEN HOUSE PHOTO BOOTH
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">รับรูปถ่ายของคุณ</h1>
          <p className="mt-1 text-xs text-neutral-400">สแกน QR Code ด้วยมือถือเพื่อเลือกกรอบและดาวน์โหลด</p>
        </header>

        {activePhoto ? (
          <div className="flex flex-col items-center animate-fade-in">
            {/* QR Code Container */}
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-white p-4 shadow-2xl">
              {/* In production this renders real QR via qrcode.react or Canvas */}
              <div className="flex h-full w-full flex-col items-center justify-center rounded border-2 border-dashed border-neutral-300 text-black">
                <span className="font-mono text-xs font-bold text-neutral-500">QR CODE</span>
                <span className="mt-2 font-mono text-2xl font-extrabold text-red-600">
                  {activePhoto.code}
                </span>
                <span className="mt-1 text-[10px] text-neutral-400 text-center px-2">
                  {activePhoto.qrUrl}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-neutral-900 border border-neutral-800 px-6 py-2 text-center">
              <span className="text-xs text-neutral-400">รหัสรูปภาพของคุณ:</span>
              <div className="font-mono text-xl font-black text-red-500 tracking-wider">
                {activePhoto.code}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-neutral-500">
            <div className="h-48 w-48 rounded-2xl border-2 border-dashed border-neutral-800 flex items-center justify-center text-xs">
              รอคนเข้าถ่ายรูป
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              เมื่อถ่ายภาพเสร็จ QR Code จะปรากฏที่นี่ทันที
            </p>
          </div>
        )}

        <footer className="mt-auto text-[11px] text-neutral-600">
          * ภาพจะถูกลบอัตโนมัติภายใน 7 วันตามกฎหมาย PDPA
        </footer>
      </section>

      {/* ฝั่งขวา 70%: Photo Wall แสดงภาพที่น้องมาถ่ายทั้งหมด (Pure 4:3 Photos) */}
      <section className="flex w-[70%] flex-col bg-neutral-900/60 p-6 overflow-hidden">
        <header className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold tracking-wide text-neutral-200">
              LIVE PHOTO SHOWCASE ({galleryPhotos.length} รูป)
            </h2>
          </div>
          <span className="text-xs text-neutral-500">
            สัดส่วน {PHOTO_ASPECT_RATIO} (แสดงรูปภาพเพียวๆ ทั้งหมดในงาน)
          </span>
        </header>

        {galleryPhotos.length > 0 ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 overflow-y-auto pr-1">
            {galleryPhotos.map((url, idx) => (
              <div
                key={idx}
                className="aspect-[4/3] rounded-lg bg-neutral-800 border border-neutral-700/60 overflow-hidden shadow-md transition hover:scale-105"
              >
                <img
                  src={url}
                  alt={`Photo ${idx}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-neutral-600">
            <p className="text-sm">ยังไม่มีรูปถ่ายในระบบ</p>
            <p className="mt-1 text-xs text-neutral-500">
              ภาพถ่ายทั้งหมดจากจอที่ 1 จะปรากฏบนกำแพงภาพนี้แบบ Real-time
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
