/**
 * USE TRIM PREVIEW — ADR-350 Phase 2 (ADR-040 micro-leaf)
 *
 * Live overlay during a TRIM session. Subscribes to {@link TrimToolStore}
 * (low-freq state) and {@link useCursorWorldPosition} (60fps cursor) — no
 * orchestrator re-renders.
 *
 * Renders:
 *   - Pickbox crosshair at cursor (12×12 px)
 *   - SHIFT held → cursor switches to EXTEND arrow icon + preview color flips
 *     from red (remove) to green (add)
 *
 * Phase-2 scope:
 *   - Cursor crosshair + label
 *   - Sub-segment dash highlight at hover (set by `useTrimMouseMove`)
 *
 * @module hooks/tools/useTrimPreview
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { TrimToolStore } from '../../systems/trim/TrimToolStore';

export interface UseTrimPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

export function useTrimPreview(props: UseTrimPreviewProps): void {
  const { transform, getCanvas, getViewportElement } = props;
  const cursorWorld = useCursorWorldPosition();
  const rafRef = useRef<number>(0);

  const phase = useSyncExternalStore(TrimToolStore.subscribe, () => TrimToolStore.getState().phase);

  const getViewport = useCallback(
    (canvas: HTMLCanvasElement) => {
      const el = getViewportElement?.() ?? canvas;
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    },
    [getViewportElement],
  );

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = TrimToolStore.getState();
    if (s.phase === 'idle') return;

    const viewport = getViewport(canvas);
    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, transform, viewport);
    const previewColor = s.inverseMode ? '#22DD55' : '#FF3030';

    // Sub-segment highlight under cursor (from TrimToolStore.hoverPreview, set
    // by the trim mouse-move helper).
    if (s.hoverPreview && s.hoverPreview.path.length >= 2) {
      ctx.save();
      ctx.strokeStyle = previewColor;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      const first = toScreen(s.hoverPreview.path[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < s.hoverPreview.path.length; i++) {
        const p = toScreen(s.hoverPreview.path[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Multi-preview during fence/crossing drag (G5)
    if (s.dragPreview) {
      ctx.save();
      ctx.strokeStyle = previewColor;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      for (const preview of s.dragPreview.previews) {
        if (preview.path.length < 2) continue;
        ctx.beginPath();
        const first = toScreen(preview.path[0]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < preview.path.length; i++) {
          const p = toScreen(preview.path[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Pickbox crosshair (Q14)
    if (!cursorWorld) return;
    const c = toScreen(cursorWorld);
    ctx.save();
    ctx.strokeStyle = s.inverseMode ? '#22DD55' : '#FFD24A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x - 6, c.y - 6, 12, 12);
    if (s.inverseMode) {
      // Small ↗ arrow tip indicating EXTEND
      ctx.beginPath();
      ctx.moveTo(c.x + 8, c.y - 8);
      ctx.lineTo(c.x + 14, c.y - 14);
      ctx.lineTo(c.x + 10, c.y - 14);
      ctx.moveTo(c.x + 14, c.y - 14);
      ctx.lineTo(c.x + 14, c.y - 10);
      ctx.stroke();
    }
    ctx.restore();
  }, [cursorWorld, transform, getCanvas, getViewport]);

  useEffect(() => {
    if (phase === 'idle') {
      const canvas = getCanvas();
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, drawFrame, getCanvas]);
}
