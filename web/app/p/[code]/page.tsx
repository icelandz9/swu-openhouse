'use client';

import React, { use, useState, useRef, useEffect, useCallback } from 'react';
import {
  Download,
  Share2,
  Sliders,
  Sparkles,
  Frame,
  Check,
  ShieldCheck,
  ArrowLeft,
  Sun,
} from 'lucide-react';
import { FilterPresetId, CPEFrameTemplateId } from '@/lib/contracts';
import { COLOR_FILTER_PRESETS } from '@/lib/mobile/colorFilters';
import { drawFrameOnCanvas } from '@/lib/mobile/frameRenderers';

const FRAME_OPTIONS: { id: CPEFrameTemplateId; name: string; thai: string }[] = [
  { id: 'cpe-official', name: 'Official', thai: 'ตราสัญลักษณ์ มศว' },
  { id: 'cpe-tech-circuit', name: 'Tech Circuit', thai: 'ไซเบอร์ วิศวะคอมพ์' },
  { id: 'cpe-photostrip', name: 'Photostrip', thai: 'ฟิล์มโพลารอยด์' },
];

const FILTER_LIST: { id: FilterPresetId; label: string; thai: string }[] = [
  { id: 'original', label: 'Original', thai: 'ต้นฉบับ' },
  { id: 'warm', label: 'Warm', thai: 'โทนอุ่น' },
  { id: 'vintage', label: 'Vintage', thai: 'วินเทจ' },
  { id: 'cool', label: 'Cool', thai: 'โทนเย็น' },
  { id: 'rosy', label: 'Rosy', thai: 'โรสโกลด์' },
  { id: 'bw', label: 'B&W', thai: 'ขาวดำ' },
];

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
  const [selectedFrame, setSelectedFrame] = useState<CPEFrameTemplateId>('cpe-official');
  const [activeTab, setActiveTab] = useState<'filters' | 'frames'>('frames');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [photoLoaded, setPhotoLoaded] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  // Load photo on start
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let candidateSrc = `/api/photos/${normalizedCode}/file`;
    if (typeof window !== 'undefined') {
      const savedLatest = localStorage.getItem('swu_latest_photo');
      if (savedLatest) {
        try {
          const parsed = JSON.parse(savedLatest);
          if (parsed.code === normalizedCode && parsed.photoUrl) {
            candidateSrc = parsed.photoUrl;
          }
        } catch {}
      }
    }

    img.src = candidateSrc;
    img.onload = () => {
      baseImageRef.current = img;
      setPhotoLoaded(true);
    };

    img.onerror = () => {
      // Fallback sample image
      img.src = '/sample-photo.jpg';
      img.onload = () => {
        baseImageRef.current = img;
        setPhotoLoaded(true);
      };
    };
  }, [normalizedCode]);

  // Composite photo on 1440x1080 Canvas 2D
  const renderComposite = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImageRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1440;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw base photo with CSS filters & brightness adjustment
    const filterPreset = COLOR_FILTER_PRESETS[selectedFilter];
    const brightnessRatio = 1 + brightness / 100;

    let filterString = `brightness(${brightnessRatio})`;
    if (filterPreset?.cssFilter && filterPreset.cssFilter !== 'none') {
      filterString += ` ${filterPreset.cssFilter}`;
    }

    ctx.filter = filterString;
    ctx.drawImage(baseImageRef.current, 0, 0, width, height);
    ctx.filter = 'none';

    // 2. Rosy subtle noise grain
    if (selectedFilter === 'rosy') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 0; i < 4000; i++) {
        ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
      }
    }

    // 3. Draw high-precision vector frame overlay
    drawFrameOnCanvas(ctx, width, height, selectedFrame);
  }, [selectedFilter, brightness, selectedFrame]);

  useEffect(() => {
    if (photoLoaded) {
      renderComposite();
    }
  }, [photoLoaded, renderComposite]);

  // Download high-resolution composite photo
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `SWU-OpenHouse-${normalizedCode}.jpg`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export photo:', err);
    }
  };

  return (
    <main className="mobile-app-shell mx-auto min-h-screen max-w-md bg-[#090D16] text-slate-200 flex flex-col justify-between pb-6 select-none shadow-2xl">
      {/* Top Header Bar */}
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 bg-[#0D111A]">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center bg-[#CE1126] text-xs font-black tracking-[-.06em] text-white rounded">
            SWU
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#CE1126] uppercase">
              CPE OPEN HOUSE
            </div>
            <div className="mono text-xs font-bold text-white">
              #{normalizedCode.replace('OPH-', '')}
            </div>
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

      {/* Main Canvas Photo Preview (4:3) */}
      <div className="px-4 py-4">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black border border-white/10 shadow-2xl">
          <canvas
            ref={canvasRef}
            className="h-full w-full object-cover"
          />
          {!photoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#06080D]">
              <div className="mono text-xs text-slate-400 animate-pulse">กำลังโหลดรูปภาพ...</div>
            </div>
          )}
        </div>
      </div>

      {/* Editing Controls & Sliders */}
      <div className="px-5 space-y-4">
        {/* Brightness Adjustment Slider */}
        <div className="rounded-xl border border-white/10 bg-[#0D111A] p-4 space-y-2">
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

        {/* Tab Selection (Frames vs Filters) */}
        <div className="flex rounded-xl border border-white/10 bg-[#0D111A] p-1">
          <button
            onClick={() => setActiveTab('frames')}
            className={`flex flex-1 items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'frames'
                ? 'bg-[#CE1126] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Frame className="size-3.5" /> กรอบรูป ({FRAME_OPTIONS.length})
          </button>
          <button
            onClick={() => setActiveTab('filters')}
            className={`flex flex-1 items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'filters'
                ? 'bg-[#CE1126] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="size-3.5" /> ฟิลเตอร์ ({FILTER_LIST.length})
          </button>
        </div>

        {/* Frames Rail */}
        {activeTab === 'frames' && (
          <div className="grid grid-cols-3 gap-2">
            {FRAME_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFrame(f.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  selectedFrame === f.id
                    ? 'border-[#CE1126] bg-[#CE1126]/10 text-white shadow-md'
                    : 'border-white/10 bg-[#0D111A] text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold">{f.name}</div>
                <div className="mt-1 text-[10px] text-slate-500">{f.thai}</div>
              </button>
            ))}
          </div>
        )}

        {/* Filters Rail */}
        {activeTab === 'filters' && (
          <div className="grid grid-cols-3 gap-2">
            {FILTER_LIST.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  selectedFilter === f.id
                    ? 'border-[#06B6D4] bg-[#06B6D4]/10 text-white shadow-md'
                    : 'border-white/10 bg-[#0D111A] text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold">{f.label}</div>
                <div className="mt-1 text-[10px] text-slate-500">{f.thai}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Save Action Bar & PDPA Notice */}
      <footer className="px-5 pt-4 space-y-3">
        <button
          onClick={handleDownload}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#CE1126] hover:bg-[#e1132b] text-sm font-bold text-white transition-colors shadow-xl"
        >
          <Download className="size-4" /> บันทึกรูปลงอุปกรณ์ (1440×1080 RAW)
        </button>

        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 text-center">
          <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
          <span>เก็บรักษาภาพ 7 วันตามนโยบาย PDPA • วิศวกรรมคอมพิวเตอร์ มศว</span>
        </div>
      </footer>
    </main>
  );
}
