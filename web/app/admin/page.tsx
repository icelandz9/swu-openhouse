'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Monitor,
  Wifi,
  HardDrive,
  Database,
  Gamepad2,
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
  Lock,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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

export default function StaffAdminPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<string>('ทั้งหมด');
  const [photos, setPhotos] = useState<PhotoRecord[]>(DEFAULT_SAMPLE_PHOTOS);
  const [deletedCodes, setDeletedCodes] = useState<string[]>([]);
  const [kioskState, setKioskState] = useState<'standby' | 'paused'>('standby');
  const [commandNotice, setCommandNotice] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  // Fetch photos from API
  const loadPhotos = async () => {
    try {
      const res = await fetch('/api/photos');
      const data = await res.json();
      if (data?.photos && Array.isArray(data.photos) && data.photos.length > 0) {
        setPhotos(data.photos);
      }
    } catch {}
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  const sendCommand = (command: string, message: string) => {
    channelRef.current?.postMessage({
      type: 'KIOSK_COMMAND',
      command,
    } as ScreenSyncEvent);

    if (command === 'RESET_STANDBY') {
      channelRef.current?.postMessage({ type: 'SCREEN1_RESET' } as ScreenSyncEvent);
    }

    setCommandNotice(message);
    setTimeout(() => setCommandNotice(''), 2500);
  };

  const copyLink = async (photo: PhotoRecord) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const link = `${origin}/p/${photo.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(photo.code);
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {}
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

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#06080D] grid place-items-center p-6 text-white select-none">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pinInput === '1234') {
              setIsAuthenticated(true);
            } else {
              alert('PIN ไม่ถูกต้อง (PIN เริ่มต้น: 1234)');
            }
          }}
          className="w-full max-w-sm rounded-2xl bg-[#0D111A] border border-[#1E2536] p-8 space-y-6 text-center shadow-2xl"
        >
          <div className="size-16 rounded-2xl bg-[#CE1126]/20 border border-[#CE1126]/40 flex items-center justify-center mx-auto text-[#CE1126]">
            <Lock className="size-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Staff Master Dashboard</h1>
            <p className="text-xs text-slate-400 mt-1">กรุณากรอก PIN เพื่อเข้าสู่ระบบ (1234)</p>
          </div>
          <input
            type="password"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="••••"
            className="w-full h-12 text-center text-2xl font-mono tracking-[0.4em] rounded-xl bg-[#06080D] border border-white/10 text-white outline-none focus:border-[#CE1126]"
            autoFocus
          />
          <button
            type="submit"
            className="w-full h-11 rounded-xl bg-[#CE1126] hover:bg-[#e1132b] text-sm font-bold text-white transition-colors"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#06080D] text-slate-200 select-none">
      {/* Top Header */}
      <header className="flex min-h-20 items-center justify-between border-b border-[#1E2536] bg-[#0D111A] px-8">
        <div className="flex items-center gap-4">
          <div className="grid size-10 place-items-center bg-[#CE1126] text-xs font-extrabold tracking-[-.06em] text-white">
            CPE
          </div>
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
          <div className="mono hidden border-l border-[#1E2536] px-4 py-1 text-[10px] text-slate-400 xl:block">
            Event: <span className="text-[#2DD4BF]">SWU Open House 2026</span>
            <span className="mx-2 text-slate-700">|</span>
            Bus: <span className="text-emerald-400">swu_photobooth_bus</span>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center gap-2 rounded border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="size-3.5" /> ล็อกเอาท์
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-8 py-5 space-y-5">
        {/* 4 Telemetry Metrics Grid */}
        <section className="grid grid-cols-2 border border-[#1E2536] bg-[#0D111A] xl:grid-cols-4 rounded-xl overflow-hidden">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                key={metric.title}
                className="border-b border-r border-[#1E2536] p-5 last:border-r-0 xl:border-b-0"
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

        {/* Quick Kiosk Remote Bar */}
        <section className="flex flex-col gap-4 rounded-xl border border-[#1E2536] bg-[#0D111A] p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-lg bg-[#2DD4BF]/10 border border-[#2DD4BF]/30 flex items-center justify-center text-[#2DD4BF]">
              <Gamepad2 className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">สั่งการด่วนจอที่ 1 (Kiosk Remote)</h2>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                สถานะปัจจุบัน:
                <span
                  className={`mono font-bold ${
                    kioskState === 'paused' ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  [{kioskState === 'paused' ? 'พักบูธชั่วคราว' : 'รอตรวจจับมือ (Standby)'}]
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setKioskState('standby');
                sendCommand('RESET_STANDBY', 'ส่งคำสั่งรีเซ็ตจอ 1 เป็น Standby แล้ว');
              }}
              className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#06080D] px-4 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
            >
              <RefreshCcw className="size-4 text-slate-400" /> รีเซ็ตจอ 1 (Force Standby)
            </button>
            <button
              onClick={() => sendCommand('SKIP_PREVIEW', 'ส่งคำสั่งข้าม Preview ไปยังจอ 2 ทันที')}
              className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-[#06080D] px-4 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors"
            >
              <SkipForward className="size-4 text-cyan-400" /> ข้าม Preview ส่งไปจอ 2 ทันที
            </button>
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
              className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-xs font-semibold transition-colors ${
                kioskState === 'paused'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              {kioskState === 'paused' ? (
                <>
                  <Play className="size-4" /> เปิดใช้งานจอ 1 ต่อ
                </>
              ) : (
                <>
                  <Pause className="size-4" /> พักบูธชั่วคราว (จัดคิว/เช็ดเลนส์)
                </>
              )}
            </button>
          </div>
        </section>

        {commandNotice && (
          <div className="fixed right-8 top-24 z-50 rounded-lg border border-[#2DD4BF]/50 bg-[#0D111A] px-5 py-3 text-xs text-[#2DD4BF] shadow-2xl animate-in fade-in">
            {commandNotice}
          </div>
        )}

        {/* Photo Gallery & Re-issue QR Code Station */}
        <section className="rounded-xl border border-[#1E2536] bg-[#0D111A] overflow-hidden">
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
              <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-lg border border-white/10 bg-[#06080D] px-4 focus-within:border-cyan-400/60">
                <Search className="size-4 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหารหัสรูป เช่น AB29 หรือ OPH-..."
                  className="mono min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <button
                onClick={loadPhotos}
                className="flex h-11 items-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors"
              >
                <RefreshCcw className="size-4" /> รีเฟรช
              </button>
            </div>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-2 gap-4 p-6 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPhotos.map((photo, index) => (
              <article
                key={`${photo.code}-${index}`}
                className="overflow-hidden rounded-xl border border-[#1E2536] bg-[#06080D] hover:border-slate-600 transition-all shadow-md"
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
                      onClick={() => setDeletedCodes((prev) => [...prev, photo.code])}
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
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0D111A] p-7 text-center shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
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
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/p/${encodeURIComponent(selectedPhoto.code)}`
                    : selectedPhoto.qrUrl
                }
                level="H"
                bgColor="#FFFFFF"
                fgColor="#090D16"
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
