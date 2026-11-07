'use client';

import React, { useRef } from 'react';
import { X, RotateCw } from 'lucide-react';
import { PlacedSticker, STICKER_MAX_WIDTH, STICKER_MIN_WIDTH } from '@/lib/mobile/stickers';

interface StickerLayerProps {
  stickers: PlacedSticker[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onChange: (id: number, patch: Partial<PlacedSticker>) => void;
  onDelete: (id: number) => void;
  /** Output canvas size, so positions map 1:1 between preview and saved photo */
  canvasWidth: number;
  canvasHeight: number;
}

type Gesture =
  | { kind: 'drag'; id: number; startX: number; startY: number; cx: number; cy: number }
  | { kind: 'handle'; id: number; dist0: number; ang0: number; w: number; rot: number }
  | { kind: 'pinch'; id: number; dist0: number; ang0: number; w: number; rot: number };

const clampW = (w: number) => Math.min(STICKER_MAX_WIDTH, Math.max(STICKER_MIN_WIDTH, w));

/**
 * Stickers drawn as DOM elements over the preview canvas.
 * One finger drags; the corner handle (or two fingers) resizes and rotates.
 */
export function StickerLayer({
  stickers,
  selectedId,
  onSelect,
  onChange,
  onDelete,
  canvasWidth,
  canvasHeight,
}: StickerLayerProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);

  const box = () => boxRef.current?.getBoundingClientRect();

  const centerPx = (s: PlacedSticker) => {
    const r = box();
    if (!r) return { x: 0, y: 0 };
    return { x: r.left + s.cx * r.width, y: r.top + s.cy * r.height };
  };

  const startPinch = (s: PlacedSticker) => {
    const [a, b] = Array.from(pointers.current.values());
    gesture.current = {
      kind: 'pinch',
      id: s.id,
      dist0: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      ang0: Math.atan2(b.y - a.y, b.x - a.x),
      w: s.w,
      rot: s.rot,
    };
  };

  const onStickerDown = (e: React.PointerEvent, s: PlacedSticker) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    onSelect(s.id);
    if (pointers.current.size >= 2) {
      startPinch(s);
    } else {
      gesture.current = { kind: 'drag', id: s.id, startX: e.clientX, startY: e.clientY, cx: s.cx, cy: s.cy };
    }
  };

  const onHandleDown = (e: React.PointerEvent, s: PlacedSticker) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const c = centerPx(s);
    gesture.current = {
      kind: 'handle',
      id: s.id,
      dist0: Math.hypot(e.clientX - c.x, e.clientY - c.y) || 1,
      ang0: Math.atan2(e.clientY - c.y, e.clientX - c.x),
      w: s.w,
      rot: s.rot,
    };
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    const r = box();
    if (!g || !r) return;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = stickers.find((st) => st.id === g.id);
    if (!s) return;

    if (g.kind === 'drag') {
      onChange(g.id, {
        cx: Math.min(1, Math.max(0, g.cx + (e.clientX - g.startX) / r.width)),
        cy: Math.min(1, Math.max(0, g.cy + (e.clientY - g.startY) / r.height)),
      });
    } else if (g.kind === 'handle') {
      const c = centerPx(s);
      const dist = Math.hypot(e.clientX - c.x, e.clientY - c.y);
      const ang = Math.atan2(e.clientY - c.y, e.clientX - c.x);
      onChange(g.id, { w: clampW(g.w * (dist / g.dist0)), rot: g.rot + ang - g.ang0 });
    } else if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      onChange(g.id, { w: clampW(g.w * (dist / g.dist0)), rot: g.rot + ang - g.ang0 });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.kind === 'pinch' && pointers.current.size === 1) {
      // one finger left: continue as a drag from where it is now
      const s = stickers.find((st) => st.id === g.id);
      const [p] = Array.from(pointers.current.values());
      if (s && p) {
        gesture.current = { kind: 'drag', id: s.id, startX: p.x, startY: p.y, cx: s.cx, cy: s.cy };
        return;
      }
    }
    if (pointers.current.size === 0) gesture.current = null;
  };

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 touch-none overflow-hidden"
      onPointerDown={(e) => {
        const g = gesture.current;
        const s = g && stickers.find((st) => st.id === g.id);
        if (g?.kind === 'drag' && s) {
          // second finger anywhere on the photo: pinch the sticker being dragged
          e.currentTarget.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          startPinch(s);
        } else {
          onSelect(null);
        }
      }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {stickers.map((s) => {
        const selected = s.id === selectedId;
        // width as % of the box keeps the preview in the same proportion as the saved photo
        const widthPct = s.w * 100;
        const heightPct = ((s.w * s.aspect * canvasWidth) / canvasHeight) * 100;
        return (
          <div
            key={s.id}
            className="absolute"
            style={{
              left: `${s.cx * 100}%`,
              top: `${s.cy * 100}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              transform: `translate(-50%, -50%) rotate(${s.rot}rad)`,
              zIndex: selected ? 2 : 1,
            }}
          >
            <img
              src={s.src}
              alt=""
              draggable={false}
              onPointerDown={(e) => onStickerDown(e, s)}
              className={`h-full w-full select-none object-fill ${
                selected ? 'outline-2 outline-dashed outline-white/90 outline-offset-2' : ''
              }`}
            />
            {selected && (
              <>
                <button
                  type="button"
                  aria-label="ลบสติกเกอร์"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  className="absolute -left-3 -top-3 grid size-7 place-items-center rounded-full bg-[#CE1126] text-white shadow-lg"
                >
                  <X className="size-4" />
                </button>
                <div
                  role="button"
                  aria-label="ย่อ ขยาย หมุน"
                  onPointerDown={(e) => onHandleDown(e, s)}
                  className="absolute -bottom-3 -right-3 grid size-7 cursor-nwse-resize place-items-center rounded-full bg-white text-[#090D16] shadow-lg"
                >
                  <RotateCw className="size-4" />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
