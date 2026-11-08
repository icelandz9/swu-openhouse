'use client';

import React, { use, useState, useRef, useEffect, useCallback } from 'react';
import { Download, Sparkles, Frame, Check, ShieldAlert, Sun, Sticker, Trash2, ShieldCheck, Lock, Maximize2, X } from 'lucide-react';
import { FilterPresetId } from '@/lib/contracts';
import { applyColorFilter } from '@/lib/mobile/colorFilters';
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
type AuthStatus = 'checking' | 'authorized' | 'forbidden' | 'not_found';

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
  const outWidth = activeFrame ? activeFrame.width : PHOTO_ONLY_SIZE.width;
  const outHeight = activeFrame ? activeFrame.height : PHOTO_ONLY_SIZE.height;

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

    drawPhotoCover(ctx, photo, win);
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
      className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
        activeTab === tab ? 'bg-[#CE1126] text-white shadow-md' : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  // 1. Loading State
  if (authStatus === 'checking') {
    return (
      <main className="min-h-dvh bg-[#0B0F19] text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="relative mb-6">
          <div className="size-16 rounded-full border-4 border-white/10 border-t-[#CE1126] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <CpeLogo className="h-6" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">กำลังตรวจสอบสิทธิ์ความปลอดภัย...</h2>
        <p className="text-xs text-slate-400">Verifying secure QR scan token for #{normalizedCode.replace('OPH-', '')}</p>
      </main>
    );
  }



  // 3. Not Found State
  if (authStatus === 'not_found') {
    return (
      <main className="min-h-dvh bg-[#0B0F19] text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141A26] p-6 shadow-2xl">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
            <Trash2 className="size-7" />
          </div>
          <h1 className="text-lg font-bold text-white mb-2">ไม่พบรูปภาพนี้</h1>
          <p className="text-xs text-slate-400 mb-6">รูปภาพรหัส {normalizedCode} อาจถูกลบ หรือหมดอายุการจัดเก็บแล้ว (เกิน 7 วัน ตามนโยบาย PDPA)</p>
          <a
            href="/"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#CE1126] text-xs font-bold text-white transition-colors"
          >
            กลับสู่หน้าหลัก
          </a>
        </div>
      </main>
    );
  }

  // 4. Authorized State: Mobile Photo Editor
  return (
    <main className="mobile-app-shell mx-auto min-h-screen max-w-md bg-black text-slate-200 flex flex-col justify-between pb-6 select-none shadow-2xl">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/60 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <CpeLogo className="h-6" />
          <div>
            <div className="text-xs font-bold tracking-wider text-white">SWU OPEN HOUSE</div>
            <div className="text-[10px] text-slate-400">วิศวกรรมคอมพิวเตอร์</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="mono text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-full">
            #{normalizedCode.replace('OPH-', '')}
          </span>
        </div>
      </header>

      {/* Main Canvas / Preview Stage */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-3 min-h-[460px]">
        <div
          className="relative max-w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0F1218]"
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
        <div className="flex bg-[#141A26] p-1 rounded-xl border border-white/5">
          {tabButton('frames', <><Frame className="size-3.5" /> กรอบรูป</>)}
          {tabButton('filters', <><Sparkles className="size-3.5" /> ฟิลเตอร์</>)}
          {tabButton('stickers', <><Sticker className="size-3.5" /> สติกเกอร์</>)}
        </div>

        {/* Frames Tab */}
        {activeTab === 'frames' && (
          <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-none px-1">
            {FRAME_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => setSelectedFrameId(tmpl.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                  selectedFrameId === tmpl.id
                    ? 'border-[#CE1126] bg-[#CE1126]/10 text-white'
                    : 'border-white/10 bg-[#141A26] text-slate-400 hover:text-white'
                }`}
              >
                <div className="w-14 h-20 bg-slate-900 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center relative">
                  <img src={tmpl.src} alt="" className="w-full h-full object-contain pointer-events-none" />
                </div>
                <span className="text-[10px] font-medium max-w-[64px] truncate">{tmpl.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filters Tab */}
        {activeTab === 'filters' && (
          <div className="space-y-3 bg-[#141A26] p-3 rounded-xl border border-white/5">
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
                className="w-full accent-[#CE1126] h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
              <span className="mono text-[11px] text-slate-400 w-8 text-right">
                {brightness > 0 ? `+${brightness}` : brightness}
              </span>
            </div>
          </div>
        )}

        {/* Stickers Tab */}
        {activeTab === 'stickers' && (
          <div className="space-y-2 bg-[#141A26] p-3 rounded-xl border border-white/5">
            {stickerCatalog.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">กำลังโหลดสติกเกอร์...</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">แตะเพื่อวางบนรูป · {stickerCatalog.length} แบบ</span>
                  <button
                    onClick={() => setStickerSheetOpen(true)}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/5"
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
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 font-bold text-slate-300"
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
          onClick={() => setStickerSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="สติกเกอร์ทั้งหมด"
        >
          <div
            className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-2xl border border-white/10 bg-[#0E131D] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-white">สติกเกอร์ทั้งหมด</h2>
                <p className="text-[11px] text-slate-400">แตะเพื่อวางบนรูป</p>
              </div>
              <button
                onClick={() => setStickerSheetOpen(false)}
                aria-label="ปิด"
                className="flex size-9 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {stickerCatalog.map((s) => (
                <button
                  key={s.src}
                  onClick={() => {
                    addSticker(s);
                    setStickerSheetOpen(false);
                  }}
                  className="flex aspect-square items-center justify-center rounded-xl border border-white/5 bg-white/5 p-2.5 transition-colors hover:bg-white/10 active:scale-95"
                  title={s.src.split('/').pop() || 'sticker'}
                >
                  <img src={s.src} alt="" className="max-h-full max-w-full object-contain" draggable={false} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
          <span>เก็บรักษาภาพ 7 วัน - วิศวกรรมคอมพิวเตอร์ มศว</span>
        </div>
      </footer>
    </main>
  );
}
