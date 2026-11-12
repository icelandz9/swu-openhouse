import React from 'react';

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

/** SMO Engineering and Faculty of Engineering logos header (as seen in Image 2) */
export function EngineeringBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-[.6cqw] ${className}`}>
      {/* SMO Engineering Badge */}
      <div className="flex items-center gap-[.3cqw] bg-[#12141a]/90 border border-[#373e4d] px-[.5cqw] py-[.25cqw] rounded-[.3cqw]">
        <div className="flex flex-col items-center">
          <span className="font-pixel text-[.7cqw] font-bold text-white tracking-wider leading-none">SMO</span>
          <span className="font-pixel-sm text-[.4cqw] text-[var(--px-red-hi)] font-bold tracking-widest leading-none mt-[.15cqw]">ENGINEERING</span>
        </div>
      </div>

      {/* SWU Engineering Seal Icon */}
      <div className="flex size-[2.4cqw] items-center justify-center rounded-full bg-[#8b1522] border border-[#e63946] shadow-[0_0_8px_rgba(230,57,70,0.4)]">
        <svg viewBox="0 0 24 24" className="size-[1.6cqw] text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" opacity="0.6" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="3" fill="#ffffff" />
        </svg>
      </div>

      {/* Faculty Name */}
      <div className="flex flex-col text-left">
        <span className="text-[.6cqw] font-bold text-white leading-tight">Faculty of Engineering</span>
        <span className="font-pixel-sm text-[.42cqw] text-[#9ca3af] leading-tight">SRINAKHARINWIROT UNIVERSITY</span>
      </div>
    </div>
  );
}

/** Pixel Art Mecha / Robot Accent (matching Image 3 right-wing artwork) */
export function MechaPixelAccent({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none relative flex flex-col items-center select-none ${className}`} aria-hidden>
      {/* Mecha head / torso pixel silhouette */}
      <svg viewBox="0 0 64 64" className="w-[10.5cqw] h-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]" shapeRendering="crispEdges">
        {/* Antennas / V-fin (Yellow & Crimson) */}
        <path d="M22 6h4v4h-4z M38 6h4v4h-4z M26 10h12v4H26z" fill="#f59e0b" />
        <rect x="29" y="10" width="6" height="4" fill="#dc2626" />
        {/* Helmet / Head (White & Dark Grey) */}
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
  );
}
