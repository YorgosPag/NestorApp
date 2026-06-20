/**
 * ADR-408 Φ12 — Plumbing manifold 2D placement ghost preview hook.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic (footprint + imperative kind read).
 *
 * The footprint comes from `useMepManifoldTool().getGhostFootprint`. The `kind` is read
 * imperatively from the bridge store inside the draw closure (ADR-040 — no store
 * subscription in the leaf). Snapped cursor όταν OSNAP.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import { MepManifoldGhostRenderer } from '../../bim/mep-manifolds/MepManifoldGhostRenderer';
import { mepManifoldToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-manifold-tool-bridge-store';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseMepManifoldGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly transform: ViewTransform;
  /** Footprint projection getter — from `useMepManifoldTool().getGhostFootprint`. */
  getGhostFootprint(cursorPos: Readonly<Point2D> | null): readonly Point3D[] | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Viewport element for size; falls back to `getCanvas` (handled by harness). */
  getViewportElement?(): HTMLElement | null;
}

export function useMepManifoldGhostPreview(
  props: Readonly<UseMepManifoldGhostPreviewProps>,
): void {
  const { isAwaitingPosition, transform, getGhostFootprint, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    const footprint = getGhostFootprint(effectiveCursor);
    if (!footprint || footprint.length < 3) return;
    // Read the active kind imperatively (ADR-040 — no store subscription in the
    // leaf); the bridge mirrors the tool's `overrides.kind` preset.
    const kind = mepManifoldToolBridgeStore.get()?.kind ?? 'floor-manifold';
    new MepManifoldGhostRenderer(ctx).render({
      footprint: footprint.map((v) => ({ x: v.x, y: v.y })),
      kind,
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
