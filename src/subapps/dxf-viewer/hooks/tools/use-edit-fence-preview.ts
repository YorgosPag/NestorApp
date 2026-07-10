/**
 * USE EDIT FENCE PREVIEW — Cluster #16 SSoT (ADR-625)
 *
 * Shared paint primitive for path-based edit-tool overlays (EXTEND / TRIM).
 * Both tools paint the IDENTICAL frame:
 *   - dashed ghost hover-path (from {@link EditFencePreviewState.hoverPreview})
 *   - multi-preview fence previews during drag
 *   - fence rubber line (#FFD24A dashed)
 *   - pickbox crosshair with an optional ↗ extend-arrow tip
 *
 * The ONLY per-tool variation is the store + which colour maps to «add» vs
 * «remove» and when the arrow shows (EXTEND and TRIM are colour-inverses of each
 * other, and SHIFT flips the mode). That variation lives in {@link EditFencePreviewColors}.
 *
 * Harness stack: {@link useGhostOverlay} (subscribe + toScreen) → `useCanvasGhostPreview`
 * (ADR-398 §4). Callers stay 3-line bindings.
 *
 * @module hooks/tools/use-edit-fence-preview
 * @see hooks/tools/use-ghost-overlay — subscribe + toScreen harness-consumption layer
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
import { useGhostOverlay, type GhostOverlayStore } from './use-ghost-overlay';
import { tracePolyline } from './overlay-draw-primitives';

/** Minimal store state the fence draw-skeleton reads. Both Extend/Trim states satisfy it structurally. */
export interface EditFencePreviewState {
  readonly phase: string;
  readonly inverseMode: boolean;
  readonly hoverPreview: { readonly path: ReadonlyArray<Point2D> } | null;
  readonly dragPreview: { readonly previews: ReadonlyArray<{ readonly path: ReadonlyArray<Point2D> }> } | null;
  readonly dragStart: Point2D | null;
  readonly dragCurrent: Point2D | null;
}

/**
 * Per-tool colour + arrow policy, resolved from `inverseMode` (SHIFT toggles it).
 * EXTEND: green add / red inverse, arrow when NOT inverse.
 * TRIM:   red remove / green inverse, arrow when inverse.
 */
export interface EditFencePreviewColors {
  /** Ghost hover/fence path colour. */
  readonly path: (inverseMode: boolean) => string;
  /** Pickbox crosshair colour. */
  readonly pickbox: (inverseMode: boolean) => string;
  /** Whether to paint the ↗ extend-arrow tip on the pickbox. */
  readonly showArrow: (inverseMode: boolean) => boolean;
}

export interface UseEditFencePreviewConfig<S extends EditFencePreviewState> {
  readonly store: GhostOverlayStore<S>;
  readonly colors: EditFencePreviewColors;
  readonly transform: ViewTransform;
  readonly getCanvas: () => HTMLCanvasElement | null;
  readonly getViewportElement?: () => HTMLElement | null;
}

/** Fence rubber-line colour — shared by both tools (drag guide, not a mode signal). */
const FENCE_LINE_COLOR = '#FFD24A';

export function useEditFencePreview<S extends EditFencePreviewState>(
  config: UseEditFencePreviewConfig<S>,
): void {
  const { store, colors, transform, getCanvas, getViewportElement } = config;

  const draw = useCallback(
    (frame: GhostDrawFrame, s: S, toScreen: (p: Point2D) => Point2D) => {
      const { ctx, effectiveCursor } = frame;
      if (s.phase === 'idle') return;

      const pathColor = colors.path(s.inverseMode);

      // Ghost hover path (dashed, sub-segment / extension under cursor).
      if (s.hoverPreview && s.hoverPreview.path.length >= 2) {
        ctx.save();
        ctx.strokeStyle = pathColor;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        tracePolyline(ctx, s.hoverPreview.path, toScreen);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Multi-preview during fence/crossing drag.
      if (s.dragPreview) {
        ctx.save();
        ctx.strokeStyle = pathColor;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        for (const preview of s.dragPreview.previews) {
          if (preview.path.length < 2) continue;
          ctx.beginPath();
          tracePolyline(ctx, preview.path, toScreen);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Fence rubber line during drag.
      if (s.phase === 'fence' && s.dragStart && s.dragCurrent) {
        const ds = toScreen(s.dragStart);
        const dc = toScreen(s.dragCurrent);
        ctx.save();
        ctx.strokeStyle = FENCE_LINE_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ds.x, ds.y);
        ctx.lineTo(dc.x, dc.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Pickbox crosshair (+ optional ↗ extend-arrow tip).
      if (!effectiveCursor) return;
      const c = toScreen(effectiveCursor);
      ctx.save();
      ctx.strokeStyle = colors.pickbox(s.inverseMode);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x - 6, c.y - 6, 12, 12);
      if (colors.showArrow(s.inverseMode)) {
        ctx.beginPath();
        ctx.moveTo(c.x + 8, c.y - 8);
        ctx.lineTo(c.x + 14, c.y - 14);
        ctx.lineTo(c.x + 10, c.y - 14);
        ctx.moveTo(c.x + 14, c.y - 14);
        ctx.lineTo(c.x + 14, c.y - 10);
        ctx.stroke();
      }
      ctx.restore();
    },
    [colors],
  );

  useGhostOverlay<S>({
    store,
    isActive: (phase) => phase !== 'idle',
    transform,
    getCanvas,
    getViewportElement,
    draw,
  });
}
