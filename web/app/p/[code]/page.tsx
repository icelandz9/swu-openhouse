'use client';

import React, { use, useState, useRef, useEffect, useCallback } from 'react';
import { Download, Sparkles, Frame, Check, ShieldCheck, Sun, Sticker, Trash2 } from 'lucide-react';
import { FilterPresetId } from '@/lib/contracts';
import { COLOR_FILTER_PRESETS } from '@/lib/mobile/colorFilters';
import { FRAME_TEMPLATES, NO_FRAME_ID, FrameTemplate, PHOTO_ONLY_SIZE, drawPhotoCover } from '@/lib/mobile/frameTemplates';
import {
  PlacedSticker,
  StickerAsset,
  STICKER_DEFAULT_WIDTH,
  drawStickers,
  loadStickerCatalog,
} from '@/lib/mobile/stickers';
import { StickerLayer } from '@/components/StickerLayer';
import { CpeLogo } from '@/components/CpeLogo';

const FILTER_LIST: { id: FilterPresetId; label: string; thai: string }[] = [
  { id: 'original', label: 'Original', thai: 'ต้นฉบับ' },
  { id: 'warm', label: 'Warm', thai: 'โทนอุ่น' },
  { id: 'vintage', label: 'Vintage', thai: 'วินเทจ' },
  { id: 'cool', label: 'Cool', thai: 'โทนเย็น' },
  { id: 'rosy', label: 'Rosy', thai: 'โรสโกลด์' },
  { id: 'bw', label: 'B&W', thai: 'ขาวดำ' },
];

