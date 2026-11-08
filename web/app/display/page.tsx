'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ScreenSyncEvent, SCREEN_SYNC_CHANNEL } from '@/lib/contracts';
import { CpeLogo } from '@/components/CpeLogo';

interface GalleryItem {
  code: string;
  qrUrl: string;
  photoUrl: string;
  createdAt: string;
  style?: string;
}

const DEFAULT_SEEDS: GalleryItem[] = [
  {
    code: 'OPH-AB29',
    qrUrl: '/p/OPH-AB29',
    photoUrl: 'https://images.unsplash.com/photo-1634938332514-6f3d23c8cc42?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900&h=1100',
    createdAt: '2026-11-07T12:00:00.000Z',
    style: 'NEURAL RED',
  },
  {
    code: 'OPH-2018',
    qrUrl: '/p/OPH-2018',
    photoUrl: 'https://images.unsplash.com/photo-1758534063829-a72058381e21?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900&h=1100',
    createdAt: '2026-11-07T11:54:00.000Z',
    style: 'CYBER GRID',
  },
  {
    code: 'OPH-1996',
    qrUrl: '/p/OPH-1996',
    photoUrl: 'https://images.unsplash.com/photo-1782069326883-090221bfcd6e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900&h=1100',
    createdAt: '2026-11-07T11:48:00.000Z',
    style: 'SIGNAL NOIR',
  },
  {
    code: 'OPH-1984',
    qrUrl: '/p/OPH-1984',
    photoUrl: 'https://images.unsplash.com/photo-1791573391615-1ad1f53d7f9e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900&h=1100',
    createdAt: '2026-11-07T11:40:00.000Z',
    style: 'RED SHIFT',
  },
  {
    code: 'OPH-8842',
    qrUrl: '/p/OPH-8842',
    photoUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
    createdAt: '2026-11-07T11:25:00.000Z',
    style: 'STUDIO RAW',
  },
  {
    code: 'OPH-7721',
    qrUrl: '/p/OPH-7721',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    createdAt: '2026-11-07T11:10:00.000Z',
    style: 'NEURAL RED',
  },
];

