// Stickers live in public/stickers/ as image files. scripts/build-sticker-manifest.mjs lists them
// in public/stickers/stickers.json before dev/build, and the mobile editor reads that list.

export interface StickerAsset {
  src: string; // e.g. /stickers/heart.png
}

/** A sticker placed on the photo. Positions are fractions of the output canvas. */
export interface PlacedSticker {
  id: number;
  src: string;
  cx: number; // centre x, 0..1 of canvas width
  cy: number; // centre y, 0..1 of canvas height
  w: number; // width, fraction of canvas width
  aspect: number; // natural height / width
  rot: number; // radians
}

export const STICKER_DEFAULT_WIDTH = 0.28;
export const STICKER_MIN_WIDTH = 0.06;
export const STICKER_MAX_WIDTH = 1.2;

export async function loadStickerCatalog(): Promise<StickerAsset[]> {
  try {
    const res = await fetch('/stickers/stickers.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const data: { stickers?: unknown } = await res.json();
    if (!Array.isArray(data.stickers)) return [];
    return data.stickers
      .filter((file): file is string => typeof file === 'string')
      .map((file) => ({ src: `/stickers/${encodeURIComponent(file)}` }));
  } catch {
    return [];
  }
}

/** Draws placed stickers onto a canvas whose size is the output size. */
export function drawStickers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stickers: PlacedSticker[],
  images: Map<string, HTMLImageElement>
): void {
  for (const s of stickers) {
    const img = images.get(s.src);
    if (!img) continue;
    const sw = s.w * width;
    const sh = sw * s.aspect;
    ctx.save();
    ctx.translate(s.cx * width, s.cy * height);
    ctx.rotate(s.rot);
    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }
}

// Groups for the "view all" sticker sheet: folders ("วิศวะรัก...", "เซเลปองครักษ์") first, then the rest.
export interface StickerGroup {
  id: string;
  title: string;
  stickers: StickerAsset[];
  /** Picture on the folder tile; also listed first inside the folder. */
  cover: StickerAsset;
}

// heart_*.png, pixelheart_*.png and the original heart sheet (sheet4-*.png)
const HEART_STICKER = /\/(heart|pixelheart)_[^/]*$|\/sheet4-[^/]*$/i;

// "วิศวะรัก เภสัช" (smooth heart) is the folder cover and the first heart inside.
const HEART_COVER = /\/sheet4-02\.png$/i;

function withCoverFirst(stickers: StickerAsset[], cover: RegExp): StickerAsset[] {
  const i = stickers.findIndex((s) => cover.test(decodeURIComponent(s.src)));
  return i <= 0 ? stickers : [stickers[i], ...stickers.slice(0, i), ...stickers.slice(i + 1)];
}

// Folder tiles in the sheet, in display order. Stickers that match no folder are listed loose after them.
const STICKER_FOLDERS: { id: string; title: string; match: RegExp; cover: RegExp }[] = [
  { id: 'hearts', title: 'วิศวะรัก...', match: HEART_STICKER, cover: HEART_COVER },
  // Engineering mascot dogs (dog-set1-*.png, dog-set2-*.png); the CPE dog is the cover.
  { id: 'celeb', title: 'เซเลปองครักษ์', match: /\/dog-set[^/]*$/i, cover: /\/dog-set1-05\.png$/i },
];

/** The id of the group that holds stickers outside every folder. */
export const LOOSE_STICKER_GROUP = 'others';

export function groupStickers(catalog: StickerAsset[]): StickerGroup[] {
  const groups: StickerGroup[] = [];
  let rest = catalog;
  for (const folder of STICKER_FOLDERS) {
    const inFolder = rest.filter((s) => folder.match.test(decodeURIComponent(s.src)));
    rest = rest.filter((s) => !inFolder.includes(s));
    const stickers = withCoverFirst(inFolder, folder.cover);
    if (stickers.length) groups.push({ id: folder.id, title: folder.title, stickers, cover: stickers[0] });
  }
  if (rest.length) groups.push({ id: LOOSE_STICKER_GROUP, title: 'สติกเกอร์อื่น ๆ', stickers: rest, cover: rest[0] });
  return groups;
}
