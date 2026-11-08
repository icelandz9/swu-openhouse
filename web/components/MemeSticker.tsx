import React from 'react';
import type { Rect } from '@/lib/ai-vision/memeRules';

export interface MemeStickerProps {
  src: string;
  /** Normalized to the unmirrored video frame */
  rect: Rect;
  videoDimensions: { width: number; height: number };
}

/**
 * Shows a meme GIF over the mirrored, object-cover video in the 16:9 kiosk stage.
 * Uses the same video-to-stage mapping as HandMesh.
 */
export function MemeSticker({ src, rect, videoDimensions }: MemeStickerProps) {
  const videoAspect = (videoDimensions.width || 16) / (videoDimensions.height || 9);
  const stageAspect = 16 / 9;
  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;
  if (videoAspect > stageAspect) {
    scaleX = videoAspect / stageAspect;
    offsetX = (1 - scaleX) / 2;
  } else if (videoAspect < stageAspect) {
    scaleY = stageAspect / videoAspect;
    offsetY = (1 - scaleY) / 2;
  }

  // The video is mirrored on screen, so the right edge in the video is the left edge here
  const left = 1 - (offsetX + (rect.x + rect.w) * scaleX);
  const top = offsetY + rect.y * scaleY;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- an animated GIF must stay a plain <img>
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute z-[24] select-none object-contain"
      style={{
        left: `${left * 100}%`,
        top: `${top * 100}%`,
        width: `${rect.w * scaleX * 100}%`,
        height: `${rect.h * scaleY * 100}%`,
      }}
    />
  );
}
