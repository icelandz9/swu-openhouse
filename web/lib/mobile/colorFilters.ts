import { FilterPresetId } from '../contracts';

export interface ColorFilterSettings {
  id: FilterPresetId;
  name: string;
  cssFilter: string;
  canvasRgbAdjust?: { r: number; g: number; b: number };
}

export const COLOR_FILTER_PRESETS: Record<FilterPresetId, ColorFilterSettings> = {
  original: {
    id: 'original',
    name: 'Original',
    cssFilter: 'none',
  },
  warm: {
    id: 'warm',
    name: 'Warm Glow',
    cssFilter: 'sepia(0.2) saturate(1.2) contrast(1.05)',
    canvasRgbAdjust: { r: 15, g: 5, b: -10 },
  },
  cool: {
    id: 'cool',
    name: 'Cool Breeze',
    cssFilter: 'hue-rotate(180deg) saturate(0.9) contrast(1.05)',
    canvasRgbAdjust: { r: -10, g: 5, b: 20 },
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage Film',
    cssFilter: 'sepia(0.4) contrast(0.9) brightness(0.95)',
    canvasRgbAdjust: { r: 20, g: 10, b: -15 },
  },
  bw: {
    id: 'bw',
    name: 'Monochrome',
    cssFilter: 'grayscale(1) contrast(1.2)',
  },
  rosy: {
    id: 'rosy',
    name: 'SWU Rosy',
    cssFilter: 'hue-rotate(330deg) saturate(1.1) brightness(1.05)',
    canvasRgbAdjust: { r: 25, g: -5, b: 5 },
  },
};
