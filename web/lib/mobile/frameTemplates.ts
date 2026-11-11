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

  // template/booth-templates-pixel/ (windows from templates-pixel-all.json)
  frame('pixel', 'G1-world', 'โลกเกม', { x: 100, y: 200, w: 880, h: 860 }),
  frame('pixel', 'G2-handheld', 'เครื่องเกมพกพา', { x: 170, y: 190, w: 740, h: 700 }),
  frame('pixel', 'G3-stage-clear', 'ผ่านด่าน', { x: 110, y: 330, w: 860, h: 820 }),
  frame('pixel', 'G4-arcade', 'ตู้เกม', { x: 170, y: 290, w: 740, h: 740 }),
  frame('pixel', 'P05-character-select', 'เลือกตัวละคร', { x: 80, y: 250, w: 600, h: 800 }),
  frame('pixel', 'P06-new-challenger', 'ผู้ท้าชิง', { x: 90, y: 260, w: 900, h: 880 }),
  frame('pixel', 'P07-openhouse-exe', 'openhouse.exe', { x: 90, y: 190, w: 900, h: 900 }),
  frame('pixel', 'P08-space', 'อวกาศ', { x: 110, y: 230, w: 860, h: 860 }),
  frame('pixel', 'P09-dungeon', 'ดันเจี้ยน', { x: 150, y: 250, w: 780, h: 860 }),
  frame('pixel', 'P10-blocks', 'ตัวต่อ', { x: 100, y: 160, w: 720, h: 1000 }),
  frame('pixel', 'P11-snake', 'เกมงู', { x: 140, y: 200, w: 800, h: 880 }),
  frame('pixel', 'P12-kawaii', 'เลเวลรัก', { x: 120, y: 220, w: 840, h: 880 }),
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
