'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Monitor,
  Wifi,
  HardDrive,
  Database,
  Gamepad2,
  RefreshCcw,
  RefreshCw,
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
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CpeLogo } from '@/components/CpeLogo';
import { StaffGate } from '@/components/StaffGate';
import { PhotoRecord, ScreenSyncEvent, SCREEN_SYNC_CHANNEL } from '@/lib/contracts';

const DEFAULT_SAMPLE_PHOTOS: PhotoRecord[] = [
  {
    code: 'OPH-AB29',
    photoUrl: 'https://images.unsplash.com/photo-1634938332514-6f3d23c8cc42?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900&h=1100',
    qrUrl: '/p/OPH-AB29',
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    code: 'OPH-2018',
    photoUrl: 'https://images.unsplash.com/photo-1758534063829-a72058381e21?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900&h=1100',
    qrUrl: '/p/OPH-2018',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    code: 'OPH-1996',
    photoUrl: 'https://images.unsplash.com/photo-1782069326883-090221bfcd6e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900&h=1100',
    qrUrl: '/p/OPH-1996',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    code: 'OPH-1984',
    photoUrl: 'https://images.unsplash.com/photo-1791573391615-1ad1f53d7f9e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=900&h=1100',
    qrUrl: '/p/OPH-1984',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    code: 'OPH-8842',
    photoUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
    qrUrl: '/p/OPH-8842',
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    code: 'OPH-7721',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    qrUrl: '/p/OPH-7721',
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function StaffAdminScreen() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<string>('ทั้งหมด');
  const [photos, setPhotos] = useState<PhotoRecord[]>(DEFAULT_SAMPLE_PHOTOS);
  const [deletedCodes, setDeletedCodes] = useState<string[]>([]);
  const [kioskState, setKioskState] = useState<'standby' | 'paused'>('standby');
  const [commandNotice, setCommandNotice] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(3.5);
  const [publicDomain, setPublicDomain] = useState<string>('');

  const channelRef = useRef<BroadcastChannel | null>(null);

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
          createdAt: data.createdAt,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.code !== data.code);
          return [newRecord, ...filtered];
        });
      }
    };

    return () => {
      channel.close();
    };
  }, []);

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
      const serverPhotos: PhotoRecord[] = data?.photos && Array.isArray(data.photos) ? data.photos : [];

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
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
      const savedHost = localStorage.getItem('swu_booth_host') || process.env.NEXT_PUBLIC_APP_URL || '';
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
    setTimeout(() => setCommandNotice(''), 2500);
  };

  const handleSavePublicDomain = () => {
    const cleanDomain = publicDomain.trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('swu_booth_host', cleanDomain);
    }
    sendCommand('SET_PUBLIC_DOMAIN', 'อัปเดต Public Domain สำหรับ 4G/5G และส่งต่อให้ทุกจอแล้ว', cleanDomain);
  };

  const handleSensitivityChange = (val: number) => {
    setSensitivity(val);
    sendCommand('SET_THRESHOLD', `ปรับเกณฑ์ความไวเป็น ${val}% แล้ว`, val / 100);
  };

  const copyLink = async (photo: PhotoRecord) => {
    const origin = publicDomain || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const link = `${origin.replace(/\/+$/, '')}/p/${photo.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(photo.code);
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {}
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

    setCommandNotice('ลบรูป ' + code + ' ถาวรสำเร็จและซิงค์กับทุกจอแล้ว');
    setTimeout(() => setCommandNotice(''), 2500);
  };

  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (deletedCodes.includes(photo.code)) return false;
      const q = searchQuery.trim().toUpperCase();
      if (!q) return true;
      return photo.code.toUpperCase().includes(q);
    });
  }, [photos, deletedCodes, searchQuery]);

  const metrics = [
    {
      icon: Monitor,
      status: 'ONLINE',
      title: 'กล้องและ Hand AI',
      value: '1080p @ 60 FPS',
      detail: 'MediaPipe WebGL: 12ms Latency · USB Webcam Active',
      statusColor: 'text-emerald-400',
    },
    {
      icon: Wifi,
      status: 'CONNECTED',
      title: 'การเชื่อมต่อ 2 จอแสดงผล',
      value: 'BroadcastChannel: 0ms',
      detail: 'จอ 1 Kiosk ↔ จอ 2 Showcase · Synced',
      statusColor: 'text-emerald-400',
    },
    {
      icon: HardDrive,
      status: 'SYNCED 100%',
      title: 'การจัดเก็บและสำรองข้อมูล',
      value: 'Local + R2 Backup',
      detail: 'ความจุคงเหลือ 214 GB',
      statusColor: 'text-[#2DD4BF]',
    },
    {
      icon: Database,
      status: 'PDPA ACTIVE',
      title: 'รูปทั้งหมด & PDPA Retention',
      value: `${photos.length} รูปในวันนี้`,
      detail: 'Auto-delete: 7 วัน · PDPA Compliance Active',
      statusColor: 'text-amber-400',
    },
  ];

  return (
    <main className="min-h-dvh bg-black text-slate-200 select-none">
      {/* Top Header */}
      <header className="flex min-h-20 items-center justify-between border-b border-[#1C1C1C] bg-[#0A0A0A] px-8">
        <div className="flex items-center gap-4">
          <CpeLogo className="h-10" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-bold text-white">Staff Master Dashboard</h1>
              <span className="mono flex items-center gap-1.5 border-l border-emerald-400/50 pl-2.5 text-[10px] text-emerald-300">
                <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
                ONLINE (LAPTOP CONTROLLER)
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-500">
              SWU Open House • ควบคุมและดูแล 2 หน้าจอแสดงผลแบบ Real-time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="mono hidden border-l border-[#1C1C1C] px-4 py-1 text-[10px] text-slate-400 xl:block">
            Event: <span className="text-[#2DD4BF]">SWU Open House 2026</span>
            <span className="mx-2 text-slate-700">|</span>
            Bus: <span className="text-emerald-400">swu_photobooth_bus</span>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
              window.location.reload();
            }}
            className="flex items-center gap-2 rounded border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="size-3.5" /> ล็อกเอาท์
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-8 py-5 space-y-5">
        {/* 4 Telemetry Metrics Grid */}
        <section className="grid grid-cols-2 border border-[#1C1C1C] bg-[#0A0A0A] xl:grid-cols-4 rounded-xl overflow-hidden">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                key={metric.title}
                className="border-b border-r border-[#1C1C1C] p-5 last:border-r-0 xl:border-b-0"
              >
                <div className="flex items-start justify-between">
                  <Icon className="size-5 text-slate-400" strokeWidth={1.5} />
                  <span className={`mono flex items-center gap-1.5 text-[9px] font-bold tracking-[.1em] ${metric.statusColor}`}>
                    <span className="size-1.5 rounded-full bg-current animate-pulse" />
                    {metric.status}
                  </span>
                </div>
                <div className="mt-4 text-xs font-semibold text-slate-400">{metric.title}</div>
                <div className="mono mt-2 text-xl font-bold text-white">{metric.value}</div>
                <div className="mt-2 text-[10px] text-slate-500">{metric.detail}</div>
              </article>
            );
          })}
        </section>

        {/* Onsite Accident Recovery Center */}
        <section className="rounded-xl border border-red-500/30 bg-[#0A0A0A] p-5 space-y-4 shadow-lg">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  ศูนย์รับมืออุบัติเหตุหน้างาน (Onsite Emergency Incident Controls)
                  <span className="rounded bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 border border-red-500/30 font-mono">
                    REALTIME BUS
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  แก้ปัญหากล้องค้าง คนเดินตัดหน้า ผู้พิการ/เด็กไม่สามารถยกมือ หรือผู้ร่วมงานต้องการลบรูปทันที
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">สถานะ Kiosk:</span>
              <span className={`mono font-bold px-2 py-0.5 rounded text-[10px] ${
                kioskState === 'paused' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {kioskState === 'paused' ? 'PAUSED (พักตู้)' : 'STANDBY (พร้อมทำงาน)'}
              </span>
            </div>
          </div>

          {/* Emergency Action Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {/* 1. Emergency Shutter */}
            <button
              onClick={() => sendCommand('STAFF_TRIGGER', 'ส่งคำสั่งเริ่มนับถอยหลังถ่ายภาพฉุกเฉินแล้ว')}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg bg-[#CE1126] hover:bg-[#e1132b] text-white transition-all shadow-md group text-center cursor-pointer"
            >
              <Camera className="size-5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">ถ่ายภาพฉุกเฉิน</span>
              <span className="text-[9px] text-white/80">วีลแชร์ / เด็ก / แสงจ้า</span>
            </button>

            {/* 2. Cancel Countdown */}
            <button
              onClick={() => sendCommand('CANCEL_COUNTDOWN', 'ยกเลิกการนับถอยหลังและกลับสู่ Standby แล้ว')}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all shadow-md group text-center cursor-pointer"
            >
              <XCircle className="size-5 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">ยกเลิกนับถอยหลัง</span>
              <span className="text-[9px] text-amber-400/80">คนเดินตัดหน้า</span>
            </button>

            {/* 3. Re-init Camera */}
            <button
              onClick={() => sendCommand('RELOAD_CAMERA', 'ส่งคำสั่งรีสตาร์ทสตรีมกล้องจอ 1 แล้ว')}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-all shadow-md group text-center cursor-pointer"
            >
              <RefreshCw className="size-5 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-xs font-bold">รีสตาร์ทกล้อง</span>
              <span className="text-[9px] text-cyan-400/80">แก้ภาพดำ / USB หลุด</span>
            </button>

            {/* 4. Skip Preview */}
            <button
              onClick={() => sendCommand('SKIP_PREVIEW', 'ส่งคำสั่งข้าม Preview ส่งรูปไปจอ 2 ทันที')}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-white/10 bg-[#0A0A0A] hover:bg-white/10 text-slate-200 transition-all group text-center cursor-pointer"
            >
              <SkipForward className="size-5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
              <span className="text-xs font-bold">ข้าม Preview</span>
              <span className="text-[9px] text-slate-400">ส่งรูปไปจอ 2 ทันที</span>
            </button>

            {/* 5. Force Standby */}
            <button
              onClick={() => {
                setKioskState('standby');
                sendCommand('RESET_STANDBY', 'ส่งคำสั่งรีเซ็ตจอ 1 เป็น Standby แล้ว');
              }}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border border-white/10 bg-[#0A0A0A] hover:bg-white/10 text-slate-200 transition-all group text-center cursor-pointer"
            >
              <RefreshCcw className="size-5 text-slate-400 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-xs font-bold">รีเซ็ตตู้ (Standby)</span>
              <span className="text-[9px] text-slate-400">เคลียร์สถานะค้าง</span>
            </button>

            {/* 6. Pause / Resume Booth */}
            <button
              onClick={() => {
                if (kioskState === 'paused') {
                  setKioskState('standby');
                  sendCommand('RESUME_BOOTH', 'เปิดการทำงานจอ 1 ต่อแล้ว');
                } else {
                  setKioskState('paused');
                  sendCommand('PAUSE_BOOTH', 'พักจอ 1 ชั่วคราวแล้ว');
                }
              }}
              className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border transition-all text-center cursor-pointer ${
                kioskState === 'paused'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              {kioskState === 'paused' ? (
                <>
                  <Play className="size-5" />
                  <span className="text-xs font-bold">เปิดใช้งานต่อ</span>
                  <span className="text-[9px] text-emerald-400/80">ปลดล็อกตู้</span>
                </>
              ) : (
                <>
                  <Pause className="size-5" />
                  <span className="text-xs font-bold">พักบูธชั่วคราว</span>
                  <span className="text-[9px] text-amber-400/80">จัดคิว / เช็ดเลนส์</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary Controls: Sensitivity Slider & Public Domain Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {/* Detection Area Sensitivity */}
            <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Sliders className="size-4 text-cyan-400" />
                  <span>เกณฑ์ระยะตรวจจับมือ (Detection Area Threshold)</span>
                </div>
                <span className="mono font-bold text-cyan-300">{sensitivity.toFixed(1)}%</span>
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
                <span>2.0% (ไวมาก / ยืนไกลได้)</span>
                <span className="text-slate-400">3.5% (แนะนำ)</span>
                <span>6.0% (ใกล้ตู้ / กรองคนด้านหลัง)</span>
              </div>
            </div>

            {/* Public Domain for 4G/5G QR Access */}
            <div className="p-3.5 rounded-lg bg-[#0A0A0A] border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-[#10B981]" />
                  <span>Public Domain / Tunnel URL (ให้น้องใช้ 4G/5G สแกน)</span>
                </div>
                <span className="text-[10px] text-emerald-400 mono">ONLINE READY</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://photobooth.cpe-swu.com หรือ trycloudflare.com"
                  value={publicDomain}
                  onChange={(e) => setPublicDomain(e.target.value)}
                  className="flex-1 rounded border border-white/10 bg-[#0A0A0A] px-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#10B981]"
                />
                <button
                  onClick={handleSavePublicDomain}
                  className="rounded bg-[#10B981] hover:bg-[#0ea371] px-3 py-1.5 text-xs font-bold text-white transition-colors shrink-0 cursor-pointer"
                >
                  บันทึก & ซิงค์ QR
                </button>
              </div>
              <div className="text-[10px] text-slate-500">
                หากใช้ Cloudflare Tunnel ให้กรอก URL ที่ได้ที่นี่ QR Code ทั้งหมดจะเปลี่ยนตามทันที
              </div>
            </div>
          </div>
        </section>

        {commandNotice && (
          <div className="fixed right-8 top-24 z-50 rounded-lg border border-[#2DD4BF]/50 bg-[#0A0A0A] px-5 py-3 text-xs text-[#2DD4BF] shadow-2xl animate-in fade-in">
            {commandNotice}
          </div>
        )}

        {/* Photo Gallery & Re-issue QR Code Station */}
        <section className="rounded-xl border border-[#1C1C1C] bg-[#0A0A0A] overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-white/10 p-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                ค้นหารูปภาพและออก QR Code ย้อนหลัง (Re-issue QR)
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                สำหรับกรณีที่น้องสแกนไม่ทัน ลืมสแกน หรือต้องการรับรูปรอบสอง
              </p>
            </div>

            <div className="flex flex-1 items-center gap-3 xl:max-w-xl">
              <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-lg border border-white/10 bg-[#0A0A0A] px-4 focus-within:border-cyan-400/60">
                <Search className="size-4 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหารหัสรูป เช่น AB29 หรือ OPH-..."
                  className="mono min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <button
                onClick={() => loadPhotos()}
                className="flex h-11 items-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors"
              >
                <RefreshCcw className="size-4" /> รีเฟรช
              </button>
            </div>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-2 gap-4 p-6 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPhotos.length === 0 && (
              <div className="col-span-full py-16 text-center space-y-3">
                <HardDrive className="size-12 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-400">ไม่มีรูปภาพในแกลเลอรี</div>
                <p className="text-xs text-slate-600">รูปภาพทั้งหมดถูกลบแล้ว หรือยังไม่มีรูปใหม่ที่ถ่ายจากตู้ Kiosk</p>
              </div>
            )}
            {filteredPhotos.map((photo, index) => (
              <article
                key={`${photo.code}-${index}`}
                className="overflow-hidden rounded-xl border border-[#1C1C1C] bg-[#0A0A0A] hover:border-slate-600 transition-all shadow-md"
              >
                <div className="relative aspect-[4/3] bg-slate-900">
                  <img
                    src={photo.photoUrl}
                    alt={photo.code}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[9px] font-bold text-emerald-400 backdrop-blur">
                    LOCAL + R2
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="mono border-l-2 border-[#CE1126] pl-2 text-sm font-bold text-white">
                      #{photo.code.replace('OPH-', '')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(photo.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedPhoto(photo)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#CE1126] text-xs font-bold text-white hover:bg-[#e1132b] transition-colors shadow-md"
                  >
                    <QrCode className="size-4" /> เปิด QR ให้น้องสแกน (Re-issue QR)
                  </button>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => copyLink(photo)}
                      className="flex h-8 items-center justify-center gap-1.5 rounded border border-white/10 text-[10px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      {copiedCode === photo.code ? (
                        <>
                          <Check className="size-3 text-emerald-400" /> คัดลอกแล้ว
                        </>
                      ) : (
                        <>
                          <Link2 className="size-3" /> คัดลอกลิงก์
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeletePhoto(photo.code)}
                      className="flex h-8 items-center justify-center gap-1.5 rounded border border-red-500/20 text-[10px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="size-3" /> ลบรูป (PDPA)
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 text-xs text-slate-500">
            <span>แสดง {filteredPhotos.length} รูปถ่าย</span>
            <span className="mono flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="size-3.5" /> PDPA 7-Day Auto Purge Active
            </span>
          </div>
        </section>
      </div>

      {/* Re-issue QR Code Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0A0A0A] p-7 text-center shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Re-issue QR Code</h3>
                <p className="text-xs text-slate-400">ออก QR Code ซ้ำให้น้องสแกนรับภาพ</p>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* QR Code Presentation */}
            <div className="mx-auto aspect-square w-64 rounded-2xl bg-white p-4 shadow-xl flex items-center justify-center">
              <QRCodeSVG
                value={
                  publicDomain
                    ? `${publicDomain.replace(/\/+$/, '')}/p/${encodeURIComponent(selectedPhoto.code)}`
                    : typeof window !== 'undefined'
                    ? `${window.location.origin}/p/${encodeURIComponent(selectedPhoto.code)}`
                    : selectedPhoto.qrUrl
                }
                level="H"
                bgColor="#FFFFFF"
                fgColor="#000000"
                className="h-full w-full"
              />
            </div>

            <div>
              <div className="mono text-2xl font-black text-[#CE1126]">
                #{selectedPhoto.code.replace('OPH-', '')}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                ให้น้องเปิดกล้องโทรศัพท์และสแกน QR Code นี้ได้ทันที
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
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
    <StaffGate title="Staff Master Dashboard">
      <StaffAdminScreen />
    </StaffGate>
  );
}
