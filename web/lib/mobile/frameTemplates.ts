// CPE Open House frame templates (portrait 1080x1440) for the mobile editor.
// The PNGs in public/frames/cpe/ are transparent where the photo goes; `window` is that area.
// Regenerate them from the designer's files with scripts/frames/make_frame_overlays.py,
// which also prints the window values below (see public/frames/README.md).

export interface PhotoWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameTemplate {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  window: PhotoWindow;
}

export const NO_FRAME_ID = 'none';

/** Output size when no frame is chosen: the original 4:3 photo */
export const PHOTO_ONLY_SIZE = { width: 1440, height: 1080 } as const;

const W = 1080;
const H = 1440;

// id = file name in the designer's folder (template/CPE Open House/<id>.png)
const frame = (id: string, name: string, window: PhotoWindow): FrameTemplate => ({
  id,
  name,
  src: `/frames/cpe/${id}.png`,
  width: W,
  height: H,
  window,
});

export const FRAME_TEMPLATES: FrameTemplate[] = [
  frame('1', 'เฟืองวิศวะ', { x: 75, y: 69, w: 931, h: 1021 }),
  frame('2', 'พิกเซลเกม', { x: 74, y: 63, w: 932, h: 980 }),
  frame('3', 'เกมคอนโซล', { x: 73, y: 63, w: 934, h: 1062 }),
  frame('4', 'หน้าต่างย้อนยุค', { x: 70, y: 103, w: 930, h: 992 }),
  frame('5', 'ป้ายถนน', { x: 75, y: 72, w: 930, h: 1019 }),
  frame('14', '#ท้าย CPE', { x: 74, y: 91, w: 932, h: 1021 }),
  frame('15', 'คลาสสิก', { x: 75, y: 68, w: 930, h: 1019 }),
];

/**
 * Draws the photo so it fills `win` (like CSS object-fit: cover), centred.
 * The window is grown by a few px so no gap shows under the frame's soft edge.
 */
export function drawPhotoCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, win: PhotoWindow): void {
  const pad = 4;
  const x = win.x - pad;
  const y = win.y - pad;
  const w = win.w + pad * 2;
  const h = win.h + pad * 2;
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  if (!iw || !ih) return;

  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}