type Tab = 'frames' | 'filters' | 'stickers';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function MobilePhotoEditorPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = decodeURIComponent(rawCode).toUpperCase();
  const normalizedCode = code.startsWith('OPH-') ? code : `OPH-${code}`;

  const [selectedFilter, setSelectedFilter] = useState<FilterPresetId>('original');
  const [brightness, setBrightness] = useState<number>(0); // -30 to +30
  const [selectedFrameId, setSelectedFrameId] = useState<string>(FRAME_TEMPLATES[0]?.id ?? NO_FRAME_ID);
  const [activeTab, setActiveTab] = useState<Tab>('frames');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [photoLoaded, setPhotoLoaded] = useState<boolean>(false);
  const [frameImages, setFrameImages] = useState<Record<string, HTMLImageElement>>({});

  const [stickerCatalog, setStickerCatalog] = useState<StickerAsset[]>([]);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<number | null>(null);
  const stickerImagesRef = useRef(new Map<string, HTMLImageElement>());
  const nextStickerId = useRef(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  const frame: FrameTemplate | null = FRAME_TEMPLATES.find((f) => f.id === selectedFrameId) ?? null;
  const frameImage = frame ? frameImages[frame.id] : undefined;
  // A frame whose PNG failed to load falls back to the plain photo
  const activeFrame = frame && frameImage ? frame : null;
  const outWidth = activeFrame ? activeFrame.width : PHOTO_ONLY_SIZE.width;
  const outHeight = activeFrame ? activeFrame.height : PHOTO_ONLY_SIZE.height;

  // Load photo on start with multi-stage CDN & fallback resolution
  useEffect(() => {
    let cancelled = false;

    async function loadAttendeePhoto() {
      let candidateSrc = `/api/photos/${normalizedCode}/file`;

      // 1. If scanned on the same machine/kiosk tab, check local storage
      try {
        const savedLatest = localStorage.getItem('swu_latest_photo');
        if (savedLatest) {
          const parsed = JSON.parse(savedLatest);
          if (parsed.code === normalizedCode && parsed.photoUrl) {
            candidateSrc = parsed.photoUrl;
          }
        }
      } catch {}

      // 2. Fetch metadata from API to resolve high-speed CDN photoUrl (Cloudflare R2)
      try {
        const res = await fetch(`/api/photos/${normalizedCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.photoUrl) {
            candidateSrc = data.photoUrl;
          }
        }
      } catch {}

      if (cancelled) return;

      // 3. Attempt loading candidateSrc, fallback to file endpoint, then sample photo
      let img = await loadImage(candidateSrc);
      if (!img && candidateSrc !== `/api/photos/${normalizedCode}/file`) {
        img = await loadImage(`/api/photos/${normalizedCode}/file`);
      }
      if (!img) {
        img = await loadImage('/sample-photo.jpg');
      }

      if (cancelled || !img) return;
      baseImageRef.current = img;
      setPhotoLoaded(true);
    }

    loadAttendeePhoto();

    return () => {
      cancelled = true;
    };
  }, [normalizedCode]);

  // Preload every frame so switching is instant
  useEffect(() => {
    Promise.all(FRAME_TEMPLATES.map((f) => loadImage(f.src))).then((imgs) => {
      const loaded: Record<string, HTMLImageElement> = {};
      imgs.forEach((img, i) => {
        if (img) loaded[FRAME_TEMPLATES[i].id] = img;
      });
      setFrameImages(loaded);
    });
  }, []);

  // Sticker list from public/stickers/stickers.json
  useEffect(() => {
    loadStickerCatalog().then(setStickerCatalog);
  }, []);

  // Photo (with filter) inside the frame window, then the frame on top. Stickers are a DOM
  // layer in the preview and are drawn onto the canvas only when saving.
  const renderComposite = useCallback(() => {
    const canvas = canvasRef.current;
    const photo = baseImageRef.current;
    if (!canvas || !photo) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = outWidth;
    canvas.height = outHeight;
    ctx.clearRect(0, 0, outWidth, outHeight);

    const win = activeFrame ? activeFrame.window : { x: 0, y: 0, w: outWidth, h: outHeight };

    const filterPreset = COLOR_FILTER_PRESETS[selectedFilter];
    let filterString = `brightness(${1 + brightness / 100})`;
    if (filterPreset?.cssFilter && filterPreset.cssFilter !== 'none') {
      filterString += ` ${filterPreset.cssFilter}`;
    }
    ctx.filter = filterString;
    drawPhotoCover(ctx, photo, win);
    ctx.filter = 'none';

    if (selectedFilter === 'rosy') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 0; i < 4000; i++) {
        ctx.fillRect(win.x + Math.random() * win.w, win.y + Math.random() * win.h, 1, 1);
      }
    }

    if (activeFrame && frameImage) {
      ctx.drawImage(frameImage, 0, 0, outWidth, outHeight);
    }
  }, [selectedFilter, brightness, activeFrame, frameImage, outWidth, outHeight]);

  useEffect(() => {
    if (photoLoaded) renderComposite();
  }, [photoLoaded, renderComposite]);

  const addSticker = async (asset: StickerAsset) => {
    let img = stickerImagesRef.current.get(asset.src);
    if (!img) {
      const loaded = await loadImage(asset.src);
      if (!loaded) return;
      img = loaded;
      stickerImagesRef.current.set(asset.src, img);
    }
    const id = nextStickerId.current++;
    const aspect = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
    // Each new sticker lands slightly offset so stacked ones stay visible
    const offset = ((id - 1) % 5) * 0.04;
    setStickers((prev) => [
      ...prev,
      { id, src: asset.src, cx: 0.5 + offset, cy: 0.4 + offset, w: STICKER_DEFAULT_WIDTH, aspect, rot: 0 },
    ]);
    setSelectedStickerId(id);
  };

  const updateSticker = useCallback((id: number, patch: Partial<PlacedSticker>) => {
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const deleteSticker = useCallback((id: number) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
    setSelectedStickerId(null);
  }, []);

  // Download: composite canvas + stickers, full resolution (with Web Share API for iOS Camera Roll)
  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(canvas, 0, 0);
      drawStickers(ctx, out.width, out.height, stickers, stickerImagesRef.current);

      const fileName = `SWU-OpenHouse-${normalizedCode}.jpg`;

      // Try Web Share API for native iOS / Android "Save to Photos"
      if (typeof navigator !== 'undefined' && navigator.share && out.toBlob) {
        try {
          const blob = await new Promise<Blob | null>((resolve) =>
            out.toBlob((b) => resolve(b), 'image/jpeg', 0.95)
          );
          if (blob) {
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'SWU CPE Open House 2026',
              });
              setSaveSuccess(true);
              setTimeout(() => setSaveSuccess(false), 2500);
              return;
            }
          }
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return; // User cancelled share sheet
        }
      }

      // Standard desktop / browser download fallback
      const link = document.createElement('a');
      link.download = fileName;
      link.href = out.toDataURL('image/jpeg', 0.95);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export photo:', err);
    }
  };

  const tabButton = (tab: Tab, label: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
        activeTab === tab ? 'bg-[#CE1126] text-white shadow-md' : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="mobile-app-shell mx-auto min-h-screen max-w-md bg-black text-slate-200 flex flex-col justify-between pb-6 select-none shadow-2xl">
      {/* Top Header Bar */}
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 bg-[#0A0A0A]">
        <div className="flex items-center gap-3">
          <CpeLogo className="h-8" />
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#CE1126] uppercase">CPE OPEN HOUSE</div>
            <div className="mono text-xs font-bold text-white">#{normalizedCode.replace('OPH-', '')}</div>
          </div>
        </div>

        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-lg bg-[#CE1126] hover:bg-[#e1132b] px-3.5 py-1.5 text-xs font-bold text-white transition-colors shadow-md"
        >
          {saveSuccess ? (
            <>
              <Check className="size-3.5 text-white" /> บันทึกแล้ว!
            </>
          ) : (
            <>
              <Download className="size-3.5" /> บันทึกรูป
            </>
          )}
        </button>
      </header>

      {/* Photo preview: same proportions as the saved file */}
      <div className="px-4 py-4">
        <div
          className="relative mx-auto w-full max-h-[62vh] overflow-hidden rounded-xl bg-black border border-white/10 shadow-2xl"
          style={{ aspectRatio: `${outWidth} / ${outHeight}`, maxWidth: `calc(62vh * ${outWidth / outHeight})` }}
        >
          <canvas ref={canvasRef} className="h-full w-full" />
          {photoLoaded && (
            <StickerLayer
              stickers={stickers}
              selectedId={selectedStickerId}
              onSelect={setSelectedStickerId}
              onChange={updateSticker}
              onDelete={deleteSticker}
              canvasWidth={outWidth}
              canvasHeight={outHeight}
            />
          )}
          {!photoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="mono text-xs text-slate-400 animate-pulse">กำลังโหลดรูปภาพ...</div>
            </div>
          )}
        </div>
      </div>

      {/* Editing Controls */}
      <div className="px-5 space-y-4">
        {/* Brightness */}
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-2">
              <Sun className="size-3.5 text-amber-400" /> ปรับความสว่าง
            </span>
            <span className="mono text-slate-400">{brightness > 0 ? `+${brightness}` : brightness}%</span>
          </div>
          <input
            type="range"
            min="-30"
            max="30"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="brightness-slider w-full"
          />
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-white/10 bg-[#0A0A0A] p-1">
          {tabButton('frames', <><Frame className="size-3.5" /> กรอบรูป ({FRAME_TEMPLATES.length})</>)}
          {tabButton('filters', <><Sparkles className="size-3.5" /> ฟิลเตอร์ ({FILTER_LIST.length})</>)}
          {tabButton('stickers', <><Sticker className="size-3.5" /> สติกเกอร์</>)}
        </div>

        {/* Frames */}
        {activeTab === 'frames' && (
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setSelectedFrameId(NO_FRAME_ID)}
              className={`flex aspect-[3/4] flex-col items-center justify-center rounded-xl border text-center transition-all ${
                selectedFrameId === NO_FRAME_ID
                  ? 'border-[#CE1126] bg-[#CE1126]/10 text-white shadow-md'
                  : 'border-white/10 bg-[#0A0A0A] text-slate-400'
              }`}
            >
              <div className="text-[11px] font-bold">ไม่มีกรอบ</div>
              <div className="mt-0.5 text-[9px] text-slate-500">รูปเดิม 4:3</div>
            </button>
            {FRAME_TEMPLATES.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFrameId(f.id)}
                aria-label={f.name}
                className={`overflow-hidden rounded-xl border-2 transition-all ${
                  selectedFrameId === f.id ? 'border-[#CE1126] shadow-md' : 'border-transparent opacity-80'
                }`}
              >
                <img src={f.src} alt={f.name} className="block aspect-[3/4] w-full bg-[#1C1C1C] object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        {activeTab === 'filters' && (
          <div className="grid grid-cols-3 gap-2">
            {FILTER_LIST.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  selectedFilter === f.id
                    ? 'border-[#06B6D4] bg-[#06B6D4]/10 text-white shadow-md'
                    : 'border-white/10 bg-[#0A0A0A] text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold">{f.label}</div>
                <div className="mt-1 text-[10px] text-slate-500">{f.thai}</div>
              </button>
            ))}
          </div>
        )}

        {/* Stickers */}
        {activeTab === 'stickers' && (
          <div className="space-y-3">
            {stickerCatalog.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] p-6 text-center">
                <Sticker className="mx-auto size-7 text-slate-500" />
                <div className="mt-2 text-xs font-bold text-slate-300">สติกเกอร์กำลังจะมาเร็ว ๆ นี้</div>
                <div className="mt-1 text-[10px] text-slate-500">Coming soon</div>
              </div>
            ) : (
              <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto overscroll-contain pr-1">
                {stickerCatalog.map((s) => (
                  <button
                    key={s.src}
                    onClick={() => addSticker(s)}
                    className="grid aspect-square place-items-center rounded-xl border border-white/10 bg-[#0A0A0A] p-2 active:scale-95 transition-transform"
                  >
                    <img src={s.src} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                  </button>
                ))}
              </div>
            )}
            {stickers.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>ลากเพื่อย้าย · ปุ่มมุมขวาล่างหรือสองนิ้วเพื่อย่อ ขยาย หมุน</span>
                <button
                  onClick={() => {
                    setStickers([]);
                    setSelectedStickerId(null);
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 font-bold text-slate-300"
                >
                  <Trash2 className="size-3.5" /> ล้างทั้งหมด
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Action Bar & PDPA Notice */}
      <footer className="px-5 pt-4 space-y-3">
        <button
          onClick={handleDownload}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#CE1126] hover:bg-[#e1132b] text-sm font-bold text-white transition-colors shadow-xl"
        >
          <Download className="size-4" /> บันทึกรูปลงอุปกรณ์ ({outWidth}×{outHeight})
        </button>

        {/* Follow the department on Instagram */}
        <a
          href="https://www.instagram.com/cpe_swu/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-white/10 bg-[#141A26] text-sm font-bold text-white transition-colors hover:bg-[#1B2232] active:scale-[.99]"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          ติดตาม IG @cpe_swu
        </a>

        <p className="text-center text-xs text-slate-400">
          ขอบคุณที่แวะมาบูธวิศวะคอมนะ #{normalizedCode.replace('OPH-', '')}
        </p>

        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 text-center">
          <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
          <span>เก็บรักษาภาพ 7 วันตามนโยบาย PDPA • วิศวกรรมคอมพิวเตอร์ มศว</span>
        </div>
      </footer>
    </main>
  );
}
