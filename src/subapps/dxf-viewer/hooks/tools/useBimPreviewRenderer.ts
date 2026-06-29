/**
 * SSOT — useBimPreviewRenderer
 *
 * Returns a stable getter that lazily builds (and reuses across RAF frames) a
 * `BimPreviewRenderer` bound to a given preview 2D context, rebuilding only when
 * the ctx changes (remount / resize). Shared by every WYSIWYG move/reshape preview
 * hook so the ref-holding boilerplate lives in ONE place — no per-hook copy.
 *
 * @see useGripGhostPreview · useMovePreview — consumers
 * @see canvas-v2/preview-canvas/bim-preview-render.ts — the real composite on the preview ctx
 * @see ADR-550 — Unified Entity Render Contract
 */

import { useCallback, useRef } from 'react';
import { BimPreviewRenderer } from '../../canvas-v2/preview-canvas/bim-preview-render';

export function useBimPreviewRenderer(): (ctx: CanvasRenderingContext2D) => BimPreviewRenderer {
  const ref = useRef<{ ctx: CanvasRenderingContext2D; renderer: BimPreviewRenderer } | null>(null);
  return useCallback((ctx: CanvasRenderingContext2D): BimPreviewRenderer => {
    if (!ref.current || ref.current.ctx !== ctx) {
      ref.current = { ctx, renderer: new BimPreviewRenderer(ctx) };
    }
    return ref.current.renderer;
  }, []);
}
