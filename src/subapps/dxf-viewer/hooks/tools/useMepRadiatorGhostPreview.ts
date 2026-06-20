/**
 * ADR-408 Εύρος Β #1 — Heating radiator 2D placement ghost preview hook.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic (το translucent footprint).
 *
 * The footprint comes from `useMepRadiatorTool().getGhostFootprint`, so the preview
 * is byte-for-byte what a click commits (WYSIWYG). Snapped cursor όταν OSNAP.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import { MepRadiatorGhostRenderer } from '../../bim/mep-radiators/MepRadiatorGhostRenderer';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseMepRadiatorGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly transform: ViewTransform;
  /** Footprint projection getter — from `useMepRadiatorTool().getGhostFootprint`. */
  getGhostFootprint(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Viewport element for size; falls back to `getCanvas` (handled by harness). */
  getViewportElement?(): HTMLElement | null;
}

export function useMepRadiatorGhostPreview(
  props: Readonly<UseMepRadiatorGhostPreviewProps>,
): void {
  const { isAwaitingPosition, transform, getGhostFootprint, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    const footprint = getGhostFootprint(effectiveCursor);
    if (!footprint || footprint.length < 3) return;
    new MepRadiatorGhostRenderer(ctx).render({
      footprint: footprint.map((v) => ({ x: v.x, y: v.y })),
      cursor: effectiveCursor,
      transform: t,
      viewport,
    });
  }, [getGhostFootprint]);

  useCanvasGhostPreview({
    isActive: isAwaitingPosition,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: true,
    draw,
  });
}
