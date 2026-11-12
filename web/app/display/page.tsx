'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ScreenSyncEvent, SCREEN_SYNC_CHANNEL, DEFAULT_PRODUCTION_APP_URL } from '@/lib/contracts';
import { CpeLogo } from '@/components/CpeLogo';
import { SafeErrorBoundary } from '@/components/SafeErrorBoundary';
import { ConsoleCaps, GameMenu, PixelSkyline } from '@/components/PixelScene';

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

// How often the display asks the server for the newest photo. Covers a display that runs on another
// machine or browser, where the kiosk's BroadcastChannel message never arrives.
const POLL_LATEST_MS = 3000;
// Only photos taken this recently count as "new" when found by polling (older ones are history).
const NEW_PHOTO_WINDOW_MS = 60000;

function ShowcaseDisplayScreenContent() {
  const [photos, setPhotos] = useState<GalleryItem[]>(DEFAULT_SEEDS);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activePhoto, setActivePhoto] = useState<GalleryItem | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('12:00');
  const [newestCode, setNewestCode] = useState<string>('');
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [hostOrigin, setHostOrigin] = useState<string>('');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Codes already shown, so the BroadcastChannel event and the poll don't announce the same photo twice
  const seenCodesRef = useRef<Set<string>>(new Set());

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

  // A new photo arrived: show it on the left with its QR and add it to the wall, without reloading the page.
  const receiveNewPhoto = useCallback(
    (item: GalleryItem) => {
      seenCodesRef.current.add(item.code);
      setNewestCode(item.code);
      showPhotoInQueue(item); // 30 s on the left; replaces the previous one
      setPhotos((prev) => [item, ...prev.filter((p) => p.code !== item.code)].slice(0, 50));
      try {
        const rawGallery = localStorage.getItem('swu_photo_gallery') || '[]';
        const gallery: GalleryItem[] = JSON.parse(rawGallery);
        const updated = [item, ...gallery.filter((p) => p?.code !== item.code)].slice(0, 50);
        localStorage.setItem('swu_photo_gallery', JSON.stringify(updated));
        localStorage.setItem('swu_latest_photo', JSON.stringify(item));
      } catch {}
    },
    [showPhotoInQueue]
  );

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

  // Poll the server for the newest photo, so a new shot appears without a page refresh even when the
  // kiosk runs in another browser or on another machine (BroadcastChannel only reaches the same browser).
  useEffect(() => {
    let stopped = false;
    let firstPoll = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/photos?latest=1', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const latest = data?.photo as (GalleryItem & { token?: string }) | null;
        if (stopped || !latest?.code) return;
        let deleted: string[] = [];
        try {
          deleted = JSON.parse(localStorage.getItem('swu_deleted_codes') || '[]');
        } catch {}
        const isFresh = Date.now() - new Date(latest.createdAt).getTime() < NEW_PHOTO_WINDOW_MS;
        // The first answer only records what is already there; later answers announce new photos.
        if (firstPoll || seenCodesRef.current.has(latest.code) || deleted.includes(latest.code) || !isFresh) {
          seenCodesRef.current.add(latest.code);
          return;
        }
        receiveNewPhoto({
          code: latest.code,
          qrUrl: latest.qrUrl,
          token: latest.token,
          photoUrl: latest.photoUrl,
          createdAt: latest.createdAt,
          style: 'NEURAL RED',
        });
      } catch {
        // offline or not staff: the BroadcastChannel path still works
      } finally {
        firstPoll = false;
      }
    };
    poll();
    const id = setInterval(poll, POLL_LATEST_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [receiveNewPhoto]);

  // Listen to live capture events from Screen 1 (Kiosk)
  useEffect(() => {
    const channel = new BroadcastChannel(SCREEN_SYNC_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<ScreenSyncEvent>) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'PHOTO_READY_FOR_DISPLAY') {
        receiveNewPhoto({
          code: data.code,
          qrUrl: data.qrUrl,
          token: data.token,
          photoUrl: data.photoUrl,
          createdAt: data.createdAt,
          style: 'NEURAL RED',
        });
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
        try {
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
        } catch {}
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
      try {
        channel.close();
      } catch {}
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
      if (queueTimerRef.current) {
        clearTimeout(queueTimerRef.current);
      }
    };
  }, [showPhotoInQueue, receiveNewPhoto]);

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
        {/* Left (30%): latest photo on a console screen + QR */}
        <section className="showcase-left absolute inset-y-0 left-0 z-20 flex w-[30%] flex-col gap-[1vw] border-r-4 border-[var(--px-red-dark)] px-[1.3vw] py-[1.1vw]">
          {/* HUD row */}
          <div className="font-pixel flex items-center justify-between text-[clamp(.36rem,.5vw,.62rem)]">
            {activePhoto ? (
              <span className="flex items-center gap-[.5vw] text-[var(--px-gold)]">
                <span className="size-[.5vw] bg-[var(--px-green)] animate-pulse" />
                NEW RECORD!
              </span>
            ) : (
              <span className="flex items-center gap-[.5vw] text-white">
                <span className="px-blink size-[.5vw] bg-[var(--px-gold)]" />
                INSERT COIN
              </span>
            )}
            <span className="px-screen px-[.5vw] py-[.25vw] text-[var(--px-gold)]" suppressHydrationWarning>
              {currentTime}
            </span>
          </div>

          {/* Console with the photo */}
          <div className="px-panel px-corners relative p-[1.1vw] pb-[.8vw] [--cap-h:1.9vw] [--cap-w:2.6vw]">
            <ConsoleCaps corners={['tl', 'tr']} />
            <div className="relative z-[2] aspect-[4/3] overflow-hidden px-screen">
              {activePhoto ? (
                <img
                  src={activePhoto.photoUrl}
                  alt={`รูปล่าสุด ${activePhoto.code}`}
                  /* contain: a 3:4 portrait shot shows whole instead of being cut to the 4:3 card */
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <>
                  <PixelSkyline />
                  <div className="relative flex h-full flex-col items-center justify-start gap-[.7vw] pt-[1.6vw]">
                    <p className="px-title text-[clamp(.8rem,1.45vw,1.75rem)]">ENGINEERING</p>
                    <p className="font-pixel px-menu-item text-[clamp(.32rem,.46vw,.56rem)]">BUILD YOUR OWN FUTURE</p>
                    <GameMenu className="mt-[.8vw] text-[clamp(.34rem,.5vw,.62rem)]" />
                  </div>
                </>
              )}
              {activePhoto && (
                <span className="font-pixel absolute left-[.5vw] top-[.5vw] bg-[var(--px-red)] px-[.45vw] py-[.25vw] text-[clamp(.32rem,.42vw,.52rem)] text-white">
                  #{activePhoto.code.replace('OPH-', '')}
                </span>
              )}
            </div>
            <div className="relative z-[2] mt-[.6vw] flex items-center justify-between">
              <div>
                <div className="font-['Kanit'] text-[clamp(.7rem,1vw,1.2rem)] font-bold leading-tight text-white [text-shadow:2px_2px_0_#1a0306]">
                  {activePhoto ? 'รูปล่าสุด' : 'ยินดีต้อนรับ'}
                </div>
                <div className="mt-[.2vw] text-[clamp(.4rem,.52vw,.64rem)] text-[var(--px-cream)]/80">
                  {activePhoto
                    ? `วิศวกรรมคอมพิวเตอร์ · ${formatPhotoDate(activePhoto.createdAt).thai}`
                    : 'ซุ้มถ่ายภาพวิศวะคอม มศว'}
                </div>
              </div>
              {/* A / B buttons */}
              <div className="flex gap-[.4vw]" aria-hidden>
                <span className="px-round size-[1.3vw] font-pixel text-[clamp(.3rem,.4vw,.5rem)]">B</span>
                <span className="px-round size-[1.3vw] -translate-y-[.4vw] font-pixel text-[clamp(.3rem,.4vw,.5rem)]">A</span>
              </div>
            </div>
          </div>

          {/* QR */}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
            <p className="font-pixel mb-[.7vw] text-center text-[clamp(.4rem,.6vw,.74rem)] text-white [text-shadow:2px_2px_0_#1a0306]">
              {activePhoto ? '▼ SCAN TO GET YOUR PHOTO ▼' : '▼ FOLLOW US ▼'}
            </p>
            <div className="qr-card px-corners flex w-fit shrink-0 flex-col items-center justify-center bg-white px-[1.3vw] pb-[1.1vw] pt-[.9vw] text-center shadow-[inset_0_0_0_6px_var(--px-red),inset_0_0_0_10px_var(--px-red-dark)]">
              <div className="mb-[.6vw] font-['Kanit'] text-[clamp(1rem,1.45vw,1.8rem)] font-bold leading-none text-[#1a0306] [text-shadow:.12vw_.12vw_0_rgba(200,16,46,0.22)]">
                {activePhoto ? (
                  <>
                    สแกนรับ<span className="text-[var(--px-red)]">รูป</span>
                  </>
                ) : (
                  <>
                    ติดตาม<span className="text-[var(--px-red)]">เรา</span>
                  </>
                )}
              </div>
              <div className="flex aspect-square w-[clamp(140px,11.5vw,220px)] items-center justify-center bg-white">
                {activePhoto ? (
                  isMounted ? (
                    <QRCodeSVG
                      value={qrTargetUrl}
                      level="H"
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      className="h-full w-full"
                      title={`รับรูป ${activePhoto.code}`}
                    />
                  ) : (
                    <div className="flex h-full w-full animate-pulse items-center justify-center bg-slate-100 font-mono text-[10px] text-slate-300">
                      QR CODE
                    </div>
                  )
                ) : (
                  <img src="/cpe-ig-qr.png" alt="Instagram @cpe_swu" className="h-full w-full object-contain p-1" />
                )}
              </div>
            </div>
          </div>

          {/* Event date, like the poster */}
          <div className="text-center">
            <div className="font-pixel text-[clamp(.42rem,.62vw,.76rem)] text-white [text-shadow:2px_2px_0_#1a0306]">14-15 NOVEMBER 2026</div>
            <div className="mt-[.3vw] text-[clamp(.4rem,.5vw,.62rem)] text-[var(--px-muted)]">ภาควิชาวิศวกรรมคอมพิวเตอร์ · IG cpe_swu</div>
          </div>
        </section>

        {/* Right (70%): photo wall */}
        <section className="absolute inset-y-0 right-0 flex w-[70%] flex-col px-[2.2vw] py-[1.1vw]">
          <header className="flex items-center justify-between gap-[1vw] border-b-4 border-[var(--px-red-dark)] pb-[.9vw]">
            <h2 className="flex items-center gap-[.8vw] text-[clamp(1rem,1.9vw,2.3rem)]">
              <CpeLogo className="h-[1.1em]" />
              <span className="px-title">SWU OPEN HOUSE</span>
            </h2>
            <div className="flex items-stretch gap-[.6vw]">
              <div className="px-screen px-corners px-[.9vw] py-[.45vw] text-center">
                <div className="font-pixel-sm text-[clamp(.38rem,.5vw,.62rem)] text-[var(--px-muted)]">PHOTOS</div>
                <div className="font-pixel text-[clamp(.6rem,.95vw,1.15rem)] text-[var(--px-gold)] tabular-nums">
                  {String(photos.length).padStart(3, '0')}
                </div>
              </div>
              <div className="px-screen px-corners px-[.9vw] py-[.45vw] text-center">
                <div className="font-pixel-sm text-[clamp(.38rem,.5vw,.62rem)] text-[var(--px-muted)]">STAGE</div>
                <div className="font-pixel text-[clamp(.6rem,.95vw,1.15rem)] text-[var(--px-green)]">CPE</div>
              </div>
            </div>
          </header>

          <div className="relative mt-[1.2vw] flex min-h-0 flex-1 flex-col">
          <div className="px-screen relative flex min-h-0 flex-1 flex-col overflow-hidden px-[1.2vw] py-[1vw]">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] opacity-60" aria-hidden>
            <PixelSkyline />
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="font-pixel flex items-center gap-[.8vw] text-[clamp(.38rem,.55vw,.68rem)] text-[var(--px-red-hi)]">
              <span>▶ HIGH SCORES</span>
              <span className="h-1 flex-1 bg-[repeating-linear-gradient(90deg,var(--px-red-dark)_0_8px,transparent_8px_14px)]" />
              <span className="font-['Kanit'] text-[clamp(.5rem,.66vw,.8rem)] text-[var(--px-muted)]">ภาพทั้งหมดของวันนี้</span>
            </div>

            <div className="photo-wall-scroll mt-[1vw] min-h-0 flex-1 overflow-y-auto pr-[.5vw]">
              <div className="grid grid-cols-4 gap-[.9vw] pb-[2vw]">
                {photos.map((photo, index) => {
                  const isNew = photo.code === newestCode;
                  return (
                    <figure
                      key={`${photo.code}-${index}`}
                      className={`group relative aspect-[4/3] overflow-hidden px-corners px-panel p-[.35vw] ${isNew ? 'photo-wall-enter' : ''}`}
                    >
                      <div className="relative h-full w-full overflow-hidden bg-black">
                        <img
                          src={photo.photoUrl}
                          alt={`ภาพถ่าย ${photo.code}`}
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <figcaption className="font-pixel absolute bottom-[.7vw] left-[.7vw] bg-[var(--px-red)] px-[.4vw] py-[.2vw] text-[clamp(.3rem,.38vw,.46rem)] text-white">
                        #{photo.code.replace('OPH-', '')}
                      </figcaption>
                      {index === 0 && (
                        <span className="font-pixel absolute right-[.7vw] top-[.7vw] bg-[var(--px-gold)] px-[.4vw] py-[.2vw] text-[clamp(.3rem,.38vw,.46rem)] text-[#1a0306]">
                          NEW
                        </span>
                      )}
                    </figure>
                  );
                })}
                {/* Empty slots so the wall never looks bare */}
                {Array.from({ length: Math.max(0, 12 - photos.length) }, (_, i) => (
                  <div key={`slot-${i}`} className="flex aspect-[4/3] flex-col items-center justify-center gap-[.5vw] px-corners px-card">
                    <span className="font-pixel text-[clamp(.9rem,1.6vw,2rem)] text-[var(--px-screen-line)]">?</span>
                    <span className="font-pixel-sm text-[clamp(.34rem,.46vw,.56rem)] text-[var(--px-muted)]/70">
                      {i === 0 ? 'NEXT PLAYER' : 'EMPTY SLOT'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ShowcaseDisplayScreen() {
  return (
    <SafeErrorBoundary fallbackTitle="หน้าจอแสดงผล Display พบข้อขัดข้องชั่วคราว">
      <ShowcaseDisplayScreenContent />
    </SafeErrorBoundary>
  );
}
