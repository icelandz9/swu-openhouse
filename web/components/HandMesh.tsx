import React from 'react';
import type { LandmarkPoint } from '@/lib/ai-vision/gestureRules';
import { HAND_BONES, computeObjectCoverTransform } from '@/lib/ai-vision/handTrackerFast';

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
  /** Width / height of the box the overlay covers (the video is object-cover in it). */
  containerAspect?: number;
  /** Direct Canvas 2D ref for zero-React-rerender 60-120fps hand tracking. */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

/**
 * HandMesh Component - High-Frequency Direct Canvas 2D Edition + SVG Fallback
 */
export const HandMesh = React.memo(function HandMesh({
  active = true,
  landmarks,
  holdProgress = 0,
  className = '',
  mode = 'overlay',
  isForeground = true,
  videoDimensions,
  containerAspect = 16 / 9,
  canvasRef,
}: HandMeshProps) {
  // Fast Path: Direct GPU Canvas 2D Overlay (driven directly by requestAnimationFrame without React state lag)
  if (mode === 'overlay' && canvasRef) {
    return (
      <canvas
        ref={canvasRef}
        className={`pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] z-25 transition-opacity duration-150 ${
          active ? 'opacity-95' : 'opacity-0'
        } ${className}`}
        aria-hidden="true"
      />
    );
  }

  const hasLandmarks = landmarks && landmarks.length >= 21;

  if (mode === 'overlay' && hasLandmarks) {
    const vw = videoDimensions?.width || 16;
    const vh = videoDimensions?.height || 9;
    const { scaleX, scaleY, offsetX, offsetY } = computeObjectCoverTransform(vw, vh, containerAspect);

    const points: [number, number][] = landmarks.map((pt) => [
      (offsetX + pt.x * scaleX) * 100,
      (offsetY + pt.y * scaleY) * 100,
    ]);

    let minX = 100, maxX = 0, minY = 100, maxY = 0;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const palmCenterX = points[9]?.[0] ?? (minX + maxX) / 2;
    const palmCenterY = points[9]?.[1] ?? (minY + maxY) / 2;

    const handSpan = Math.max(maxX - minX, maxY - minY);
    const ringRadius = Math.max(3.2, Math.min(6.5, handSpan * 0.35));
    const circumference = 2 * Math.PI * ringRadius;
    const strokeDashoffset = circumference - (holdProgress / 100) * circumference;

    const isHolding = holdProgress > 0;
    const strokeColor = isForeground ? '#FFFFFF' : '#F59E0B';

    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={`pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] z-25 transition-opacity duration-200 ${
          active ? 'opacity-95' : 'opacity-40'
        } ${className}`}
        aria-hidden="true"
      >
        <g
          stroke={strokeColor}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.9}
        >
          {HAND_BONES.map(([start, end], i) => (
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
              r={isWrist ? 1.05 : isFingertip ? 0.9 : 0.6}
              fill="#FFFFFF"
              stroke="#000000"
              strokeWidth="0.18"
            />
          );
        })}

        {isHolding && (
          <g transform={`translate(${palmCenterX}, ${palmCenterY})`}>
            <circle
              cx="0"
              cy="0"
              r={ringRadius}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.5"
              strokeOpacity="0.25"
            />
            <circle
              cx="0"
              cy="0"
              r={ringRadius}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.1"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90)"
            />
            <text
              transform={`scale(${-1 / containerAspect}, 1)`}
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
          </g>
        )}
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
      <g stroke="#FFFFFF" strokeWidth="0.6" strokeLinecap="round" strokeOpacity="0.9">
        {HAND_BONES.map(([start, end], i) => (
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
            r={isWrist ? 1.5 : isFingertip ? 1.2 : 0.8}
            fill="#FFFFFF"
            stroke="#000000"
            strokeWidth="0.25"
          />
        );
      })}
    </svg>
  );
});
