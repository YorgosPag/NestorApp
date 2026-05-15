/**
 * USE EXTEND PREVIEW — ADR-353 (ADR-040 micro-leaf)
 *
 * Live canvas overlay during an EXTEND session. Subscribes to
 * {@link ExtendToolStore} and {@link useCursorWorldPosition} — no orchestrator
 * re-renders.
 *
 * Renders:
 *  - Ghost extension path (green #22DD55) from entity endpoint to boundary
 *  - SHIFT held → cursor switches to TRIM scissor icon; preview color flips red
 *  - Fence line during drag (#FFD24A dashed)
 *  - Pickbox cursor at world position
 *
 * @module hooks/tools/useExtendPreview
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { ExtendToolStore } from '../../systems/extend/ExtendToolStore';

export interface UseExtendPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

export function useExtendPreview(props: UseExtendPreviewProps): void {
  const { transform, getCanvas, getViewportElement } = props;
  const cursorWorld = useCursorWorldPosition();
  const rafRef = useRef<number>(0);

  const phase = useSyncExternalStore(
    ExtendToolStore.subscribe,
    () => ExtendToolStore.getState().phase,
  );

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

    const s = ExtendToolStore.getState();
    if (s.phase === 'idle') return;

    const viewport = getViewport(canvas);
    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, transform, viewport);
    // EXTEND = green, SHIFT (TRIM inverse) = red
    const previewColor = s.inverseMode ? '#FF3030' : '#22DD55';

    // Ghost extension path under cursor (hover preview)
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
        const sc = toScreen(s.hoverPreview.path[i]);
        ctx.lineTo(sc.x, sc.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Multi-preview during fence drag
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
          const sc = toScreen(preview.path[i]);
          ctx.lineTo(sc.x, sc.y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Fence line during drag
    if (s.phase === 'fence' && s.dragStart && s.dragCurrent) {
      const ds = toScreen(s.dragStart);
      const dc = toScreen(s.dragCurrent);
      ctx.save();
      ctx.strokeStyle = '#FFD24A';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ds.x, ds.y);
      ctx.lineTo(dc.x, dc.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Pickbox cursor crosshair
    if (!cursorWorld) return;
    const c = toScreen(cursorWorld);
    ctx.save();
    ctx.strokeStyle = s.inverseMode ? '#FF3030' : '#22DD55';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x - 6, c.y - 6, 12, 12);
    if (!s.inverseMode) {
      // Small ↗ extend-arrow indicator (extend mode)
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
