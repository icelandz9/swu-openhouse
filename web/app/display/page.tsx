'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ScreenSyncEvent, SCREEN_SYNC_CHANNEL, DEFAULT_PRODUCTION_APP_URL } from '@/lib/contracts';
import { CpeLogo } from '@/components/CpeLogo';

interface GalleryItem {
  code: string;
  qrUrl: string;
  token?: string;
  photoUrl: string;
  createdAt: string;
  style?: string;
}

const DEFAULT_SEEDS: GalleryItem[] = [];

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

// Wait a moment after a new photo arrives (so the upload has finished) before reloading.
const RELOAD_AFTER_PHOTO_MS = 1500;

export default function ShowcaseDisplayScreen() {
  const [photos, setPhotos] = useState<GalleryItem[]>(DEFAULT_SEEDS);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activePhoto, setActivePhoto] = useState<GalleryItem | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('12:00');
  const [newestCode, setNewestCode] = useState<string>('');
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [hostOrigin, setHostOrigin] = useState<string>('');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Activates a photo on the left showcase for 30s. If next photo arrives, resets timer immediately.
  const showPhotoInQueue = useCallback((photo: GalleryItem) => {
    setActivePhoto(photo);
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current);
    }
    queueTimerRef.current = setTimeout(() => {
      setActivePhoto(null); // Return to Standby mode (Black photo + IG QR)
    }, 30000); // 30 seconds
  }, []);

  // Mount tracking and host resolution for hydration safety
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      let customHost = localStorage.getItem('swu_booth_host');
      if (customHost && customHost.includes('swu-openhouse.vercel.app')) {
        customHost = DEFAULT_PRODUCTION_APP_URL;
        localStorage.setItem('swu_booth_host', DEFAULT_PRODUCTION_APP_URL);
      }
      const envAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
      const fallbackOrigin = isLocal ? DEFAULT_PRODUCTION_APP_URL : window.location.origin;
      setHostOrigin(customHost || envAppUrl || fallbackOrigin);
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

        // Check if there was a photo captured within the last 30 seconds
        const savedLatest = localStorage.getItem('swu_latest_photo');
        if (savedLatest) {
          const parsedLatest: GalleryItem = JSON.parse(savedLatest);
          if (parsedLatest?.code && !deletedCodes.includes(parsedLatest.code)) {
            const ageMs = Date.now() - new Date(parsedLatest.createdAt).getTime();
            if (ageMs < 30000) {
              setActivePhoto(parsedLatest);
              queueTimerRef.current = setTimeout(() => {
                setActivePhoto(null);
              }, 30000 - ageMs);
            }
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
          token: data.token,
          photoUrl: data.photoUrl,
          createdAt: data.createdAt,
          style: 'NEURAL RED',
        };

        setNewestCode(data.code);
        showPhotoInQueue(newItem); // Starts 30s display; immediately replaces previous queue

        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.code !== data.code);
          return [newItem, ...filtered].slice(0, 50);
        });

        // Save the new photo first, then reload the page so it shows up for sure.
        // After the reload, the start-up code reads these back and keeps the photo on the
        // left showcase for the rest of its 30 seconds.
        try {
          const rawGallery = localStorage.getItem('swu_photo_gallery') || '[]';
          const gallery: GalleryItem[] = JSON.parse(rawGallery);
          const updated = [newItem, ...gallery.filter((p) => p?.code !== data.code)].slice(0, 50);
          localStorage.setItem('swu_photo_gallery', JSON.stringify(updated));
          localStorage.setItem('swu_latest_photo', JSON.stringify(newItem));
        } catch {}
        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = setTimeout(() => window.location.reload(), RELOAD_AFTER_PHOTO_MS);
      } else if (data.type === 'KIOSK_COMMAND' && data.command === 'SET_PUBLIC_DOMAIN') {
        if (typeof window !== 'undefined') {
          const val = typeof data.value === 'string' ? data.value.trim() : '';
          if (val) {
            setHostOrigin(val);
            localStorage.setItem('swu_booth_host', val);
          } else {
            localStorage.removeItem('swu_booth_host');
            const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
            const fallbackOrigin = isLocal ? DEFAULT_PRODUCTION_APP_URL : window.location.origin;
            setHostOrigin(process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin);
          }
        }
      } else if (
        data.type === 'SCREEN1_RESET' ||
        (data.type === 'KIOSK_COMMAND' && (data.command === 'RESET_STANDBY' || data.command === 'FORCE_STANDBY'))
      ) {
        if (queueTimerRef.current) {
          clearTimeout(queueTimerRef.current);
          queueTimerRef.current = null;
        }
        setActivePhoto(null);
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('swu_latest_photo');
          } catch {}
        }
      } else if (data.type === 'MUTE_DISPLAY' || (data.type === 'KIOSK_COMMAND' && data.command === 'MUTE_DISPLAY')) {
        if (queueTimerRef.current) {
          clearTimeout(queueTimerRef.current);
          queueTimerRef.current = null;
        }
        setActivePhoto(null);
        setIsMuted(true);
      } else if (data.type === 'UNMUTE_DISPLAY' || (data.type === 'KIOSK_COMMAND' && data.command === 'UNMUTE_DISPLAY')) {
        setIsMuted(false);
      } else if (data.type === 'PUSH_TO_DISPLAY') {
        const pushItem: GalleryItem = {
          code: data.photo.code,
          qrUrl: data.photo.qrUrl,
          photoUrl: data.photo.photoUrl,
          createdAt: data.photo.createdAt,
          style: 'NEURAL RED',
        };
        setIsMuted(false);
        setNewestCode(pushItem.code);
        showPhotoInQueue(pushItem);
      } else if (data.type === 'HEARTBEAT_PING') {
        channelRef.current?.postMessage({
          type: 'HEARTBEAT_PONG',
          sender: 'DISPLAY',
          timestamp: Date.now(),
          pingTimestamp: data.timestamp,
          status: {
            activeCode: activePhoto?.code || null,
            totalPhotos: photos.length,
            queueLength: activePhoto ? 1 : 0,
            isMuted,
          },
        });
      } else if (data.type === 'PHOTO_DELETED') {
        const deletedCode = data.code;

        // If the deleted photo is currently in the active 30s showcase, return to standby immediately
        setActivePhoto((prev) => {
          if (prev?.code === deletedCode) {
            if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
            return null;
          }
          return prev;
        });

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
                  localStorage.removeItem('swu_latest_photo');
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
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current);
      }
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
    };
  }, [showPhotoInQueue]);

  // Compute clean QR URL (Hydration-safe with hostOrigin fallback)
  const cleanHostOrigin = hostOrigin?.trim().replace(/\/+$/, '');
  const baseOrigin = cleanHostOrigin
    ? (/^https?:\/\//i.test(cleanHostOrigin)
        ? cleanHostOrigin
        : `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${cleanHostOrigin}`)
    : (typeof window !== 'undefined' ? window.location.origin : '');

  // Extract token query string if present in activePhoto
  let tokenQuery = '';
  if (activePhoto?.token) {
    tokenQuery = `?t=${encodeURIComponent(activePhoto.token)}`;
  } else if (activePhoto?.qrUrl && activePhoto.qrUrl.includes('?')) {
    tokenQuery = activePhoto.qrUrl.slice(activePhoto.qrUrl.indexOf('?'));
  }

  const qrTargetUrl = activePhoto
    ? (baseOrigin
        ? `${baseOrigin}/p/${encodeURIComponent(activePhoto.code)}${tokenQuery}`
        : (activePhoto.qrUrl && /^https?:\/\//i.test(activePhoto.qrUrl) ? activePhoto.qrUrl : `/p/${activePhoto.code}${tokenQuery}`))
    : '';

  return (
    <main className="display-shell grid h-dvh w-screen place-items-center overflow-hidden bg-black select-none">
      <div className="display-stage relative aspect-video h-auto max-h-dvh w-full max-w-[calc(100dvh*16/9)] overflow-hidden">
        {isMuted && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0305]/95 text-white select-none animate-in fade-in">
            <CpeLogo className="h-16 text-white opacity-40 mb-4" />
            <div className="font-pixel px-blink mb-3 text-xs text-[var(--px-gold)]">
              PAUSED
            </div>
            <h2 className="text-xl font-bold text-white">จอแสดงผลอยู่ในโหมดพักการแสดงภาพชั่วคราว</h2>
            <p className="text-xs text-slate-400 mt-1">เจ้าหน้าที่กำลังจัดเตรียมระบบ กรุณารอสักครู่</p>
          </div>
        )}
        {/* Left Section (30%): Live Polaroid Showcase & Centered White QR Station */}
        <section className="showcase-left absolute inset-y-0 left-0 z-20 flex w-[30%] flex-col border-r-4 border-[var(--px-red-dark)] px-[1.2%] py-[1.2vw] justify-between">
          <div>
            {/* Live Indicator Banner */}
            <div className="font-pixel flex items-center justify-between text-[clamp(.36rem,.48vw,.6rem)]">
              {activePhoto ? (
                <span className="flex items-center gap-2 text-[var(--px-red-hi)]">
                  <span className="size-2 bg-[var(--px-green)] animate-pulse" />
                  NEW RECORD!
                </span>
              ) : (
                <span className="flex items-center gap-2 text-white">
                  <span className="size-2 bg-[var(--px-gold)] px-blink" />
                  INSERT COIN
                </span>
              )}
              <span className="text-[var(--px-muted)]" suppressHydrationWarning>{currentTime}</span>
            </div>

            <h1 className="mt-[0.8vw] font-['Kanit'] text-[clamp(1.3rem,1.8vw,2.2rem)] font-extrabold text-white [text-shadow:3px_3px_0_#1a0306]">
              {activePhoto ? 'รูปล่าสุด' : 'ยินดีต้อนรับ'}
            </h1>

            {/* Polaroid Frame Card tilted -2deg */}
            <div className="mx-auto mt-[0.6vw] w-[96%] shrink-0 rotate-[-2deg] px-panel px-corners p-[.65vw] pb-[.75vw] transition-transform duration-500 hover:rotate-0">
              {activePhoto ? (
                // Active Attendee Photo
                <>
                  <div className="relative aspect-[4/3] overflow-hidden px-screen">
                    <img
                      src={activePhoto.photoUrl}
                      alt={`รูปล่าสุด ${activePhoto.code}`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/85 px-[.7vw] py-[.38vw] text-white backdrop-blur-sm">
                      <span className="text-[clamp(.42rem,.52vw,.62rem)] font-bold">
                        <span className="text-[var(--px-red-hi)]">CPE</span> OPEN HOUSE
                      </span>
                      <span className="text-[clamp(.34rem,.42vw,.5rem)] text-slate-300">
                        วิศวกรรมคอมพิวเตอร์ • {formatPhotoDate(activePhoto.createdAt).thai}
                      </span>
                    </div>
                  </div>
                  <div className="pt-[.65vw] text-center text-white">
                    <div className="font-pixel text-[clamp(.4rem,.55vw,.68rem)] [text-shadow:2px_2px_0_#1a0306]">
                      CPE OPEN HOUSE
                    </div>
                    <div className="font-pixel-sm mt-1 text-[clamp(.38rem,.46vw,.56rem)] text-[var(--px-cream)]/80 font-bold">
                      {formatPhotoDate(activePhoto.createdAt).dotted} · #{activePhoto.code.replace('OPH-', '')}
                    </div>
                  </div>
                </>
              ) : (
                // Standby Idle Black Card (Not stored in history)
                <>
                  <div className="relative aspect-[4/3] overflow-hidden px-screen flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center gap-2 select-none">
                      <CpeLogo className="h-[2.2vw] opacity-30 text-white" />
                      <span className="font-pixel px-blink text-[clamp(.36rem,.46vw,.56rem)] text-[var(--px-gold)]">
                        PRESS START
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/90 px-[.7vw] py-[.38vw] text-white backdrop-blur-sm">
                      <span className="text-[clamp(.42rem,.52vw,.62rem)] font-bold">
                        <span className="text-[var(--px-red-hi)]">CPE</span> OPEN HOUSE
                      </span>
                      <span className="text-[clamp(.34rem,.42vw,.5rem)] text-slate-400">
                        วิศวกรรมคอมพิวเตอร์ มศว
                      </span>
                    </div>
                  </div>
                  <div className="pt-[.65vw] text-center text-white">
                    <div className="font-pixel text-[clamp(.4rem,.55vw,.68rem)] [text-shadow:2px_2px_0_#1a0306]">
                      CPE OPEN HOUSE
                    </div>
                    <div className="font-pixel-sm mt-1 text-[clamp(.38rem,.46vw,.56rem)] text-[var(--px-cream)]/80 font-bold">
                      ซุ้มถ่ายภาพวิศวะคอม · STANDBY
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* White QR Card - Perfectly Centered in Lower Section, Elevated from Bottom */}
          <div className="flex-1 flex flex-col items-center justify-center my-auto pt-[0.6vw] pb-[0.2vw]">
            <div className="qr-card px-corners flex flex-col items-center justify-center bg-white shadow-[inset_0_0_0_6px_var(--px-red),inset_0_0_0_10px_var(--px-red-dark)] px-[1.4vw] pb-[1.3vw] pt-[1.0vw] shadow-2xl shrink-0 w-fit text-center">
              {activePhoto ? (
                // Active Photo Scan QR
                <>
                  <div className="text-[#0F172A] text-[clamp(.95rem,1.3vw,1.6rem)] font-extrabold tracking-[-.02em] mb-[0.6vw]">
                    สแกนรับ<span className="text-[#CE1126]">รูป</span>
                  </div>
                  <div className="aspect-square w-[clamp(145px,12.5vw,230px)] bg-white flex items-center justify-center">
                    {isMounted ? (
                      <QRCodeSVG
                        value={qrTargetUrl}
                        level="H"
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                        className="h-full w-full"
                        title={`รับรูป ${activePhoto.code}`}
                      />
                    ) : (
                      <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-300 text-[10px] font-mono animate-pulse rounded">
                        QR CODE
                      </div>
                    )}
                  </div>
                </>
              ) : (
                // Standby Follow Us (Instagram) QR
                <>
                  <div className="text-[#0F172A] text-[clamp(.95rem,1.3vw,1.6rem)] font-extrabold tracking-[-.02em] mb-[0.6vw]">
                    ติดตาม<span className="text-[#CE1126]">เรา</span>
                  </div>
                  <div className="aspect-square w-[clamp(145px,12.5vw,230px)] bg-white flex items-center justify-center p-1">
                    <img
                      src="/cpe-ig-qr.png"
                      alt="Instagram @cpe_swu"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Right Section (70%): Live Photo Wall / Gallery (Never contains black standby cards) */}
        <section className="absolute inset-y-0 right-0 flex w-[70%] flex-col px-[2.45vw] py-[.75vw]">
          <header className="flex items-center justify-between border-b-4 border-[var(--px-red-dark)] pb-3">
            <h2 className="flex items-center gap-[.5em] text-[clamp(1rem,1.7vw,2.1rem)]">
              <CpeLogo className="h-[1em]" />
              <span className="px-title">SWU OPEN HOUSE</span>
            </h2>
            <div className="text-[clamp(.5rem,.68vw,.82rem)] font-medium text-[var(--px-muted)]">
              ถ่ายไปแล้ว <span className="font-pixel text-[var(--px-gold)]">{photos.length}</span> รูป
            </div>
          </header>

          <div className="mt-[1.8vw] flex min-h-0 flex-1 flex-col">
            <div className="font-pixel text-[clamp(.38rem,.5vw,.62rem)] text-[var(--px-red-hi)]">
              ▶ HIGH SCORES · ภาพทั้งหมด
            </div>

            <div className="photo-wall-scroll mt-[1vw] min-h-0 flex-1 overflow-y-auto pr-[.5vw]">
              <div className="grid grid-cols-5 gap-[.65vw] pb-[2vw]">
                {photos.map((photo, index) => {
                  const isNew = photo.code === newestCode;
                  return (
                    <figure
                      key={`${photo.code}-${index}`}
                      className={`group relative aspect-[4/3] overflow-hidden px-corners px-screen transition duration-300 hover:brightness-110 ${
                        isNew ? 'photo-wall-enter' : ''
                      }`}
                    >
                      <img
                        src={photo.photoUrl}
                        alt={`ภาพถ่าย ${photo.code}`}
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <figcaption className="font-pixel-sm absolute bottom-1.5 left-1.5 bg-[var(--px-red)] px-1.5 py-0.5 text-[clamp(.32rem,.4vw,.48rem)] font-bold text-white">
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
