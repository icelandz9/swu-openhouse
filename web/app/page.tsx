'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Sun, Moon } from 'lucide-react';
import { CpeLogo } from '@/components/CpeLogo';

interface LaunchCard {
  key: string;
  title: string;
  subtitle: string;
  route: string;
}

const LAUNCH_CARDS: LaunchCard[] = [
  {
    key: '1',
    title: 'ตู้ถ่ายรูป',
    subtitle: '/kiosk',
    route: '/kiosk',
  },
  {
    key: '2',
    title: 'จอแสดงผล',
    subtitle: '/display',
    route: '/display',
  },
  {
    key: '3',
    title: 'แดชบอร์ดสตาฟ',
    subtitle: '/admin',
    route: '/admin',
  },
  {
    key: '4',
    title: 'เว็บมือถือ',
    subtitle: '/p/[code]',
    route: '/p/demo-code',
  },
];

export default function MasterHub() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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

  // Keyboard shortcut routing [1-4]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const card = LAUNCH_CARDS.find((c) => c.key === e.key);
        if (card) {
          window.open(card.route, '_blank');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen flex flex-col justify-between font-['Prompt'] transition-colors duration-200 select-none ${
        isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* 1. Header (Minimalist & Crisp) */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-1 rounded-lg transition-colors ${!isDark ? 'bg-slate-900' : ''}`}>
            <CpeLogo className="h-7" />
          </div>
          <div className="border-l border-slate-700/40 pl-3">
            <span className="font-['Kanit'] font-bold text-sm tracking-tight">PhotoBooth</span>
            <span className="text-slate-500 text-xs font-mono ml-2">Open House 2026</span>
          </div>
        </div>

        {/* Theme Toggle */}
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
      </header>

      {/* 2. Hero & 4 Launch Cards (Centered, Balanced) */}
      <main className="w-full max-w-5xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center text-center">
        <div className="mb-10 space-y-2">
          <div className="text-[11px] font-mono tracking-widest uppercase text-slate-500 font-semibold">
            CPE Central Mission Launchpad
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-['Kanit'] tracking-tight">
            เลือกหน้าต่างที่ต้องการเปิด
          </h1>
        </div>

        {/* 4 Clean Action Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {LAUNCH_CARDS.map((card) => (
            <button
              key={card.key}
              onClick={() => window.open(card.route, '_blank')}
              className={`group relative text-left p-6 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-48 ${
                isDark
                  ? 'bg-slate-900/30 border-slate-800 hover:bg-slate-900/70 hover:border-slate-700 hover:-translate-y-1 shadow-sm hover:shadow-lg'
                  : 'bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-1 shadow-xs hover:shadow-md'
              }`}
            >
              {/* Top: Hotkey Badge & Arrow */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg border transition-colors ${
                    isDark
                      ? 'bg-slate-800/80 border-slate-700/60 text-slate-400 group-hover:text-white group-hover:border-slate-600'
                      : 'bg-slate-100 border-slate-200 text-slate-600 group-hover:text-slate-900 group-hover:border-slate-300'
                  }`}
                >
                  [{card.key}]
                </span>
                <ArrowUpRight
                  className={`w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                    isDark ? 'text-slate-500 group-hover:text-rose-400' : 'text-slate-400 group-hover:text-rose-600'
                  }`}
                />
              </div>

              {/* Bottom: Title & Route */}
              <div className="space-y-1">
                <h2
                  className={`text-lg font-bold font-['Kanit'] transition-colors ${
                    isDark ? 'text-white group-hover:text-rose-400' : 'text-slate-900 group-hover:text-rose-600'
                  }`}
                >
                  {card.title}
                </h2>
                <div className="text-xs font-mono text-slate-500">{card.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* 3. Footer (Quiet, Minimal) */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500 border-t border-slate-800/30">
        <div>Department of Computer Engineering, Srinakharinwirot University</div>
        <div className="flex items-center gap-3">
          <span>กดปุ่ม [1] [2] [3] [4] เพื่อเปิด</span>
          <span className="text-slate-600">•</span>
          <span>v2.6</span>
        </div>
      </footer>
    </div>
  );
}
