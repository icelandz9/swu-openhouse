'use client';

import { useEffect, useRef, useState } from 'react';
import { CPEFrameTemplateId, FilterPresetId } from '../contracts';
import { composePhoto, exportJpeg } from './canvasCompositor';

// Transparent 4:3 PNGs in public/frames/ (see public/frames/README.md)
export const FRAME_FILES: Record<CPEFrameTemplateId, string> = {
  'cpe-official': '/frames/template-1-classic.png',
  'cpe-tech-circuit': '/frames/template-2-cpe-tech.png',
  'cpe-photostrip': '/frames/template-3-photostrip.png',
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // missing frame file -> draw photo only
    img.src = src;
  });
}

/**
 * Mobile editor hook: loads the photo and all 3 frames up front (no lag when switching),
 * re-renders whenever filter / brightness / frame change, and exports a JPEG.
 */
export function useCanvasCompositor(photoUrl: string | null) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [frames, setFrames] = useState<Partial<Record<CPEFrameTemplateId, HTMLImageElement>>>({});
  const [filter, setFilter] = useState<FilterPresetId>('original');
  const [brightness, setBrightness] = useState(0);
  const [frame, setFrame] = useState<CPEFrameTemplateId | null>(null);

  useEffect(() => {
    if (!photoUrl) return;
    loadImage(photoUrl).then(setPhoto);
  }, [photoUrl]);

  useEffect(() => {
    const ids = Object.keys(FRAME_FILES) as CPEFrameTemplateId[];
    Promise.all(ids.map((id) => loadImage(FRAME_FILES[id]))).then((imgs) => {
      const loaded: Partial<Record<CPEFrameTemplateId, HTMLImageElement>> = {};
      imgs.forEach((img, i) => {
        if (img) loaded[ids[i]] = img;
      });
      setFrames(loaded);
    });
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !photo) return;
    composePhoto(canvasRef.current, photo, {
      filter,
      brightness,
      frame: frame ? frames[frame] : null,
    });
  }, [photo, frames, filter, brightness, frame]);

  const exportImage = () => (canvasRef.current ? exportJpeg(canvasRef.current) : Promise.resolve(null));

  return {
    canvasRef,
    isPhotoReady: photo !== null,
    filter,
    setFilter,
    brightness,
    setBrightness,
    frame,
    setFrame,
    exportImage,
  };
}
