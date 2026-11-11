// CPE Open House frame templates (portrait 1080x1440) for the mobile editor.
// The PNGs in public/frames/<group>/ are transparent where the photo goes; `window` is that area.
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
  /** FrameGroup id; also the folder in public/frames/ */
  group: string;
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

// Groups shown in the frames tab: the department's own frames first, then the other themes.
export interface FrameGroup {
  id: string;
  title: string;
}

export const FRAME_GROUPS: FrameGroup[] = [
  { id: 'cpe', title: 'กรอบภาคคอม' },
  { id: 'style', title: 'สไตล์อื่น ๆ' },
  { id: 'pixel', title: 'ธีมเกม 8-bit' },
];

// group = folder in public/frames/, id = file name without .png
const frame = (group: string, id: string, name: string, window: PhotoWindow): FrameTemplate => ({
  id,
  group,
  name,
  src: `/frames/${group}/${id}.png`,
  width: W,
  height: H,
  window,
});

export const FRAME_TEMPLATES: FrameTemplate[] = [
  // template/CPE Open House/ (designer exports with a transparent photo area)
  frame('cpe', 'cpe-frame-1', 'เฟืองวิศวะ', { x: 73, y: 68, w: 934, h: 1023 }),
  frame('cpe', 'cpe-frame-2', 'พิกเซลเกม', { x: 73, y: 61, w: 934, h: 983 }),
  frame('cpe', 'cpe-frame-3', 'เกมคอนโซล', { x: 73, y: 61, w: 934, h: 1069 }),
  frame('cpe', 'cpe-frame-4', 'หน้าต่างย้อนยุค', { x: 68, y: 102, w: 934, h: 995 }),
  frame('cpe', 'cpe-frame-5', 'ป้ายถนน', { x: 73, y: 70, w: 934, h: 1023 }),
  frame('cpe', 'cpe-frame-6', 'เฟืองแดง', { x: 73, y: 71, w: 934, h: 1023 }),
  frame('cpe', '14', '#ท้าย CPE', { x: 74, y: 91, w: 932, h: 1021 }),
  frame('cpe', '15', 'คลาสสิก', { x: 75, y: 68, w: 930, h: 1019 }),

  // template/booth-templates-934x1023/ (templates.json): every window is 934x1023, the same shape
  // as the kiosk's frame-mode photo (986x1080), so the photo fills it with nothing cut
  frame('style', 'A-maroon', 'แดงเลือดหมู', { x: 73, y: 60, w: 934, h: 1023 }),
  frame('style', 'B-film', 'ฟิล์ม', { x: 73, y: 80, w: 934, h: 1023 }),
  frame('style', 'C-white-red', 'ขาวแดง', { x: 73, y: 60, w: 934, h: 1023 }),
  frame('style', 'E-magazine', 'ปกนิตยสาร', { x: 73, y: 250, w: 934, h: 1023 }),
  frame('style', 'F-digicam', 'กล้องดิจิทัล', { x: 73, y: 110, w: 934, h: 1023 }),
  frame('style', 'G-polaroid', 'โพลารอยด์', { x: 73, y: 100, w: 934, h: 1023 }),
  frame('style', 'H-ticket', 'ตั๋วเข้างาน', { x: 73, y: 70, w: 934, h: 1023 }),

  frame('pixel', 'D-pixel', 'พิกเซล 1UP', { x: 73, y: 190, w: 934, h: 1023 }),
  frame('pixel', 'I-world', 'โลกเกม', { x: 73, y: 170, w: 934, h: 1023 }),
  frame('pixel', 'J-handheld', 'เครื่องเกมพกพา', { x: 73, y: 70, w: 934, h: 1023 }),
  frame('pixel', 'K-stage-clear', 'ผ่านด่าน', { x: 73, y: 225, w: 934, h: 1023 }),
  frame('pixel', 'L-arcade', 'ตู้เกม', { x: 73, y: 210, w: 934, h: 1023 }),
  frame('pixel', 'M-character-select', 'เลือกตัวละคร', { x: 73, y: 120, w: 934, h: 1023 }),
  frame('pixel', 'N-new-challenger', 'ผู้ท้าชิง', { x: 73, y: 200, w: 934, h: 1023 }),
  frame('pixel', 'O-openhouse-exe', 'openhouse.exe', { x: 73, y: 130, w: 934, h: 1023 }),
  frame('pixel', 'P-space', 'เลเวลอัป', { x: 73, y: 150, w: 934, h: 1023 }),
  frame('pixel', 'Q-dungeon', 'ดันเจี้ยน', { x: 73, y: 170, w: 934, h: 1023 }),
  frame('pixel', 'R-blocks', 'ตัวต่อ', { x: 73, y: 150, w: 934, h: 1023 }),
  frame('pixel', 'S-snake', 'เกมงู', { x: 73, y: 130, w: 934, h: 1023 }),
  frame('pixel', 'T-kawaii', 'เลเวลรัก', { x: 73, y: 150, w: 934, h: 1023 }),
];

/**
 * Draws the whole photo inside `win` (like CSS object-fit: contain), so nobody at the edge of the
 * kiosk shot is cut off. The leftover bands are filled with a soft, darkened, blown-up copy of the
 * same photo instead of empty space.
 *
 * The blur is made by shrinking the photo to a tiny canvas and scaling it back up, because
 * `ctx.filter` does nothing on older iOS Safari.
 */
export function drawPhotoContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLCanvasElement, win: PhotoWindow): void {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  if (!iw || !ih) return;

  // 1. Background: cover-fit, blurred by down/up-scaling, then darkened
  const pad = 4;
  const bx = win.x - pad;
  const by = win.y - pad;
  const bw = win.w + pad * 2;
  const bh = win.h + pad * 2;
  const tiny = document.createElement('canvas');
  tiny.width = Math.max(1, Math.round(bw / 24));
  tiny.height = Math.max(1, Math.round(bh / 24));
  const tctx = tiny.getContext('2d');
  if (tctx) {
    const s = Math.max(tiny.width / iw, tiny.height / ih);
    const sw = tiny.width / s;
    const sh = tiny.height / s;
    tctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, tiny.width, tiny.height);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tiny, bx, by, bw, bh);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }

  // 2. The whole photo, centred
  const scale = Math.min(win.w / iw, win.h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, 0, 0, iw, ih, win.x + (win.w - dw) / 2, win.y + (win.h - dh) / 2, dw, dh);
}

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
