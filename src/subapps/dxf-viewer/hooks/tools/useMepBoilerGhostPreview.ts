/**
 * ADR-408 Εύρος Β #2 — Heating boiler 2D placement ghost preview hook.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic (footprint + symbol).
 *
 * The footprint + symbol come from `useMepBoilerTool()`, so the preview is
 * byte-for-byte what a click commits (WYSIWYG). Snapped cursor όταν OSNAP.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import { MepBoilerGhostRenderer } from '../../bim/mep-boilers/MepBoilerGhostRenderer';
import type { BoilerSymbolGeometry } from '../../bim/mep-boilers/mep-boiler-symbol';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseMepBoilerGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly transform: ViewTransform;
  /** Footprint projection getter — from `useMepBoilerTool().getGhostFootprint`. */
  getGhostFootprint(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  /** Full-symbol projection getter — from `useMepBoilerTool().getGhostSymbol` (WYSIWYG). */
  getGhostSymbol(cursorPos: Readonly<Point2D> | null): BoilerSymbolGeometry | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Viewport element for size; falls back to `getCanvas` (handled by harness). */
  getViewportElement?(): HTMLElement | null;
}

export function useMepBoilerGhostPreview(
  props: Readonly<UseMepBoilerGhostPreviewProps>,
): void {
  const { isAwaitingPosition, transform, getGhostFootprint, getGhostSymbol, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    const footprint = getGhostFootprint(effectiveCursor);
    if (!footprint || footprint.length < 3) return;
    // Full symbol (connector stubs + flue vent + glyph) — same SSoT as the placed
    // renderer, so the preview is byte-for-byte WYSIWYG.
    const symbol = getGhostSymbol(effectiveCursor);
    new MepBoilerGhostRenderer(ctx).render({
      footprint: footprint.map((v) => ({ x: v.x, y: v.y })),
      cursor: effectiveCursor,
      symbol,
      transform: t,
      viewport,
    });
  }, [getGhostFootprint, getGhostSymbol]);

  useCanvasGhostPreview({
    isActive: isAwaitingPosition,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: true,
    draw,
  });
}
