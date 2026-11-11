'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  QrCode,
  Link2,
  Trash2,
  LogOut,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CpeLogo } from '@/components/CpeLogo';
import { StaffGate } from '@/components/StaffGate';
import { SafeErrorBoundary } from '@/components/SafeErrorBoundary';
import {
  PhotoRecord,
  ScreenSyncEvent,
  SCREEN_SYNC_CHANNEL,
  DEFAULT_PRODUCTION_APP_URL,
} from '@/lib/contracts';

interface AuditLogItem {
  id: string;
  time: string;
  type: 'STAFF' | 'KIOSK' | 'DISPLAY' | 'NETWORK' | 'PDPA';
  text: string;
}

type AdminTab = 'overview' | 'gallery' | 'controls' | 'hardware' | 'logs';

const DEFAULT_SAMPLE_PHOTOS: PhotoRecord[] = [];

// Safe LocalStorage setter with LRU pruning
function safeLocalStorageSet<T>(key: string, data: T, maxItems: number = 50): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    try {
      if (Array.isArray(data)) {
        localStorage.setItem(key, JSON.stringify(data.slice(0, maxItems)));
      }
    } catch {}
  }
}

// Reusable Smooth SVG Sparkline Wave (Image 2 style - clean, no icon clutter)
function SparklineWave({
  color = '#10B981',
  gradientId,
  data = [18, 24, 20, 28, 23, 35, 30, 42, 38, 48],
}: {
  color?: string;
  gradientId: string;
  data?: number[];
}) {
  const width = 240;
  const height = 40;
  const min = Math.min(...data);
  const max = Math.max(...data) || 1;
  const range = max - min || 1;
  const padding = 4;
  const effectiveH = height - padding * 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - padding - ((val - min) / range) * effectiveH;
    return { x, y };
  });

  let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) / 2;
    const cp2y = p1.y;
    pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }

  const fillD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="w-full h-10 overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <path d={fillD} fill={`url(#${gradientId})`} />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function StaffAdminScreen() {
  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'recent1h' | 'recent30m'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);

  // Core Data
  const [photos, setPhotos] = useState<PhotoRecord[]>(DEFAULT_SAMPLE_PHOTOS);
  const [deletedCodes, setDeletedCodes] = useState<string[]>([]);
  const [kioskState, setKioskState] = useState<'standby' | 'paused' | 'active'>('standby');
  const [isDisplayMuted, setIsDisplayMuted] = useState<boolean>(false);
  const [netLatency, setNetLatency] = useState<number | null>(null);
  const [isNetOnline, setIsNetOnline] = useState<boolean>(true);
  const [commandNotice, setCommandNotice] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [pushedCode, setPushedCode] = useState<string | null>(null);

  // Settings & Tuners
  const [sensitivity, setSensitivity] = useState<number>(2.5);
  const [countdownDuration, setCountdownDuration] = useState<number>(3);
  const [photoRatio, setPhotoRatio] = useState<'3:4' | '4:3'>('4:3');
  const [publicDomain, setPublicDomain] = useState<string>('');
  const [instantPurgeCode, setInstantPurgeCode] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('--:--');
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [chartTimeRange, setChartTimeRange] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [chartStyle, setChartStyle] = useState<'area' | 'bar'>('area');
  const [chartInterval, setChartInterval] = useState<15 | 30 | 60>(15);
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; count: number; x: number; y: number } | null>(null);

  // Heartbeats & Real-time Telemetry (Zero-overhead IPC)
  const [kioskOnline, setKioskOnline] = useState<boolean>(false);
  const [displayOnline, setDisplayOnline] = useState<boolean>(false);
  const lastKioskPongRef = useRef<number>(0);
  const lastDisplayPongRef = useRef<number>(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Safe BroadcastChannel dispatcher that avoids InvalidStateError (Channel is closed)
  const safePostMessage = useCallback((event: ScreenSyncEvent) => {
    try {
      if (channelRef.current) {
        channelRef.current.postMessage(event);
      }
    } catch {
      // Guard against InvalidStateError when channel is closed during unmount / navigation
    }
  }, []);

  const [kioskTelemetry, setKioskTelemetry] = useState<{
    online: boolean;
    fps: number;
    resolution: string;
    aiLatencyMs: number;
    state: string;
    cameraActive: boolean;
    lastSeen: number | null;
  }>({
    online: false,
    fps: 0,
    resolution: '',
    aiLatencyMs: 0,
    state: 'STANDBY',
    cameraActive: false,
    lastSeen: null,
  });

  const [displayTelemetry, setDisplayTelemetry] = useState<{
    online: boolean;
    latencyMs: number;
    activeCode: string | null;
    queueLength: number;
    totalPhotos: number;
    isMuted: boolean;
    lastSeen: number | null;
  }>({
    online: false,
    latencyMs: 0,
    activeCode: null,
    queueLength: 0,
    totalPhotos: 0,
    isMuted: false,
    lastSeen: null,
  });

  // Audit log helper
  const addAuditLog = useCallback(
    (type: AuditLogItem['type'], text: string) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const newItem: AuditLogItem = {
        id: `${Date.now()}-${Math.random()}`,
        time: timeStr,
        type,
        text,
      };
      setAuditLogs((prev) => [newItem, ...prev.slice(0, 49)]);
    },
    []
  );

  // Sync tab from hash or search param
  useEffect(() => {
    const syncTab = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash.replace('#', '') as AdminTab;
      if (['overview', 'gallery', 'controls', 'hardware', 'logs'].includes(hash)) {
        setActiveTab(hash);
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab') as AdminTab;
        if (['overview', 'gallery', 'controls', 'hardware', 'logs'].includes(tabParam)) {
          setActiveTab(tabParam);
        }
      }
    };
    syncTab();
    window.addEventListener('hashchange', syncTab);
    return () => window.removeEventListener('hashchange', syncTab);
  }, []);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  };

  // Load theme preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const themeParam = urlParams.get('theme') as 'dark' | 'light';
      if (themeParam === 'light' || themeParam === 'dark') {
        setTheme(themeParam);
      } else {
        const saved = localStorage.getItem('swu_admin_theme') as 'dark' | 'light';
        if (saved === 'light' || saved === 'dark') setTheme(saved);
      }

      // Load saved hand threshold sensitivity
      const savedThreshold = localStorage.getItem('swu_hand_threshold');
      if (savedThreshold) {
        const parsed = parseFloat(savedThreshold);
        if (!isNaN(parsed) && parsed >= 0.005 && parsed <= 0.1) {
          setSensitivity(parsed * 100);
        }
      }

      // Load saved photo capture ratio (defaults to 4:3 landscape: wide enough for groups)
      const savedRatio = localStorage.getItem('swu_photo_ratio');
      if (savedRatio === '3:4' || savedRatio === '4:3') {
        setPhotoRatio(savedRatio);
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('swu_admin_theme', next);
    }
  };

  // Clock ticker (clean HH:mm)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat watchdog (Zero-overhead IPC, pings every 3s, timeout 8s)
  useEffect(() => {
    const sendPing = () => {
      safePostMessage({
        type: 'HEARTBEAT_PING',
        sender: 'ADMIN',
        timestamp: Date.now(),
      } as ScreenSyncEvent);

      const now = Date.now();
      if (lastKioskPongRef.current > 0 && now - lastKioskPongRef.current > 8000) {
        setKioskOnline(false);
        setKioskTelemetry((prev) => (prev.online ? { ...prev, online: false } : prev));
      }
      if (lastDisplayPongRef.current > 0 && now - lastDisplayPongRef.current > 8000) {
        setDisplayOnline(false);
        setDisplayTelemetry((prev) => (prev.online ? { ...prev, online: false } : prev));
      }
    };

    sendPing();
    const pingTimer = setInterval(sendPing, 3000);
    return () => clearInterval(pingTimer);
  }, []);

  // Network latency check
  const checkNetwork = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch('/api/photos?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const lat = Math.round(performance.now() - start);
      setNetLatency(lat);
      setIsNetOnline(true);
      setCommandNotice(`เน็ตตอบสนอง ${lat} ms`);
      setTimeout(() => setCommandNotice(''), 2000);
    } catch {
      setIsNetOnline(false);
      setCommandNotice('สัญญาณเน็ตขัดข้อง');
      setTimeout(() => setCommandNotice(''), 2500);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => setIsNetOnline(true);
    const onOffline = () => setIsNetOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    checkNetwork();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [checkNetwork]);

  // BroadcastChannel setup
  useEffect(() => {
    const channel = new BroadcastChannel(SCREEN_SYNC_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<ScreenSyncEvent>) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'PHOTO_READY_FOR_DISPLAY') {
        const newRecord: PhotoRecord = {
          code: data.code,
          photoUrl: data.photoUrl,
          qrUrl: data.qrUrl,
          token: data.token,
          createdAt: data.createdAt,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
        setPhotos((prev) => [newRecord, ...prev.filter((p) => p.code !== data.code)]);
        addAuditLog('KIOSK', `ถ่ายภาพ #${data.code.replace('OPH-', '')}`);
      } else if (data.type === 'PHOTO_DELETED') {
        setPhotos((prev) => prev.filter((p) => p.code !== data.code));
        addAuditLog('PDPA', `ลบรูป #${data.code.replace('OPH-', '')}`);
      } else if (data.type === 'HEARTBEAT_PONG') {
        const now = Date.now();
        const latency = data.pingTimestamp ? Math.max(1, now - data.pingTimestamp) : 1;

        if (data.sender === 'KIOSK') {
          lastKioskPongRef.current = now;
          setKioskOnline(true);
          const st = data.status || {};
          setKioskTelemetry({
            online: true,
            fps: typeof st.fps === 'number' ? st.fps : 60,
            resolution: st.resolution || '1080p',
            aiLatencyMs: typeof st.aiLatencyMs === 'number' ? st.aiLatencyMs : 11,
            state: st.state || 'STANDBY',
            cameraActive: st.cameraActive !== undefined ? st.cameraActive : true,
            lastSeen: now,
          });
        } else if (data.sender === 'DISPLAY') {
          lastDisplayPongRef.current = now;
          setDisplayOnline(true);
          const st = data.status || {};
          setDisplayTelemetry({
            online: true,
            latencyMs: latency,
            activeCode: st.activeCode || null,
            queueLength: typeof st.queueLength === 'number' ? st.queueLength : 0,
            totalPhotos: typeof st.totalPhotos === 'number' ? st.totalPhotos : photos.length,
            isMuted: !!st.isMuted,
            lastSeen: now,
          });
        }
      } else if (data.type === 'MUTE_DISPLAY' || (data.type === 'KIOSK_COMMAND' && data.command === 'MUTE_DISPLAY')) {
        setIsDisplayMuted(true);
      } else if (data.type === 'UNMUTE_DISPLAY' || (data.type === 'KIOSK_COMMAND' && data.command === 'UNMUTE_DISPLAY')) {
        setIsDisplayMuted(false);
      }
    };

    return () => {
      try {
        channel.close();
      } catch {}
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [addAuditLog]);

  // Load photos
  const loadPhotos = async (currentDeleted?: string[] | unknown) => {
    try {
      let activeDeleted = Array.isArray(currentDeleted) ? currentDeleted : undefined;
      if (!activeDeleted && typeof window !== 'undefined') {
        try {
          activeDeleted = JSON.parse(localStorage.getItem('swu_deleted_codes') || '[]');
        } catch {}
      }
      const deletedSet = new Set(activeDeleted || deletedCodes);

      const res = await fetch('/api/photos');
      const data = await res.json();
      const serverPhotos: PhotoRecord[] = data?.photos && Array.isArray(data.photos) ? data.photos : [];

      let localPhotos: PhotoRecord[] = [];
      if (typeof window !== 'undefined') {
        try {
          localPhotos = JSON.parse(localStorage.getItem('swu_photo_gallery') || '[]');
        } catch {}
      }

      const map = new Map<string, PhotoRecord>();
      [...serverPhotos, ...localPhotos, ...DEFAULT_SAMPLE_PHOTOS].forEach((p) => {
        if (p?.code && !deletedSet.has(p.code) && !map.has(p.code)) {
          map.set(p.code, p);
        }
      });

      const list = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setPhotos(list);
    } catch {}
  };

  useEffect(() => {
    let initialDeleted: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('swu_deleted_codes');
        if (raw) initialDeleted = JSON.parse(raw);
      } catch {}
      setDeletedCodes(initialDeleted);
      let domain = localStorage.getItem('swu_booth_host') || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_PRODUCTION_APP_URL;
      if (domain.includes('swu-openhouse.vercel.app')) {
        domain = DEFAULT_PRODUCTION_APP_URL;
        localStorage.setItem('swu_booth_host', DEFAULT_PRODUCTION_APP_URL);
      }
      setPublicDomain(domain);
    }
    loadPhotos(initialDeleted);
  }, []);

  const sendCommand = (command: string, label: string, value?: any) => {
    safePostMessage({
      type: 'KIOSK_COMMAND',
      command,
      value,
    } as ScreenSyncEvent);

    if (command === 'RESET_STANDBY') {
      safePostMessage({ type: 'SCREEN1_RESET' } as ScreenSyncEvent);
    }

    setCommandNotice(label);
    addAuditLog('STAFF', label);
    setTimeout(() => setCommandNotice(''), 2000);
  };

  const toggleDisplayMute = () => {
    const next = !isDisplayMuted;
    setIsDisplayMuted(next);
    safePostMessage({ type: next ? 'MUTE_DISPLAY' : 'UNMUTE_DISPLAY' } as ScreenSyncEvent);
    setCommandNotice(next ? 'ม่านดำเปิดใช้งาน' : 'ปลดม่านดำแล้ว');
    addAuditLog('STAFF', next ? 'เปิดม่านดำ' : 'ปลดม่านดำ');
    setTimeout(() => setCommandNotice(''), 2000);
  };

  const copyLink = async (photo: PhotoRecord) => {
    const clean = (publicDomain || (typeof window !== 'undefined' ? window.location.origin : '')).trim().replace(/\/+$/, '');
    const origin = /^https?:\/\//i.test(clean) ? clean : clean ? `http://${clean}` : '';
    const link = !publicDomain && photo.qrUrl && /^https?:\/\//i.test(photo.qrUrl) ? photo.qrUrl : `${origin}/p/${photo.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(photo.code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {}
  };

  const handlePushToDisplay = (photo: PhotoRecord) => {
    safePostMessage({ type: 'PUSH_TO_DISPLAY', photo } as ScreenSyncEvent);
    setPushedCode(photo.code);
    setCommandNotice(`ส่งรูป #${photo.code.replace('OPH-', '')} ขึ้นจอแล้ว`);
    setTimeout(() => setPushedCode(null), 2000);
  };

  const handleDeletePhoto = async (code: string) => {
    const updated = Array.from(new Set([...deletedCodes, code]));
    setDeletedCodes(updated);
    safeLocalStorageSet('swu_deleted_codes', updated, 200);
    setPhotos((prev) => prev.filter((p) => p.code !== code));
    if (selectedPhoto?.code === code) setSelectedPhoto(null);

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('swu_photo_gallery');
        if (saved) {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) safeLocalStorageSet('swu_photo_gallery', list.filter((p: any) => p.code !== code), 60);
        }
      } catch {}
    }

    try {
      await fetch('/api/photos/' + encodeURIComponent(code), { method: 'DELETE' });
    } catch {}

    safePostMessage({ type: 'PHOTO_DELETED', code } as ScreenSyncEvent);

    setCommandNotice(`ลบรูป ${code} แล้ว`);
    setTimeout(() => setCommandNotice(''), 2000);
  };

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (deletedCodes.includes(photo.code)) return false;
      if (filterTab === 'recent30m' && Date.now() - new Date(photo.createdAt).getTime() > 30 * 60 * 1000) return false;
      if (filterTab === 'recent1h' && Date.now() - new Date(photo.createdAt).getTime() > 60 * 60 * 1000) return false;
      const q = searchQuery.trim().toUpperCase();
      if (!q) return true;
      return photo.code.toUpperCase().includes(q);
    });
  }, [photos, deletedCodes, searchQuery, filterTab]);

  // Paginated photos
  const totalPages = Math.ceil(filteredPhotos.length / pageSize) || 1;
  const paginatedPhotos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPhotos.slice(start, start + pageSize);
  }, [filteredPhotos, currentPage, pageSize]);

  useEffect(() => setCurrentPage(1), [searchQuery, filterTab, pageSize]);

  // Dynamic High-Frequency Attendee Data (08:00 - 17:00, 15/30/60 min intervals)
  const frequencyData = useMemo(() => {
    const startHour = 8;
    const endHour = 17;
    const totalMinutes = (endHour - startHour) * 60; // 540 min
    const slotCount = Math.floor(totalMinutes / chartInterval) + 1;

    // Count actual photos falling into each interval
    const counts: Record<number, number> = {};
    photos.forEach((p) => {
      try {
        const d = new Date(p.createdAt);
        const mins = (d.getHours() - startHour) * 60 + d.getMinutes();
        if (mins >= 0 && mins <= totalMinutes) {
          const slot = Math.floor(mins / chartInterval);
          counts[slot] = (counts[slot] || 0) + 1;
        }
      } catch {}
    });

    const hasData = photos.length >= 10;
    const result = [];
    for (let i = 0; i < slotCount; i++) {
      const curMins = i * chartInterval;
      const h = startHour + Math.floor(curMins / 60);
      const m = curMins % 60;
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      // High-frequency Open House attendance distribution curve with natural variation
      const progress = curMins / totalMinutes; // 0 to 1
      const distFromPeak = Math.abs(progress - 0.44); // Peak rush at ~11:45-12:15
      const bell = Math.exp(-Math.pow(distFromPeak / 0.28, 2));
      const scale = chartInterval === 15 ? 26 : chartInterval === 30 ? 46 : 58;
      const ripple = (Math.sin(i * 1.6) * 0.14 + Math.cos(i * 2.5) * 0.08) * scale;
      const baseVal = Math.max(2, Math.round(bell * scale + ripple));

      result.push({
        label,
        hour: h,
        minute: m,
        count: hasData ? (counts[i] || 0) : baseVal,
        isMajorHour: m === 0,
      });
    }
    return result;
  }, [photos, chartInterval]);

  const filteredFrequencyData = useMemo(() => {
    if (chartTimeRange === 'morning') return frequencyData.filter((d) => d.hour <= 12);
    if (chartTimeRange === 'afternoon') return frequencyData.filter((d) => d.hour >= 12);
    return frequencyData;
  }, [frequencyData, chartTimeRange]);

  const isDark = theme === 'dark';
  const themeClasses = {
    mainBg: isDark ? 'bg-[#0B0F17] text-slate-200' : 'bg-[#F8FAFC] text-slate-800',
    headerBg: isDark ? 'bg-[#0B0F17]/95 border-slate-800/80' : 'bg-white/95 border-slate-200/90',
    cardBg: isDark ? 'bg-[#121824] border-slate-800/80' : 'bg-white border-slate-200/90 shadow-xs',
    textTitle: isDark ? 'text-white' : 'text-slate-900',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    inputBg: isDark ? 'bg-black/50 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900',
  };

  return (
    <main className={`min-h-dvh ${themeClasses.mainBg} select-none antialiased font-sans transition-colors duration-150`}>
      {/* 1. Header (Clean Minimalist, zero icon clutter) */}
      <header className={`sticky top-0 z-40 border-b ${themeClasses.headerBg} px-6 py-3 backdrop-blur-md`}>
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <CpeLogo className="h-7" />
            <span className={`text-sm font-bold tracking-tight ${themeClasses.textTitle}`}>PhotoBooth</span>
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span className={`text-xs font-mono ${themeClasses.textMuted}`}>{currentTime} น.</span>
          </div>

          {/* Quick Action Matrix (Simple, compact) */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle (Single Icon Button) */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'โหมดสว่าง' : 'โหมดกลางคืน'}
              className={`size-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                isDark ? 'border-slate-800 bg-slate-900 text-amber-400 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-xs'
              }`}
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4 text-indigo-500" />}
            </button>

            {/* Panic Mute Button (Single Crisp Action) */}
            <button
              onClick={toggleDisplayMute}
              className={`h-8 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isDisplayMuted
                  ? 'border-red-500 bg-red-600 text-white shadow-xs'
                  : isDark
                  ? 'border-slate-800 bg-slate-900 text-slate-300 hover:border-red-500/40 hover:text-red-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-red-500/40 hover:text-red-600 shadow-xs'
              }`}
            >
              {isDisplayMuted ? 'ม่านดำเปิดอยู่' : 'ม่านดำจอใหญ่'}
            </button>

            {/* Logout */}
            <button
              onClick={async () => {
                await fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
                if (typeof window !== 'undefined') sessionStorage.removeItem('swu_admin_auth');
                window.location.reload();
              }}
              className={`size-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                isDark ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 shadow-xs'
              }`}
              title="ออกจากระบบ"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher (Clean Text Pills - No Icons, No Noise) */}
        <div className="mx-auto max-w-[1600px] pt-2.5">
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'overview', label: 'ภาพรวม' },
              { id: 'gallery', label: 'แกลเลอรี' },
              { id: 'controls', label: 'ควบคุม' },
              { id: 'hardware', label: 'ฮาร์ดแวร์' },
              { id: 'logs', label: 'บันทึกระบบ' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as AdminTab)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? isDark
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                  {tab.id === 'gallery' && photos.length > 0 && (
                    <span className="ml-1.5 font-mono text-[10px] text-slate-400">({photos.length})</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-[1600px] p-6 space-y-6">
        {/* Status Strip (Glanceable Minimalist, zero icon spam) */}
        <section
          className={`rounded-2xl border px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono ${
            isDark ? 'bg-[#121824] border-slate-800/80 text-slate-400' : 'bg-white border-slate-200/90 text-slate-600 shadow-xs'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${kioskTelemetry.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {kioskTelemetry.online ? `กล้อง ${kioskTelemetry.fps} FPS` : 'กล้องออฟไลน์'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${displayTelemetry.online ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {displayTelemetry.online ? `ซิงค์ ${displayTelemetry.latencyMs}ms` : 'จอ 2 ออฟไลน์'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${isNetOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              เน็ต {netLatency !== null ? `${netLatency}ms` : '5GHz'}
            </span>
            <span className="text-slate-600">•</span>
            <span>PDPA 7 วัน</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {publicDomain ? publicDomain.replace(/^https?:\/\//, '') : 'localhost:3000'}
          </div>
        </section>

        {/* =========================================================================
            TAB 1: ภาพรวม (Overview - Image 1 pure aesthetic)
            ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* 4 Clean Metric Cards (Short text, clear numbers, wave sparklines) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Photos */}
              <article className={`rounded-2xl border p-5 flex flex-col justify-between ${themeClasses.cardBg}`}>
                <div>
                  <div className={`text-xs font-medium ${themeClasses.textMuted}`}>ภาพถ่ายวันนี้</div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <div className={`font-mono text-2xl font-bold ${themeClasses.textTitle}`}>{photos.length}</div>
                    <span className="font-mono text-xs font-semibold text-emerald-500">+14%</span>
                  </div>
                </div>
                <div className="mt-3">
                  <SparklineWave color="#10B981" gradientId="spk-1" data={[12, 18, 15, 24, 22, 31, 28, 36, 33, 44]} />
                </div>
              </article>

              {/* Card 2: Speed */}
              <article className={`rounded-2xl border p-5 flex flex-col justify-between ${themeClasses.cardBg}`}>
                <div>
                  <div className={`text-xs font-medium ${themeClasses.textMuted}`}>ความเร็วคิว</div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <div className={`font-mono text-2xl font-bold ${themeClasses.textTitle}`}>35s</div>
                    <span className="font-mono text-xs font-semibold text-cyan-500">ปกติ</span>
                  </div>
                </div>
                <div className="mt-3">
                  <SparklineWave color="#06B6D4" gradientId="spk-2" data={[45, 42, 38, 36, 35, 34, 35, 33, 34, 32]} />
                </div>
              </article>

              {/* Card 3: QR Delivery */}
              <article className={`rounded-2xl border p-5 flex flex-col justify-between ${themeClasses.cardBg}`}>
                <div>
                  <div className={`text-xs font-medium ${themeClasses.textMuted}`}>สแกน QR สำเร็จ</div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <div className={`font-mono text-2xl font-bold ${themeClasses.textTitle}`}>98%</div>
                    <span className="font-mono text-xs font-semibold text-indigo-500">สมบูรณ์</span>
                  </div>
                </div>
                <div className="mt-3">
                  <SparklineWave color="#8B5CF6" gradientId="spk-3" data={[90, 92, 94, 95, 96, 97, 98, 97, 98, 99]} />
                </div>
              </article>

              {/* Card 4: Hourly Flow */}
              <article className={`rounded-2xl border p-5 flex flex-col justify-between ${themeClasses.cardBg}`}>
                <div>
                  <div className={`text-xs font-medium ${themeClasses.textMuted}`}>เฉลี่ยต่อชั่วโมง</div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <div className={`font-mono text-2xl font-bold ${themeClasses.textTitle}`}>38</div>
                    <span className="font-mono text-xs font-semibold text-amber-500">พีค 11:00</span>
                  </div>
                </div>
                <div className="mt-3">
                  <SparklineWave color="#F59E0B" gradientId="spk-4" data={[18, 25, 38, 54, 50, 44, 38, 30, 24, 16]} />
                </div>
              </article>
            </section>

            {/* Hourly Attendee Area Chart (Image 1 Financial Dashboard Style) */}
            <section className={`rounded-2xl border p-6 space-y-4 ${themeClasses.cardBg}`}>
              {/* Header with Title & Chart Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/40 pb-3">
                <div>
                  <h2 className={`text-sm font-bold ${themeClasses.textTitle}`}>สถิติผู้เข้าถ่ายภาพตามช่วงเวลา</h2>
                  <div className={`text-xs ${themeClasses.textMuted} mt-0.5`}>เปรียบเทียบผู้เข้าถ่ายจริงกับเกณฑ์เป้าหมายความจุบูธ</div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Interval Selector (15m, 30m, 1h) */}
                  <div className={`flex rounded-lg p-0.5 border text-xs ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                    {[
                      { id: 15, label: '15 นาที' },
                      { id: 30, label: '30 นาที' },
                      { id: 60, label: '1 ชม.' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setChartInterval(btn.id as any)}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                          chartInterval === btn.id
                            ? isDark ? 'bg-slate-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                            : themeClasses.textMuted
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {/* Chart Style Toggle: Area vs Bar */}
                  <div className={`flex rounded-lg p-0.5 border text-xs ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                    <button
                      onClick={() => setChartStyle('area')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                        chartStyle === 'area'
                          ? isDark ? 'bg-slate-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                          : themeClasses.textMuted
                      }`}
                    >
                      เส้นตรง
                    </button>
                    <button
                      onClick={() => setChartStyle('bar')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                        chartStyle === 'bar'
                          ? isDark ? 'bg-slate-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                          : themeClasses.textMuted
                      }`}
                    >
                      แท่ง
                    </button>
                  </div>

                  {/* Range pills */}
                  <div className={`flex rounded-lg p-0.5 border text-xs ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                    {[
                      { id: 'all', label: 'ทั้งวัน' },
                      { id: 'morning', label: 'เช้า' },
                      { id: 'afternoon', label: 'บ่าย' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setChartTimeRange(btn.id as any)}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                          chartTimeRange === btn.id
                            ? isDark ? 'bg-slate-800 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                            : themeClasses.textMuted
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Main Chart Grid: Area/Bar SVG on Left + Donut & Metrics on Right (Image 1 Style) */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start pt-1">
                {/* Left 3 Columns: SVG Chart with Y-Axis */}
                <div className="lg:col-span-3 space-y-2">
                  <div className="relative w-full aspect-[22/8]">
                    <svg
                      viewBox="0 0 740 210"
                      className="w-full h-full overflow-visible cursor-crosshair"
                      preserveAspectRatio="none"
                      onMouseLeave={() => setHoveredPoint(null)}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relX = (e.clientX - rect.left) / rect.width;
                        const svgX = relX * 740;

                        const count = filteredFrequencyData.length;
                        if (count < 2) return;
                        const maxVal = chartInterval === 15 ? 32 : chartInterval === 30 ? 55 : 65;
                        const chartH = 160;
                        const baseBottomY = 185;

                        const pts = filteredFrequencyData.map((d, i) => ({
                          x: 48 + (i / (count - 1)) * 664,
                          y: baseBottomY - (d.count / maxVal) * chartH,
                          data: d,
                        }));

                        let closest = pts[0];
                        let minD = Math.abs(pts[0].x - svgX);
                        for (let i = 1; i < pts.length; i++) {
                          const d = Math.abs(pts[i].x - svgX);
                          if (d < minD) {
                            minD = d;
                            closest = pts[i];
                          }
                        }
                        setHoveredPoint({
                          label: closest.data.label,
                          count: closest.data.count,
                          x: closest.x,
                          y: closest.y,
                        });
                      }}
                    >
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0.35} />
                        </linearGradient>
                      </defs>

                      {/* Left Y-Axis Labels & Horizontal Grid Lines */}
                      {(() => {
                        const maxVal = chartInterval === 15 ? 32 : chartInterval === 30 ? 55 : 65;
                        const step = Math.round(maxVal / 4);
                        return [
                          { label: String(step * 4), y: 25 },
                          { label: String(step * 3), y: 65 },
                          { label: String(step * 2), y: 105 },
                          { label: String(step * 1), y: 145 },
                          { label: '0', y: 185 },
                        ].map((grid) => (
                          <g key={grid.label}>
                            <text
                              x="24"
                              y={grid.y + 3}
                              fill={isDark ? '#64748B' : '#94A3B8'}
                              fontSize="10"
                              fontFamily="monospace"
                              textAnchor="end"
                            >
                              {grid.label}
                            </text>
                            <line
                              x1="34"
                              y1={grid.y}
                              x2="730"
                              y2={grid.y}
                              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
                              strokeDasharray="4 4"
                            />
                          </g>
                        ));
                      })()}

                      {/* Secondary Benchmark Target (Straight dashed line - Target capacity) */}
                      <line
                        x1="48"
                        y1="75"
                        x2="712"
                        y2="75"
                        stroke={isDark ? '#38BDF8' : '#0EA5E9'}
                        strokeOpacity="0.4"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />

                      {/* Primary Data Elements (Straight Linear Segments / Bars) */}
                      {(() => {
                        const count = filteredFrequencyData.length;
                        if (count < 2) return null;
                        const maxVal = chartInterval === 15 ? 32 : chartInterval === 30 ? 55 : 65;
                        const chartH = 160;
                        const baseBottomY = 185;

                        const points = filteredFrequencyData.map((d, i) => {
                          const x = 48 + (i / (count - 1)) * 664;
                          const y = baseBottomY - (d.count / maxVal) * chartH;
                          return { x, y, data: d };
                        });

                        // Straight Lines Connecting Each Point (Linear Polyline - user requirement)
                        let pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
                        for (let i = 1; i < points.length; i++) {
                          pathD += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
                        }

                        const fillD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${baseBottomY} L ${points[0].x.toFixed(1)} ${baseBottomY} Z`;

                        return (
                          <>
                            {chartStyle === 'area' ? (
                              <>
                                <path d={fillD} fill="url(#areaGrad)" />
                                <path
                                  d={pathD}
                                  fill="none"
                                  stroke="#10B981"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />

                                {/* Micro Dots on Each High-Frequency Point */}
                                {points.map((p, idx) => {
                                  const isHov = hoveredPoint?.label === p.data.label;
                                  return (
                                    <circle
                                      key={idx}
                                      cx={p.x}
                                      cy={p.y}
                                      r={isHov ? '4.5' : '2'}
                                      fill={isHov ? '#10B981' : isDark ? '#0B0F17' : '#FFFFFF'}
                                      stroke="#10B981"
                                      strokeWidth={isHov ? '2.5' : '1.5'}
                                      className="transition-all"
                                    />
                                  );
                                })}
                              </>
                            ) : (
                              /* Bar Chart Mode */
                              points.map((p, idx) => {
                                const barW = Math.max(4, Math.min(18, 540 / count));
                                const isHov = hoveredPoint?.label === p.data.label;
                                return (
                                  <rect
                                    key={idx}
                                    x={p.x - barW / 2}
                                    y={p.y}
                                    width={barW}
                                    height={baseBottomY - p.y}
                                    rx="2"
                                    fill={isHov ? '#34D399' : 'url(#barGrad)'}
                                    className="transition-colors"
                                  />
                                );
                              })
                            )}

                            {/* Interactive Hover Crosshair Line & High-Contrast Tooltip Badge */}
                            {hoveredPoint && (
                              <g>
                                <line
                                  x1={hoveredPoint.x}
                                  y1="25"
                                  x2={hoveredPoint.x}
                                  y2="185"
                                  stroke="#10B981"
                                  strokeWidth="1.4"
                                  strokeDasharray="3 3"
                                />
                                <circle
                                  cx={hoveredPoint.x}
                                  cy={hoveredPoint.y}
                                  r="5"
                                  fill="#10B981"
                                  stroke={isDark ? '#0B0F17' : '#FFFFFF'}
                                  strokeWidth="2"
                                />
                                <rect
                                  x={Math.min(625, Math.max(34, hoveredPoint.x - 52))}
                                  y={Math.max(10, hoveredPoint.y - 38)}
                                  width="104"
                                  height="30"
                                  rx="6"
                                  fill={isDark ? '#1E293B' : '#0F172A'}
                                  stroke={isDark ? '#334155' : '#1E293B'}
                                  strokeWidth="1"
                                  filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))"
                                />
                                <text
                                  x={Math.min(625, Math.max(34, hoveredPoint.x - 52)) + 52}
                                  y={Math.max(10, hoveredPoint.y - 38) + 13}
                                  fill="#94A3B8"
                                  fontSize="9"
                                  fontFamily="monospace"
                                  textAnchor="middle"
                                >
                                  {hoveredPoint.label} น.
                                </text>
                                <text
                                  x={Math.min(625, Math.max(34, hoveredPoint.x - 52)) + 52}
                                  y={Math.max(10, hoveredPoint.y - 38) + 25}
                                  fill="#10B981"
                                  fontSize="11"
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {hoveredPoint.count} รูป
                                </text>
                              </g>
                            )}

                            {/* X-Axis Major Hour Labels */}
                            {points.map((p, idx) => {
                              if (!p.data.isMajorHour && count > 15) return null;
                              return (
                                <g key={idx}>
                                  <line
                                    x1={p.x}
                                    y1="185"
                                    x2={p.x}
                                    y2="190"
                                    stroke={isDark ? '#475569' : '#CBD5E1'}
                                    strokeWidth="1"
                                  />
                                  <text
                                    x={p.x}
                                    y="202"
                                    fill={isDark ? '#64748B' : '#94A3B8'}
                                    fontSize="10"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    {p.data.label}
                                  </text>
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Chart Legend & Live Cursor Indicator */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 px-8">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        ความถี่จริง ({chartInterval} นาที/จุด)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 border-t border-dashed border-cyan-400" />
                        เกณฑ์ความจุมาตรฐาน
                      </span>
                    </div>
                    <span className="text-emerald-500 font-bold">
                      {hoveredPoint ? `${hoveredPoint.label} น. : ${hoveredPoint.count} รูป` : 'ชี้เมาส์บนเส้นกราฟเพื่อดูยอด'}
                    </span>
                  </div>
                </div>

                {/* Right 1 Column: Gesture Donut + Key Metrics (Matching Image 1's Sector Allocation & Risk Metrics) */}
                <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  {/* Donut Chart: Interaction Breakdown */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                      <span>สัดส่วนท่าโพส AI</span>
                      <span className="font-mono text-emerald-500">100%</span>
                    </div>

                    <div className="flex items-center justify-center my-2">
                      <div className="relative size-24">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          {/* Circle Background */}
                          <circle cx="18" cy="18" r="14" fill="none" stroke={isDark ? '#1E293B' : '#E2E8F0'} strokeWidth="4" />
                          {/* Segment 1: Palm 60% */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="4"
                            strokeDasharray="52.8 88"
                            strokeDashoffset="0"
                          />
                          {/* Segment 2: Heart 22% */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#06B6D4"
                            strokeWidth="4"
                            strokeDasharray="19.4 88"
                            strokeDashoffset="-52.8"
                          />
                          {/* Segment 3: Peace 12% */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#8B5CF6"
                            strokeWidth="4"
                            strokeDasharray="10.5 88"
                            strokeDashoffset="-72.2"
                          />
                          {/* Segment 4: Staff 6% */}
                          <circle
                            cx="18"
                            cy="18"
                            r="14"
                            fill="none"
                            stroke="#CE1126"
                            strokeWidth="4"
                            strokeDasharray="5.3 88"
                            strokeDashoffset="-82.7"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className={`text-xs font-bold font-mono ${themeClasses.textTitle}`}>MediaPipe</span>
                          <span className="text-[8px] text-slate-400 font-mono">Vision</span>
                        </div>
                      </div>
                    </div>

                    {/* Donut Legend */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        <span>แบมือ 60%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-cyan-500" />
                        <span>มินิฮาร์ท 22%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-indigo-500" />
                        <span>ชู 2 นิ้ว 12%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-[#CE1126]" />
                        <span>สตาฟฟ์ 6%</span>
                      </div>
                    </div>
                  </div>

                  {/* Operational Metrics (Risk Metrics equivalent from Image 1) */}
                  <div className={`border-t border-slate-800/40 pt-3 space-y-2 text-xs font-mono`}>
                    <div className="flex justify-between items-center">
                      <span className={themeClasses.textMuted}>ช่วงพีคสุด</span>
                      <span className="font-bold text-[#CE1126]">11:00 - 13:00</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={themeClasses.textMuted}>ความเร็วคิว</span>
                      <span className="font-bold text-emerald-500">35 วินาที</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={themeClasses.textMuted}>สแกนรับรูป</span>
                      <span className={`font-bold ${themeClasses.textTitle}`}>98.4%</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Compact Live Fleet Viewport (Image 4 shrunk down) */}
            <section className={`rounded-2xl border p-4 space-y-3 ${themeClasses.cardBg}`}>
              <div className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                สถานะ 2 หน้าจอ (Dual Fleet)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Screen 1 */}
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${themeClasses.textTitle}`}>Screen 1 · Kiosk</span>
                      <span
                        className={`rounded text-[10px] px-1.5 py-0.2 font-mono font-bold ${
                          kioskTelemetry.online
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-rose-500/15 text-rose-500'
                        }`}
                      >
                        {kioskTelemetry.online ? kioskTelemetry.state.toUpperCase() : 'OFFLINE'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {kioskTelemetry.online
                        ? `${kioskTelemetry.resolution} ${kioskTelemetry.fps}fps · ${kioskTelemetry.cameraActive ? 'กล้องพร้อม' : 'กล้องพัก'}`
                        : 'ไม่พบสัญญาณจอ Kiosk (/kiosk)'}
                    </div>
                  </div>
                  <button
                    onClick={() => sendCommand('STAFF_TRIGGER', 'สั่งถ่ายภาพแล้ว')}
                    disabled={!kioskTelemetry.online}
                    className="h-8 px-3 rounded-lg bg-[#CE1126] hover:bg-[#E1132B] disabled:opacity-40 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    ถ่ายภาพ
                  </button>
                </div>

                {/* Screen 2 */}
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${themeClasses.textTitle}`}>Screen 2 · Showcase</span>
                      <span
                        className={`rounded text-[10px] px-1.5 py-0.2 font-mono font-bold ${
                          !displayTelemetry.online
                            ? 'bg-rose-500/15 text-rose-500'
                            : isDisplayMuted
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-emerald-500/15 text-emerald-500'
                        }`}
                      >
                        {!displayTelemetry.online ? 'OFFLINE' : isDisplayMuted ? 'MUTED' : 'ACTIVE'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {displayTelemetry.online
                        ? `${displayTelemetry.queueLength} รูปในคิว · ${displayTelemetry.activeCode ? `ฉาย #${displayTelemetry.activeCode}` : 'สแตนด์บาย'}`
                        : 'ไม่พบสัญญาณจอ Showcase (/display)'}
                    </div>
                  </div>
                  <button
                    onClick={toggleDisplayMute}
                    disabled={!displayTelemetry.online}
                    className={`h-8 px-3 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-40 ${
                      isDisplayMuted ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {isDisplayMuted ? 'ปลดม่านดำ' : 'ม่านดำ'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =========================================================================
            TAB 2: แกลเลอรีรูปถ่าย (Gallery - Clean, Paginated)
            ========================================================================= */}
        {activeTab === 'gallery' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <section className={`rounded-2xl border overflow-hidden ${themeClasses.cardBg}`}>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 border-b border-slate-800/40 gap-3">
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm font-bold ${themeClasses.textTitle}`}>แกลเลอรีภาพถ่าย</h2>
                  <span className="font-mono text-xs text-slate-400">({filteredPhotos.length} รูป)</span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search */}
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหารหัส เช่น AB29"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full rounded-xl border pl-8 pr-3 py-1 text-xs outline-none focus:border-cyan-500 font-mono ${themeClasses.inputBg}`}
                    />
                  </div>

                  {/* Page Size */}
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className={`rounded-xl border px-2 py-1 text-xs outline-none ${themeClasses.inputBg} cursor-pointer`}
                  >
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={48}>48</option>
                  </select>

                  <button
                    onClick={() => loadPhotos()}
                    className={`px-3 py-1 rounded-xl border text-xs font-semibold cursor-pointer ${
                      isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-xs'
                    }`}
                  >
                    รีเฟรช
                  </button>
                </div>
              </div>

              {/* Grid */}
              <div className="p-5">
                {paginatedPhotos.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-500 font-mono">
                    ไม่มีรูปภาพในระบบ
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {paginatedPhotos.map((photo, index) => (
                      <article
                        key={`${photo.code}-${index}`}
                        className={`overflow-hidden rounded-xl border transition-all flex flex-col justify-between ${
                          isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white shadow-xs'
                        }`}
                      >
                        <div className="relative aspect-[4/3] bg-black/80 overflow-hidden">
                          <img
                            src={photo.photoUrl}
                            alt={photo.code}
                            className="h-full w-full object-cover"
                            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                          />
                          <div className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.2 text-[10px] font-mono font-bold text-white">
                            #{photo.code.replace('OPH-', '')}
                          </div>
                        </div>

                        <div className="p-2.5 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                            <span>{photo.code}</span>
                            <span>{new Date(photo.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <button
                            onClick={() => setSelectedPhoto(photo)}
                            className="h-7 w-full rounded-lg bg-[#CE1126] hover:bg-[#E1132B] text-[11px] font-bold text-white transition-colors cursor-pointer"
                          >
                            เปิด QR
                          </button>

                          <div className="grid grid-cols-3 gap-1 pt-0.5">
                            <button
                              onClick={() => handlePushToDisplay(photo)}
                              className={`h-6 rounded border text-[10px] font-semibold transition-colors cursor-pointer ${
                                pushedCode === photo.code
                                  ? 'border-cyan-400 text-cyan-400'
                                  : isDark ? 'border-slate-800 text-slate-400 hover:text-white' : 'border-slate-200 text-slate-600 hover:text-slate-900'
                              }`}
                              title="ส่งขึ้นจอใหญ่ 30s"
                            >
                              จอใหญ่
                            </button>
                            <button
                              onClick={() => copyLink(photo)}
                              className={`h-6 rounded border text-[10px] font-semibold transition-colors cursor-pointer flex items-center justify-center ${
                                copiedCode === photo.code
                                  ? 'border-emerald-500 text-emerald-500'
                                  : isDark ? 'border-slate-800 text-slate-400 hover:text-white' : 'border-slate-200 text-slate-600 hover:text-slate-900'
                              }`}
                              title="คัดลอกลิงก์"
                            >
                              {copiedCode === photo.code ? <Check className="size-3 text-emerald-500" /> : <Link2 className="size-3" />}
                            </button>
                            <button
                              onClick={() => handleDeletePhoto(photo.code)}
                              className="h-6 rounded border border-red-500/20 text-red-500 hover:bg-red-500/10 text-[10px] transition-colors cursor-pointer flex items-center justify-center"
                              title="ลบรูป (PDPA)"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredPhotos.length > 0 && (
                <div className={`flex items-center justify-between border-t p-3 text-xs font-mono ${isDark ? 'border-slate-800/80 bg-black/20' : 'border-slate-200 bg-slate-50'}`}>
                  <span className="text-slate-500">
                    หน้า {currentPage} จาก {totalPages} ({filteredPhotos.length} รูป)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 rounded-lg border border-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      ก่อนหน้า
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 rounded-lg border border-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* =========================================================================
            TAB 3: ควบคุมหน้างาน (Controls - Crisp single-line buttons, no walls of text)
            ========================================================================= */}
        {activeTab === 'controls' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <section className={`rounded-2xl border p-6 space-y-6 ${themeClasses.cardBg}`}>
              <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
                <h2 className={`text-sm font-bold ${themeClasses.textTitle}`}>แผงควบคุมหน้างาน</h2>
                <div className="text-xs font-mono text-slate-400">
                  Kiosk: <span className={kioskState === 'paused' ? 'text-amber-500' : 'text-emerald-500 font-bold'}>{kioskState.toUpperCase()}</span>
                </div>
              </div>

              {/* 3 Simple Action Groups (Crisp, single-line buttons, zero explanatory bloat) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Group 1: Shutter */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-xs font-semibold text-slate-400">ชัตเตอร์ & คิว</div>
                  <div className="space-y-2">
                    <button
                      onClick={() => sendCommand('STAFF_TRIGGER', 'ถ่ายภาพฉุกเฉินแล้ว')}
                      className="h-9 w-full rounded-xl bg-[#CE1126] hover:bg-[#E1132B] text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      ถ่ายภาพฉุกเฉิน
                    </button>
                    <button
                      onClick={() => sendCommand('CANCEL_COUNTDOWN', 'ยกเลิกนับถอยหลังแล้ว')}
                      className={`h-9 w-full rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      ยกเลิกนับถอยหลัง
                    </button>
                    <button
                      onClick={() => sendCommand('SKIP_PREVIEW', 'ข้าม Preview แล้ว')}
                      className={`h-9 w-full rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      ข้าม Preview
                    </button>
                  </div>
                </div>

                {/* Group 2: Screen Safety */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-xs font-semibold text-slate-400">ความปลอดภัยจอใหญ่</div>
                  <div className="space-y-2">
                    <button
                      onClick={toggleDisplayMute}
                      className={`h-9 w-full rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        isDisplayMuted
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                      }`}
                    >
                      {isDisplayMuted ? 'ปลดม่านดำ' : 'ม่านดำจอใหญ่ (Panic Mute)'}
                    </button>
                    <div className="p-2.5 rounded-lg border border-slate-800/40 text-[11px] text-slate-400 font-mono">
                      เมื่อกดม่านดำ จอใหญ่จะตัดเป็นโลโก้ CPE ทันทีเพื่อความเรียบร้อย
                    </div>
                  </div>
                </div>

                {/* Group 3: Maintenance */}
                <div className={`p-4 rounded-xl border space-y-2.5 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="text-xs font-semibold text-slate-400">จัดการตู้</div>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setKioskState('standby');
                        sendCommand('RESET_STANDBY', 'รีเซ็ตตู้เป็น Standby แล้ว');
                      }}
                      className={`h-9 w-full rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      รีเซ็ตตู้ (Standby)
                    </button>
                    <button
                      onClick={() => sendCommand('RELOAD_CAMERA', 'รีสตาร์ทกล้องแล้ว')}
                      className={`h-9 w-full rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      รีสตาร์ทกล้อง
                    </button>
                    <button
                      onClick={() => {
                        const next = kioskState === 'paused' ? 'standby' : 'paused';
                        setKioskState(next);
                        sendCommand(next === 'paused' ? 'PAUSE_BOOTH' : 'RESUME_BOOTH', next === 'paused' ? 'พักตู้แล้ว' : 'เปิดใช้งานต่อแล้ว');
                      }}
                      className={`h-9 w-full rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        kioskState === 'paused'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                          : isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {kioskState === 'paused' ? 'เปิดใช้งานต่อ' : 'พักตู้ชั่วคราว'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Minimal Tuners (Clean, Compact 4-Column) */}
              <div className="border-t border-slate-800/40 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Tuner 1: Sensitivity (Hand Detection Range) */}
                  <div className={`p-3.5 rounded-xl border space-y-2.5 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-300">ระยะตรวจจับมือ</span>
                      <span className="font-mono text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-md text-[11px]">
                        {sensitivity.toFixed(1)}% ({sensitivity <= 1.8 ? 'ไกล 2-3m' : sensitivity <= 3.2 ? 'ปกติ 1.5m' : 'ประชิด <1m'})
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.8"
                      max="5.0"
                      step="0.1"
                      value={sensitivity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSensitivity(val);
                        sendCommand('SET_THRESHOLD', `เกณฑ์ ${val.toFixed(1)}%`, val / 100);
                        if (typeof window !== 'undefined') {
                          try { localStorage.setItem('swu_hand_threshold', (val / 100).toString()); } catch {}
                        }
                      }}
                      className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                    />

                    {/* Quick Distance Presets */}
                    <div className="grid grid-cols-3 gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSensitivity(1.5);
                          sendCommand('SET_THRESHOLD', 'โหมดระยะไกล 1.5%', 0.015);
                          if (typeof window !== 'undefined') {
                            try { localStorage.setItem('swu_hand_threshold', '0.015'); } catch {}
                          }
                        }}
                        className={`px-1.5 py-1 text-[10px] rounded-lg font-medium transition-all cursor-pointer ${
                          sensitivity <= 1.8
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                            : isDark ? 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent' : 'bg-slate-200 text-slate-600 hover:text-slate-800 border border-transparent'
                        }`}
                      >
                        🔭 ไกล (1.5%)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSensitivity(2.5);
                          sendCommand('SET_THRESHOLD', 'โหมดปกติ 2.5%', 0.025);
                          if (typeof window !== 'undefined') {
                            try { localStorage.setItem('swu_hand_threshold', '0.025'); } catch {}
                          }
                        }}
                        className={`px-1.5 py-1 text-[10px] rounded-lg font-medium transition-all cursor-pointer ${
                          sensitivity > 1.8 && sensitivity <= 3.2
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                            : isDark ? 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent' : 'bg-slate-200 text-slate-600 hover:text-slate-800 border border-transparent'
                        }`}
                      >
                        🎯 ปกติ (2.5%)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSensitivity(4.0);
                          sendCommand('SET_THRESHOLD', 'โหมดคนแน่น 4.0%', 0.04);
                          if (typeof window !== 'undefined') {
                            try { localStorage.setItem('swu_hand_threshold', '0.04'); } catch {}
                          }
                        }}
                        className={`px-1.5 py-1 text-[10px] rounded-lg font-medium transition-all cursor-pointer ${
                          sensitivity > 3.2
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                            : isDark ? 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent' : 'bg-slate-200 text-slate-600 hover:text-slate-800 border border-transparent'
                        }`}
                      >
                        🛡️ ประชิด (4.0%)
                      </button>
                    </div>
                  </div>

                  {/* Tuner 2: Countdown */}
                  <div className={`p-3.5 rounded-xl border space-y-2 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-400">เวลานับถอยหลัง</span>
                      <span className="font-mono text-amber-500 font-bold">{countdownDuration}s</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {[3, 5, 8].map((sec) => (
                        <button
                          key={sec}
                          onClick={() => {
                            setCountdownDuration(sec);
                            sendCommand('SET_COUNTDOWN', `นับ ${sec}s`, sec);
                          }}
                          className={`py-1 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                            countdownDuration === sec
                              ? 'bg-amber-500 text-black shadow-xs'
                              : isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tuner 3: Photo Aspect Ratio */}
                  <div className={`p-3.5 rounded-xl border space-y-2 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-400">สัดส่วนภาพถ่าย</span>
                      <span className="font-mono text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-md text-[11px]">
                        {photoRatio === '3:4' ? '3:4 แนวตั้ง พอดีกรอบ' : '4:3 แนวนอน ถ่ายกลุ่ม'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoRatio('3:4');
                          sendCommand('SET_PHOTO_RATIO', 'สลับสัดส่วนภาพ 3:4 แนวตั้ง', '3:4');
                          if (typeof window !== 'undefined') {
                            try { localStorage.setItem('swu_photo_ratio', '3:4'); } catch {}
                          }
                        }}
                        className={`py-1 px-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          photoRatio === '3:4'
                            ? 'bg-cyan-500 text-black font-bold shadow-xs'
                            : isDark ? 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800' : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        3:4 แนวตั้ง (คนน้อย)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoRatio('4:3');
                          sendCommand('SET_PHOTO_RATIO', 'สลับสัดส่วนภาพ 4:3 แนวนอน', '4:3');
                          if (typeof window !== 'undefined') {
                            try { localStorage.setItem('swu_photo_ratio', '4:3'); } catch {}
                          }
                        }}
                        className={`py-1 px-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          photoRatio === '4:3'
                            ? 'bg-cyan-500 text-black font-bold shadow-xs'
                            : isDark ? 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800' : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        4:3 แนวนอน (แนะนำ)
                      </button>
                    </div>
                  </div>

                  {/* Tuner 4: Purge by Code */}
                  <div className={`p-3.5 rounded-xl border space-y-2 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-xs font-semibold text-slate-400">ลบรูปด่วน (PDPA)</div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="รหัส เช่น AB29"
                        value={instantPurgeCode}
                        onChange={(e) => setInstantPurgeCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            let c = instantPurgeCode.trim().toUpperCase();
                            if (c) {
                              if (!c.startsWith('OPH-')) c = `OPH-${c}`;
                              handleDeletePhoto(c);
                              setInstantPurgeCode('');
                            }
                          }
                        }}
                        className={`flex-1 rounded-lg border px-2 py-1 text-xs outline-none font-mono uppercase ${themeClasses.inputBg}`}
                      />
                      <button
                        onClick={() => {
                          let c = instantPurgeCode.trim().toUpperCase();
                          if (c) {
                            if (!c.startsWith('OPH-')) c = `OPH-${c}`;
                            handleDeletePhoto(c);
                            setInstantPurgeCode('');
                          }
                        }}
                        className="rounded-lg bg-red-600 hover:bg-red-500 px-2.5 py-1 text-xs font-bold text-white transition-colors cursor-pointer"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* =========================================================================
            TAB 4: ฮาร์ดแวร์ (Hardware Diagnostics - Glanceable table)
            ========================================================================= */}
        {activeTab === 'hardware' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <section className={`rounded-2xl border p-6 space-y-4 ${themeClasses.cardBg}`}>
              <div className="text-sm font-bold text-slate-300">การวินิจฉัยอุปกรณ์ (Diagnostics)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-mono text-xs">
                {/* 1: Screen 1 (Kiosk) */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${kioskTelemetry.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      Screen 1 (Kiosk)
                    </span>
                    <span className={`font-bold text-[11px] ${kioskTelemetry.online ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {kioskTelemetry.online ? 'ONLINE' : 'LOST'}
                    </span>
                  </div>
                  <div className="text-slate-200 text-sm font-bold">
                    {kioskTelemetry.online ? `${kioskTelemetry.resolution} @ ${kioskTelemetry.fps} FPS` : 'ออฟไลน์ (ไม่พบจอ 1)'}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {kioskTelemetry.online
                      ? `MediaPipe WebGL (${kioskTelemetry.aiLatencyMs}ms)`
                      : 'เปิดหน้า /kiosk เพื่อเริ่มส่งสัญญาณ'}
                  </div>
                </div>

                {/* 2: Screen 2 (Showcase) */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${displayTelemetry.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      Screen 2 (Showcase)
                    </span>
                    <span className={`font-bold text-[11px] ${displayTelemetry.online ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {displayTelemetry.online ? 'SYNCED' : 'LOST'}
                    </span>
                  </div>
                  <div className="text-slate-200 text-sm font-bold">
                    {displayTelemetry.online ? `${displayTelemetry.latencyMs} ms Latency` : 'ออฟไลน์ (ไม่พบจอ 2)'}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {displayTelemetry.online
                      ? (displayTelemetry.isMuted
                          ? 'Muted (จอดำฉุกเฉิน)'
                          : displayTelemetry.activeCode
                            ? `สปอตไลต์รูป #${displayTelemetry.activeCode}`
                            : 'สแตนด์บายฉายสไลด์')
                      : 'เปิดหน้า /display เพื่อเชื่อมต่อ'}
                  </div>
                </div>

                {/* 3 */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Network Gateway</span>
                    <span className={isNetOnline ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'}>{isNetOnline ? 'OK' : 'OFF'}</span>
                  </div>
                  <div className="text-slate-200 text-sm font-bold">{netLatency !== null ? `${netLatency} ms` : '5GHz'}</div>
                  <div className="text-slate-500 text-[11px]">HTTPS Ready</div>
                </div>

                {/* 4 */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>PDPA Storage</span>
                    <span className="text-amber-500 font-bold">7 DAYS</span>
                  </div>
                  <div className="text-slate-200 text-sm font-bold">{photos.length} รูปในระบบ</div>
                  <div className="text-slate-500 text-[11px]">ลบแล้ว {deletedCodes.length} รูป</div>
                </div>
              </div>
            </section>

            {/* Network & Public Domain Tunnel Gateway (Moved from Controls for ultra-clean UI) */}
            <section className={`rounded-2xl border p-6 space-y-3 ${themeClasses.cardBg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-300">Public Domain / Tunnel Gateway</div>
                  <div className="text-xs text-slate-500 mt-0.5">โดเมนสาธารณะสำหรับสร้าง QR Code ให้ผู้เข้างานเปิดด้วย 4G/5G</div>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  QR ENDPOINT
                </span>
              </div>
              <div className="flex gap-2 max-w-xl">
                <input
                  type="text"
                  placeholder="https://..."
                  value={publicDomain}
                  onChange={(e) => setPublicDomain(e.target.value)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none font-mono ${themeClasses.inputBg}`}
                />
                <button
                  onClick={() => {
                    const clean = publicDomain.trim().replace(/\/+$/, '');
                    if (typeof window !== 'undefined') localStorage.setItem('swu_booth_host', clean);
                    sendCommand('SET_PUBLIC_DOMAIN', 'อัปเดตโดเมนแล้ว', clean);
                  }}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            </section>
          </div>
        )}

        {/* =========================================================================
            TAB 5: บันทึกระบบ (Logs - Clean stream)
            ========================================================================= */}
        {activeTab === 'logs' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <section className={`rounded-2xl border overflow-hidden ${themeClasses.cardBg}`}>
              <div className="flex items-center justify-between p-4 border-b border-slate-800/40 text-xs">
                <span className="font-bold text-slate-300 font-mono">บันทึกเหตุการณ์ ({auditLogs.length})</span>
                <button
                  onClick={() => setAuditLogs([])}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  ล้าง
                </button>
              </div>

              <div className="p-4 max-h-[400px] overflow-y-auto font-mono text-xs space-y-1.5">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-10 text-slate-600">ไม่มีกิจกรรมบันทึก</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-2 text-slate-300">
                      <span className="text-slate-600">[{log.time}]</span>
                      <span className="text-cyan-500 font-semibold">{log.type}</span>
                      <span>{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* Global Toast */}
        {commandNotice && (
          <div className="fixed right-6 top-16 z-50 rounded-xl border border-slate-700 bg-[#0B0F17]/95 px-4 py-2 text-xs font-semibold text-cyan-400 shadow-xl backdrop-blur-md animate-in fade-in">
            {commandNotice}
          </div>
        )}
      </div>

      {/* Re-issue QR Modal (Minimalist) */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-sm rounded-2xl border p-6 text-center space-y-4 shadow-2xl ${isDark ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${themeClasses.textTitle}`}>QR Code รับรูป</span>
              <button onClick={() => setSelectedPhoto(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="mx-auto aspect-square w-56 rounded-xl bg-white p-3 shadow-md flex items-center justify-center">
              <QRCodeSVG
                value={(() => {
                  const clean = (publicDomain || (typeof window !== 'undefined' ? window.location.origin : '')).trim().replace(/\/+$/, '');
                  const base = /^https?:\/\//i.test(clean) ? clean : clean ? `http://${clean}` : '';
                  return base ? `${base}/p/${encodeURIComponent(selectedPhoto.code)}` : selectedPhoto.qrUrl;
                })()}
                level="H"
                className="h-full w-full"
              />
            </div>

            <div className="font-mono text-xl font-bold text-[#CE1126]">
              #{selectedPhoto.code.replace('OPH-', '')}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => copyLink(selectedPhoto)}
                className={`h-9 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  isDark ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                คัดลอกลิงก์
              </button>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="h-9 rounded-xl bg-[#CE1126] text-xs font-bold text-white transition-colors cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function StaffAdminPortal() {
  return (
    <SafeErrorBoundary fallbackTitle="ศูนย์ควบคุม Staff Admin พบข้อขัดข้องชั่วคราว">
      <StaffGate title="Staff Mission Control Center">
        <StaffAdminScreen />
      </StaffGate>
    </SafeErrorBoundary>
  );
}
