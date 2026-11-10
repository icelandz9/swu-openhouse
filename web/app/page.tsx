'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera,
  Monitor,
  Sliders,
  Smartphone,
  ArrowUpRight,
  Sun,
  Moon,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { CpeLogo } from '@/components/CpeLogo';
import { SCREEN_SYNC_CHANNEL, ScreenSyncEvent } from '@/lib/contracts';

interface LaunchModule {
  id: string;
  hotkey: string;
  route: string;
  badge: string;
  badgeColor: string;
  title: string;
  desc: string;
  tag: string;
  icon: React.ReactNode;
  ctaText: string;
}

export default function MasterHub() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [kioskOnline, setKioskOnline] = useState<boolean>(false);
  const [displayOnline, setDisplayOnline] = useState<boolean>(false);
  const [isNetOnline, setIsNetOnline] = useState<boolean>(true);
  const lastKioskPongRef = useRef<number>(0);
  const lastDisplayPongRef = useRef<number>(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Sync theme with admin preference and URL param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const themeParam = urlParams.get('theme') as 'dark' | 'light';
      if (themeParam === 'light' || themeParam === 'dark') {
        setTheme(themeParam);
      } else {
        const saved = localStorage.getItem('swu_admin_theme') as 'dark' | 'light';
        if (saved === 'light' || saved === 'dark') {
          setTheme(saved);
        }
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

  // Heartbeat monitoring (In-memory zero overhead)
  useEffect(() => {
    const channel = new BroadcastChannel(SCREEN_SYNC_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<ScreenSyncEvent>) => {
      const data = event.data;
      if (!data) return;
      if (data.type === 'HEARTBEAT_PONG') {
        const now = Date.now();
        if (data.sender === 'KIOSK') {
          lastKioskPongRef.current = now;
          setKioskOnline(true);
        } else if (data.sender === 'DISPLAY') {
          lastDisplayPongRef.current = now;
          setDisplayOnline(true);
        }
      }
    };

    const sendPing = () => {
      channel.postMessage({
        type: 'HEARTBEAT_PING',
        sender: 'ADMIN',
        timestamp: Date.now(),
      } as ScreenSyncEvent);

      const now = Date.now();
      if (lastKioskPongRef.current > 0 && now - lastKioskPongRef.current > 8000) {
        setKioskOnline(false);
      }
      if (lastDisplayPongRef.current > 0 && now - lastDisplayPongRef.current > 8000) {
        setDisplayOnline(false);
      }
    };

    sendPing();
    const interval = setInterval(sendPing, 3000);
    return () => {
      clearInterval(interval);
      channel.close();
    };
  }, []);

  // Network listener
  useEffect(() => {
    const onOnline = () => setIsNetOnline(true);
    const onOffline = () => setIsNetOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Physical Keyboard shortcut routing [1-4]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const routes: Record<string, string> = {
          '1': '/kiosk',
          '2': '/display',
          '3': '/admin',
          '4': '/p/demo-code',
        };
        window.open(routes[e.key], '_blank');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isDark = theme === 'dark';
  const themeClasses = {
    bg: isDark ? 'bg-[#0B0F19]' : 'bg-[#F8FAFC]',
    textTitle: isDark ? 'text-slate-100' : 'text-slate-900',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-600',
    headerBg: isDark ? 'bg-[#0B0F19]/90 border-slate-800/80' : 'bg-white/90 border-slate-200/90',
    cardBg: isDark ? 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700' : 'bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-xs',
    statusBg: isDark ? 'bg-[#121824] border-slate-800/80 text-slate-400' : 'bg-white border-slate-200/90 text-slate-600 shadow-xs',
  };

  const modules: LaunchModule[] = [
    {
      id: 'kiosk',
      hotkey: '1',
      route: '/kiosk',
      badge: 'SCREEN 1',
      badgeColor: isDark ? 'bg-[#CE1126]/15 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-200',
      title: 'ตู้ถ่ายรูปไร้สัมผัส',
      desc: 'ระบบถ่ายภาพอัตโนมัติด้วย AI แบมือ ตรวจจับโครงกระดูกมือ 60 FPS และส่งภาพขึ้นจอใหญ่',
      tag: 'Touchless MediaPipe AI',
      icon: <Camera className="w-5 h-5 text-rose-500" />,
      ctaText: 'เปิดตู้ถ่ายรูป',
    },
    {
      id: 'display',
      hotkey: '2',
      route: '/display',
      badge: 'SCREEN 2',
      badgeColor: isDark ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200',
      title: 'จอแสดงผล & QR Code',
      desc: 'ฉาย Spotlight รูปถ่ายความละเอียดสูง 30 วินาที พร้อม Dynamic QR Code สำหรับดาวน์โหลด',
      tag: 'Dual Fleet Showcase',
      icon: <Monitor className="w-5 h-5 text-cyan-500" />,
      ctaText: 'เปิดจอแสดงผล',
    },
    {
      id: 'admin',
      hotkey: '3',
      route: '/admin',
      badge: 'STAFF ONLY',
      badgeColor: isDark ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      title: 'แดชบอร์ดสตาฟ',
      desc: 'ศูนย์ควบคุมกลาง กราฟสถิติสด มอนิเตอร์ฮาร์ดแวร์ คำสั่งฉุกเฉิน และจัดการข้อมูลตาม PDPA',
      tag: 'Mission Control Suite',
      icon: <Sliders className="w-5 h-5 text-emerald-500" />,
      ctaText: 'เปิดแดชบอร์ด',
    },
    {
      id: 'mobile',
      hotkey: '4',
      route: '/p/[code]',
      badge: 'MOBILE 4G/5G',
      badgeColor: isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200',
      title: 'เว็บแต่งรูปบนมือถือ',
      desc: 'หน้าจอบนสมาร์ทโฟนของน้อง ใส่กรอบ มศว ปรับแต่งโทนสี 6 สไตล์ และแปะสติกเกอร์วิศวะ',
      tag: 'Attendee Canvas Editor',
      icon: <Smartphone className="w-5 h-5 text-amber-500" />,
      ctaText: 'ทดสอบเว็บบนมือถือ',
    },
  ];

  return (
    <div className={`min-h-screen ${themeClasses.bg} ${themeClasses.textTitle} flex flex-col justify-between font-['Prompt'] transition-colors duration-200`}>
      {/* Top Header (Clean, quiet, matching Admin) */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md ${themeClasses.headerBg}`}>
        <div className="mx-auto max-w-[1600px] px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center py-1 px-1.5 rounded-lg transition-colors ${!isDark ? 'bg-slate-900 shadow-xs' : ''}`}>
              <CpeLogo className="h-8" />
            </div>
            <div className="border-l border-slate-700/50 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-['Kanit'] font-bold text-base tracking-tight">PhotoBooth</span>
                <span className="rounded bg-rose-500/10 text-rose-500 text-[10px] font-mono px-1.5 py-0.5 font-bold">
                  LAUNCHPAD
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                SWU Open House 2026
              </div>
            </div>
          </div>

          {/* Right Actions: Hardware Pill & Theme Toggle */}
          <div className="flex items-center gap-3">
            {/* Live Fleet Badge */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}>
              <span className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${kioskOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                <span className={kioskOnline ? 'text-emerald-500 font-bold' : 'text-slate-500'}>
                  {kioskOnline ? 'KIOSK ONLINE' : 'KIOSK IDLE'}
                </span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${displayOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                <span className={displayOnline ? 'text-emerald-500 font-bold' : 'text-slate-500'}>
                  {displayOnline ? 'SHOWCASE SYNCED' : 'SHOWCASE IDLE'}
                </span>
              </span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-xs'
              }`}
              title="สลับธีม สว่าง / มืด"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-[1600px] w-full px-6 py-8 flex-1 flex flex-col justify-center space-y-7">
        {/* Status Strip (Matching Admin glanceable aesthetic) */}
        <section
          className={`rounded-2xl border px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono ${themeClasses.statusBg}`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${kioskOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
              {kioskOnline ? 'กล้อง 60 FPS' : 'กล้องสแตนด์บาย'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${displayOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
              {displayOnline ? 'ซิงค์ &lt; 1ms' : 'รอจอ Showcase'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${isNetOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              เน็ต {isNetOnline ? '5GHz OK' : 'ออฟไลน์'}
            </span>
            <span className="text-slate-600">•</span>
            <span>BroadcastChannel IPC</span>
          </div>
          <div className="text-[11px] text-slate-500 hidden md:block">
            กดปุ่ม [1] [2] [3] [4] เพื่อเปิดหน้าต่างทันที
          </div>
        </section>

        {/* Hero Title */}
        <div className="space-y-2 text-left">
          <div className="text-[11px] font-mono tracking-widest uppercase text-slate-500 font-bold">
            Department of Computer Engineering • Srinakharinwirot University
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-['Kanit'] tracking-tight">
            ศูนย์ควบคุมระบบ PhotoBooth
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            เปิดหน้าต่างควบคุม 2 จอแสดงผลแบบไร้สัมผัส เชื่อมโยงข้อมูลผ่าน Local IPC ตอบสนองทันทีโดยไม่ต้องผ่านเซิร์ฟเวอร์ภายนอก
          </p>
        </div>

        {/* Bento Grid: 4 Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((m) => (
            <div
              key={m.id}
              onClick={() => {
                const target = m.id === 'mobile' ? '/p/demo-code' : m.route;
                window.open(target, '_blank');
              }}
              className={`group rounded-2xl border p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer ${themeClasses.cardBg}`}
            >
              <div className="space-y-4">
                {/* Card Top: Icon & Hotkey Pill */}
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    {m.icon}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className={`px-2 py-0.5 rounded-md border font-bold ${
                      isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      [{m.hotkey}]
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border font-bold ${m.badgeColor}`}>
                      {m.badge}
                    </span>
                  </div>
                </div>

                {/* Card Details */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono text-slate-500">
                    {m.route}
                  </div>
                  <h3 className="text-base font-bold font-['Kanit'] group-hover:text-rose-500 transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed min-h-[48px]">
                    {m.desc}
                  </p>
                </div>
              </div>

              {/* Card Footer: Subtle Tag & Crisp Button */}
              <div className="pt-4 border-t border-slate-800/40 mt-4 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">
                  {m.tag}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500 group-hover:translate-x-0.5 transition-transform">
                  <span>{m.ctaText}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer Info (Matching Admin clean bottom) */}
      <footer className={`border-t py-4 px-6 text-xs font-mono ${
        isDark ? 'border-slate-800/80 text-slate-500' : 'border-slate-200 text-slate-600'
      }`}>
        <div className="mx-auto max-w-[1600px] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>Department of Computer Engineering, Srinakharinwirot University</div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Shortcuts: Press [1] [2] [3] [4] to launch</span>
            <span className="px-2 py-0.5 rounded border border-slate-800/60 text-[10px] text-slate-400">
              v2.6-Production
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
