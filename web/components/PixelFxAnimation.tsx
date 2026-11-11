'use client';

import React, { useEffect, useRef, useState } from 'react';

interface FrameData {
  frame: { x: number; y: number; w: number; h: number };
  duration: number;
}

interface PixelFxSheetData {
  frames: FrameData[];
  meta?: {
    size?: { w: number; h: number };
  };
}

interface PixelFxAnimationProps {
  sheetSrc: string;      // e.g. "/pixelfx/ui/countdown/countdown.png"
  jsonSrc: string;       // e.g. "/pixelfx/ui/countdown/countdown.json"
  width?: number;        // display width
  height?: number;       // display height
  loop?: boolean;
  onComplete?: () => void;
  className?: string;
  speed?: number;        // 1.0 = normal
}

export function PixelFxAnimation({
  sheetSrc,
  jsonSrc,
  width,
  height,
  loop = false,
  onComplete,
  className = '',
  speed = 1.0,
}: PixelFxAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const animStateRef = useRef<{
    sheet: HTMLImageElement | null;
    frames: FrameData[];
    frameIndex: number;
    lastTime: number;
    elapsedInFrame: number;
    animId: number | null;
  }>({
    sheet: null,
    frames: [],
    frameIndex: 0,
    lastTime: 0,
    elapsedInFrame: 0,
    animId: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      try {
        const res = await fetch(jsonSrc);
        if (!res.ok) return;
        const data: PixelFxSheetData = await res.json();

        const img = new Image();
        img.src = sheetSrc;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        if (cancelled) return;

        animStateRef.current.sheet = img;
        animStateRef.current.frames = data.frames || [];
        animStateRef.current.frameIndex = 0;
        animStateRef.current.elapsedInFrame = 0;
        animStateRef.current.lastTime = performance.now();
        setLoaded(true);
      } catch (err) {
        console.warn('Could not load PixelFx asset:', err);
      }
    }

    loadAssets();

    return () => {
      cancelled = true;
      if (animStateRef.current.animId) {
        cancelAnimationFrame(animStateRef.current.animId);
      }
    };
  }, [sheetSrc, jsonSrc]);

  useEffect(() => {
    if (!loaded) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    function renderLoop(now: number) {
      const state = animStateRef.current;
      if (!state.sheet || state.frames.length === 0) return;

      const delta = (now - state.lastTime) * speed;
      state.lastTime = now;
      state.elapsedInFrame += delta;

      let currentFrame = state.frames[state.frameIndex];
      const duration = currentFrame?.duration || 33;

      if (state.elapsedInFrame >= duration) {
        state.elapsedInFrame -= duration;
        state.frameIndex++;

        if (state.frameIndex >= state.frames.length) {
          if (loop) {
            state.frameIndex = 0;
          } else {
            state.frameIndex = state.frames.length - 1;
            onComplete?.();
            return;
          }
        }
        currentFrame = state.frames[state.frameIndex];
      }

      // Draw current frame
      if (currentFrame && state.sheet) {
        const { x, y, w, h } = currentFrame.frame;
        canvas!.width = w;
        canvas!.height = h;
        ctx!.imageSmoothingEnabled = false;
        ctx!.clearRect(0, 0, w, h);
        ctx!.drawImage(state.sheet, x, y, w, h, 0, 0, w, h);
      }

      state.animId = requestAnimationFrame(renderLoop);
    }

    animStateRef.current.lastTime = performance.now();
    animStateRef.current.animId = requestAnimationFrame(renderLoop);

    return () => {
      if (animStateRef.current.animId) {
        cancelAnimationFrame(animStateRef.current.animId);
      }
    };
  }, [loaded, loop, speed, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        imageRendering: 'pixelated',
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
      }}
      className={`pixel-art select-none pointer-events-none ${className}`}
    />
  );
}