// Photo date shown on the latest-photo card, in Thai time so the server and browser agree.
function formatPhotoDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { thai: '', dotted: '' };
  const opts = { timeZone: 'Asia/Bangkok' } as const;
  return {
    // e.g. "7 พ.ย. 2026"
    thai: date.toLocaleDateString('th-TH-u-ca-gregory', { ...opts, day: 'numeric', month: 'short', year: 'numeric' }),
    // e.g. "07.11.2026"
    dotted: date.toLocaleDateString('en-GB', { ...opts, day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'),
  };
}

export default function ShowcaseDisplayScreen() {
  const [photos, setPhotos] = useState<GalleryItem[]>(DEFAULT_SEEDS);
  const [currentTime, setCurrentTime] = useState<string>('12:00');
  const [newestCode, setNewestCode] = useState<string>('');
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [hostOrigin, setHostOrigin] = useState<string>('');
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Mount tracking and host resolution for hydration safety
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const customHost = localStorage.getItem('swu_booth_host');
      const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      setHostOrigin(envAppUrl || customHost || window.location.origin);
    }
  }, []);

  // Live time ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 15000);
    return () => clearInterval(interval);
  }, []);

  // Load photos from localStorage / API on start, excluding deleted codes
  useEffect(() => {
    let deletedCodes: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        const rawDel = localStorage.getItem('swu_deleted_codes') || '[]';
        deletedCodes = JSON.parse(rawDel);
      } catch {}
    }

    if (typeof window !== 'undefined') {
      try {
        const savedGallery = localStorage.getItem('swu_photo_gallery');
        if (savedGallery) {
          const parsed = JSON.parse(savedGallery);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const clean = parsed.filter((p: any) => !deletedCodes.includes(p?.code));
            setPhotos(clean.length > 0 ? clean : DEFAULT_SEEDS.filter(s => !deletedCodes.includes(s.code)));
          }
        }
      } catch {}
    }

    // Also fetch latest from server
    fetch('/api/photos')
      .then((res) => res.json())
      .then((data) => {
        if (data?.photos && Array.isArray(data.photos)) {
          setPhotos((prev) => {
            const map = new Map<string, GalleryItem>();
            [...data.photos, ...prev].forEach((item: any) => {
              if (item?.code && !deletedCodes.includes(item.code)) {
                map.set(item.code, item);
              }
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
  }, []);

  // Listen to live capture events from Screen 1 (Kiosk)
  useEffect(() => {
    const channel = new BroadcastChannel(SCREEN_SYNC_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<ScreenSyncEvent>) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'PHOTO_READY_FOR_DISPLAY') {
        const newItem: GalleryItem = {
          code: data.code,
          qrUrl: data.qrUrl,
          photoUrl: data.photoUrl,
          createdAt: data.createdAt,
          style: 'NEURAL RED',
        };

        setNewestCode(data.code);
        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.code !== data.code);
          const updated = [newItem, ...filtered].slice(0, 50);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('swu_photo_gallery', JSON.stringify(updated));
              localStorage.setItem('swu_latest_photo', JSON.stringify(newItem));
            } catch {}
          }
          return updated;
        });
      } else if (data.type === 'KIOSK_COMMAND' && data.command === 'SET_PUBLIC_DOMAIN') {
        if (data.value && typeof window !== 'undefined') {
          setHostOrigin(data.value);
          localStorage.setItem('swu_booth_host', data.value);
        }
      } else if (data.type === 'PHOTO_DELETED') {
        const deletedCode = data.code;
        if (typeof window !== 'undefined') {
          try {
            const rawDel = localStorage.getItem('swu_deleted_codes') || '[]';
            const cur: string[] = JSON.parse(rawDel);
            localStorage.setItem('swu_deleted_codes', JSON.stringify(Array.from(new Set([...cur, deletedCode]))));
          } catch {}
        }
        setPhotos((prev) => {
          const updated = prev.filter((p) => p.code !== deletedCode);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('swu_photo_gallery', JSON.stringify(updated));
              const latestStored = localStorage.getItem('swu_latest_photo');
              if (latestStored) {
                const parsed = JSON.parse(latestStored);
                if (parsed?.code === deletedCode) {
                  localStorage.setItem('swu_latest_photo', JSON.stringify(updated[0] ?? null));
                }
              }
            } catch {}
          }
          return updated;
        });
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  const latest = photos[0] ?? DEFAULT_SEEDS[0];
  const historyPhotos = photos.slice(1);

  // Compute clean QR URL (Hydration-safe with hostOrigin fallback)
  const qrTargetUrl = hostOrigin
    ? `${hostOrigin}/p/${encodeURIComponent(latest.code)}`
    : latest.qrUrl || `/p/${latest.code}`;

  return (
    <main className="display-shell grid h-dvh w-screen place-items-center overflow-hidden bg-black select-none">
      <div className="display-stage relative aspect-video h-auto max-h-dvh w-full max-w-[calc(100dvh*16/9)] overflow-hidden bg-black">
        {/* Left Section (30%): Live Polaroid Showcase & White QR Pill Station */}
        <section className="showcase-left absolute inset-y-0 left-0 z-20 flex w-[30%] flex-col border-r border-[#1C1C1C] px-[1.2%] py-[1.25%] justify-between">
          <div>
            {/* Live Indicator Banner */}
            <div className="mono flex items-center justify-between text-[clamp(.48rem,.62vw,.74rem)]">
              <span className="flex items-center gap-2 tracking-[.16em] text-[#CE1126] font-bold">
                <span className="size-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_12px_#10B981]" />
                LATEST SHOT
              </span>
              <span className="text-slate-400 font-bold" suppressHydrationWarning>{currentTime}</span>
            </div>

            <h1 className="mt-[1.1vw] text-[clamp(1.4rem,2vw,2.4rem)] font-extrabold tracking-[-.035em] text-white">
              รูปล่าสุด
            </h1>

            {/* Polaroid Frame Card tilted -2deg */}
            <div className="mx-auto mt-[1vw] w-[96%] shrink-0 rotate-[-2deg] rounded-[.18vw] bg-[#F8FAFC] p-[.7vw] pb-[.8vw] shadow-[0_24px_70px_rgba(0,0,0,.55)] transition-transform duration-500 hover:rotate-0">
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-900 rounded-[2px]">
                <img
                  src={latest.photoUrl}
                  alt={`รูปล่าสุด ${latest.code}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/85 px-[.7vw] py-[.38vw] text-white backdrop-blur-sm">
                  <span className="text-[clamp(.42rem,.52vw,.62rem)] font-bold">
                    <span className="text-[#CE1126]">CPE</span> OPEN HOUSE
                  </span>
                  <span className="text-[clamp(.34rem,.42vw,.5rem)] text-slate-300">
                    วิศวกรรมคอมพิวเตอร์ • {formatPhotoDate(latest.createdAt).thai}
                  </span>
                </div>
              </div>
              <div className="pt-[.65vw] text-center text-[#0F172A]">
                <div className="text-[clamp(.52rem,.68vw,.82rem)] font-extrabold tracking-[.12em]">
                  CPE OPEN HOUSE
                </div>
                <div className="mono mt-1 text-[clamp(.38rem,.46vw,.56rem)] text-slate-500 font-semibold">
                  {formatPhotoDate(latest.createdAt).dotted} · #{latest.code.replace('OPH-', '')}
                </div>
              </div>
            </div>
          </div>

          {/* White QR Card - Centered, Clean & Minimal */}
          <div className="qr-card mx-auto mt-[0.8vw] flex flex-col items-center justify-center rounded-[1vw] border-t-[.3vw] border-[#CE1126] bg-white px-[1.4vw] pb-[1.4vw] pt-[1.1vw] shadow-2xl shrink-0 w-fit text-center">
            <div className="text-[#0F172A] text-[clamp(.95rem,1.3vw,1.6rem)] font-extrabold tracking-[-.02em] mb-[0.6vw]">
              สแกนรับ<span className="text-[#CE1126]">รูป</span>
            </div>
            <div className="aspect-square w-[clamp(150px,13vw,240px)] bg-white flex items-center justify-center">
              {isMounted ? (
                <QRCodeSVG
                  value={qrTargetUrl}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  className="h-full w-full"
                  title={`รับรูป ${latest.code}`}
                />
              ) : (
                <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-300 text-[10px] font-mono animate-pulse rounded">
                  QR CODE
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Section (70%): Live Photo Wall / Gallery */}
        <section className="absolute inset-y-0 right-0 flex w-[70%] flex-col bg-black px-[2.45vw] py-[.75vw]">
          <header className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="flex items-center gap-[.3em] text-[clamp(1.55rem,2.5vw,3rem)] font-extrabold tracking-[-.05em]">
              <CpeLogo className="h-[1em]" />
              <span className="text-white">OPEN HOUSE</span>
            </h2>
            <div className="text-[clamp(.5rem,.68vw,.82rem)] font-medium text-slate-400">
              ถ่ายไปแล้ว <span className="mono text-white font-bold">{photos.length}</span> รูป
            </div>
          </header>

          <div className="mt-[1.8vw] flex min-h-0 flex-1 flex-col">
            <div className="text-[clamp(.45rem,.58vw,.7rem)] font-bold tracking-[.18em] text-[#CE1126] uppercase">
              ประวัติการถ่ายภาพทั้งหมด (Live Photo Wall)
            </div>

            <div className="photo-wall-scroll mt-[1vw] min-h-0 flex-1 overflow-y-auto pr-[.5vw]">
              <div className="grid grid-cols-5 gap-[.65vw] pb-[2vw]">
                {historyPhotos.map((photo, index) => {
                  const isNew = photo.code === newestCode;
                  return (
                    <figure
                      key={`${photo.code}-${index}`}
                      className={`group relative aspect-[4/3] overflow-hidden rounded-[.3vw] bg-[#0A0A0A] border border-white/5 transition duration-300 hover:border-[#CE1126] ${
                        isNew ? 'photo-wall-enter' : ''
                      }`}
                    >
                      <img
                        src={photo.photoUrl}
                        alt={`ภาพถ่าย ${photo.code}`}
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <figcaption className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[clamp(.32rem,.4vw,.48rem)] font-bold tracking-[.08em] text-white/80 backdrop-blur">
                        #{photo.code.replace('OPH-', '')}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
