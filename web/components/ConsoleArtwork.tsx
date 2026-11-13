import React from 'react';
import { CpeLogo } from './CpeLogo';

/** Realistic industrial screw with circular metallic bevel and recessed cross slot */
export function IndustrialScrew({ className = 'size-[1.4cqw]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <radialGradient id="screw-head-grad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="25%" stopColor="#cbd5e1" />
          <stop offset="65%" stopColor="#64748b" />
          <stop offset="90%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1e293b" />
        </radialGradient>
      </defs>
      {/* Outer steel rim */}
      <circle cx="12" cy="12" r="11" fill="#0f172a" />
      <circle cx="12" cy="12" r="10" fill="url(#screw-head-grad)" stroke="#334155" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="8.8" fill="none" stroke="#e2e8f0" strokeWidth="0.6" opacity="0.75" />
      {/* Recessed Cross Slot (Phillips) */}
      <rect x="10.5" y="5.5" width="3" height="13" rx="0.5" fill="#0f172a" />
      <rect x="5.5" y="10.5" width="13" height="3" rx="0.5" fill="#0f172a" />
      <rect x="11" y="6" width="2" height="12" fill="#020617" />
      <rect x="6" y="11" width="12" height="2" fill="#020617" />
    </svg>
  );
}

/** Metallic industrial gear graphic for the left grip panel (as seen in Image 2) */
export function IndustrialGear({ className = 'size-[3.8cqw]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <radialGradient id="gear-grad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="35%" stopColor="#cbd5e1" />
          <stop offset="70%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </radialGradient>
      </defs>
      {/* 8 Gear Teeth */}
      <path
        d="M21 2h6v6h-6z M21 40h6v6h-6z M2 21h6v6H2z M40 21h6v6h-6z M7.5 7.5l4.2 4.2-4.2 4.2-4.2-4.2z M36.3 36.3l4.2 4.2-4.2 4.2-4.2-4.2z M7.5 40.5l-4.2-4.2 4.2-4.2 4.2 4.2z M36.3 11.7l4.2-4.2 4.2 4.2-4.2 4.2z"
        fill="#475569"
      />
      <circle cx="24" cy="24" r="17" fill="url(#gear-grad)" stroke="#1e293b" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="12" fill="#0f172a" stroke="#334155" strokeWidth="1.2" />
      <circle cx="24" cy="24" r="6" fill="url(#gear-grad)" stroke="#1e293b" strokeWidth="1" />
      <circle cx="24" cy="24" r="3" fill="#020617" />
    </svg>
  );
}

/** Bolt / Screw icon for the 4th Action Button (matching Image 3) */
export function BoltIcon({ className = 'size-[1.8cqw]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 3h10v4H7z" fill="currentColor" fillOpacity="0.25" />
      <path d="M9 7v10l3 3 3-3V7" />
      <path d="M7 11h10" />
      <path d="M8 14h8" />
    </svg>
  );
}

