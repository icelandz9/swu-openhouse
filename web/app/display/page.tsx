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

// How often the display asks the server for sync commands / latest photo across machines.
const POLL_LATEST_MS = 2500;
const POLL_SYNC_MS = 2000;
const POLL_GALLERY_MS = 10000;
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
  const [peerUrl, setPeerUrl] = useState<string>('');
  const [isNetOnline, setIsNetOnline] = useState<boolean>(true);
  const [imageRefreshKey, setImageRefreshKey] = useState<number>(0);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Codes already shown, so BroadcastChannel, /api/photos?latest=1, and /api/kiosk-sync don't double-trigger
  const seenCodesRef = useRef<Set<string>>(new Set());
  const initialGalleryLoadedRef = useRef<boolean>(false);
  const lastDisplayActionIdRef = useRef<string | null>(null);
  const lastDisplayMuteTsRef = useRef<number>(0);
  const lastDeletedAtRef = useRef<number>(0);
  const lastSyncBootedAtRef = useRef<number>(Date.now());
  const wasOfflineRef = useRef<boolean>(false);
  const netLatencyRef = useRef<number>(0);

  const activePhotoRef = useRef<GalleryItem | null>(null);
  const photosCountRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);

  useEffect(() => {
    activePhotoRef.current = activePhoto;
  }, [activePhoto]);

  useEffect(() => {
    photosCountRef.current = photos.length;
  }, [photos.length]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const buildApiUrl = useCallback(
    (path: string) => (peerUrl ? `${peerUrl}${path}` : path),
    [peerUrl]
  );

  const resolvePhotoSrc = useCallback(
    (photoUrl: string, code: string) => {
      const clean = (photoUrl || '').trim();
      const base =
        clean && /^https?:\/\//i.test(clean)
          ? clean
          : clean && clean.startsWith('/api/') && peerUrl
          ? `${peerUrl}${clean}`
          : clean || `${peerUrl}/api/photos/${encodeURIComponent(code)}/file`;
      if (imageRefreshKey > 0) {
        const sep = base.includes('?') ? '&' : '?';
        return `${base}${sep}r=${imageRefreshKey}`;
      }
      return base;
    },
    [peerUrl, imageRefreshKey]
  );

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

  // Mount tracking, host resolution, and optional ?peer= LAN URL for direct Machine 1 <-> Machine 2 sync
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const peerParam = params.get('peer');
      if (peerParam !== null) {
        const cleanPeer = peerParam.trim().replace(/\/+$/, '');
        if (!cleanPeer || cleanPeer === 'off' || cleanPeer === 'clear') {
          localStorage.removeItem('swu_kiosk_peer_url');
          setPeerUrl('');
        } else {
          const normalized = /^https?:\/\//i.test(cleanPeer) ? cleanPeer : `http://${cleanPeer}`;
          localStorage.setItem('swu_kiosk_peer_url', normalized);
          setPeerUrl(normalized);
        }
      } else {
        const savedPeer = localStorage.getItem('swu_kiosk_peer_url') || '';
        if (savedPeer) setPeerUrl(savedPeer.replace(/\/+$/, ''));
      }

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

  // Shared helper to remove a deleted photo everywhere in Display state & cache
  const removeDeletedCode = useCallback((deletedCode: string) => {
    if (!deletedCode) return;
    setActivePhoto((prev) => {
      if (prev?.code === deletedCode) {
        if (queueTimerRef.current) {
          clearTimeout(queueTimerRef.current);
          queueTimerRef.current = null;
        }
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
  }, []);

  // Reconcile full photo list from server/R2 (recovers missed offline backlog + removes server-deleted items)
  const reconcileGalleryFromServer = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl(`/api/photos?t=${Date.now()}`), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const serverPhotos: GalleryItem[] = Array.isArray(data?.photos) ? data.photos : [];
      if (!serverPhotos) return;

      let deletedCodes: string[] = [];
      try {
        deletedCodes = JSON.parse(localStorage.getItem('swu_deleted_codes') || '[]');
      } catch {}

      const cleanServerPhotos = serverPhotos.filter((p) => p?.code && !deletedCodes.includes(p.code));
      const serverCodes = new Set(cleanServerPhotos.map((p) => p.code));

      if (!initialGalleryLoadedRef.current) {
        cleanServerPhotos.forEach((p) => seenCodesRef.current.add(p.code));
        initialGalleryLoadedRef.current = true;
      } else {
        // Announce genuinely new photos synced from Machine 1 after offline backlog flush!
        const unseenNewest = cleanServerPhotos
          .filter((p) => !seenCodesRef.current.has(p.code))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        cleanServerPhotos.forEach((p) => seenCodesRef.current.add(p.code));
        if (unseenNewest && Date.now() - new Date(unseenNewest.createdAt).getTime() < 5 * 60 * 1000) {
          setNewestCode(unseenNewest.code);
          showPhotoInQueue(unseenNewest);
        }
      }

      setPhotos((prev) => {
        const prevMap = new Map(prev.map((p) => [p.code, p]));
        // Keep only items confirmed on server OR very recently captured local items (< 90s old)
        const now = Date.now();
        const merged = new Map<string, GalleryItem>();
        cleanServerPhotos.forEach((item) => {
          merged.set(item.code, item);
        });
        prevMap.forEach((item, code) => {
          if (!serverCodes.has(code) && !deletedCodes.includes(code)) {
            const ageMs = now - new Date(item.createdAt).getTime();
            if (ageMs < 90000) merged.set(code, item);
          }
        });
        const sorted = Array.from(merged.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        try {
          localStorage.setItem('swu_photo_gallery', JSON.stringify(sorted.slice(0, 60)));
        } catch {}
        return sorted;
      });
    } catch {}
  }, [buildApiUrl, showPhotoInQueue]);

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

  // Load initial photos from localStorage / API and reconcile every 10s
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
            const clean = parsed.filter((p: any) => p?.code && !deletedCodes.includes(p.code));
            setPhotos(clean.length > 0 ? clean : DEFAULT_SEEDS.filter((s) => !deletedCodes.includes(s.code)));
          }
        }

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

    void reconcileGalleryFromServer();
    const wallInterval = setInterval(() => {
      void reconcileGalleryFromServer();
    }, POLL_GALLERY_MS);
    return () => clearInterval(wallInterval);
  }, [reconcileGalleryFromServer]);

  // Poll the server for the newest photo (fast path)
  useEffect(() => {
    let stopped = false;
    let firstPoll = true;
    const poll = async () => {
      try {
        const res = await fetch(buildApiUrl('/api/photos?latest=1'), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const latest = data?.photo as (GalleryItem & { token?: string }) | null;
        if (stopped || !latest?.code) return;
        let deleted: string[] = [];
        try {
          deleted = JSON.parse(localStorage.getItem('swu_deleted_codes') || '[]');
        } catch {}
        const isFresh = Date.now() - new Date(latest.createdAt).getTime() < NEW_PHOTO_WINDOW_MS;
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
  }, [buildApiUrl, receiveNewPhoto]);

  // Cross-machine Admin <-> Display sync (PUSH_TO_DISPLAY, MUTE_DISPLAY, PHOTO_DELETED, publicDomain & Display telemetry)
  useEffect(() => {
    let stopped = false;
    let firstSync = true;

    const pollSync = async () => {
      try {
        const res = await fetch(buildApiUrl(`/api/kiosk-sync?t=${Date.now()}`), { cache: 'no-store' });
        if (!res.ok) return;
        const sync = await res.json();
        if (stopped || !sync) return;

        // 1. Sync publicDomain if Admin updated it on Machine 1
        const remoteDomain = typeof sync.config?.publicDomain === 'string' ? sync.config.publicDomain.trim() : '';
        if (remoteDomain && typeof window !== 'undefined') {
          setHostOrigin(remoteDomain);
          try {
            localStorage.setItem('swu_booth_host', remoteDomain);
          } catch {}
        }

        // 2. Sync displayMuted state from Machine 1 Admin
        const remoteMuteTs = typeof sync.displayUpdatedAt === 'number' ? sync.displayUpdatedAt : 0;
        if (firstSync || remoteMuteTs > lastDisplayMuteTsRef.current) {
          lastDisplayMuteTsRef.current = remoteMuteTs;
          const nextMute = Boolean(sync.displayMuted);
          setIsMuted(nextMute);
          if (nextMute) {
            if (queueTimerRef.current) {
              clearTimeout(queueTimerRef.current);
              queueTimerRef.current = null;
            }
            setActivePhoto(null);
          }
        }

        // 3. Process cross-machine displayAction (PUSH_TO_DISPLAY, PHOTO_READY, RESET_STANDBY)
        const action = sync.displayAction;
        if (action?.id && action.id !== lastDisplayActionIdRef.current) {
          lastDisplayActionIdRef.current = action.id;
          const actionTs = typeof action.timestamp === 'number' ? action.timestamp : 0;
          const isRecentOnBoot = Date.now() - actionTs < 45000;
          if (!firstSync || isRecentOnBoot) {
            if (action.type === 'PUSH_TO_DISPLAY' && action.photo?.code) {
              const pushed: GalleryItem = {
                code: action.photo.code,
                qrUrl: action.photo.qrUrl,
                token: action.photo.token,
                photoUrl: action.photo.photoUrl,
                createdAt: action.photo.createdAt,
                style: 'NEURAL RED',
              };
              setIsMuted(false);
              setNewestCode(pushed.code);
              showPhotoInQueue(pushed);
              setPhotos((prev) =>
                prev.some((p) => p.code === pushed.code) ? prev : [pushed, ...prev].slice(0, 60)
              );
            } else if (action.type === 'PHOTO_READY' && action.photo?.code) {
              if (!seenCodesRef.current.has(action.photo.code)) {
                receiveNewPhoto({
                  code: action.photo.code,
                  qrUrl: action.photo.qrUrl,
                  token: action.photo.token,
                  photoUrl: action.photo.photoUrl,
                  createdAt: action.photo.createdAt,
                  style: 'NEURAL RED',
                });
              }
            } else if (action.type === 'RESET_STANDBY') {
              if (!firstSync || actionTs >= lastSyncBootedAtRef.current - 5000) {
                if (queueTimerRef.current) {
                  clearTimeout(queueTimerRef.current);
                  queueTimerRef.current = null;
                }
                setActivePhoto(null);
              }
            }
          }
        }

        // 4. Sync remote photo deletion (PDPA instant removal on Screen 2)
        if (sync.lastDeleted?.code && typeof sync.lastDeleted.at === 'number') {
          if (sync.lastDeleted.at > lastDeletedAtRef.current) {
            lastDeletedAtRef.current = sync.lastDeleted.at;
            removeDeletedCode(sync.lastDeleted.code);
          }
        }
      } catch {
      } finally {
        firstSync = false;
      }
    };

    const sendDisplayHeartbeat = async () => {
      try {
        await fetch(buildApiUrl('/api/kiosk-sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telemetry: {
              display: {
                activeCode: activePhotoRef.current?.code || null,
                queueLength: activePhotoRef.current ? 1 : 0,
                totalPhotos: photosCountRef.current,
                isMuted: isMutedRef.current,
                latencyMs: netLatencyRef.current ?? 0,
              },
            },
          }),
        });
      } catch {}
    };

    void pollSync();
    void sendDisplayHeartbeat();
    const syncTimer = setInterval(() => void pollSync(), POLL_SYNC_MS);
    const hbTimer = setInterval(() => void sendDisplayHeartbeat(), 4000);
    return () => {
      stopped = true;
      clearInterval(syncTimer);
      clearInterval(hbTimer);
    };
  }, [buildApiUrl, receiveNewPhoto, removeDeletedCode, showPhotoInQueue]);

  // Network health monitor + automatic reconnect refresh (no F5 required when internet returns!)
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine && !peerUrl) {
        wasOfflineRef.current = true;
        setIsNetOnline(false);
        return;
      }
      try {
        const res = await fetch(buildApiUrl(`/api/network-status?t=${Date.now()}`), { cache: 'no-store' });
        if (!res.ok) throw new Error('offline');
        const data = await res.json();
        const onlineNow = peerUrl ? true : Boolean(data?.online && data?.cloudReachable);
        if (typeof data?.latencyMs === 'number') netLatencyRef.current = data.latencyMs;
        setIsNetOnline(onlineNow);
        if (onlineNow && wasOfflineRef.current) {
          wasOfflineRef.current = false;
          setImageRefreshKey((k) => k + 1);
          void reconcileGalleryFromServer();
        } else if (!onlineNow) {
          wasOfflineRef.current = true;
        }
      } catch {
        wasOfflineRef.current = true;
        setIsNetOnline(false);
      }
    };

    const onOnline = () => {
      setIsNetOnline(true);
      setImageRefreshKey((k) => k + 1);
      void checkConnection();
      void reconcileGalleryFromServer();
    };
    const onOffline = () => {
      wasOfflineRef.current = true;
      setIsNetOnline(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }
    void checkConnection();
    const probeTimer = setInterval(() => void checkConnection(), 5000);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
      clearInterval(probeTimer);
    };
  }, [buildApiUrl, peerUrl, reconcileGalleryFromServer]);

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
        removeDeletedCode(data.code);
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
  }, [showPhotoInQueue, receiveNewPhoto, removeDeletedCode]);

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
                  key={`${activePhoto.code}-${imageRefreshKey}`}
                  src={resolvePhotoSrc(activePhoto.photoUrl, activePhoto.code)}
                  alt={`รูปล่าสุด ${activePhoto.code}`}
                  /* contain: a 3:4 portrait shot shows whole instead of being cut to the 4:3 card */
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (!img.dataset.fallbackTried) {
                      img.dataset.fallbackTried = '1';
                      img.src = buildApiUrl(`/api/photos/${encodeURIComponent(activePhoto.code)}/file?r=${imageRefreshKey}`);
                    } else {
                      img.style.display = 'none';
                    }
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
                <div className="font-pixel-sm text-[clamp(.38rem,.5vw,.62rem)] text-[var(--px-muted)]">
                  {!isNetOnline ? 'NETWORK' : peerUrl ? 'LAN SYNC' : 'STAGE'}
                </div>
                <div
                  className={`font-pixel text-[clamp(.6rem,.95vw,1.15rem)] ${
                    !isNetOnline ? 'px-blink text-red-400' : 'text-[var(--px-green)]'
                  }`}
                >
                  {!isNetOnline ? 'OFFLINE' : peerUrl ? 'PEER' : 'CPE'}
                </div>
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
                      key={`${photo.code}-${imageRefreshKey}-${index}`}
                      className={`group relative aspect-[4/3] overflow-hidden px-corners px-panel p-[.35vw] ${isNew ? 'photo-wall-enter' : ''}`}
                    >
                      <div className="relative h-full w-full overflow-hidden bg-black">
                        <img
                          src={resolvePhotoSrc(photo.photoUrl, photo.code)}
                          alt={`ภาพถ่าย ${photo.code}`}
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            if (!img.dataset.fallbackTried) {
                              img.dataset.fallbackTried = '1';
                              img.src = buildApiUrl(`/api/photos/${encodeURIComponent(photo.code)}/file?r=${imageRefreshKey}`);
                            } else {
                              img.style.display = 'none';
                            }
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
