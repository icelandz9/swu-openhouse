import React from 'react';
import type { LandmarkPoint } from '@/lib/ai-vision/gestureRules';

const DEFAULT_LANDMARKS: [number, number][] = [
  [50, 81],
  [43, 72],
  [38, 61],
  [34, 50],
  [30, 39],
  [47, 58],
  [45, 43],
  [44, 30],
  [44, 18],
  [53, 56],
  [54, 39],
  [55, 24],
  [56, 10],
  [59, 59],
  [64, 45],
  [68, 34],
  [71, 23],
  [64, 65],
  [73, 56],
  [80, 49],
  [86, 43],
];

// Bones connecting MediaPipe landmarks
const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
];

// MediaPipe's default hand style (drawing_styles.py), the same colors as the Python demo
// scripts/model-training/fivepalm_shutter.py. MediaPipe lists them as BGR; these are RGB.
const MP_COLORS = {
  red: '#FF3030',
  green: '#30FF30',
  blue: '#1565C0',
  yellow: '#FFCC00',
  gray: '#808080',
  purple: '#804080',
  peach: '#FFE5B4',
  white: '#E0E0E0',
};
const PALM_JOINTS = new Set([0, 1, 5, 9, 13, 17]);
const PALM_BONES = new Set(['0-1', '0-5', '5-9', '9-13', '13-17', '0-17']);

// Thumb 1-4, index 5-8, middle 9-12, ring 13-16, pinky 17-20
function fingerColor(landmark: number): string {
  if (landmark <= 4) return MP_COLORS.peach;
  if (landmark <= 8) return MP_COLORS.purple;
  if (landmark <= 12) return MP_COLORS.yellow;
  if (landmark <= 16) return MP_COLORS.green;
  return MP_COLORS.blue;
}

export interface HandMeshProps {
  active?: boolean;
  landmarks?: LandmarkPoint[];
  holdProgress?: number;
  className?: string;
  mode?: 'overlay' | 'card';
  handAreaRatio?: number;
  isForeground?: boolean;
  gestureText?: string;
  videoDimensions?: { width: number; height: number };
}

