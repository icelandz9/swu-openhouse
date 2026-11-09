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

/**
 * HandMesh Component - SWU CPE Tactical Crimson HUD Edition
 * 
 * Styled specifically to match the Kiosk camera screen:
 * - CPE Crimson (#CE1126) & Pure White (#FFFFFF) dual-rail laser bones
 * - Tactical military reticles with crosshairs and diamond centers
 * - Circular tactical azimuth dial on palm center with hold percentage
 * - Mil-spec corner brackets with alignment anchors
 * - Real-time animated top-to-bottom crimson laser scanner
 */
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
    const themeCrimson = '#CE1126';
    const mainColor = isForeground ? themeCrimson : '#F59E0B';

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
          <filter id="cpeCrimsonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.6" floodColor="#CE1126" floodOpacity="0.9" />
          </filter>
          <filter id="cpeLaserGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.75" floodColor="#CE1126" floodOpacity="1" />
            <feDropShadow dx="0" dy="0" stdDeviation="0.3" floodColor="#FFFFFF" floodOpacity="0.9" />
          </filter>

          {/* Horizontal laser scanline beam with high-contrast white core */}
          <linearGradient id="cpeLaserBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#CE1126" stopOpacity="0" />
            <stop offset="25%" stopColor="#CE1126" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="75%" stopColor="#CE1126" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#CE1126" stopOpacity="0" />
          </linearGradient>

          {/* Top-to-bottom trailing energy sweep in CPE crimson */}
          <linearGradient id="cpeLaserSweepTrail" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#CE1126" stopOpacity="0" />
            <stop offset="65%" stopColor="#CE1126" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#CE1126" stopOpacity="0.35" />
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
              fill="url(#cpeLaserSweepTrail)"
            />

            {/* Glowing horizontal laser line sweeping from top to bottom */}
            <line
              x1={scanLeft}
              y1={scanY}
              x2={scanRight}
              y2={scanY}
              stroke="url(#cpeLaserBeamGrad)"
              strokeWidth="1.2"
              strokeLinecap="round"
              filter="url(#cpeLaserGlow)"
            />
            <line
              x1={scanLeft + 1}
              y1={scanY}
              x2={scanRight - 1}
              y2={scanY}
              stroke="#FFFFFF"
              strokeWidth="0.45"
              strokeLinecap="round"
            />

            {/* Left and right tactical optical tracking beacons */}
            <circle cx={scanLeft} cy={scanY} r="0.95" fill="#CE1126" filter="url(#cpeLaserGlow)" />
            <circle cx={scanLeft} cy={scanY} r="0.4" fill="#FFFFFF" />
            <circle cx={scanRight} cy={scanY} r="0.95" fill="#CE1126" filter="url(#cpeLaserGlow)" />
            <circle cx={scanRight} cy={scanY} r="0.4" fill="#FFFFFF" />
          </g>
        )}

        {/* 2. Tactical Dual-Rail Connecting Bones (Crimson Rail + White Laser Core) */}
        <g
          stroke={mainColor}
          strokeWidth="1.15"
          strokeLinecap="round"
          strokeOpacity={0.95}
          filter="url(#cpeCrimsonGlow)"
        >
          {BONES.map(([start, end], i) => (
            <line
              key={`b-crimson-${i}`}
              x1={points[start]?.[0] ?? 0}
              y1={points[start]?.[1] ?? 0}
              x2={points[end]?.[0] ?? 0}
              y2={points[end]?.[1] ?? 0}
            />
          ))}
        </g>
        <g
          stroke="#FFFFFF"
          strokeWidth="0.32"
          strokeLinecap="round"
          strokeOpacity={0.9}
        >
          {BONES.map(([start, end], i) => (
            <line
              key={`b-core-${i}`}
              x1={points[start]?.[0] ?? 0}
              y1={points[start]?.[1] ?? 0}
              x2={points[end]?.[0] ?? 0}
              y2={points[end]?.[1] ?? 0}
            />
          ))}
        </g>

        {/* 3. Tactical Reticle Joints & Crosshairs */}
        {points.map(([x, y], i) => {
          const isFingertip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
          const isWrist = i === 0;

          if (isWrist) {
            return (
              <g key={`c-wrist-${i}`} transform={`translate(${x}, ${y})`}>
                <polygon
                  points="0,-2.4 2.4,0 0,2.4 -2.4,0"
                  fill={mainColor}
                  stroke="#FFFFFF"
                  strokeWidth="0.4"
                  filter="url(#cpeCrimsonGlow)"
                />
                <circle cx="0" cy="0" r="0.8" fill="#FFFFFF" />
              </g>
            );
          }

          return (
            <g key={`c-${i}`} transform={`translate(${x}, ${y})`}>
              {/* Tactical Crosshair Lines */}
              <line x1="-1.4" y1="0" x2="1.4" y2="0" stroke="#FFFFFF" strokeWidth="0.3" strokeOpacity="0.85" />
              <line x1="0" y1="-1.4" x2="0" y2="1.4" stroke="#FFFFFF" strokeWidth="0.3" strokeOpacity="0.85" />
              {/* Joint Beacon */}
              <circle
                cx="0"
                cy="0"
                r={isFingertip ? 1.35 : 0.8}
                fill={isFingertip ? '#FFFFFF' : mainColor}
                stroke={mainColor}
                strokeWidth="0.35"
                filter="url(#cpeCrimsonGlow)"
              />
              {isFingertip && (
                <circle
                  cx="0"
                  cy="0"
                  r="2.1"
                  fill="none"
                  stroke={mainColor}
                  strokeWidth="0.3"
                  strokeDasharray="0.8 0.8"
                />
              )}
            </g>
          );
        })}

        {/* 4. Tactical Azimuth Dial & Circular Hold Progress Meter centered on Palm */}
        {isHolding && (
          <g transform={`translate(${palmCenterX}, ${palmCenterY})`}>
            {/* Outer dashed calibration ring */}
            <circle
              cx="0"
              cy="0"
              r={ringRadius * 1.25}
              fill="none"
              stroke={mainColor}
              strokeWidth="0.35"
              strokeDasharray="1.2 1.2"
              opacity="0.6"
            />
            {/* Background guide ring */}
            <circle
              cx="0"
              cy="0"
              r={ringRadius}
              fill="none"
              stroke={mainColor}
              strokeWidth="0.6"
              strokeOpacity="0.3"
            />
            {/* 4 Quadrant Tactical Brackets */}
            <path
              d={`M ${-ringRadius} 0 A ${ringRadius} ${ringRadius} 0 0 1 0 ${-ringRadius}`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.6"
              opacity="0.8"
            />
            <path
              d={`M 0 ${ringRadius} A ${ringRadius} ${ringRadius} 0 0 1 ${ringRadius} 0`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.6"
              opacity="0.8"
            />
            {/* Active progress arc in CPE Crimson */}
            <circle
              cx="0"
              cy="0"
              r={ringRadius}
              fill="none"
              stroke={mainColor}
              strokeWidth="1.35"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90)"
              filter="url(#cpeLaserGlow)"
            />
            {/* Center Core HUD readout */}
            <circle cx="0" cy="0" r={ringRadius * 0.45} fill="rgba(206,17,38,0.3)" stroke={mainColor} strokeWidth="0.4" />
            <text
              x="0"
              y="0.8"
              fill="#FFFFFF"
              fontSize={Math.max(1.8, ringRadius * 0.42)}
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {Math.round(holdProgress)}%
            </text>
            <text
              x="0"
              y={ringRadius * 1.6}
              fill={mainColor}
              fontSize="1.6"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
              letterSpacing="0.1em"
            >
              CPE-LOCK
            </text>
          </g>
        )}

        {/* 5. Mil-Spec Corner Brackets around Bounding Box */}
        {(() => {
          const pad = 1.4;
          const bx = Math.max(0, minX - pad);
          const by = Math.max(0, minY - pad);
          const bw = Math.min(100 - bx, maxX - minX + pad * 2);
          const bh = Math.min(100 - by, maxY - minY + pad * 2);
          const arm = Math.min(bw, bh) * 0.25;

          return (
            <g
              stroke={mainColor}
              strokeWidth="0.5"
              fill="none"
              opacity={isHolding ? 0.95 : 0.75}
            >
              {/* Top-Left */}
              <path d={`M ${bx} ${by + arm} L ${bx} ${by} L ${bx + arm} ${by}`} />
              <rect x={bx - 0.4} y={by - 0.4} width="0.8" height="0.8" fill={mainColor} />
              {/* Top-Right */}
              <path d={`M ${bx + bw - arm} ${by} L ${bx + bw} ${by} L ${bx + bw} ${by + arm}`} />
              <rect x={bx + bw - 0.4} y={by - 0.4} width="0.8" height="0.8" fill={mainColor} />
              {/* Bottom-Left */}
              <path d={`M ${bx} ${by + bh - arm} L ${bx} ${by + bh} L ${bx + arm} ${by + bh}`} />
              <rect x={bx - 0.4} y={by + bh - 0.4} width="0.8" height="0.8" fill={mainColor} />
              {/* Bottom-Right */}
              <path d={`M ${bx + bw - arm} ${by + bh} L ${bx + bw} ${by + bh} L ${bx + bw} ${by + bh - arm}`} />
              <rect x={bx + bw - 0.4} y={by + bh - 0.4} width="0.8" height="0.8" fill={mainColor} />
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
        <filter id="meshGlowCrimsonSmall" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.4" floodColor="#CE1126" floodOpacity="0.85" />
        </filter>
      </defs>

      <g stroke="#CE1126" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.9" filter="url(#meshGlowCrimsonSmall)">
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
      <g stroke="#FFFFFF" strokeWidth="0.3" strokeLinecap="round" strokeOpacity="0.9">
        {BONES.map(([start, end], i) => (
          <line
            key={`b-white-${i}`}
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
            r={isWrist ? 1.8 : isFingertip ? 1.5 : 0.9}
            fill={isFingertip ? '#FFFFFF' : '#CE1126'}
            stroke="#FFFFFF"
            strokeWidth="0.3"
            filter="url(#meshGlowCrimsonSmall)"
          />
        );
      })}
    </svg>
  );
}
