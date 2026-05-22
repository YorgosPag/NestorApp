'use client';

/**
 * ADR-366 §C.6.Q6 — Crop Region Canvas2D overlay.
 *
 * Photoshop crop tool pattern:
 *  - 50% dim outside the crop rect
 *  - 1px dashed white border + 1px black outline (contrast)
 *  - 8 resize handles (4 corners + 4 edge midpoints) — pointer-events div overlays
 *  - RAF-throttled 60fps redraw (Canvas2D only, zero GPU cost)
 *
 * Absolutely positioned over the viewport canvas. Does not interfere with
 * Three.js rendering — pure 2D overlay on top.
 *
 * @see ADR-366 §C.6.Q6
 */

import { useRef, useEffect, useSyncExternalStore, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCropRegionStore, type HandleId } from './CropRegionStore';
import { startHandleDrag } from './CropRegionTool';

const HANDLE_SIZE = 8;
const DIM_ALPHA = 0.5;
const HANDLES: HandleId[] = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];

function handlePosition(
  id: HandleId,
  rect: { x: number; y: number; w: number; h: number },
  cw: number,
  ch: number,
): { left: number; top: number } {
  const lx = rect.x * cw;
  const ty = rect.y * ch;
  const rx = (rect.x + rect.w) * cw;
  const by = (rect.y + rect.h) * ch;
  const mx = (lx + rx) / 2;
  const my = (ty + by) / 2;
  const map: Record<HandleId, { left: number; top: number }> = {
    tl: { left: lx, top: ty }, tc: { left: mx, top: ty }, tr: { left: rx, top: ty },
    ml: { left: lx, top: my },                             mr: { left: rx, top: my },
    bl: { left: lx, top: by }, bc: { left: mx, top: by }, br: { left: rx, top: by },
  };
  return map[id];
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  cw: number,
  ch: number,
) {
  ctx.clearRect(0, 0, cw, ch);

  const lx = rect.x * cw;
  const ty = rect.y * ch;
  const rw = rect.w * cw;
  const rh = rect.h * ch;

  ctx.fillStyle = `rgba(0,0,0,${DIM_ALPHA})`;
  ctx.fillRect(0, 0, cw, ch);
  ctx.clearRect(lx, ty, rw, rh);

  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(lx, ty, rw, rh);

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(lx, ty, rw, rh);

  ctx.setLineDash([]);
}

export function CropRegionOverlay() {
  const { t } = useTranslation('bim3d');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const cropState = useSyncExternalStore(
    useCropRegionStore.subscribe,
    useCropRegionStore.getState,
    useCropRegionStore.getState,
  );

  const { editState, rectangle, showPreview } = cropState;
  const isVisible =
    showPreview &&
    rectangle !== null &&
    (editState === 'dragging' || editState === 'editing' || editState === 'committed');

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !rectangle) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawOverlay(ctx, rectangle, cw, ch);
  }, [rectangle]);

  useEffect(() => {
    if (!isVisible) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isVisible, draw]);

  if (!isVisible || !rectangle) return null;

  const containerEl = containerRef.current;
  const cw = containerEl?.clientWidth ?? 0;
  const ch = containerEl?.clientHeight ?? 0;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {editState === 'editing' && HANDLES.map((handle) => {
        const pos = handlePosition(handle, rectangle, cw, ch);
        return (
          <div
            key={handle}
            className="pointer-events-auto absolute cursor-pointer rounded-sm bg-white shadow"
            style={{
              left: pos.left - HANDLE_SIZE / 2,
              top: pos.top - HANDLE_SIZE / 2,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
            }}
            aria-label={t('crop.toolName')}
            onPointerDown={(e) => {
              startHandleDrag(handle);
              e.stopPropagation();
            }}
          />
        );
      })}

      {editState === 'editing' && (
        <div
          className="pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2"
        >
          <button
            type="button"
            className="rounded bg-black/70 px-3 py-1 text-[11px] text-white hover:bg-black/90"
            onClick={() => useCropRegionStore.getState().cancelEdit()}
          >
            {t('crop.cancel')}
          </button>
          <button
            type="button"
            className="rounded bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
            onClick={() => useCropRegionStore.getState().commitEdit()}
          >
            {t('crop.commit')}
          </button>
        </div>
      )}
    </div>
  );
}
