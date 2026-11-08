'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Monitor,
  Wifi,
  HardDrive,
  Database,
  RefreshCw,
  RefreshCcw,
  SkipForward,
  Pause,
  Play,
  Search,
  QrCode,
  Link2,
  Trash2,
  LogOut,
  Check,
  X,
  ShieldCheck,
  Camera,
  AlertTriangle,
  Sliders,
  Globe,
  XCircle,
  ShieldAlert,
  Radio,
  Tv,
  Zap,
  Terminal,
  Clock,
  Eye,
  EyeOff,
  Send,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CpeLogo } from '@/components/CpeLogo';
import { StaffGate } from '@/components/StaffGate';
import {
  PhotoRecord,
  ScreenSyncEvent,
  SCREEN_SYNC_CHANNEL,
  DEFAULT_PRODUCTION_APP_URL,
} from '@/lib/contracts';

interface AuditLogItem {
  id: string;
  time: string;
  type: 'STAFF' | 'KIOSK' | 'DISPLAY' | 'STORAGE' | 'PDPA';
  text: string;
  variant: 'info' | 'success' | 'warning' | 'danger';
}

const DEFAULT_SAMPLE_PHOTOS: PhotoRecord[] = [];

function StaffAdminScreen() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'recent1h' | 'recent30m'>('all');
  const [photos, setPhotos] = useState<PhotoRecord[]>(DEFAULT_SAMPLE_PHOTOS);
  const [deletedCodes, setDeletedCodes] = useState<string[]>([]);
  const [kioskState, setKioskState] = useState<'standby' | 'paused' | 'active'>('standby');
  const [isDisplayMuted, setIsDisplayMuted] = useState<boolean>(false);
  const [storageMode, setStorageMode] = useState<'r2_dual' | 'local_only'>('r2_dual');
  const [commandNotice, setCommandNotice] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [pushedCode, setPushedCode] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(3.5);
  const [countdownDuration, setCountdownDuration] = useState<number>(3);
  const [publicDomain, setPublicDomain] = useState<string>('');
  const [instantPurgeCode, setInstantPurgeCode] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('--:--:--');
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Screen heartbeats
  const [kioskOnline, setKioskOnline] = useState<boolean>(true);
  const [displayOnline, setDisplayOnline] = useState<boolean>(true);

  const channelRef = useRef<BroadcastChannel | null>(null);

  // Helper to add timestamped audit log
  const addAuditLog = useCallback(
    (type: AuditLogItem['type'], text: string, variant: AuditLogItem['variant'] = 'info') => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const newItem: AuditLogItem = {
        id: `${Date.now()}-${Math.random()}`,
        time: timeStr,
        type,
        text,
        variant,
      };
      setAuditLogs((prev) => [newItem, ...prev.slice(0, 49)]);
    },
    []
  );

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize BroadcastChannel
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

        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.code !== data.code);
          return [newRecord, ...filtered];
        });

        addAuditLog('KIOSK', `ถ่ายภาพสำเร็จ: รหัส #${data.code.replace('OPH-', '')}`, 'success');
        addAuditLog('DISPLAY', `ส่งรูป #${data.code.replace('OPH-', '')} ขึ้นจอใหญ่ 30 วินาที`, 'info');
      } else if (data.type === 'PHOTO_DELETED') {
        const code = data.code;
        setPhotos((prev) => prev.filter((p) => p.code !== code));
        addAuditLog('PDPA', `ลบรูป #${code.replace('OPH-', '')} ถาวรจากทุกจอ`, 'warning');
      } else if (data.type === 'HEARTBEAT_PONG') {
        if (data.sender === 'KIOSK') {
          setKioskOnline(true);
          addAuditLog('KIOSK', 'ได้รับสัญญาณตอบกลับจาก Kiosk (Screen 1)', 'info');
        } else if (data.sender === 'DISPLAY') {
          setDisplayOnline(true);
          addAuditLog('DISPLAY', 'ได้รับสัญญาณตอบกลับจาก Showcase (Screen 2)', 'info');
        }
      } else if (data.type === 'MUTE_DISPLAY' || (data.type === 'KIOSK_COMMAND' && data.command === 'MUTE_DISPLAY')) {
        setIsDisplayMuted(true);
        addAuditLog('DISPLAY', 'เปิดม่านดำเซ็นเซอร์จอใหญ่ฉุกเฉิน (Display Muted)', 'danger');
      } else if (data.type === 'UNMUTE_DISPLAY' || (data.type === 'KIOSK_COMMAND' && data.command === 'UNMUTE_DISPLAY')) {
        setIsDisplayMuted(false);
        addAuditLog('DISPLAY', 'ยกเลิกเซ็นเซอร์จอใหญ่ กลับสู่โหมดปกติ', 'success');
      }
    };

    addAuditLog('STAFF', 'เชื่อมต่อ BroadcastChannel: swu_photobooth_bus สำเร็จ', 'success');

    return () => {
      channel.close();
    };
  }, [addAuditLog]);

  // Fetch photos combining server, localStorage, and seeds, strictly excluding deleted codes
  const loadPhotos = async (currentDeleted?: string[] | unknown) => {
    const activeDeletedList = Array.isArray(currentDeleted) ? currentDeleted : undefined;
    try {
      let activeDeleted = activeDeletedList;
      if (!activeDeleted && typeof window !== 'undefined') {
        try {
          const rawDel = localStorage.getItem('swu_deleted_codes') || '[]';
          activeDeleted = JSON.parse(rawDel);
        } catch {}
      }
      const deletedSet = new Set(activeDeleted || deletedCodes);

      // 1. Fetch from server API
      const res = await fetch('/api/photos');
      const data = await res.json();
      const serverPhotos: PhotoRecord[] =
        data?.photos && Array.isArray(data.photos) ? data.photos : [];

      // 2. Read from client local gallery
      let localPhotos: PhotoRecord[] = [];
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('swu_photo_gallery') || '[]';
          localPhotos = JSON.parse(raw);
        } catch {}
      }

      // 3. Merge server + local + default sample photos
      const map = new Map<string, PhotoRecord>();
      [...serverPhotos, ...localPhotos, ...DEFAULT_SAMPLE_PHOTOS].forEach((p) => {
        if (p?.code && !deletedSet.has(p.code)) {
          if (!map.has(p.code)) {
            map.set(p.code, p);
          }
        }
      });

      const list = Array.from(map.values());
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setPhotos(list);
    } catch (err) {
      console.warn('Failed to load photos:', err);
    }
  };

  useEffect(() => {
    let initialDeleted: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        const rawDel = localStorage.getItem('swu_deleted_codes') || '[]';
        const parsed = JSON.parse(rawDel);
        if (Array.isArray(parsed)) {
          initialDeleted = parsed;
          setDeletedCodes(parsed);
        }
      } catch {}
    }

    loadPhotos(initialDeleted);

    if (typeof window !== 'undefined') {
      const savedHost =
        localStorage.getItem('swu_booth_host') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        '';
      setPublicDomain(savedHost);
    }
  }, []);

  const sendCommand = (command: string, message: string, value?: any) => {
    channelRef.current?.postMessage({
      type: 'KIOSK_COMMAND',
      command,
      value,
    } as ScreenSyncEvent);

    if (command === 'RESET_STANDBY') {
      channelRef.current?.postMessage({ type: 'SCREEN1_RESET' } as ScreenSyncEvent);
    }

    setCommandNotice(message);
    addAuditLog('STAFF', message, 'info');
    setTimeout(() => setCommandNotice(''), 2500);
  };

  const toggleDisplayMute = () => {
    const nextState = !isDisplayMuted;
    setIsDisplayMuted(nextState);
    if (nextState) {
      channelRef.current?.postMessage({ type: 'MUTE_DISPLAY' } as ScreenSyncEvent);
      setCommandNotice('เซ็นเซอร์จอใหญ่ฉุกเฉิน: ดับจอแสดงผล Screen 2 แล้ว');
      addAuditLog('STAFF', 'กดปุ่มเซ็นเซอร์จอใหญ่ฉุกเฉิน (Mute Display Activated)', 'danger');
    } else {
      channelRef.current?.postMessage({ type: 'UNMUTE_DISPLAY' } as ScreenSyncEvent);
      setCommandNotice('ยกเลิกเซ็นเซอร์จอใหญ่: จอแสดงผล Screen 2 กลับมาทำงานปกติ');
      addAuditLog('STAFF', 'ยกเลิกเซ็นเซอร์จอใหญ่ (Unmute Display)', 'success');
    }
    setTimeout(() => setCommandNotice(''), 2500);
  };

  const pingScreens = () => {
    channelRef.current?.postMessage({
      type: 'HEARTBEAT_PING',
      sender: 'ADMIN',
      timestamp: Date.now(),
    } as ScreenSyncEvent);
    setCommandNotice('ส่งสัญญาณ Ping ไปยัง Kiosk และ Showcase Display แล้ว');
    addAuditLog('STAFF', 'ส่งสัญญาณ Ping ไปยัง Kiosk & Display', 'info');
    setTimeout(() => setCommandNotice(''), 2500);
  };

  const handleCountdownChange = (seconds: number) => {
    setCountdownDuration(seconds);
    sendCommand('SET_COUNTDOWN', `ปรับเวลานับถอยหลังเป็น ${seconds} วินาทีแล้ว`, seconds);
  };

  const handleSensitivityChange = (val: number) => {
    setSensitivity(val);
    sendCommand('SET_THRESHOLD', `ปรับเกณฑ์ความไวตรวจจับมือเป็น ${val}% แล้ว`, val / 100);
  };

  const handleSavePublicDomain = () => {
    const cleanDomain = publicDomain.trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      if (cleanDomain) {
        localStorage.setItem('swu_booth_host', cleanDomain);
      } else {
        localStorage.removeItem('swu_booth_host');
      }
    }
    sendCommand(
      'SET_PUBLIC_DOMAIN',
      'อัปเดต Public Domain สำหรับ 4G/5G และส่งต่อให้ทุกจอแล้ว',
      cleanDomain
    );
  };

  const handlePresetDomain = (preset: string) => {
    setPublicDomain(preset);
    if (typeof window !== 'undefined') {
      if (preset) {
        localStorage.setItem('swu_booth_host', preset);
      } else {
        localStorage.removeItem('swu_booth_host');
      }
    }
    sendCommand(
      'SET_PUBLIC_DOMAIN',
      `เปลี่ยน Public Domain เป็น ${preset || 'Vercel Production'} และซิงค์ทุกจอแล้ว`,
      preset
    );
  };

  const copyLink = async (photo: PhotoRecord) => {
    const rawOrigin =
      publicDomain ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const cleanOrigin = rawOrigin.trim().replace(/\/+$/, '');
    const origin = /^https?:\/\//i.test(cleanOrigin)
      ? cleanOrigin
      : cleanOrigin
      ? `http://${cleanOrigin}`
      : '';

    const link =
      !publicDomain && photo.qrUrl && /^https?:\/\//i.test(photo.qrUrl)
        ? photo.qrUrl
        : `${origin}/p/${photo.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(photo.code);
      addAuditLog('STAFF', `คัดลอกลิงก์ตรงของรูป #${photo.code.replace('OPH-', '')}`, 'info');
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {}
  };

  const handlePushToDisplay = (photo: PhotoRecord) => {
    channelRef.current?.postMessage({
      type: 'PUSH_TO_DISPLAY',
      photo,
    } as ScreenSyncEvent);

    setPushedCode(photo.code);
    setCommandNotice(`ส่งรูป #${photo.code.replace('OPH-', '')} ขึ้นจอใหญ่ 30 วินาทีแล้ว`);
    addAuditLog('STAFF', `บังคับส่งรูป #${photo.code.replace('OPH-', '')} ขึ้นจอใหญ่ (Showcase Spotlight)`, 'success');
    setTimeout(() => {
      setPushedCode(null);
      setCommandNotice('');
    }, 2500);
  };

  const handleDeletePhoto = async (code: string) => {
    // 1. Immediately persist to localStorage deleted set
    let updatedDeleted: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        const rawDel = localStorage.getItem('swu_deleted_codes') || '[]';
        const cur: string[] = JSON.parse(rawDel);
        updatedDeleted = Array.from(new Set([...cur, code]));
        localStorage.setItem('swu_deleted_codes', JSON.stringify(updatedDeleted));
      } catch {
        updatedDeleted = [code];
      }
    } else {
      updatedDeleted = [code];
    }
    setDeletedCodes(updatedDeleted);

    // 2. Remove from component state & close modal if open
    setPhotos((prev) => prev.filter((p) => p.code !== code));
    if (selectedPhoto?.code === code) {
      setSelectedPhoto(null);
    }

    // 3. Remove from local gallery & latest photo storage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('swu_photo_gallery');
        if (saved) {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            const filtered = list.filter((p: any) => p.code !== code);
            localStorage.setItem('swu_photo_gallery', JSON.stringify(filtered));
          }
        }
        const savedLatest = localStorage.getItem('swu_latest_photo');
        if (savedLatest) {
          const latestItem = JSON.parse(savedLatest);
          if (latestItem?.code === code) {
            localStorage.removeItem('swu_latest_photo');
          }
        }
      } catch {}
    }

    // 4. Send API DELETE request to server storage
    try {
      await fetch('/api/photos/' + encodeURIComponent(code), { method: 'DELETE' });
    } catch {}

    // 5. Broadcast deletion to Screen 2 (Showcase) and Screen 1 (Kiosk)
    try {
      channelRef.current?.postMessage({
        type: 'PHOTO_DELETED',
        code,
      } as ScreenSyncEvent);
    } catch {}

    setCommandNotice('ลบรูป ' + code + ' ถาวรสำเร็จและซิงค์กับทุกจอแล้ว (PDPA Purge)');
    addAuditLog('PDPA', `ลบรูป #${code.replace('OPH-', '')} ออกจากระบบถาวร`, 'danger');
    setTimeout(() => setCommandNotice(''), 2500);
  };

  const handleInstantPurge = () => {
    let code = instantPurgeCode.trim().toUpperCase();
    if (!code) return;
    if (!code.startsWith('OPH-')) {
      code = `OPH-${code}`;
    }
    handleDeletePhoto(code);
    setInstantPurgeCode('');
  };

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (deletedCodes.includes(photo.code)) return false;

      // Time filter
      if (filterTab === 'recent30m') {
        const diff = Date.now() - new Date(photo.createdAt).getTime();
        if (diff > 30 * 60 * 1000) return false;
      } else if (filterTab === 'recent1h') {
        const diff = Date.now() - new Date(photo.createdAt).getTime();
        if (diff > 60 * 60 * 1000) return false;
      }

      const q = searchQuery.trim().toUpperCase();
      if (!q) return true;
      return photo.code.toUpperCase().includes(q);
    });
  }, [photos, deletedCodes, searchQuery, filterTab]);

  return (
    <main className="min-h-dvh hud-dot-grid text-slate-200 select-none antialiased">
      {/* Top Header - UIHut Mission Control Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0B0F17]/95 px-6 py-3.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-4">
          {/* Brand & Ticker */}
          <div className="flex items-center gap-4">
            <CpeLogo className="h-9" />
            <div className="border-l border-slate-800 pl-4">
              <div className="flex items-center gap-2.5">
                <h1 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-2">
                  STAFF MISSION CONTROL CENTER
                  <span className="rounded bg-[#CE1126]/20 px-2 py-0.5 text-[9px] font-mono font-bold text-[#FF5A6B] border border-[#CE1126]/40">
                    OPEN HOUSE 2026
                  </span>
                </h1>
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 font-mono text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
                  ALL SYSTEMS ARMED
                </span>
                <span className="text-slate-700">•</span>
                <span className="font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="size-3 text-cyan-400" />
                  {currentTime} น. (BKK)
                </span>
                <span className="text-slate-700">•</span>
                <span className="font-mono text-slate-500 hidden sm:inline">
                  Bus: <span className="text-cyan-400">swu_photobooth_bus</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Matrix & Logout */}
          <div className="flex items-center gap-3">
            {/* Global Panic Blackout Display Mute Switch */}
            <button
              onClick={toggleDisplayMute}
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-xs font-bold transition-all shadow-lg cursor-pointer ${
                isDisplayMuted
                  ? 'border-red-500 bg-red-600 text-white animate-pulse shadow-red-500/30'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-red-500/50 hover:text-red-400'
              }`}
            >
              {isDisplayMuted ? (
                <>
                  <EyeOff className="size-4" />
                  <span>เซ็นเซอร์จอใหญ่: กำลังม่านดำ</span>
                </>
              ) : (
                <>
                  <Eye className="size-4 text-slate-400" />
                  <span>เซ็นเซอร์จอใหญ่ฉุกเฉิน (Mute)</span>
                </>
              )}
            </button>

            {/* Manual Ping Bus */}
            <button
              onClick={pingScreens}
              title="Ping Kiosk & Display Screens"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Radio className="size-3.5 text-cyan-400" />
              <span className="hidden md:inline">Ping Bus</span>
            </button>

            {/* Logout */}
            <button
              onClick={async () => {
                await fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('swu_admin_auth');
                }
                window.location.reload();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">ออก</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-[1920px] p-6 space-y-6">
        {/* 4 Telemetry HUD Modules (UIHut Command Center Style) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* 1. Camera & AI Vision Module */}
          <article className="craft-hud-card tactical-corner p-5 relative overflow-hidden group transition-all duration-300 hover:border-cyan-500/40">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Camera className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-300">กล้อง & Hand AI Vision</h3>
                  <div className="text-[10px] text-slate-500 font-mono">Kiosk Screen 1</div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="mt-4 font-mono text-xl font-black text-white">
              1080p @ 60 FPS
            </div>
            <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
              <span>MediaPipe WebGL: ~11ms Latency</span>
              <button
                onClick={() => sendCommand('RELOAD_CAMERA', 'รีสตาร์ทสตรีมกล้อง Screen 1 สำเร็จ')}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                รีบูตกล้อง
              </button>
            </div>
          </article>

          {/* 2. Multi-Screen Real-Time Sync Module */}
          <article className="craft-hud-card tactical-corner p-5 relative overflow-hidden group transition-all duration-300 hover:border-cyan-500/40">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Tv className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-300">การซิงค์ 2 หน้าจอ</h3>
                  <div className="text-[10px] text-slate-500 font-mono">BroadcastChannel</div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                2 SCREENS SYNCED
              </span>
            </div>
            <div className="mt-4 font-mono text-xl font-black text-white">
              Latency: &lt; 1 ms
            </div>
            <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Screen 1 (Kiosk) ↔ Screen 2 (Showcase)</span>
              <button
                onClick={pingScreens}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
              >
                Ping ตรวจเช็ค
              </button>
            </div>
          </article>

          {/* 3. Storage Resilience & Circuit Breaker Module */}
          <article className="craft-hud-card tactical-corner p-5 relative overflow-hidden group transition-all duration-300 hover:border-cyan-500/40">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <HardDrive className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-300">พื้นที่จัดเก็บรูปภาพ</h3>
                  <div className="text-[10px] text-slate-500 font-mono">Cloudflare R2 + Local</div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-400 border border-cyan-500/30">
                <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                R2 ACTIVE
              </span>
            </div>
            <div className="mt-4 font-mono text-xl font-black text-white">
              cpe-swu-photobooth
            </div>
            <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Dual Storage: Cloudflare + Local Disk</span>
              <span className="text-[10px] text-indigo-400 font-mono">0 Mocks</span>
            </div>
          </article>

          {/* 4. PDPA Compliance & Retention Module */}
          <article className="craft-hud-card tactical-corner p-5 relative overflow-hidden group transition-all duration-300 hover:border-cyan-500/40">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Database className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-300">รูปภาพ & นโยบาย PDPA</h3>
                  <div className="text-[10px] text-slate-500 font-mono">Retention Management</div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/30">
                <ShieldCheck className="size-3" />
                PDPA 7-DAY TTL
              </span>
            </div>
            <div className="mt-4 font-mono text-xl font-black text-white">
              {photos.length} รูปในระบบ
            </div>
            <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Auto-Purge 7 วัน · สิทธิลบรูปทันที</span>
              <span className="text-[10px] text-amber-400 font-bold font-mono">100% Secure</span>
            </div>
          </article>
        </section>

        {/* Dual Cockpit Live Fleet Telemetry (George Railean / Fuselab Dribbble HUD Style) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Screen 1: Kiosk Station Cockpit */}
          <div className="craft-hud-card tactical-corner p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Monitor className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold tracking-wider text-white flex items-center gap-2">
                    SCREEN 1 · KIOSK COCKPIT
                    <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 border border-cyan-500/40">
                      STATION A
                    </span>
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono">1080p WebRTC Viewfinder · MediaPipe Hand AI</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="pulse-beacon">
                  <span className="pulse-beacon-ring bg-emerald-400" />
                  <span className="pulse-beacon-dot bg-emerald-400" />
                </span>
                <span className="font-mono text-[10px] text-emerald-400 font-bold">LIVE RADAR</span>
              </div>
            </div>

            {/* Viewfinder Monitor Visual */}
            <div className="relative aspect-video w-full rounded-xl bg-black/90 border border-cyan-500/30 overflow-hidden shadow-inner flex flex-col justify-between p-3">
              {/* Radar Grid Overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.12)_0%,_transparent_70%)] pointer-events-none" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d410_1px,transparent_1px),linear-gradient(to_bottom,#06b6d410_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

              {/* Top Viewfinder Ticker */}
              <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-cyan-400/80">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                  <span>REC · 60 FPS</span>
                </div>
                <div>THRESHOLD: {sensitivity.toFixed(1)}%</div>
              </div>

              {/* Center Target Crosshair & Hand Detection Visual */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto space-y-2">
                <div className="relative size-20 rounded-full border border-cyan-400/40 flex items-center justify-center animate-pulse">
                  <div className="size-14 rounded-full border border-dashed border-cyan-400/60 flex items-center justify-center">
                    <Camera className="size-6 text-cyan-400" />
                  </div>
                  {/* Crosshair ticks */}
                  <div className="absolute -top-1 w-2 h-0.5 bg-cyan-400" />
                  <div className="absolute -bottom-1 w-2 h-0.5 bg-cyan-400" />
                  <div className="absolute -left-1 h-2 w-0.5 bg-cyan-400" />
                  <div className="absolute -right-1 h-2 w-0.5 bg-cyan-400" />
                </div>
                <div className="text-[11px] font-mono font-bold text-cyan-300">
                  {kioskState === 'paused' ? 'PAUSED BY STAFF' : 'HAND GESTURE TRACKING ACTIVE'}
                </div>
                <div className="text-[9px] text-slate-400 font-mono">
                  Gesture: แบมือ 5 นิ้วค้าง 1.2 วินาทีเพื่อลั่นชัตเตอร์
                </div>
              </div>

              {/* Bottom Telemetry Bar */}
              <div className="relative z-10 flex items-center justify-between text-[10px] font-mono border-t border-cyan-500/20 pt-2 text-slate-400">
                <span>STATE: <span className="text-emerald-400 font-bold">{kioskState.toUpperCase()}</span></span>
                <span>COUNTDOWN: <span className="text-amber-400 font-bold">{countdownDuration}s</span></span>
                <button
                  onClick={() => sendCommand('STAFF_TRIGGER', 'สั่งถ่ายภาพฉุกเฉินจาก Kiosk Cockpit แล้ว')}
                  className="rounded bg-red-600/90 hover:bg-red-500 px-2.5 py-0.5 text-[9px] font-bold text-white transition-colors cursor-pointer"
                >
                  TRIGGER SHUTTER
                </button>
              </div>
            </div>
          </div>

          {/* Screen 2: Showcase Display Station Cockpit */}
          <div className="craft-hud-card tactical-corner p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Tv className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold tracking-wider text-white flex items-center gap-2">
                    SCREEN 2 · SHOWCASE MEGA DISPLAY
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300 border border-emerald-500/40">
                      HALL DISPLAY
                    </span>
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono">Real-Time Photo Spotlight · QR Download Broadcast</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="pulse-beacon">
                  <span className={`pulse-beacon-ring ${isDisplayMuted ? 'bg-red-400' : 'bg-emerald-400'}`} />
                  <span className={`pulse-beacon-dot ${isDisplayMuted ? 'bg-red-400' : 'bg-emerald-400'}`} />
                </span>
                <span className={`font-mono text-[10px] font-bold ${isDisplayMuted ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isDisplayMuted ? 'BLACKOUT MUTED' : 'BROADCASTING'}
                </span>
              </div>
            </div>

            {/* Showcase Monitor Visual */}
            <div className={`relative aspect-video w-full rounded-xl border overflow-hidden shadow-inner flex flex-col justify-between p-3 transition-colors ${
              isDisplayMuted
                ? 'bg-red-950/40 border-red-500/40'
                : 'bg-black/90 border-emerald-500/30'
            }`}>
              {/* Background Glow */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.12)_0%,_transparent_70%)] pointer-events-none" />

              {/* Top Bar */}
              <div className="relative z-10 flex items-center justify-between text-[10px] font-mono">
                <span className="text-emerald-400/90 font-bold">DISPLAY STATUS: {isDisplayMuted ? 'MUTED' : 'ACTIVE'}</span>
                <span className="text-slate-400">LATENCY: &lt; 1ms</span>
              </div>

              {/* Center Content Preview */}
              <div className="relative z-10 flex flex-col items-center justify-center my-auto space-y-2">
                {isDisplayMuted ? (
                  <div className="text-center space-y-1">
                    <EyeOff className="size-8 text-red-400 mx-auto animate-pulse" />
                    <div className="text-xs font-mono font-bold text-red-300">EMERGENCY BLACKOUT MUTED</div>
                    <div className="text-[9px] text-slate-400 font-mono">หน้าจอใหญ่ถูกปิดเพื่อความปลอดภัยของสตาฟฟ์</div>
                  </div>
                ) : photos.length > 0 ? (
                  <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-lg p-2.5 max-w-sm">
                    <img
                      src={photos[0].photoUrl}
                      alt=""
                      className="size-16 rounded object-cover border border-white/10"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="text-left space-y-1">
                      <div className="text-[11px] font-mono font-bold text-white">
                        LATEST: #{photos[0].code.replace('OPH-', '')}
                      </div>
                      <div className="text-[9px] text-slate-400 font-mono">Spotlight Active (30s Carousel)</div>
                      <div className="text-[9px] text-emerald-400 font-mono">QR Code Generated for Attendees</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-1">
                    <Tv className="size-8 text-emerald-400 mx-auto" />
                    <div className="text-xs font-mono font-bold text-white">STANDBY SHOWCASE IDLE</div>
                    <div className="text-[9px] text-slate-400 font-mono">รอรูปภาพแรกจาก Kiosk Screen 1</div>
                  </div>
                )}
              </div>

              {/* Bottom Telemetry Bar */}
              <div className="relative z-10 flex items-center justify-between text-[10px] font-mono border-t border-white/10 pt-2 text-slate-400">
                <span>QUEUE: <span className="text-white font-bold">{photos.length} PHOTOS</span></span>
                <button
                  onClick={toggleDisplayMute}
                  className={`rounded px-2.5 py-0.5 text-[9px] font-bold text-white transition-colors cursor-pointer ${
                    isDisplayMuted ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600/90 hover:bg-red-500'
                  }`}
                >
                  {isDisplayMuted ? 'UNMUTE DISPLAY' : 'PANIC MUTE'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Tactical Onsite Accident Recovery Center (ศูนย์บัญชาการแก้วิกฤตหน้างาน) */}
        <section className="craft-hud-card tactical-corner p-6 shadow-2xl space-y-5 border-red-500/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  ศูนย์รับมืออุบัติเหตุและแก้ปัญหาวิกฤตหน้างาน (Onsite Emergency Incident Controls)
                  <span className="rounded bg-red-500/20 text-red-400 text-[9px] px-2 py-0.5 border border-red-500/30 font-mono">
                    HIGH PRIORITY
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  คำสั่งฉุกเฉินแบบ Zero-Latency สำหรับสตาฟฟ์ควบคุมตู้ถ่ายภาพ แก้ปัญหาได้ทันทีโดยไม่ต้องรีสตาร์ทเซิร์ฟเวอร์
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px]">สถานะ Kiosk:</span>
                <span
                  className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded ${
                    kioskState === 'paused'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {kioskState === 'paused' ? 'PAUSED (พักตู้)' : 'STANDBY (พร้อมทำงาน)'}
                </span>
              </div>
            </div>
          </div>

          {/* 7 Primary Tactical Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {/* 1. Emergency Shutter */}
            <button
              onClick={() =>
                sendCommand('STAFF_TRIGGER', 'ส่งคำสั่งเริ่มนับถอยหลังถ่ายภาพฉุกเฉินแล้ว')
              }
              className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl bg-[#CE1126] hover:bg-[#E1132B] text-white transition-all shadow-lg shadow-red-950/40 group text-center cursor-pointer border border-red-500/50"
            >
              <Camera className="size-5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">ถ่ายภาพฉุกเฉิน</span>
              <span className="text-[9px] text-white/80">วีลแชร์ / เด็ก / แสงจ้า</span>
            </button>

            {/* 2. Cancel Countdown */}
            <button
              onClick={() =>
                sendCommand('CANCEL_COUNTDOWN', 'ยกเลิกการนับถอยหลังและกลับสู่ Standby แล้ว')
              }
              className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all shadow-md group text-center cursor-pointer"
            >
              <XCircle className="size-5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">ยกเลิกนับถอยหลัง</span>
              <span className="text-[9px] text-amber-400/80">คนเดินตัดหน้ากล้อง</span>
            </button>

            {/* 3. Emergency Display Mute (Panic Button) */}
            <button
              onClick={toggleDisplayMute}
              className={`flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border transition-all shadow-md group text-center cursor-pointer ${
                isDisplayMuted
                  ? 'border-red-500 bg-red-600/30 text-red-200 shadow-red-500/20'
                  : 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
              }`}
            >
              {isDisplayMuted ? (
                <>
                  <EyeOff className="size-5 text-red-300 animate-pulse" />
                  <span className="text-xs font-bold">ปลดม่านดำจอใหญ่</span>
                  <span className="text-[9px] text-red-300/80">เปิดแสดงภาพต่อ</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="size-5 group-hover:scale-110 transition-transform text-rose-400" />
                  <span className="text-xs font-bold">เซ็นเซอร์จอใหญ่ฉุกเฉิน</span>
                  <span className="text-[9px] text-rose-400/80">ดับภาพไม่เหมาะสมทันที</span>
                </>
              )}
            </button>

            {/* 4. Force Reset Standby */}
            <button
              onClick={() => {
                setKioskState('standby');
                sendCommand('RESET_STANDBY', 'ส่งคำสั่งรีเซ็ตจอ 1 และจอ 2 เป็น Standby แล้ว');
              }}
              className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-all group text-center cursor-pointer"
            >
              <RefreshCcw className="size-5 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-xs font-bold">รีเซ็ตตู้ (Standby)</span>
              <span className="text-[9px] text-cyan-400/80">เคลียร์สถานะค้าง</span>
            </button>

            {/* 5. Reboot Camera */}
            <button
              onClick={() =>
                sendCommand('RELOAD_CAMERA', 'ส่งคำสั่งรีสตาร์ทกล้อง Kiosk Screen 1 แล้ว')
              }
              className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-all shadow-md group text-center cursor-pointer"
            >
              <RefreshCw className="size-5 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-xs font-bold">รีสตาร์ทกล้อง</span>
              <span className="text-[9px] text-indigo-400/80">แก้ภาพดำ / USB หลุด</span>
            </button>

            {/* 6. Skip Preview */}
            <button
              onClick={() =>
                sendCommand('SKIP_PREVIEW', 'ส่งคำสั่งข้าม Preview ส่งรูปไปจอ 2 ทันที')
              }
              className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-all group text-center cursor-pointer"
            >
              <SkipForward className="size-5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
              <span className="text-xs font-bold">ข้าม Preview</span>
              <span className="text-[9px] text-emerald-400/80">เร่งระบายคิวคนแน่น</span>
            </button>

            {/* 7. Pause / Resume Booth */}
            <button
              onClick={() => {
                if (kioskState === 'paused') {
                  setKioskState('standby');
                  sendCommand('RESUME_BOOTH', 'เปิดการทำงาน Kiosk ต่อแล้ว');
                } else {
                  setKioskState('paused');
                  sendCommand('PAUSE_BOOTH', 'พัก Kiosk ชั่วคราวแล้ว');
                }
              }}
              className={`flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border transition-all text-center cursor-pointer ${
                kioskState === 'paused'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              {kioskState === 'paused' ? (
                <>
                  <Play className="size-5 text-emerald-400" />
                  <span className="text-xs font-bold">เปิดใช้งานต่อ</span>
                  <span className="text-[9px] text-emerald-400/80">ปลดล็อกตู้ Kiosk</span>
                </>
              ) : (
                <>
                  <Pause className="size-5 text-amber-400" />
                  <span className="text-xs font-bold">พักบูธชั่วคราว</span>
                  <span className="text-[9px] text-amber-400/80">จัดคิว / เช็ดเลนส์</span>
                </>
              )}
            </button>
          </div>

          {/* Real-Time Tuners: Sensitivity, Countdown, Public Domain & Instant Purge */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-2">
            {/* Tuner 1: Detection Sensitivity */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Sliders className="size-4 text-cyan-400" />
                  <span>เกณฑ์ระยะตรวจจับมือ</span>
                </div>
                <span className="font-mono font-bold text-cyan-300">{sensitivity.toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="6.0"
                step="0.5"
                value={sensitivity}
                onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span
                  onClick={() => handleSensitivityChange(2.0)}
                  className="hover:text-cyan-400 cursor-pointer"
                >
                  2.0% (ยืนไกล)
                </span>
                <span
                  onClick={() => handleSensitivityChange(3.5)}
                  className="text-cyan-400 font-bold hover:underline cursor-pointer"
                >
                  3.5% (แนะนำ)
                </span>
                <span
                  onClick={() => handleSensitivityChange(5.0)}
                  className="hover:text-cyan-400 cursor-pointer"
                >
                  5.0% (กรองคนเดินผ่าน)
                </span>
              </div>
            </div>

            {/* Tuner 2: Countdown Timer Selector */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-400" />
                  <span>เวลานับถอยหลัง (Countdown)</span>
                </div>
                <span className="font-mono text-amber-400">{countdownDuration}s</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                {[3, 5, 8].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => handleCountdownChange(sec)}
                    className={`py-1.5 rounded text-xs font-bold font-mono transition-colors cursor-pointer ${
                      countdownDuration === sec
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {sec} วินาที {sec === 3 ? '(Express)' : sec === 5 ? '(ปกติ)' : '(กลุ่ม)'}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-500">
                ปรับความเร็วการถ่ายรูปตามความหนาแน่นของผู้เข้าแถว
              </div>
            </div>

            {/* Tuner 3: Public Domain / Cloudflare Tunnel Hot-Swap */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-emerald-400" />
                  <span>Public Domain / Tunnel</span>
                </div>
                <span className="text-[9px] text-emerald-400 font-mono">BROADCAST SYNC</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://swu-openhouse.vercel.app"
                  value={publicDomain}
                  onChange={(e) => setPublicDomain(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-black/60 px-2.5 py-1 text-xs text-white placeholder:text-slate-600 outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  onClick={handleSavePublicDomain}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-bold text-white transition-colors shrink-0 cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-slate-500">Preset:</span>
                <button
                  onClick={() => handlePresetDomain(DEFAULT_PRODUCTION_APP_URL)}
                  className="text-emerald-400 hover:underline cursor-pointer"
                >
                  Vercel Prod
                </button>
                <span className="text-slate-700">|</span>
                <button
                  onClick={() => handlePresetDomain('http://localhost:3000')}
                  className="text-slate-400 hover:underline cursor-pointer"
                >
                  Local
                </button>
              </div>
            </div>

            {/* Tuner 4: Emergency Instant Purge by Code */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <div className="flex items-center gap-2">
                  <Trash2 className="size-4 text-red-400" />
                  <span>ลบรูปด่วนด้วยรหัส (Instant Purge)</span>
                </div>
                <span className="text-[9px] text-red-400 font-mono">PDPA KILL</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="เช่น AB29 หรือ OPH-AB29"
                  value={instantPurgeCode}
                  onChange={(e) => setInstantPurgeCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInstantPurge();
                  }}
                  className="flex-1 rounded-lg border border-slate-700 bg-black/60 px-2.5 py-1 text-xs text-white placeholder:text-slate-600 outline-none focus:border-red-500 font-mono uppercase"
                />
                <button
                  onClick={handleInstantPurge}
                  className="rounded-lg bg-red-600 hover:bg-red-500 px-3 py-1 text-xs font-bold text-white transition-colors shrink-0 cursor-pointer"
                >
                  ลบทันที
                </button>
              </div>
              <div className="text-[10px] text-slate-500">
                ลบรูปเป้าหมายออกจาก R2, Local และทุกหน้าจอทันทีในคลิกเดียว
              </div>
            </div>
          </div>
        </section>

        {/* Command Toast Feedback */}
        {commandNotice && (
          <div className="fixed right-6 top-20 z-50 rounded-xl border border-cyan-400/40 bg-[#0B0F17]/95 px-5 py-3 text-xs font-semibold text-cyan-300 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
            {commandNotice}
          </div>
        )}

        {/* Live Photo Stream & Re-issue Station */}
        <section className="craft-hud-card tactical-corner overflow-hidden shadow-2xl">
          {/* Gallery Header */}
          <div className="flex flex-col gap-4 border-b border-slate-800/80 p-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-white">
                  แกลเลอรีภาพถ่ายสด & สถานีออก QR Code ซ้ำ (Photo Stream & Re-issue Station)
                </h2>
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-cyan-400 border border-cyan-500/30">
                  {filteredPhotos.length} PHOTOS
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                รองรับการค้นหาตามรหัส ออก QR ซ้ำให้น้องสแกน ส่งภาพขึ้นจอใหญ่ หรือลบตามสิทธิ PDPA
              </p>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Tabs */}
              <div className="flex rounded-lg bg-slate-900/80 p-1 border border-slate-800 text-xs">
                <button
                  onClick={() => setFilterTab('all')}
                  className={`rounded-md px-3 py-1 font-semibold transition-colors cursor-pointer ${
                    filterTab === 'all'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  onClick={() => setFilterTab('recent1h')}
                  className={`rounded-md px-3 py-1 font-semibold transition-colors cursor-pointer ${
                    filterTab === 'recent1h'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1 ชม. ล่าสุด
                </button>
                <button
                  onClick={() => setFilterTab('recent30m')}
                  className={`rounded-md px-3 py-1 font-semibold transition-colors cursor-pointer ${
                    filterTab === 'recent30m'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  30 นาทีล่าสุด
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="ค้นหารหัส เช่น AB29 หรือ OPH-..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/90 pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => loadPhotos()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCcw className="size-3.5" />
                <span>รีเฟรช</span>
              </button>
            </div>
          </div>

          {/* Photo Cards Grid */}
          <div className="p-6">
            {filteredPhotos.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <HardDrive className="size-12 text-slate-700 mx-auto" />
                <div className="text-sm font-bold text-slate-400">ไม่มีรูปภาพในระบบ</div>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  รูปภาพทั้งหมดถูกลบตามนโยบาย PDPA แล้ว หรือยังไม่มีรูปใหม่ที่ถ่ายจากตู้ Kiosk
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                {filteredPhotos.map((photo, index) => (
                  <article
                    key={`${photo.code}-${index}`}
                    className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/40 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between group"
                  >
                    <div>
                      {/* Thumbnail Container */}
                      <div className="relative aspect-[4/3] bg-black/80 overflow-hidden">
                        <img
                          src={photo.photoUrl}
                          alt={photo.code}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded bg-black/80 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-400 backdrop-blur border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          R2 + LOCAL
                        </div>
                        <div className="absolute bottom-2.5 left-2.5 rounded bg-black/80 px-2 py-0.5 text-[10px] font-mono font-bold text-white backdrop-blur border border-white/10">
                          #{photo.code.replace('OPH-', '')}
                        </div>
                      </div>

                      {/* Card Metadata */}
                      <div className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono text-slate-300 font-bold">
                            {photo.code}
                          </span>
                          <span>
                            {new Date(photo.createdAt).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Primary Button: Re-issue QR */}
                        <button
                          onClick={() => setSelectedPhoto(photo)}
                          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#CE1126] hover:bg-[#E1132B] text-xs font-bold text-white transition-colors shadow-md cursor-pointer"
                        >
                          <QrCode className="size-4" />
                          <span>เปิด QR ให้น้องสแกน</span>
                        </button>

                        {/* Secondary Button: Push to Display */}
                        <button
                          onClick={() => handlePushToDisplay(photo)}
                          className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                            pushedCode === photo.code
                              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                              : 'border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300'
                          }`}
                        >
                          <Tv className="size-3.5 text-cyan-400" />
                          <span>
                            {pushedCode === photo.code ? 'ส่งขึ้นจอใหญ่แล้ว' : 'ส่งขึ้นจอใหญ่ (30s)'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Bottom Action Bar: Copy Link & Delete */}
                    <div className="border-t border-slate-800/80 p-2.5 grid grid-cols-2 gap-2 bg-black/40">
                      <button
                        onClick={() => copyLink(photo)}
                        className="flex h-7 items-center justify-center gap-1 rounded border border-slate-700 text-[10px] font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        {copiedCode === photo.code ? (
                          <>
                            <Check className="size-3 text-emerald-400" />
                            <span>คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="size-3 text-slate-400" />
                            <span>คัดลอกลิงก์</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeletePhoto(photo.code)}
                        className="flex h-7 items-center justify-center gap-1 rounded border border-red-500/20 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3 text-red-400" />
                        <span>ลบรูป (PDPA)</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Gallery Footer Note */}
          <div className="flex items-center justify-between border-t border-slate-800/80 px-6 py-3 text-xs text-slate-500 bg-black/40">
            <span>แสดง {filteredPhotos.length} รูปถ่ายที่พร้อมให้ผู้ร่วมงานเข้าถึง</span>
            <span className="flex items-center gap-1.5 font-mono text-emerald-400 text-[11px]">
              <ShieldCheck className="size-3.5" />
              PDPA Compliance Active • Zero Mock Rule Enforced
            </span>
          </div>
        </section>

        {/* Live Mission Audit Log (Terminal Event Ticker) */}
        <section className="craft-hud-card tactical-corner overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3 bg-black/50">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white font-mono tracking-wider">
                LIVE MISSION AUDIT LOG (EVENT BUS FEED)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              REALTIME BUS: swu_photobooth_bus
            </span>
          </div>
          <div className="p-4 max-h-48 overflow-y-auto font-mono text-xs space-y-1.5 bg-black/80">
            {auditLogs.length === 0 ? (
              <div className="text-slate-600 text-center py-4">
                ไม่มีกิจกรรมบันทึกในขณะนี้ • รอรับสัญญาณจาก Kiosk และ Display
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5">
                  <span className="text-slate-500 shrink-0">[{log.time}]</span>
                  <span
                    className={`shrink-0 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      log.type === 'STAFF'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : log.type === 'KIOSK'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : log.type === 'DISPLAY'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : log.type === 'PDPA'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {log.type}
                  </span>
                  <span
                    className={`${
                      log.variant === 'danger'
                        ? 'text-red-400'
                        : log.variant === 'warning'
                        ? 'text-amber-400'
                        : log.variant === 'success'
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Re-issue QR Code Modal (UIHut Dark Glass Aesthetic) */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0B0F17] p-7 text-center shadow-2xl space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="text-left">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <QrCode className="size-5 text-[#CE1126]" />
                  ออก QR Code ซ้ำ (Re-issue QR)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  สำหรับน้องที่สแกนไม่ทัน หรือต้องการสแกนรับรูปรอบสอง
                </p>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* High-Contrast Crisp QR Code Presentation */}
            <div className="mx-auto aspect-square w-64 rounded-2xl bg-white p-4 shadow-2xl flex items-center justify-center">
              <QRCodeSVG
                value={(() => {
                  const raw =
                    publicDomain ||
                    (typeof window !== 'undefined' ? window.location.origin : '');
                  const clean = raw.trim().replace(/\/+$/, '');
                  const base = /^https?:\/\//i.test(clean)
                    ? clean
                    : clean
                    ? `http://${clean}`
                    : '';
                  return base
                    ? `${base}/p/${encodeURIComponent(selectedPhoto.code)}`
                    : selectedPhoto.qrUrl;
                })()}
                level="H"
                bgColor="#FFFFFF"
                fgColor="#000000"
                className="h-full w-full"
              />
            </div>

            {/* Code & Direct Instructions */}
            <div className="space-y-1">
              <div className="font-mono text-2xl font-black text-[#CE1126] tracking-wider">
                #{selectedPhoto.code.replace('OPH-', '')}
              </div>
              <p className="text-xs text-slate-400">
                ให้น้องเปิดกล้องโทรศัพท์ (4G/5G) สแกน QR Code นี้เพื่อเปิดรูปและตกแต่งได้ทันที
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => copyLink(selectedPhoto)}
                className="h-10 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Link2 className="size-4 text-cyan-400" />
                <span>คัดลอกลิงก์ตรง</span>
              </button>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
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
    <StaffGate title="Staff Mission Control Center">
      <StaffAdminScreen />
    </StaffGate>
  );
}
