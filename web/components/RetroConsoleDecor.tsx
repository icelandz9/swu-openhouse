'use client';

import React from 'react';
import { Cog, Wrench, HardHat, Disc } from 'lucide-react';

/**
 * 4 Industrial Screws for the corners of a console bezel
 */
export function ChassisScrews() {
  return (
    <>
      <div className="chassis-screw absolute top-3 left-3 z-30" />
      <div className="chassis-screw absolute top-3 right-3 z-30" />
      <div className="chassis-screw absolute bottom-3 left-3 z-30" />
      <div className="chassis-screw absolute bottom-3 right-3 z-30" />
    </>
  );
}

/**
 * Retro D-Pad Controller (+ control pad)
 */
export function RetroDPad({ className = '', onDirectionClick }: { className?: string; onDirectionClick?: (dir: 'up' | 'down' | 'left' | 'right') => void }) {
  return (
    <div className={`relative w-24 h-24 select-none ${className}`}>
      {/* Background shadow plate */}
      <div className="absolute inset-0 bg-[#0A0C10] rounded-full border border-slate-800 shadow-inner" />

      {/* D-Pad Cross Body */}
      <div className="absolute inset-2 flex items-center justify-center">
        {/* Horizontal bar */}
        <div className="absolute w-20 h-7 bg-[#1F232B] rounded-sm border border-slate-700/80 shadow-md flex justify-between items-center px-1">
          <button
            type="button"
            onClick={() => onDirectionClick?.('left')}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-transform"
          >
            <span className="text-[10px] font-pixel">◀</span>
          </button>
          <button
            type="button"
            onClick={() => onDirectionClick?.('right')}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-transform"
          >
            <span className="text-[10px] font-pixel">▶</span>
          </button>
        </div>

        {/* Vertical bar */}
        <div className="absolute w-7 h-20 bg-[#1F232B] rounded-sm border border-slate-700/80 shadow-md flex flex-col justify-between items-center py-1">
          <button
            type="button"
            onClick={() => onDirectionClick?.('up')}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-transform"
          >
            <span className="text-[10px] font-pixel">▲</span>
          </button>
          <button
            type="button"
            onClick={() => onDirectionClick?.('down')}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-transform"
          >
            <span className="text-[10px] font-pixel">▼</span>
          </button>
        </div>

        {/* Center dimple */}
        <div className="relative z-10 w-4 h-4 rounded-full bg-[#12141A] border border-slate-800 shadow-inner" />
      </div>
    </div>
  );
}

/**
 * 4 Engineering Action Buttons (Gear, Wrench, Helmet, Screw)
 */
export function RetroEngineeringButtons({
  className = '',
  onButtonClick,
}: {
  className?: string;
  onButtonClick?: (action: 'gear' | 'wrench' | 'helmet' | 'screw') => void;
}) {
  return (
    <div className={`relative w-28 h-28 select-none ${className}`}>
      {/* Background shadow plate */}
      <div className="absolute inset-0 bg-[#0A0C10] rounded-full border border-slate-800 shadow-inner" />

      {/* 4 Diamond Buttons */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Top Button: Gear (⚙️) */}
        <button
          type="button"
          onClick={() => onButtonClick?.('gear')}
          title="วิศวกรรมเครื่องกล/คอมพิวเตอร์ (Gear)"
          className="pixel-btn-action absolute top-1.5 w-8 h-8 rounded-full bg-gradient-to-b from-[#E51E38] to-[#990012] border border-[#FF4D6D]/40 flex items-center justify-center text-white shadow-md active:scale-95 cursor-pointer"
        >
          <Cog className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Left Button: Helmet (🪖) */}
        <button
          type="button"
          onClick={() => onButtonClick?.('helmet')}
          title="ความปลอดภัยวิศวกรรม (Safety Helmet)"
          className="pixel-btn-action absolute left-1.5 w-8 h-8 rounded-full bg-gradient-to-b from-[#E51E38] to-[#990012] border border-[#FF4D6D]/40 flex items-center justify-center text-white shadow-md active:scale-95 cursor-pointer"
        >
          <HardHat className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Right Button: Wrench (🔧) */}
        <button
          type="button"
          onClick={() => onButtonClick?.('wrench')}
          title="เครื่องมือปฏิบัติการ (Wrench)"
          className="pixel-btn-action absolute right-1.5 w-8 h-8 rounded-full bg-gradient-to-b from-[#E51E38] to-[#990012] border border-[#FF4D6D]/40 flex items-center justify-center text-white shadow-md active:scale-95 cursor-pointer"
        >
          <Wrench className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Bottom Button: Screw/Bolt (🔩) */}
        <button
          type="button"
          onClick={() => onButtonClick?.('screw')}
          title="ฮาร์ดแวร์ & โครงสร้าง (Hardware)"
          className="pixel-btn-action absolute bottom-1.5 w-8 h-8 rounded-full bg-gradient-to-b from-[#E51E38] to-[#990012] border border-[#FF4D6D]/40 flex items-center justify-center text-white shadow-md active:scale-95 cursor-pointer"
        >
          <Disc className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}

