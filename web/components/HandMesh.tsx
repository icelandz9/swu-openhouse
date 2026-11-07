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
  className?: string;
}

export function HandMesh({ active = true, landmarks, className = '' }: HandMeshProps) {
  let points: [number, number][] = DEFAULT_LANDMARKS;

  if (landmarks && landmarks.length >= 21) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

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

    // Center in [15, 85] viewBox range (span ~68) with smooth padding
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
