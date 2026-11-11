'use client';

import React, { use, useState, useRef, useEffect, useCallback } from 'react';
import { Download, Sparkles, Frame, Check, ShieldAlert, Sun, Sticker, Trash2, ShieldCheck, Lock, Maximize2, X, ChevronLeft } from 'lucide-react';
import { FilterPresetId } from '@/lib/contracts';
import { applyColorFilter } from '@/lib/mobile/colorFilters';
import { FRAME_GROUPS, FRAME_TEMPLATES, NO_FRAME_ID, FrameTemplate, PHOTO_ONLY_SIZE, drawPhotoContain, drawPhotoCover } from '@/lib/mobile/frameTemplates';
import {
  PlacedSticker,
  StickerAsset,
  STICKER_DEFAULT_WIDTH,
  drawStickers,
  groupStickers,
  LOOSE_STICKER_GROUP,
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
type AuthStatus = 'checking' | 'authorized' | 'forbidden' | 'not_found';

// Demo code for trying the editor (home page card). The kiosk never issues it: its codes skip "1".
const DEMO_CODE = 'OPH-SWU1';

// A drawn placeholder instead of a stock photo of a real person (PDPA).
function makeDemoPhoto(): Promise<HTMLImageElement | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  const bg = ctx.createLinearGradient(0, 0, 1440, 1080);
  bg.addColorStop(0, '#38BDF8');
  bg.addColorStop(0.5, '#F472B6');
  bg.addColorStop(1, '#FBBF24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1440, 1080);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(720, 470, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(720, 1000, 360, 280, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('รูปตัวอย่าง', 720, 200);
  ctx.font = '48px sans-serif';
  ctx.fillText('CPE SWU Open House', 720, 270);
  return loadImage(canvas.toDataURL('image/jpeg', 0.9));
}

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

  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [selectedFilter, setSelectedFilter] = useState<FilterPresetId>('original');
  const [brightness, setBrightness] = useState<number>(0); // -30 to +30
  const [selectedFrameId, setSelectedFrameId] = useState<string>(FRAME_TEMPLATES[0]?.id ?? NO_FRAME_ID);
  const [activeTab, setActiveTab] = useState<Tab>('frames');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [photoLoaded, setPhotoLoaded] = useState<boolean>(false);
  const [stickerSheetOpen, setStickerSheetOpen] = useState<boolean>(false);
  const [openStickerGroup, setOpenStickerGroup] = useState<string | null>(null);
  const [filterThumbs, setFilterThumbs] = useState<Partial<Record<FilterPresetId, string>>>({});
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
  // Without a frame the output is the photo itself: 1440x1080 (4:3) or 986x1080 (frame shape), whichever the kiosk took.
  // photoLoaded re-renders once the image is in, so the ref has its real size here.
  const photoW = (photoLoaded && baseImageRef.current?.naturalWidth) || PHOTO_ONLY_SIZE.width;
  const photoH = (photoLoaded && baseImageRef.current?.naturalHeight) || PHOTO_ONLY_SIZE.height;
  const outWidth = activeFrame ? activeFrame.width : photoW;
  const outHeight = activeFrame ? activeFrame.height : photoH;

  // Verify Scan Token / Claim and Load Photo
  useEffect(() => {
    let cancelled = false;

    async function verifyAndLoadAttendeePhoto() {
      // 1. Extract ?t= token from URL
      let token = '';
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search);
        token = searchParams.get('t') || '';
      }

      // Direct access allowed - bypass 403 blocking
      if (!cancelled) setAuthStatus('authorized');

      if (normalizedCode === DEMO_CODE) {
        const demo = await makeDemoPhoto();
        if (cancelled || !demo) return;
        baseImageRef.current = demo;
        setPhotoLoaded(true);
        return;
      }

      // 3. Resolve candidate photo URL
      let candidateSrc = `/api/photos/${normalizedCode}/file${token ? `?t=${encodeURIComponent(token)}` : ''}`;

      // A. If scanned on the same machine/kiosk tab, check local storage
      try {
        const savedLatest = localStorage.getItem('swu_latest_photo');
        if (savedLatest) {
          const parsed = JSON.parse(savedLatest);
          if (parsed.code === normalizedCode && parsed.photoUrl) {
            candidateSrc = parsed.photoUrl;
          }
        }
      } catch {}

      // B. Fetch metadata from API with token to resolve high-speed CDN photoUrl (Cloudflare R2)
      try {
        const metaRes = await fetch(`/api/photos/${normalizedCode}${token ? `?t=${encodeURIComponent(token)}` : ''}`);
        if (metaRes.ok) {
          const data = await metaRes.json();
          if (data?.photoUrl) {
            candidateSrc = data.photoUrl;
          }
        }
      } catch {}

      if (cancelled) return;

      // C. Attempt loading strictly from Cloudflare R2 / API endpoint
      let img = await loadImage(candidateSrc);
      if (!img && candidateSrc !== `/api/photos/${normalizedCode}/file`) {
        img = await loadImage(`/api/photos/${normalizedCode}/file${token ? `?t=${encodeURIComponent(token)}` : ''}`);
      }

      if (cancelled) return;

      // If photo is not found on Cloudflare R2, mark not_found (Never use fake sample photo)
      if (!img) {
        setAuthStatus('not_found');
        return;
      }
      baseImageRef.current = img;
      setPhotoLoaded(true);
    }

    verifyAndLoadAttendeePhoto();

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

  // Photo (with filter) inside the frame window, then the frame on top.
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

    // Whole photo in the frame window: nobody standing at the edge of the kiosk shot gets cut off
    drawPhotoContain(ctx, photo, win);
    applyColorFilter(ctx, win, selectedFilter, brightness);

    if (activeFrame && frameImage) {
      ctx.drawImage(frameImage, 0, 0, outWidth, outHeight);
    }
  }, [selectedFilter, brightness, activeFrame, frameImage, outWidth, outHeight]);

  useEffect(() => {
    if (photoLoaded) renderComposite();
  }, [photoLoaded, renderComposite]);

  // Small preview of the photo in every filter, for the filter tab
  useEffect(() => {
    const photo = baseImageRef.current;
    if (!photoLoaded || !photo) return;
    const size = 120;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = size;
    thumbCanvas.height = size;
    const ctx = thumbCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const thumbs: Partial<Record<FilterPresetId, string>> = {};
    for (const f of FILTER_LIST) {
      ctx.clearRect(0, 0, size, size);
      drawPhotoCover(ctx, photo, { x: 0, y: 0, w: size, h: size });
      applyColorFilter(ctx, { x: 0, y: 0, w: size, h: size }, f.id);
      thumbs[f.id] = thumbCanvas.toDataURL('image/jpeg', 0.85);
    }
    setFilterThumbs(thumbs);
  }, [photoLoaded]);

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
      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 px-tab px-corners text-xs font-bold ${
        activeTab === tab ? 'is-active' : 'hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  // 1. Loading State
  if (authStatus === 'checking') {
    return (
      <main className="min-h-dvh px-bg text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="relative mb-6">
          <div className="size-16 rounded-full border-4 border-white/10 border-t-[#CE1126] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <CpeLogo className="h-6" />
          </div>
        </div>
        <p className="font-pixel px-blink mb-3 text-xs text-[var(--px-gold)]">LOADING...</p>
        <h2 className="text-lg font-bold text-white mb-2">กำลังตรวจสอบสิทธิ์ความปลอดภัย...</h2>
        <p className="text-xs text-slate-400">Verifying secure QR scan token for #{normalizedCode.replace('OPH-', '')}</p>
      </main>
    );
  }



  // 3. Not Found State
  if (authStatus === 'not_found') {
    return (
      <main className="min-h-dvh px-bg text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-full max-w-sm px-panel px-corners p-6">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center bg-black/30 px-corners text-[var(--px-cream)]">
            <Trash2 className="size-7" />
          </div>
          <p className="font-pixel mb-3 text-sm text-[var(--px-red-hi)]">GAME OVER</p>
          <h1 className="text-lg font-bold text-white mb-2">ไม่พบรูปภาพนี้</h1>
          <p className="text-xs text-[var(--px-cream)]/80 mb-6">รูปภาพรหัส {normalizedCode} อาจถูกลบ หรือหมดอายุการจัดเก็บแล้ว (เกิน 7 วัน ตามนโยบาย PDPA)</p>
          <a
            href="/"
            className="flex h-11 w-full items-center justify-center gap-2 px-btn px-btn-red px-corners text-xs"
          >
            กลับสู่หน้าหลัก
          </a>
        </div>
      </main>
    );
  }

  // 4. Authorized State: Mobile Photo Editor
  return (
    <main className="mobile-app-shell mx-auto min-h-screen max-w-md px-bg text-slate-200 flex flex-col justify-between pb-6 select-none shadow-2xl">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b-4 border-[var(--px-red-dark)] bg-[#1a0709]/90 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <CpeLogo className="h-6" />
          <div>
            <div className="font-pixel text-[9px] text-white">SWU OPEN HOUSE</div>
            <div className="text-[10px] text-slate-400">วิศวกรรมคอมพิวเตอร์</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-pixel-sm text-[10px] text-[var(--px-muted)]">PLAYER</span>
          <span className="font-pixel-sm text-xs font-bold text-[var(--px-gold)] bg-black/50 px-2 py-0.5 px-corners">
            #{normalizedCode.replace('OPH-', '')}
          </span>
        </div>
      </header>

      {/* Main Canvas / Preview Stage */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 min-h-[460px]">
        <p className="font-pixel mb-3 text-[10px] text-[var(--px-gold)]">★ STAGE CLEAR ★</p>
        <div
          className="relative max-w-full overflow-hidden px-screen"
          style={{
            width: '100%',
            maxWidth: '340px',
            aspectRatio: `${outWidth} / ${outHeight}`,
          }}
        >
          {/* Canvas for photo + filter + frame */}
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain block"
            style={{ width: '100%', height: '100%' }}
          />

          {/* Interactive Sticker Overlay */}
          <StickerLayer
            stickers={stickers}
            selectedId={selectedStickerId}
            onSelect={setSelectedStickerId}
            onChange={updateSticker}
            onDelete={deleteSticker}
            canvasWidth={outWidth}
            canvasHeight={outHeight}
          />

          {/* Save Success Banner */}
          {saveSuccess && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 animate-in fade-in z-50">
              <div className="size-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
                <Check className="size-6 stroke-[3]" />
              </div>
              <p className="text-sm font-bold">บันทึกรูปภาพเรียบร้อยแล้ว!</p>
              <p className="text-xs text-slate-300 text-center mt-1">รูปบันทึกลงในเครื่องของคุณแล้ว</p>
            </div>
          )}
        </div>
      </div>

      {/* Customization Controls Panel */}
      <div className="px-4 space-y-3">
        {/* Tab Switcher */}
        <div className="flex gap-1 p-1.5 px-panel px-corners">
          {tabButton('frames', <><Frame className="size-3.5" /> กรอบรูป</>)}
          {tabButton('filters', <><Sparkles className="size-3.5" /> ฟิลเตอร์</>)}
          {tabButton('stickers', <><Sticker className="size-3.5" /> สติกเกอร์</>)}
        </div>

        {/* Frames Tab */}
        {activeTab === 'frames' && (
          <div className="space-y-2">
            {/* No frame: the original 4:3 photo, edge to edge */}
            <button
              onClick={() => setSelectedFrameId(NO_FRAME_ID)}
              aria-pressed={selectedFrameId === NO_FRAME_ID}
              className={`px-corners flex w-full items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${
                selectedFrameId === NO_FRAME_ID ? 'bg-[var(--px-red)] text-white' : 'px-card text-[var(--px-muted)] hover:text-white'
              }`}
            >
              <span>ไม่ใส่กรอบ · รูปเต็ม</span>
              <span className="font-pixel-sm text-[10px]">
                {photoW}×{photoH}
              </span>
            </button>
            {FRAME_GROUPS.map((group) => {
              const frames = FRAME_TEMPLATES.filter((f) => f.group === group.id);
              if (!frames.length) return null;
              return (
                <div key={group.id}>
                  <p className="font-pixel-sm px-1 text-[11px] font-bold text-[var(--px-gold)]">
                    {group.title} <span className="font-normal text-slate-500">· {frames.length} แบบ</span>
                  </p>
                  <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-none px-1">
                    {frames.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => setSelectedFrameId(tmpl.id)}
                        className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 px-corners transition-all ${
                          selectedFrameId === tmpl.id
                            ? 'bg-[var(--px-red)] text-white'
                            : 'px-card text-[var(--px-muted)] hover:text-white'
                        }`}
                      >
                        <div className="w-14 h-20 bg-slate-900 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center relative">
                          <img src={tmpl.src} alt="" className="w-full h-full object-contain pointer-events-none" loading="lazy" />
                        </div>
                        <span className="text-[10px] font-medium max-w-[64px] truncate">{tmpl.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filters Tab */}
        {activeTab === 'filters' && (
          <div className="space-y-3 px-card px-corners p-3">
            <div className="grid grid-cols-3 gap-2">
              {FILTER_LIST.map((f) => {
                const active = selectedFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilter(f.id)}
                    aria-pressed={active}
                    className={`group overflow-hidden rounded-lg border-2 bg-white/5 text-left transition-colors ${
                      active ? 'border-[#CE1126]' : 'border-transparent hover:border-white/20'
                    }`}
                  >
                    <div className="relative aspect-square w-full bg-black/40">
                      {filterThumbs[f.id] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={filterThumbs[f.id]} alt="" className="h-full w-full object-cover" />
                      )}
                      {active && (
                        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-[#CE1126] text-white">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <div className={`px-1.5 py-1 text-center text-[11px] font-semibold ${active ? 'bg-[#CE1126] text-white' : 'text-slate-300'}`}>
                      {f.thai}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Brightness Slider */}
            <div className="flex items-center gap-3 pt-1">
              <Sun className="size-4 text-slate-400 shrink-0" />
              <input
                type="range"
                min="-30"
                max="30"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                className="brightness-slider px-slider w-full cursor-pointer"
              />
              <span className="mono text-[11px] text-slate-400 w-8 text-right">
                {brightness > 0 ? `+${brightness}` : brightness}
              </span>
            </div>
          </div>
        )}

        {/* Stickers Tab */}
        {activeTab === 'stickers' && (
          <div className="space-y-2 px-card px-corners p-3">
            {stickerCatalog.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">กำลังโหลดสติกเกอร์...</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">แตะเพื่อวางบนรูป · {stickerCatalog.length} แบบ</span>
                  <button
                    onClick={() => setStickerSheetOpen(true)}
                    className="px-btn px-corners px-2.5 py-1.5 text-[11px]"
                  >
                    <Maximize2 className="size-3.5" /> ดูทั้งหมด
                  </button>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                  {stickerCatalog.map((s) => (
                    <button
                      key={s.src}
                      onClick={() => addSticker(s)}
                      className="flex-shrink-0 size-14 rounded-lg bg-white/5 hover:bg-white/10 p-1.5 flex items-center justify-center transition-colors border border-white/5"
                      title={s.src.split('/').pop() || 'sticker'}
                    >
                      <img src={s.src} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {stickers.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>ลากเพื่อย้าย · ปุ่มมุมขวาล่างหรือสองนิ้วเพื่อย่อ ขยาย หมุน</span>
                <button
                  onClick={() => {
                    setStickers([]);
                    setSelectedStickerId(null);
                  }}
                  className="px-btn px-corners shrink-0 px-2.5 py-1.5"
                >
                  <Trash2 className="size-3.5" /> ล้างทั้งหมด
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* All stickers, large, in a bottom sheet */}
      {stickerSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => {
            setStickerSheetOpen(false);
            setOpenStickerGroup(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="สติกเกอร์ทั้งหมด"
        >
          <div
            className="flex max-h-[80dvh] w-full max-w-md flex-col px-screen"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const groups = groupStickers(stickerCatalog);
              const folders = groups.filter((g) => g.id !== LOOSE_STICKER_GROUP);
              const others = groups.find((g) => g.id === LOOSE_STICKER_GROUP)?.stickers ?? [];
              const openFolder = folders.find((g) => g.id === openStickerGroup);
              const closeSheet = () => {
                setStickerSheetOpen(false);
                setOpenStickerGroup(null);
              };
              const tile = 'flex aspect-square items-center justify-center rounded-xl border border-white/5 bg-white/5 p-2.5 transition-colors hover:bg-white/10 active:scale-95';
              const stickerButton = (st: StickerAsset) => (
                <button
                  key={st.src}
                  onClick={() => {
                    addSticker(st);
                    closeSheet();
                  }}
                  className={tile}
                  title={st.src.split('/').pop() || 'sticker'}
                >
                  <img src={st.src} alt="" className="max-h-full max-w-full object-contain" draggable={false} loading="lazy" />
                </button>
              );
              return (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {openFolder && (
                        <button
                          onClick={() => setOpenStickerGroup(null)}
                          aria-label="กลับ"
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
                        >
                          <ChevronLeft className="size-5" />
                        </button>
                      )}
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-white">{openFolder ? openFolder.title : 'สติกเกอร์ทั้งหมด'}</h2>
                        <p className="text-[11px] text-slate-400">
                          {openFolder ? `${openFolder.stickers.length} แบบ · แตะเพื่อวางบนรูป` : 'แตะเพื่อวางบนรูป'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={closeSheet}
                      aria-label="ปิด"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {openFolder ? (
                      openFolder.stickers.map(stickerButton)
                    ) : (
                      <>
                        {folders.map((folder) => (
                          // Folder tile: the cover in front, two more of the folder's stickers fanned behind
                          <button
                            key={folder.id}
                            onClick={() => setOpenStickerGroup(folder.id)}
                            className="relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-[#CE1126]/50 bg-[#CE1126]/10 p-2 transition-colors hover:bg-[#CE1126]/20 active:scale-95"
                          >
                            <span className="relative block h-[62%] w-[80%]">
                              {folder.stickers.slice(1, 3).map((st, i) => (
                                <img
                                  key={st.src}
                                  src={st.src}
                                  alt=""
                                  draggable={false}
                                  className="absolute inset-0 h-full w-full object-contain opacity-80"
                                  style={{ transform: `translateX(${i === 0 ? -18 : 18}%) rotate(${i === 0 ? -14 : 14}deg) scale(0.82)` }}
                                />
                              ))}
                              <img
                                src={folder.cover.src}
                                alt=""
                                draggable={false}
                                className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
                              />
                            </span>
                            <span className="max-w-full truncate text-[12px] font-bold text-white">{folder.title}</span>
                            <span className="absolute right-1.5 top-1.5 rounded-full bg-[#CE1126] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {folder.stickers.length}
                            </span>
                          </button>
                        ))}
                        {others.map(stickerButton)}
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Save Action Bar & PDPA Notice */}
      <footer className="px-5 pt-4 space-y-3">
        <button
          onClick={handleDownload}
          className="px-btn px-btn-red px-corners h-12 w-full text-sm"
        >
          <Download className="size-4" /> บันทึกรูปลงอุปกรณ์ ({outWidth}×{outHeight})
        </button>

        {/* Follow the department on Instagram */}
        <a
          href="https://www.instagram.com/cpe_swu/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-btn px-corners h-12 w-full gap-2.5 text-sm"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          ติดตาม IG @cpe_swu
        </a>

        <p className="font-pixel text-center text-[10px] text-white">THANKS FOR PLAYING!</p>
        <p className="text-center text-xs text-[var(--px-muted)]">
          ขอบคุณที่แวะมาบูธวิศวะคอมนะ #{normalizedCode.replace('OPH-', '')}
        </p>

        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 text-center">
          <span>เก็บรักษาภาพ 7 วัน - วิศวกรรมคอมพิวเตอร์ มศว</span>
        </div>
      </footer>
    </main>
  );
}
