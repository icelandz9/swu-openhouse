'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Monitor,
  Sliders,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CpeLogo } from '@/components/CpeLogo';

interface ModuleCardProps {
  id: string;
  hotkey: string;
  route: string;
  badge: string;
  title: string;
  icon: React.ReactNode;
  accentColor: 'red' | 'cyan' | 'blue' | 'amber';
  specs: string[];
  ctaText: string;
  onLaunch: () => void;
}

const ACCENT_STYLES = {
  red: {
    badgeBg: 'bg-red-500/10 text-red-400 border-red-500/30',
    iconBg: 'bg-red-500/10 text-red-500 border-red-500/20',
    hoverBorder: 'hover:border-red-500/50',
    glow: 'group-hover:shadow-[0_0_35px_rgba(229,9,20,0.22)]',
    ctaText: 'text-red-400 group-hover:text-red-300',
    ctaBg: 'bg-red-500/10 group-hover:bg-red-500/20',
  },
  cyan: {
    badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    hoverBorder: 'hover:border-cyan-500/50',
    glow: 'group-hover:shadow-[0_0_35px_rgba(0,242,254,0.22)]',
    ctaText: 'text-cyan-400 group-hover:text-cyan-300',
    ctaBg: 'bg-cyan-500/10 group-hover:bg-cyan-500/20',
  },
  blue: {
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    hoverBorder: 'hover:border-blue-500/50',
    glow: 'group-hover:shadow-[0_0_35px_rgba(59,130,246,0.22)]',
    ctaText: 'text-blue-400 group-hover:text-blue-300',
    ctaBg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
  },
  amber: {
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    hoverBorder: 'hover:border-amber-500/50',
    glow: 'group-hover:shadow-[0_0_35px_rgba(245,158,11,0.22)]',
    ctaText: 'text-amber-400 group-hover:text-amber-300',
    ctaBg: 'bg-amber-500/10 group-hover:bg-amber-500/20',
  },
};

