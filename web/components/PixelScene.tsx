// Pieces of the "Engineering: Build Your Own Future" poster world, drawn in code (no image files).
// - <PixelSkyline />: the dusk city inside the console screen (sun, towers, cranes, railing)
// - <ConsoleCaps />: the four red corner plates with screws on the handheld console
// - <GameMenu />: the "Start Game / Options" title menu

import React from 'react';

/** Dusk skyline. Fills its parent (position the parent relative); keep it behind content. */
export function PixelSkyline({ className = '' }: { className?: string }) {
  // Buildings: [x, width, height] on a 320×120 grid, back row then front row
  const back: [number, number, number][] = [
    [0, 18, 44], [16, 12, 58], [30, 20, 38], [52, 10, 66], [64, 22, 48], [90, 14, 54],
    [108, 26, 40], [138, 12, 62], [152, 18, 46], [236, 16, 52], [254, 22, 64], [278, 14, 44], [294, 26, 56],
  ];
  const front: [number, number, number][] = [
    [0, 26, 30], [24, 16, 40], [42, 24, 26], [70, 18, 34], [92, 30, 22], [126, 16, 30],
    [226, 20, 28], [248, 14, 38], [264, 24, 24], [290, 30, 34],
  ];
  const groundY = 104;
  return (
    <svg
      viewBox="0 0 320 120"
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="px-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a0a10" />
          <stop offset="0.55" stopColor="#5a1822" />
          <stop offset="1" stopColor="#7a2430" />
        </linearGradient>
      </defs>
      <rect width="320" height="120" fill="url(#px-sky)" />

      {/* Clouds */}
      <g fill="#6e2430" opacity="0.7">
        <rect x="20" y="18" width="40" height="4" />
        <rect x="30" y="14" width="22" height="4" />
        <rect x="230" y="26" width="48" height="4" />
        <rect x="244" y="22" width="20" height="4" />
      </g>

      {/* Striped retro sun */}
      <circle cx="196" cy="80" r="30" fill="#d23a4c" opacity="0.85" />
      <g fill="#5a1822">
        <rect x="160" y="82" width="72" height="2" />
        <rect x="160" y="88" width="72" height="3" />
        <rect x="160" y="95" width="72" height="4" />
      </g>

      {/* Back row of towers */}
      <g fill="#3d1118">
        {back.map(([x, w, h]) => (
          <rect key={`b${x}`} x={x} y={groundY - h} width={w} height={h} />
        ))}
      </g>
      {/* Lit windows */}
      <g fill="#8a3040" opacity="0.8">
        {back.flatMap(([x, w, h]) =>
          Array.from({ length: Math.floor(h / 10) }, (_, row) => (
            <rect key={`w${x}-${row}`} x={x + 3} y={groundY - h + 5 + row * 10} width={Math.max(2, w - 8)} height={2} />
          ))
        )}
      </g>

      {/* Cranes */}
      <g fill="#2a0a10">
        <rect x="120" y="30" width="3" height="74" />
        <rect x="104" y="30" width="44" height="3" />
        <rect x="144" y="33" width="1" height="14" />
        <rect x="270" y="38" width="3" height="66" />
        <rect x="256" y="38" width="36" height="3" />
      </g>

      {/* Front row */}
      <g fill="#24080d">
        {front.map(([x, w, h]) => (
          <rect key={`f${x}`} x={x} y={groundY - h} width={w} height={h} />
        ))}
      </g>

      {/* Bridge railing and ground */}
      <rect x="0" y={groundY - 8} width="320" height="2" fill="#160408" />
      <g fill="#160408">
        {Array.from({ length: 40 }, (_, i) => (
          <rect key={`p${i}`} x={i * 8} y={groundY - 8} width="2" height="8" />
        ))}
      </g>
      <rect x="0" y={groundY} width="320" height={120 - groundY} fill="#14040a" />
      <rect x="0" y={groundY} width="320" height="2" fill="#3a1218" />
    </svg>
  );
}

/** Four red corner plates. The parent must be positioned (relative/absolute). */
export function ConsoleCaps({ corners = ['tl', 'tr', 'bl', 'br'] }: { corners?: Array<'tl' | 'tr' | 'bl' | 'br'> }) {
  return (
    <>
      {corners.map((c) => (
        <span key={c} className={`px-cap px-cap-${c}`} aria-hidden />
      ))}
    </>
  );
}

/** "Start Game / Options" title menu. */
export function GameMenu({ className = '', start = 'Start Game', option = 'Options' }: { className?: string; start?: string; option?: string }) {
  return (
    <div className={`font-pixel flex flex-col items-center gap-[.6em] ${className}`}>
      <span className="px-menu-item flex items-center">
        <span className="px-blink mr-[.6em] text-[var(--px-gold)]">▶</span>
        {start}
      </span>
      <span className="px-menu-item opacity-45">{option}</span>
    </div>
  );
}
