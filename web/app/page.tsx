'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Monitor,
  Sliders,
  Smartphone,
  ArrowUpRight,
  Sun,
  Moon,
  ExternalLink,
} from 'lucide-react';
import { CpeLogo } from '@/components/CpeLogo';

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
      const routes: Record<string, string> = {
        '1': '/kiosk',
        '2': '/display',
        '3': '/admin',
        '4': '/p/demo-code',
      };
      if (routes[e.key]) {
        e.preventDefault();
        window.open(routes[e.key], '_blank');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen flex flex-col justify-between font-['Prompt'] transition-colors duration-150 select-none ${
        isDark ? 'bg-[#090C13] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* 1. Header (Quiet, Precise) */}
      <header
        className={`border-b transition-colors ${
          isDark ? 'border-slate-800/60 bg-[#090C13]/90' : 'border-slate-200 bg-white/90 shadow-2xs'
        } backdrop-blur-md`}
      >
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-1 rounded-lg transition-colors ${!isDark ? 'bg-slate-900 shadow-xs' : ''}`}>
              <CpeLogo className="h-7" />
            </div>
            <div className="border-l border-slate-700/40 pl-3">
              <div className="text-sm font-['Kanit'] font-bold tracking-tight">PhotoBooth Studio</div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                SWU Open House 2026
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
                isDark
                  ? 'text-slate-400 border-slate-800/80 bg-slate-900/40'
                  : 'text-slate-700 border-slate-200 bg-slate-100'
              }`}
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              DUAL DISPLAY READY
            </span>

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

      {/* 2. Main Studio Console */}
      <main className="mx-auto max-w-5xl w-full px-6 py-10 flex-1 flex flex-col justify-center space-y-8">
        {/* Section 1: Dual Exhibition Displays (Primary Stage) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono font-semibold tracking-wider text-slate-500 uppercase">
              ฮาร์ดแวร์แสดงผลหน้างาน (Dual Fleet Displays)
            </div>
            <div className="text-[11px] font-mono text-slate-500 hidden sm:block">
              1 โน้ตบุ๊กควบคุม 2 จอพร้อมกัน
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Display 1: Kiosk */}
            <div
              onClick={() => window.open('/kiosk', '_blank')}
              className={`group p-6 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between h-52 relative overflow-hidden ${
                isDark
                  ? 'bg-slate-900/30 border-slate-800 hover:bg-slate-900/70 hover:border-slate-700'
                  : 'bg-white border-slate-200 hover:bg-slate-50/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-[#CE1126] uppercase">
                    DISPLAY 1 · PRIMARY
                  </span>
                  <kbd className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border transition-colors ${
                    isDark
                      ? 'border-slate-700/60 bg-slate-800/80 text-slate-300 group-hover:border-slate-500 group-hover:text-white'
                      : 'border-slate-200 bg-slate-100 text-slate-700 group-hover:border-slate-300 group-hover:text-slate-900'
                  }`}>
                    1
                  </kbd>
                </div>
                <h2 className="text-2xl font-bold font-['Kanit'] tracking-tight group-hover:text-rose-500 transition-colors">
                  ตู้ถ่ายรูปไร้สัมผัส
                </h2>
                <p className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  /kiosk • กล้องหลัก & MediaPipe AI 60 FPS
                </p>
              </div>

              <div className={`pt-4 border-t flex items-center justify-between text-xs font-semibold ${
                isDark ? 'border-slate-800/60' : 'border-slate-100'
              }`}>
                <span className={isDark ? 'text-slate-400 group-hover:text-white transition-colors' : 'text-slate-600 group-hover:text-slate-900 transition-colors'}>
                  เปิดจอ 1 (Kiosk)
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-rose-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            </div>

            {/* Display 2: Showcase */}
            <div
              onClick={() => window.open('/display', '_blank')}
              className={`group p-6 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between h-52 relative overflow-hidden ${
                isDark
                  ? 'bg-slate-900/30 border-slate-800 hover:bg-slate-900/70 hover:border-slate-700'
                  : 'bg-white border-slate-200 hover:bg-slate-50/80 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
                    DISPLAY 2 · EXTERNAL HDMI
                  </span>
                  <kbd className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border transition-colors ${
                    isDark
                      ? 'border-slate-700/60 bg-slate-800/80 text-slate-300 group-hover:border-slate-500 group-hover:text-white'
                      : 'border-slate-200 bg-slate-100 text-slate-700 group-hover:border-slate-300 group-hover:text-slate-900'
                  }`}>
                    2
                  </kbd>
                </div>
                <h2 className="text-2xl font-bold font-['Kanit'] tracking-tight group-hover:text-cyan-400 transition-colors">
                  จอฉายแสดงผล & QR Code
                </h2>
                <p className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  /display • จอโปรเจกเตอร์/ทีวี & Spotlight 30s
                </p>
              </div>

              <div className={`pt-4 border-t flex items-center justify-between text-xs font-semibold ${
                isDark ? 'border-slate-800/60' : 'border-slate-100'
              }`}>
                <span className={isDark ? 'text-slate-400 group-hover:text-white transition-colors' : 'text-slate-600 group-hover:text-slate-900 transition-colors'}>
                  เปิดจอ 2 (Showcase)
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Management & Companion (Secondary Utilities) */}
        <section className="space-y-3">
          <div className="text-xs font-mono font-semibold tracking-wider text-slate-500 uppercase">
            เครื่องมือสตาฟและการทดสอบ (Operations & Mobile)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Staff Admin */}
            <div
              onClick={() => window.open('/admin', '_blank')}
              className={`group p-4 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between ${
                isDark
                  ? 'bg-slate-900/20 border-slate-800 hover:bg-slate-900/60 hover:border-slate-700'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold font-['Kanit'] transition-colors ${
                    isDark ? 'group-hover:text-emerald-400' : 'group-hover:text-emerald-600'
                  }`}>
                    แดชบอร์ดสตาฟ (Mission Control)
                  </span>
                  <kbd className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${
                    isDark
                      ? 'border-slate-700/60 bg-slate-800/60 text-slate-400'
                      : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}>
                    3
                  </kbd>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  /admin • ควบคุมกล้อง กราฟความถี่สด และคำสั่งฉุกเฉิน
                </div>
              </div>
              <ArrowUpRight className={`w-4 h-4 text-slate-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ${
                isDark ? 'group-hover:text-emerald-400' : 'group-hover:text-emerald-600'
              }`} />
            </div>

            {/* Mobile Web Editor */}
            <div
              onClick={() => window.open('/p/demo-code', '_blank')}
              className={`group p-4 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between ${
                isDark
                  ? 'bg-slate-900/20 border-slate-800 hover:bg-slate-900/60 hover:border-slate-700'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold font-['Kanit'] transition-colors ${
                    isDark ? 'group-hover:text-amber-400' : 'group-hover:text-amber-600'
                  }`}>
                    เว็บแต่งรูปมือถือน้อง (Mobile Studio)
                  </span>
                  <kbd className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${
                    isDark
                      ? 'border-slate-700/60 bg-slate-800/60 text-slate-400'
                      : 'border-slate-200 bg-slate-100 text-slate-600'
                  }`}>
                    4
                  </kbd>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  /p/[code] • ทดสอบแต่งโทนสี ใส่กรอบ และสติกเกอร์
                </div>
              </div>
              <ArrowUpRight className={`w-4 h-4 text-slate-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ${
                isDark ? 'group-hover:text-amber-400' : 'group-hover:text-amber-600'
              }`} />
            </div>
          </div>
        </section>
      </main>

      {/* 3. Footer */}
      <footer
        className={`border-t py-4 px-6 text-xs font-mono transition-colors ${
          isDark ? 'border-slate-800/60 text-slate-500' : 'border-slate-200 text-slate-600'
        }`}
      >
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>Department of Computer Engineering, Srinakharinwirot University</div>
          <div className="flex items-center gap-3">
            <span>กดปุ่ม [1] [2] [3] [4] เพื่อเปิด</span>
            <span className="text-slate-600">•</span>
            <span>v2.6-Production</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
