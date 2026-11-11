'use client';

import React, { useEffect } from 'react';
import { Camera, Monitor, Settings, Smartphone, Cog, HardHat, Wrench, Hammer } from 'lucide-react';
import { CpeLogo } from '@/components/CpeLogo';
import { SafeErrorBoundary } from '@/components/SafeErrorBoundary';

// Start menu: each screen of the booth is a "stage". Keys 1-4 open them in a new tab.
const STAGES = [
  {
    key: '1',
    href: '/kiosk',
    label: 'STAGE 1',
    title: 'ตู้ถ่ายรูปไร้สัมผัส',
    detail: '/kiosk · กล้องหลัก + AI จับท่ามือ',
    icon: Camera,
  },
  {
    key: '2',
    href: '/display',
    label: 'STAGE 2',
    title: 'จอโชว์รูป & QR Code',
    detail: '/display · จอใหญ่ต่อ HDMI',
    icon: Monitor,
  },
  {
    key: '3',
    href: '/admin',
    label: 'STAFF',
    title: 'แดชบอร์ดสตาฟ',
    detail: '/admin · ควบคุมกล้อง และคำสั่งฉุกเฉิน',
    icon: Settings,
  },
  {
    key: '4',
    href: '/p/OPH-SWU1',
    label: 'BONUS',
    title: 'เว็บแต่งรูปบนมือถือ',
    detail: '/p/[code] · ลองใส่กรอบ ฟิลเตอร์ สติกเกอร์',
    icon: Smartphone,
  },
] as const;

function MasterHubContent() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const stage = STAGES.find((s) => s.key === e.key);
      if (stage) {
        e.preventDefault();
        window.open(stage.href, '_blank');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="px-bg min-h-screen flex flex-col font-['Prompt'] select-none">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-5 sm:px-6">
        <div className="flex items-center gap-3">
          <CpeLogo className="h-8" />
          <div className="border-l-4 border-[var(--px-red)] pl-3">
            <div className="font-pixel-sm text-sm font-bold text-white">PHOTOBOOTH</div>
            <div className="font-pixel-sm text-[11px] text-[var(--px-muted)]">COMPUTER ENGINEERING</div>
          </div>
        </div>
        <div className="font-pixel text-[10px] text-white sm:text-xs">SWU OPEN HOUSE</div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        {/* Handheld console */}
        <div className="px-panel px-corners flex items-stretch gap-4 p-4 sm:gap-6 sm:p-6">
          {/* Left controls: D-pad */}
          <div className="hidden w-24 shrink-0 flex-col items-center justify-center gap-6 md:flex" aria-hidden>
            <div className="relative size-20">
              <span className="absolute left-1/2 top-0 h-full w-7 -translate-x-1/2 bg-[var(--px-red-dark)] shadow-[inset_3px_3px_0_var(--px-red)]" />
              <span className="absolute left-0 top-1/2 h-7 w-full -translate-y-1/2 bg-[var(--px-red-dark)] shadow-[inset_3px_3px_0_var(--px-red)]" />
            </div>
            <div className="flex gap-2">
              <span className="size-5 rounded-full bg-[var(--px-steel-dark)] shadow-[0_3px_0_#111]" />
              <span className="size-5 rounded-full bg-[var(--px-red-dark)] shadow-[0_3px_0_#111]" />
            </div>
          </div>

          {/* Screen */}
          <div className="px-screen flex-1 px-4 py-6 sm:px-8 sm:py-8">
            <div className="text-center">
              <h1 className="px-title text-2xl sm:text-4xl md:text-5xl">ENGINEERING</h1>
              <p className="px-title-cream font-pixel mt-3 text-[10px] sm:text-sm">BUILD YOUR OWN FUTURE</p>
            </div>

            <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
              {STAGES.map((stage) => {
                const Icon = stage.icon;
                return (
                  <button
                    key={stage.key}
                    onClick={() => window.open(stage.href, '_blank')}
                    className="group px-card px-corners flex items-center gap-3 p-3 text-left transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
                  >
                    <span className="px-btn px-btn-red px-corners size-12 shrink-0">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-pixel-sm flex items-center gap-2 text-[11px] text-[var(--px-gold)]">
                        <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">▶</span>
                        {stage.label}
                      </span>
                      <span className="block truncate font-['Kanit'] text-base font-bold text-white">{stage.title}</span>
                      <span className="block truncate text-[11px] text-[var(--px-muted)]">{stage.detail}</span>
                    </span>
                    <kbd className="font-pixel-sm px-btn px-corners size-8 shrink-0 text-xs">{stage.key}</kbd>
                  </button>
                );
              })}
            </div>

            <p className="font-pixel px-blink mt-8 text-center text-[10px] text-white sm:text-xs">PRESS 1 - 4 TO START</p>
          </div>

          {/* Right controls: gear / hard hat / wrench / bolt */}
          <div className="hidden w-24 shrink-0 items-center justify-center md:flex" aria-hidden>
            <div className="grid grid-cols-3 grid-rows-3 gap-1">
              <span />
              <span className="px-round size-9"><Cog className="size-4" /></span>
              <span />
              <span className="px-round size-9"><HardHat className="size-4" /></span>
              <span />
              <span className="px-round size-9"><Wrench className="size-4" /></span>
              <span />
              <span className="px-round size-9"><Hammer className="size-4" /></span>
              <span />
            </div>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-5 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-2 text-[11px] text-[var(--px-muted)] sm:flex-row">
          <div>ภาควิชาวิศวกรรมคอมพิวเตอร์ มหาวิทยาลัยศรีนครินทรวิโรฒ</div>
          <div className="font-pixel text-[10px] text-white">14-15 NOV 2026</div>
        </div>
      </footer>
    </div>
  );
}

export default function MasterHub() {
  return (
    <SafeErrorBoundary fallbackTitle="หน้าหลัก Launchpad พบข้อขัดข้องชั่วคราว">
      <MasterHubContent />
    </SafeErrorBoundary>
  );
}
