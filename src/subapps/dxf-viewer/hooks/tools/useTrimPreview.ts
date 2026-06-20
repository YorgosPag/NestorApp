/**
 * USE TRIM PREVIEW — ADR-350 Phase 2 (ADR-040 micro-leaf)
 *
 * Live overlay during a TRIM session. Subscribes to {@link TrimToolStore}
 * (low-freq state) and {@link useCursorWorldPosition} (60fps cursor) — no
 * orchestrator re-renders.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF
 * lifecycle + DPR-clear + canonical viewport/transform + cursor subscription
 * ζουν πλέον ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
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
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { TrimToolStore } from '../../systems/trim/TrimToolStore';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseTrimPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

export function useTrimPreview(props: UseTrimPreviewProps): void {
  const { transform, getCanvas, getViewportElement } = props;

  const phase = useSyncExternalStore(TrimToolStore.subscribe, () => TrimToolStore.getState().phase);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const s = TrimToolStore.getState();
    if (s.phase === 'idle') return;

    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);
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

    // Fence line during drag (B3)
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

    // Pickbox crosshair (Q14)
    if (!effectiveCursor) return;
    const c = toScreen(effectiveCursor);
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
  }, []);

  useCanvasGhostPreview({
    isActive: phase !== 'idle',
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
