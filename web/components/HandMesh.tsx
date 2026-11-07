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
}: HandMeshProps) {
  const hasLandmarks = landmarks && landmarks.length >= 21;

  if (mode === 'overlay' && hasLandmarks) {
    // 1:1 Direct mapping to video frame coordinates (0 to 100%)
    const points: [number, number][] = landmarks.map((pt) => [pt.x * 100, pt.y * 100]);

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
    const mainColor = isForeground ? '#06B6D4' : '#F59E0B'; // Cyan if OK, Amber if too far

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
          <filter id="meshGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.4" floodColor="#06B6D4" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* 1. Connecting Bones with exact angle/rotation */}
        <g stroke={mainColor} strokeWidth="0.6" strokeLinecap="round" strokeOpacity="0.85" filter="url(#meshGlow)">
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

        {/* 2. Landmark Joints (Circles) */}
        {points.map(([x, y], i) => {
          const isFingertip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
          const isWrist = i === 0;
          return (
            <circle
              key={`c-${i}`}
              cx={x}
              cy={y}
              r={isWrist ? 1.4 : isFingertip ? 1.1 : 0.75}
              fill={isFingertip ? '#FFFFFF' : mainColor}
              stroke={mainColor}
              strokeWidth="0.3"
              filter="url(#meshGlow)"
            />
          );
        })}

        {/* 3. Circular Hold Progress Meter centered on Palm */}
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
              strokeWidth="1.2"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${palmCenterX} ${palmCenterY})`}
              filter="url(#meshGlow)"
            />
          </g>
        )}

        {/* 4. Sci-Fi Corner Brackets around Bounding Box */}
        {(() => {
          const pad = 1.2;
          const bx = Math.max(0, minX - pad);
          const by = Math.max(0, minY - pad);
          const bw = Math.min(100 - bx, maxX - minX + pad * 2);
          const bh = Math.min(100 - by, maxY - minY + pad * 2);
          const arm = Math.min(bw, bh) * 0.25;

          return (
            <g stroke={mainColor} strokeWidth="0.4" fill="none" opacity="0.6">
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
      className={`absolute inset-0 h-full w-full pointer-events-none transition-opacity duration-300 ${
        active ? 'opacity-90' : 'opacity-25'
      } ${className}`}
      aria-hidden="true"
    >
      <g stroke="#06B6D4" strokeWidth="0.75" fill="none">
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
      {points.map(([x, y], i) => (
        <circle
          key={`c-${i}`}
          cx={x}
          cy={y}
          r={i === 0 ? 2 : 1.3}
          fill="#06B6D4"
          stroke="#CFFAFE"
          strokeWidth="0.4"
        />
      ))}
    </svg>
  );
}
