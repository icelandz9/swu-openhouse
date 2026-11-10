'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Monitor,
  Sliders,
  Smartphone,
  ArrowRight,
  Sun,
  Moon,
} from 'lucide-react';
import { CpeLogo } from '@/components/CpeLogo';

interface LaunchCardData {
  key: string;
  role: string;
  title: string;
  endpoint: string;
  route: string;
  accent: 'crimson' | 'cyan' | 'emerald' | 'amber';
  icon: React.ReactNode;
}

const LAUNCH_MODULES: LaunchCardData[] = [
  {
    key: '1',
    role: 'SCREEN 1 · KIOSK',
    title: 'ตู้ถ่ายภาพไร้สัมผัส',
    endpoint: 'localhost:3000/kiosk',
    route: '/kiosk',
    accent: 'crimson',
    icon: <Camera className="w-5 h-5" strokeWidth={1.5} />,
  },
  {
    key: '2',
    role: 'SCREEN 2 · SHOWCASE',
    title: 'จอฉายภาพขนาดใหญ่',
    endpoint: 'localhost:3000/display',
    route: '/display',
    accent: 'cyan',
    icon: <Monitor className="w-5 h-5" strokeWidth={1.5} />,
  },
  {
    key: '3',
    role: 'CONTROL · ADMIN',
    title: 'ศูนย์ควบคุมสตาฟ',
    endpoint: 'localhost:3000/admin',
    route: '/admin',
    accent: 'emerald',
    icon: <Sliders className="w-5 h-5" strokeWidth={1.5} />,
  },
  {
    key: '4',
    role: 'MOBILE · ATTENDEE',
    title: 'สตูดิโอแต่งรูปมือถือ',
    endpoint: 'vercel.app/p/[code]',
    route: '/p/demo-code',
    accent: 'amber',
    icon: <Smartphone className="w-5 h-5" strokeWidth={1.5} />,
  },
];

export default function MasterHub() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load theme preference from query param or localStorage
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

  // Keyboard shortcut listener [1-4]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const mod = LAUNCH_MODULES.find((m) => m.key === e.key);
        if (mod) {
          window.open(mod.route, '_blank');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isDark = theme === 'dark';

  // Accent styling mappings
  const accentStyles = {
    crimson: {
      borderHover: isDark ? 'group-hover:border-rose-500/40' : 'group-hover:border-rose-400',
      iconBox: isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-600 border-rose-200',
      pill: isDark ? 'text-rose-400' : 'text-rose-600',
      line: 'bg-[#CE1126]',
    },
    cyan: {
      borderHover: isDark ? 'group-hover:border-cyan-500/40' : 'group-hover:border-cyan-400',
      iconBox: isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-600 border-cyan-200',
      pill: isDark ? 'text-cyan-400' : 'text-cyan-600',
      line: 'bg-cyan-400',
    },
    emerald: {
      borderHover: isDark ? 'group-hover:border-emerald-500/40' : 'group-hover:border-emerald-400',
      iconBox: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200',
      pill: isDark ? 'text-emerald-400' : 'text-emerald-600',
      line: 'bg-emerald-400',
    },
    amber: {
      borderHover: isDark ? 'group-hover:border-amber-500/40' : 'group-hover:border-amber-400',
      iconBox: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200',
      pill: isDark ? 'text-amber-400' : 'text-amber-600',
      line: 'bg-amber-400',
    },
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between font-['Prompt'] transition-colors duration-200 select-none ${
        isDark ? 'bg-[#08090D] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* 1. Top Header Bar (Razor-sharp, clean) */}
      <header className={`border-b transition-colors ${
        isDark ? 'border-slate-800/60 bg-[#08090D]/90' : 'border-slate-200 bg-white/90 shadow-2xs'
      } backdrop-blur-md`}>
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`p-1 rounded-lg transition-colors ${!isDark ? 'bg-slate-900 shadow-xs' : ''}`}>
              <CpeLogo className="h-7" />
            </div>
            <div className="border-l border-slate-700/40 pl-3.5">
              <div className="text-sm font-['Kanit'] font-bold tracking-tight">PhotoBooth</div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                SWU Open House 2026
              </div>
            </div>
          </div>

          {/* Right Status & Theme */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="tracking-wide">READY</span>
            </div>

            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark
                  ? 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-xs'
              }`}
              title="สลับธีม สว่าง / มืด"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Center Deck */}
      <main className="mx-auto max-w-6xl w-full px-6 py-12 flex-1 flex flex-col justify-center">
        {/* Title Group (High-contrast, clean, no eyebrow kicker) */}
        <div className="text-center space-y-2.5 mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-['Kanit'] tracking-tight">
            CPE PhotoBooth Suite
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            ศูนย์ควบคุมระบบถ่ายภาพไร้สัมผัส • ภาควิชาวิศวกรรมคอมพิวเตอร์ มศว
          </p>
        </div>

        {/* 4 Precision Launch Portals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {LAUNCH_MODULES.map((m) => {
            const acc = accentStyles[m.accent];
            return (
              <button
                key={m.key}
                onClick={() => window.open(m.route, '_blank')}
                className={`group relative text-left p-6 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-56 overflow-hidden ${
                  isDark
                    ? 'bg-[#0E1118]/70 border-white/[0.08] hover:bg-[#131722] hover:-translate-y-1 shadow-sm hover:shadow-xl'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50/80 hover:-translate-y-1 shadow-2xs hover:shadow-md'
                } ${acc.borderHover}`}
              >
                {/* Top Row: Keycap + Icon */}
                <div className="flex items-center justify-between w-full">
                  <div
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border shadow-xs transition-colors ${
                      isDark
                        ? 'bg-slate-800/80 border-slate-700 text-slate-300 group-hover:text-white group-hover:border-slate-500'
                        : 'bg-slate-100 border-slate-200 text-slate-700 group-hover:text-slate-900 group-hover:border-slate-300'
                    }`}
                  >
                    [ {m.key} ]
                  </div>

                  <div className={`p-2 rounded-xl border transition-transform duration-200 group-hover:scale-105 ${acc.iconBox}`}>
                    {m.icon}
                  </div>
                </div>

                {/* Middle: Role & Title & Endpoint */}
                <div className="space-y-1 pt-4">
                  <div className={`text-[10px] font-mono tracking-widest font-bold uppercase ${acc.pill}`}>
                    {m.role}
                  </div>
                  <h2 className="text-lg font-bold font-['Kanit'] tracking-tight transition-colors">
                    {m.title}
                  </h2>
                  <div className="text-[11px] font-mono text-slate-500 pt-0.5">
                    {m.endpoint}
                  </div>
                </div>

                {/* Bottom Trigger: Action Link with Sliding Arrow */}
                <div className="pt-3 border-t border-slate-800/30 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400 group-hover:text-white transition-colors">
                    เปิดหน้าต่าง
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all duration-200 group-hover:translate-x-1" />
                </div>

                {/* Subtle bottom edge indicator line on hover */}
                <div className={`absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${acc.line}`} />
              </button>
            );
          })}
        </div>
      </main>

      {/* 3. Footer Anchor */}
      <footer className={`border-t py-5 px-6 text-xs font-mono transition-colors ${
        isDark ? 'border-slate-800/60 text-slate-500' : 'border-slate-200 text-slate-600'
      }`}>
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>Department of Computer Engineering, Srinakharinwirot University</div>
          <div className="flex items-center gap-4">
            <span>กดปุ่ม [1] [2] [3] [4] บนแป้นพิมพ์เพื่อเปิด</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">v2.6-Production</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