/**
 * Pixel Seal Mascot with Engineering Helmet (SVG Pixel Art)
 */
export function PixelEngineerSeal({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`pixel-art ${className}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Helmet (Red/Orange with white cross) */}
      <rect x="10" y="3" width="12" height="3" fill="#CE1126" />
      <rect x="8" y="6" width="16" height="3" fill="#E1132B" />
      <rect x="7" y="9" width="18" height="2" fill="#8F0B20" />
      {/* Helmet badge/cross */}
      <rect x="15" y="5" width="2" height="4" fill="#FFFFFF" />
      <rect x="14" y="6" width="4" height="2" fill="#FFFFFF" />

      {/* Seal Head & Body (Cream/White) */}
      <rect x="9" y="11" width="14" height="9" fill="#F8FAFC" />
      <rect x="8" y="14" width="16" height="11" fill="#E2E8F0" />
      <rect x="7" y="18" width="18" height="8" fill="#CBD5E1" />

      {/* Eyes */}
      <rect x="11" y="14" width="2" height="3" fill="#0F172A" />
      <rect x="11" y="14" width="1" height="1" fill="#FFFFFF" />
      <rect x="19" y="14" width="2" height="3" fill="#0F172A" />
      <rect x="19" y="14" width="1" height="1" fill="#FFFFFF" />

      {/* Nose & Muzzle */}
      <rect x="15" y="16" width="2" height="2" fill="#0F172A" />
      <rect x="14" y="18" width="4" height="1" fill="#94A3B8" />

      {/* Blushing Cheeks */}
      <rect x="9" y="16" width="2" height="1" fill="#FDA4AF" />
      <rect x="21" y="16" width="2" height="1" fill="#FDA4AF" />

      {/* Flippers */}
      <rect x="5" y="21" width="3" height="4" fill="#94A3B8" />
      <rect x="24" y="21" width="3" height="4" fill="#94A3B8" />

      {/* Bottom base */}
      <rect x="9" y="26" width="14" height="2" fill="#64748B" />
    </svg>
  );
}

/**
 * Pixel Engineering Mecha Badge (Gundam V-Fin Silhouette)
 */
export function PixelMechaBadge({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`pixel-art ${className}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* V-Fin Yellow Gold */}
      <path d="M4 4L11 12H13L20 4L18 3L12 9L6 3L4 4Z" fill="#F59E0B" />
      <rect x="11" y="8" width="2" height="4" fill="#CE1126" />
      {/* Face plate white/red */}
      <rect x="8" y="12" width="8" height="5" fill="#F8FAFC" />
      <rect x="9" y="13" width="2" height="1" fill="#00F2FE" />
      <rect x="13" y="13" width="2" height="1" fill="#00F2FE" />
      <rect x="11" y="15" width="2" height="4" fill="#CE1126" />
      <rect x="9" y="17" width="6" height="3" fill="#E2E8F0" />
    </svg>
  );
}

/**
 * Retro Pixel Marquee Header Bar
 */
export function RetroEventHeader() {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#12151D] border-b border-slate-800 text-slate-300">
      {/* Left: SMO & CPE Badges */}
      <div className="flex items-center gap-3">
        <span className="font-pixel text-[11px] font-bold text-red-500 bg-red-950/80 border border-red-500/40 px-2 py-0.5 rounded-xs tracking-wider">
          SMO·ENG
        </span>
        <span className="font-pixel text-[10px] text-slate-400 hidden sm:inline">
          SWU OPEN HOUSE 2026
        </span>
      </div>

      {/* Center: Mission Theme */}
      <div className="flex items-center gap-2">
        <span className="font-pixel text-[10px] text-amber-400 tracking-wider">
          ENGINEERING: BUILD YOUR OWN FUTURE
        </span>
      </div>

      {/* Right: Date & Venue */}
      <div className="font-pixel text-[9px] text-slate-500 hidden md:block">
        14-15 NOV 2026 · ลานเล่นล้อ มศว
      </div>
    </div>
  );
}