export function HandMesh({
  active = true,
  landmarks,
  holdProgress = 0,
  className = '',
  mode = 'overlay',
  handAreaRatio = 0,
  isForeground = true,
  gestureText = 'NONE',
  videoDimensions,
}: HandMeshProps) {
  const hasLandmarks = landmarks && landmarks.length >= 21;

  if (mode === 'overlay' && hasLandmarks) {
    // Exact mapping taking into account video aspect ratio vs 16:9 container object-cover
    const vw = videoDimensions?.width || 16;
    const vh = videoDimensions?.height || 9;
    const videoAspect = vw / vh;
    const containerAspect = 16 / 9;

    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (videoAspect > containerAspect) {
      // Video is wider than container (cropped left/right)
      scaleX = videoAspect / containerAspect;
      offsetX = (1 - scaleX) / 2;
    } else if (videoAspect < containerAspect) {
      // Video is taller than container (e.g. 4:3 cropped top/bottom)
      scaleY = containerAspect / videoAspect;
      offsetY = (1 - scaleY) / 2;
    }

    // 1:1 Direct mapping to displayed video pixels (0 to 100%)
    const points: [number, number][] = landmarks.map((pt) => [
      (offsetX + pt.x * scaleX) * 100,
      (offsetY + pt.y * scaleY) * 100,
    ]);

    // Calculate Bounding Box
    let minX = 100, maxX = 0, minY = 100, maxY = 0;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    // Hand Center (Middle MCP - landmark 9)
    const palmCenterX = points[9]?.[0] ?? (minX + maxX) / 2;
    const palmCenterY = points[9]?.[1] ?? (minY + maxY) / 2;

    // Radius of circular hold progress ring scaled to hand span
    const handSpan = Math.max(maxX - minX, maxY - minY);
    const ringRadius = Math.max(3.2, Math.min(6.5, handSpan * 0.35));
    const circumference = 2 * Math.PI * ringRadius;
    const strokeDashoffset = circumference - (holdProgress / 100) * circumference;

    const isHolding = holdProgress > 0;
    const mainColor = isForeground ? '#06B6D4' : '#F59E0B';

    // Top-to-Bottom laser scanning position based on hold progress
    const scanPad = 3.2;
    const scanLeft = Math.max(0, minX - scanPad);
    const scanRight = Math.min(100, maxX + scanPad);
    const scanWidth = scanRight - scanLeft;
    const scanY = minY + (holdProgress / 100) * Math.max(4, maxY - minY);

    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={`pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] z-25 transition-opacity duration-200 ${
          active ? 'opacity-95' : 'opacity-40'
        } ${className}`}
        aria-hidden="true"
      >
        <defs>
          <filter id="laserGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.6" floodColor="#22D3EE" floodOpacity="1" />
          </filter>

          {/* Horizontal laser scanline beam */}
          <linearGradient id="laserBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0" />
            <stop offset="15%" stopColor="#22D3EE" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="85%" stopColor="#22D3EE" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
          </linearGradient>

          {/* Top-to-bottom trailing energy sweep */}
          <linearGradient id="laserSweepTrail" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0" />
            <stop offset="65%" stopColor="#06B6D4" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {/* 1. Animated Top-to-Bottom Processing Scan Laser */}
        {isHolding && (
          <g className="animate-in fade-in duration-150">
            {/* Trailing downward energy wash */}
            <rect
              x={scanLeft}
              y={minY}
              width={scanWidth}
              height={Math.max(0, scanY - minY)}
              fill="url(#laserSweepTrail)"
            />

            {/* Glowing horizontal laser line sweeping from top to bottom */}
            <line
              x1={scanLeft}
              y1={scanY}
              x2={scanRight}
              y2={scanY}
              stroke="url(#laserBeamGrad)"
              strokeWidth="1.2"
              strokeLinecap="round"
              filter="url(#laserGlow)"
            />
            <line
              x1={scanLeft + 1}
              y1={scanY}
              x2={scanRight - 1}
              y2={scanY}
              stroke="#FFFFFF"
              strokeWidth="0.5"
              strokeLinecap="round"
            />

            {/* Left and right optical tracking beacons */}
            <circle cx={scanLeft} cy={scanY} r="0.9" fill="#22D3EE" filter="url(#laserGlow)" />
            <circle cx={scanRight} cy={scanY} r="0.9" fill="#22D3EE" filter="url(#laserGlow)" />
          </g>
        )}

        {/* 2. Bones in MediaPipe's default colors: palm gray, each finger its own color */}
        <g strokeLinecap="round">
          {BONES.map(([start, end], i) => {
            const isPalm = PALM_BONES.has(`${start}-${end}`);
            return (
              <line
                key={`b-${i}`}
                x1={points[start]?.[0] ?? 0}
                y1={points[start]?.[1] ?? 0}
                x2={points[end]?.[0] ?? 0}
                y2={points[end]?.[1] ?? 0}
                stroke={isPalm ? MP_COLORS.gray : fingerColor(end)}
                strokeWidth={isPalm ? 4 : 3}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>

        {/* 3. Joints: white ring, filled with the palm (red) or finger color.
            Ellipses, because the SVG is stretched to 16:9: these come out round on screen. */}
        {points.map(([x, y], i) => (
          <g key={`c-${i}`}>
            <ellipse cx={x} cy={y} rx={0.5} ry={0.5 * (16 / 9)} fill={MP_COLORS.white} />
            <ellipse
              cx={x}
              cy={y}
              rx={0.38}
              ry={0.38 * (16 / 9)}
              fill={PALM_JOINTS.has(i) ? MP_COLORS.red : fingerColor(i)}
            />
          </g>
        ))}

        {/* 4. Circular Hold Progress Meter centered on Palm */}
        {isHolding && (
          <g>
            {/* Background ring */}
            <circle
              cx={palmCenterX}
              cy={palmCenterY}
              r={ringRadius}
              fill="none"
              stroke="#06B6D4"
              strokeWidth="0.8"
              strokeOpacity="0.35"
            />
            {/* Active progress arc */}
            <circle
              cx={palmCenterX}
              cy={palmCenterY}
              r={ringRadius}
              fill="none"
              stroke="#22D3EE"
              strokeWidth="1.3"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${palmCenterX} ${palmCenterY})`}
              filter="url(#laserGlow)"
            />
          </g>
        )}

        {/* 5. Sci-Fi Corner Brackets around Bounding Box */}
        {(() => {
          const pad = 1.2;
          const bx = Math.max(0, minX - pad);
          const by = Math.max(0, minY - pad);
          const bw = Math.min(100 - bx, maxX - minX + pad * 2);
          const bh = Math.min(100 - by, maxY - minY + pad * 2);
          const arm = Math.min(bw, bh) * 0.25;

          return (
            <g
              stroke={isHolding ? '#22D3EE' : mainColor}
              strokeWidth="0.4"
              fill="none"
              opacity={isHolding ? 0.85 : 0.6}
            >
              {/* Top-Left */}
              <path d={`M ${bx} ${by + arm} L ${bx} ${by} L ${bx + arm} ${by}`} />
              {/* Top-Right */}
              <path d={`M ${bx + bw - arm} ${by} L ${bx + bw} ${by} L ${bx + bw} ${by + arm}`} />
              {/* Bottom-Left */}
              <path d={`M ${bx} ${by + bh - arm} L ${bx} ${by + bh} L ${bx + arm} ${by + bh}`} />
              {/* Bottom-Right */}
              <path d={`M ${bx + bw - arm} ${by + bh} L ${bx + bw} ${by + bh} L ${bx + bw} ${by + bh - arm}`} />
            </g>
          );
        })()}
      </svg>
    );
  }

  // Fallback / Normalized Card Mode
  let points: [number, number][] = DEFAULT_LANDMARKS;
  if (hasLandmarks) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pt of landmarks) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    const spanX = Math.max(maxX - minX, 0.001);
    const spanY = Math.max(maxY - minY, 0.001);
    const maxSpan = Math.max(spanX, spanY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    points = landmarks.map((pt) => [
      50 + ((pt.x - cx) / maxSpan) * 68,
      50 + ((pt.y - cy) / maxSpan) * 68,
    ]);
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={`h-full w-full ${active ? 'opacity-90' : 'opacity-40'} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <filter id="meshGlowSmall" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.4" floodColor="#06B6D4" floodOpacity="0.8" />
        </filter>
      </defs>

      <g stroke="#06B6D4" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.85" filter="url(#meshGlowSmall)">
        {BONES.map(([start, end], i) => (
          <line
            key={`b-${i}`}
            x1={points[start]?.[0] ?? 0}
            y1={points[start]?.[1] ?? 0}
            x2={points[end]?.[0] ?? 0}
            y2={points[end]?.[1] ?? 0}
          />
        ))}
      </g>

      {points.map(([x, y], i) => {
        const isFingertip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
        const isWrist = i === 0;
        return (
          <circle
            key={`c-${i}`}
            cx={x}
            cy={y}
            r={isWrist ? 1.8 : isFingertip ? 1.5 : 1}
            fill={isFingertip ? '#FFFFFF' : '#06B6D4'}
            stroke="#06B6D4"
            strokeWidth="0.4"
            filter="url(#meshGlowSmall)"
          />
        );
      })}
    </svg>
  );
}
