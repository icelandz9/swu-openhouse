import { FilterPresetId } from '../contracts';

/**
 * Color filters for the mobile editor (/p/[code]).
 *
 * Each filter is a color matrix applied to the pixels directly, instead of `ctx.filter`, so it looks
 * the same in every browser (older iOS Safari ignores `ctx.filter`, so filters did nothing there).
 * The matrix math follows the CSS filter functions (saturate, sepia, contrast, brightness).
 */

// 3x4 matrix in 0–255 space: [rR, rG, rB, rOffset, gR, gG, gB, gOffset, bR, bG, bB, bOffset]
type ColorMatrix = number[];

const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

// a ∘ b: apply b first, then a
function compose(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out: ColorMatrix = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      let v = 0;
      for (let k = 0; k < 3; k++) v += a[row * 4 + k] * b[k * 4 + col];
      if (col === 3) v += a[row * 4 + 3];
      out.push(v);
    }
  }
  return out;
}

function chain(...steps: ColorMatrix[]): ColorMatrix {
  return steps.reduce((acc, step) => compose(step, acc), IDENTITY);
}

const saturate = (s: number): ColorMatrix => [
  0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0,
  0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0,
  0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0,
];

const sepia = (amount: number): ColorMatrix => {
  const a = 1 - amount;
  return [
    0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0,
    0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0,
    0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a, 0,
  ];
};

const contrast = (c: number): ColorMatrix => {
  const o = 127.5 * (1 - c);
  return [c, 0, 0, o, 0, c, 0, o, 0, 0, c, o];
};

const brightness = (b: number): ColorMatrix => [b, 0, 0, 0, 0, b, 0, 0, 0, 0, b, 0];

// Adds a color cast (values in 0–255)
const tint = (r: number, g: number, b: number): ColorMatrix => [1, 0, 0, r, 0, 1, 0, g, 0, 0, 1, b];

// Lifts the blacks for a faded film look
const fade = (amount: number): ColorMatrix => {
  const k = 1 - amount / 255;
  return [k, 0, 0, amount, 0, k, 0, amount, 0, 0, k, amount];
};

export interface ColorFilterSettings {
  id: FilterPresetId;
  name: string;
  matrix: ColorMatrix;
  /** Rough CSS equivalent, for places that still preview with CSS filters. */
  cssFilter: string;
}

export const COLOR_FILTER_PRESETS: Record<FilterPresetId, ColorFilterSettings> = {
  original: {
    id: 'original',
    name: 'Original',
    matrix: IDENTITY,
    cssFilter: 'none',
  },
  warm: {
    id: 'warm',
    name: 'Warm Glow',
    matrix: chain(saturate(1.15), contrast(1.05), tint(16, 5, -14)),
    cssFilter: 'sepia(0.2) saturate(1.2) contrast(1.05)',
  },
  cool: {
    id: 'cool',
    name: 'Cool Breeze',
    matrix: chain(saturate(0.95), contrast(1.05), tint(-14, 2, 18)),
    cssFilter: 'saturate(0.95) contrast(1.05) hue-rotate(-10deg)',
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage Film',
    matrix: chain(sepia(0.35), contrast(0.9), brightness(0.97), fade(14)),
    cssFilter: 'sepia(0.4) contrast(0.9) brightness(0.95)',
  },
  bw: {
    id: 'bw',
    name: 'Monochrome',
    matrix: chain(saturate(0), contrast(1.2)),
    cssFilter: 'grayscale(1) contrast(1.2)',
  },
  rosy: {
    id: 'rosy',
    name: 'SWU Rosy',
    matrix: chain(saturate(1.1), brightness(1.04), tint(18, -4, 8)),
    cssFilter: 'saturate(1.1) brightness(1.05)',
  },
};

/**
 * Applies a filter (and brightness from -30 to +30 %) to a region of the canvas, in place.
 */
export function applyColorFilter(
  ctx: CanvasRenderingContext2D,
  region: { x: number; y: number; w: number; h: number },
  filterId: FilterPresetId,
  brightnessPercent = 0
): void {
  const preset = COLOR_FILTER_PRESETS[filterId] ?? COLOR_FILTER_PRESETS.original;
  const b = 1 + Math.max(-30, Math.min(30, brightnessPercent)) / 100;
  const m = b === 1 ? preset.matrix : compose(brightness(b), preset.matrix);
  if (m === IDENTITY) return;

  const x = Math.max(0, Math.round(region.x));
  const y = Math.max(0, Math.round(region.y));
  const w = Math.min(ctx.canvas.width - x, Math.round(region.w));
  const h = Math.min(ctx.canvas.height - y, Math.round(region.h));
  if (w <= 0 || h <= 0) return;

  const image = ctx.getImageData(x, y, w, h);
  const d = image.data; // Uint8ClampedArray clamps to 0–255 on write
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const bl = d[i + 2];
    d[i] = m[0] * r + m[1] * g + m[2] * bl + m[3];
    d[i + 1] = m[4] * r + m[5] * g + m[6] * bl + m[7];
    d[i + 2] = m[8] * r + m[9] * g + m[10] * bl + m[11];
  }
  ctx.putImageData(image, x, y);
}