export default function MasterHub() {
  // Physical Keyboard shortcut routing [1-4]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid firing when typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
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

  return (
    <div className="relative min-h-screen bg-[#07080B] text-slate-100 flex flex-col justify-between overflow-hidden font-['Prompt'] select-none">
      {/* Engineering Background Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-red-600/10 blur-[140px] pointer-events-none rounded-full" />

      {/* Top Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-3.5">
          <CpeLogo className="h-10" />
          <div className="border-l border-white/10 pl-3.5">
            <div className="text-[10px] font-['JetBrains_Mono'] tracking-widest text-slate-400 uppercase font-semibold">
              SRINAKHARINWIROT UNIVERSITY • FACULTY OF ENGINEERING
            </div>
            <div className="text-sm font-semibold tracking-wide text-white">
              CPE PhotoBooth <span className="text-[#E50914]">•</span> Open House 2026
            </div>
          </div>
        </div>

        {/* Live Hardware Telemetry Pill */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-['JetBrains_Mono'] font-medium backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>SYSTEM READY</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-300">DUAL-SCREEN SYNCED</span>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-cyan-400 text-xs font-['JetBrains_Mono'] mb-4 tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            TOUCHLESS AI VISION CONTROL SUITE
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-['Kanit'] bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            CPE Central Mission Launchpad
          </h1>
          <p className="mt-3 text-sm md:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
            1 Laptop ควบคุม 2 จอแสดงผลแบบไร้สัมผัส เชื่อมต่อ Real-time Inter-window ผ่าน{' '}
            <code className="text-slate-200 bg-white/5 px-2 py-0.5 rounded font-['JetBrains_Mono'] text-xs border border-white/10">
              BroadcastChannel API
            </code>
          </p>
        </div>

        {/* Bento Grid: 4 Target Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <ModuleCard
            id="kiosk"
            hotkey="1"
            route="/kiosk"
            badge="DISPLAY 1"
            title="ตู้ถ่ายรูปไร้สัมผัส"
            icon={<Camera className="w-5 h-5" />}
            accentColor="red"
            specs={[
              'สัดส่วน 16:9 ไกด์ 4:3',
              'AI Gesture แบมือ 1.5s',
              'Flash 150ms + Preview 10s',
            ]}
            ctaText="เปิดหน้าตู้ถ่ายรูป"
            onLaunch={() => window.open('/kiosk', '_blank')}
          />
          <ModuleCard
            id="display"
            hotkey="2"
            route="/display"
            badge="DISPLAY 2"
            title="Showcase & QR"
            icon={<Monitor className="w-5 h-5" />}
            accentColor="cyan"
            specs={[
              'สัดส่วนแบ่ง 30:70',
              'ซ้าย: Dynamic QR Code',
              'ขวา: Live Photo Wall',
            ]}
            ctaText="เปิดหน้า Showcase"
            onLaunch={() => window.open('/display', '_blank')}
          />
          <ModuleCard
            id="admin"
            hotkey="3"
            route="/admin"
            badge="STAFF CONSOLE"
            title="แดชบอร์ดสตาฟ"
            icon={<Sliders className="w-5 h-5" />}
            accentColor="blue"
            specs={[
              'PIN Gate Security (1234)',
              'ลบรูปตาม PDPA 1-Click',
              'Kiosk Emergency Reset',
            ]}
            ctaText="เปิดแดชบอร์ดสตาฟ"
            onLaunch={() => window.open('/admin', '_blank')}
          />
          <ModuleCard
            id="mobile"
            hotkey="4"
            route="/p/[code]"
            badge="MOBILE WEB"
            title="เว็บดาวน์โหลด & แต่งรูป"
            icon={<Smartphone className="w-5 h-5" />}
            accentColor="amber"
            specs={[
              'Canvas Editor 4G/5G',
              '6 Presets + สติกเกอร์วิศวะ',
              'บันทึกลง Camera Roll ทันที',
            ]}
            ctaText="ทดสอบเว็บบนมือถือ"
            onLaunch={() => window.open('/p/demo-code', '_blank')}
          />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-white/[0.06] font-['JetBrains_Mono']">
        <div>Department of Computer Engineering, Srinakharinwirot University</div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline">Shortcuts: Press [1] [2] [3] [4] to open directly</span>
          <span className="rounded bg-white/5 px-2 py-0.5 border border-white/10 text-slate-400">
            v2.6-Production
          </span>
        </div>
      </footer>
    </div>
  );
}

function ModuleCard({
  hotkey,
  route,
  badge,
  title,
  icon,
  accentColor,
  specs,
  ctaText,
  onLaunch,
}: ModuleCardProps) {
  const styles = ACCENT_STYLES[accentColor];

  return (
    <div
      onClick={onLaunch}
      className={`group relative flex flex-col justify-between p-5 rounded-2xl bg-[#0E1017]/90 border border-white/[0.08] backdrop-blur-md transition-all duration-300 hover:scale-[1.018] cursor-pointer ${styles.hoverBorder} ${styles.glow}`}
    >
      <div>
        {/* Card Header: Icon & Hotkey Pill */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-transform duration-300 group-hover:scale-110 ${styles.iconBg}`}
          >
            {icon}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 group-hover:border-white/25">
              Key [{hotkey}]
            </span>
            <span
              className={`text-[10px] font-bold font-['JetBrains_Mono'] px-2 py-0.5 rounded-full border tracking-wide uppercase ${styles.badgeBg}`}
            >
              {badge}
            </span>
          </div>
        </div>

        {/* Route & Title */}
        <div className="font-['JetBrains_Mono'] text-xs text-slate-500 mb-1">
          {route}
        </div>
        <h3 className="text-lg font-bold font-['Kanit'] text-white group-hover:text-slate-100 transition-colors">
          {title}
        </h3>

        {/* Spec Chips */}
        <div className="mt-3.5 space-y-1.5">
          {specs.map((spec, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-1 h-1 rounded-full bg-slate-600 group-hover:bg-slate-400 transition-colors" />
              <span>{spec}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Integrated Action Button */}
      <div className="mt-6 pt-3.5 border-t border-white/[0.06] flex items-center justify-between">
        <span
          className={`text-xs font-semibold font-['Kanit'] tracking-wide transition-colors ${styles.ctaText}`}
        >
          {ctaText}
        </span>
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:translate-x-1 ${styles.ctaBg} ${styles.ctaText}`}
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