/** Stereo speaker grille (balanced 2x5 acoustic dots) */
export function StereoSpeakerGrille({ className = '' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-5 gap-[.45cqw] ${className}`} aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="size-[.65cqw] rounded-full bg-[#0a0c12] border border-[#1e2330] shadow-[inset_0_1.5px_2px_rgba(0,0,0,0.95),0_0.05cqw_0.1cqw_rgba(255,255,255,0.08)]"
        />
      ))}
    </div>
  );
}

/** Left wing header: Official CPE Logo + "Computer Engineering SWU" label */
export function LeftWingHeader() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center justify-center bg-[#12151d] border border-[#2f3644] px-[.8cqw] py-[.28cqw] rounded-[.3cqw] shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
        <CpeLogo className="h-[1.55cqw] w-auto drop-shadow-[0_0_5px_rgba(230,57,70,0.45)]" />
      </div>
      <p className="font-pixel mt-[.6cqw] text-[.54cqw] leading-[1.45] text-[#cbd5e1] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
        COMPUTER
        <br />
        <span className="text-[var(--px-red-hi)]">ENGINEERING SWU</span>
      </p>
    </div>
  );
}

/** Right wing header: Retro Arcade AI Vision System Badge + Slogan (1:1 mirror height of Left Wing) */
export function RightWingHeader() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-[.42cqw] bg-[#12151d] border border-[#2f3644] px-[.68cqw] py-[.25cqw] rounded-[.3cqw] shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
        {/* Retro Arcade AI Chip Emblem */}
        <div className="flex size-[1.6cqw] items-center justify-center rounded-[.22cqw] bg-[#8b1522] border border-[#e63946] shadow-[0_0_6px_rgba(230,57,70,0.4)]">
          <svg viewBox="0 0 24 24" className="size-[1.08cqw] text-[var(--px-gold)]" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <rect x="6" y="6" width="12" height="12" rx="1.5" fill="#12151d" />
            <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor" />
            <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" strokeLinecap="square" />
          </svg>
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="font-pixel text-[.58cqw] font-bold text-white tracking-wider">ARCADE</span>
          <span className="font-pixel-sm text-[.38cqw] text-[var(--px-gold)] font-bold tracking-widest mt-[.08cqw]">AI EDITION</span>
        </div>
      </div>
      <p className="font-pixel mt-[.6cqw] text-[.54cqw] leading-[1.45] text-[#cbd5e1] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
        HAND TRACKING
        <br />
        <span className="text-[var(--px-gold)]">PHOTO BOOTH</span>
      </p>
    </div>
  );
}

/** Twin console pill buttons (e.g. SELECT / START or RESET / TURBO) */
export function TwinConsolePills({ pill1, pill2 }: { pill1: string; pill2: string }) {
  return (
    <div className="flex gap-[1cqw]" aria-hidden>
      {[pill1, pill2].map((label) => (
        <div key={label} className="flex flex-col items-center gap-[.3cqw]">
          <span className="kc-pill kc-px h-[1cqw] w-[3.5cqw]" />
          <span className="font-pixel-sm text-[.52cqw] font-bold text-[#838999] tracking-wider">{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Twin status LEDs */
export function TwinStatusLeds({
  led1,
  led2,
}: {
  led1: { label: string; on: boolean; color: string; shadow: string };
  led2: { label: string; on: boolean; color: string; shadow: string };
}) {
  return (
    <div className="flex gap-[1.4cqw]" aria-hidden>
      {[led1, led2].map(({ label, on, color, shadow }) => (
        <div key={label} className="flex flex-col items-center gap-[.25cqw]">
          <span
            className={`size-[.75cqw] rounded-[.15cqw] border border-black/80 transition-all ${
              on ? `${color} ${shadow}` : 'bg-[#2b2d35] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]'
            }`}
          />
          <span className="font-pixel-sm text-[.52cqw] font-bold text-[#94a3b8]">{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Left wing mechanical drive pedestal (balancing the right-wing Mecha mascot) */
export function MechaGearDrive({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`} aria-hidden>
      <div className="relative flex size-[5.8cqw] items-center justify-center rounded-[.5cqw] bg-[#12151e] border border-[#2b3345] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_3px_8px_rgba(0,0,0,0.6)]">
        {/* Corner micro-screws */}
        <span className="absolute left-[.35cqw] top-[.35cqw] size-[.35cqw] rounded-full bg-[#475569] shadow-[inset_0_1px_0_#94a3b8]" />
        <span className="absolute right-[.35cqw] top-[.35cqw] size-[.35cqw] rounded-full bg-[#475569] shadow-[inset_0_1px_0_#94a3b8]" />
        <span className="absolute bottom-[.35cqw] left-[.35cqw] size-[.35cqw] rounded-full bg-[#475569] shadow-[inset_0_1px_0_#94a3b8]" />
        <span className="absolute bottom-[.35cqw] right-[.35cqw] size-[.35cqw] rounded-full bg-[#475569] shadow-[inset_0_1px_0_#94a3b8]" />
        
        {/* Rotating Industrial Gear */}
        <IndustrialGear className="size-[3.8cqw] animate-[spin_35s_linear_infinite] drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]" />
      </div>
      <span className="font-pixel-sm mt-[.35cqw] text-[.48cqw] font-bold text-[#94a3b8] tracking-widest [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
        CORE // DRIVE
      </span>
    </div>
  );
}

/** Pixel Art Mecha / Robot Mascot (matching Image 3 right-wing artwork) */
export function MechaPixelAccent({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none relative flex flex-col items-center select-none ${className}`} aria-hidden>
      <div className="flex size-[5.8cqw] items-center justify-center">
        <svg viewBox="0 0 64 64" className="w-[5.8cqw] h-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]" shapeRendering="crispEdges">
          {/* Antennas / V-fin (Yellow & Crimson) */}
          <path d="M22 6h4v4h-4z M38 6h4v4h-4z M26 10h12v4H26z" fill="#f59e0b" />
          <rect x="29" y="10" width="6" height="4" fill="#dc2626" />
          {/* Helmet / Head (White & Grey) */}
          <path d="M20 14h24v12H20z" fill="#f8fafc" />
          <path d="M18 16h2v10h-2z M44 16h2v10h-2z" fill="#94a3b8" />
          {/* Eyes (Green LED visor) */}
          <rect x="24" y="20" width="6" height="3" fill="#10b981" />
          <rect x="34" y="20" width="6" height="3" fill="#10b981" />
          {/* Face plate (Red & White) */}
          <rect x="29" y="22" width="6" height="6" fill="#dc2626" />
          <rect x="25" y="24" width="14" height="4" fill="#f1f5f9" />
          {/* Torso & Shoulders (Crimson, Navy & Dark Titanium) */}
          <rect x="14" y="28" width="36" height="18" fill="#881337" />
          <rect x="8" y="28" width="8" height="14" fill="#f8fafc" />
          <rect x="48" y="28" width="8" height="14" fill="#f8fafc" />
          <rect x="22" y="32" width="20" height="8" fill="#1e293b" />
          {/* Chest Vents (Yellow) */}
          <rect x="24" y="34" width="6" height="2" fill="#fbbf24" />
          <rect x="34" y="34" width="6" height="2" fill="#fbbf24" />
          <rect x="24" y="38" width="6" height="2" fill="#fbbf24" />
          <rect x="34" y="38" width="6" height="2" fill="#fbbf24" />
          {/* Cockpit Hatch (Red) */}
          <rect x="28" y="33" width="8" height="11" fill="#e11d48" />
          {/* Arms & Lower Base (White, Grey, Navy) */}
          <rect x="10" y="44" width="10" height="14" fill="#e2e8f0" />
          <rect x="44" y="44" width="10" height="14" fill="#e2e8f0" />
          <rect x="20" y="46" width="24" height="12" fill="#0f172a" />
          <rect x="26" y="48" width="12" height="6" fill="#e11d48" />
        </svg>
      </div>
      <span className="font-pixel-sm mt-[.35cqw] text-[.48cqw] font-bold text-[#94a3b8] tracking-widest [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
        UNIT // 01-SWU
      </span>
    </div>
  );
}
