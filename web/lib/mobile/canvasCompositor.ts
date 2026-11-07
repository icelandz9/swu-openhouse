import { CROP_DIMENSIONS_4_3, FilterPresetId } from '../contracts';
import { COLOR_FILTER_PRESETS } from './colorFilters';

export interface ComposeOptions {
  filter: FilterPresetId;
  brightness: number; // -30 to +30 (%)
  frame?: CanvasImageSource | null; // transparent 4:3 PNG from public/frames/
}

/**
 * Draws the 4:3 photo with the chosen color filter and brightness, then the CPE frame on top.
 * Pure drawing logic: no React, easy to test.
 */
export function composePhoto(
  canvas: HTMLCanvasElement,
  photo: CanvasImageSource,
  { filter, brightness, frame }: ComposeOptions
): void {
  const { width, height } = CROP_DIMENSIONS_4_3;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const preset = COLOR_FILTER_PRESETS[filter];
  const clamped = Math.max(-30, Math.min(30, brightness));
  const brightnessCss = `brightness(${1 + clamped / 100})`;
  ctx.filter = !preset || preset.cssFilter === 'none' ? brightnessCss : `${preset.cssFilter} ${brightnessCss}`;
  ctx.drawImage(photo, 0, 0, width, height);

  ctx.filter = 'none';
  if (frame) ctx.drawImage(frame, 0, 0, width, height);
}

/** Exports the canvas as JPEG quality 0.92 (docs/decisions.md). */
export function exportJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}
