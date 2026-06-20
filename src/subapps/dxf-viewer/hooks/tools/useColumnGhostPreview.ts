/**
 * ADR-363 Phase 4.5c.1 — Column anchor ghost preview hook (RAF-driven).
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): το RAF
 * lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor ζουν πλέον
 * ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic (τα 9 anchor ghosts).
 *
 * Mirror του `useRotationPreview` pattern: micro-leaf consumer που subscribes
 * σε `useCursorWorldPosition` και ζωγραφίζει τα 9 anchor ghosts απευθείας
 * στο preview canvas (CSS pixels με DPR transform). Ζωντάνεμα μέσω RAF —
 * δεν προκαλεί React re-renders πάνω από αυτό το leaf.
 *
 * ADR-398 §ghost coloring — statusColor διαβάζεται imperatively μέσα στο
 * draw delegate (zero React subscription, ADR-040):
 *   🟢 πάνω σε δοκάρι (snap στον άξονα)
 *   🔴 πάνω σε κολώνα (overlap)
 *   default — κανένα BIM snap
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5c.1
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { ColumnKind } from '../../bim/types/column-types';
import { getColumnGhostStatus } from '../../systems/cursor/ColumnPlacementGhostStatusStore';
import type { AnchorGhost } from '../../bim/columns/column-anchor-ghosts';
import {
  ColumnAnchorGhostRenderer,
  resolveGhostStatusColor,
} from '../../bim/columns/ColumnAnchorGhostRenderer';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseColumnGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly kind: ColumnKind;
  readonly transform: ViewTransform;
  /** Projection getter — από `useColumnTool().getGhostFootprints`. */
  getGhostFootprints(cursorPos: Readonly<Point2D> | null): readonly AnchorGhost[] | null;
  getCanvas(): HTMLCanvasElement | null;
  /** Same viewport-element convention with `useRotationPreview`. Falls back
   *  στο `getCanvas` όταν undefined. */
  getViewportElement?(): HTMLElement | null;
}

export function useColumnGhostPreview(props: Readonly<UseColumnGhostPreviewProps>): void {
  const { isAwaitingPosition, kind, transform, getGhostFootprints, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!effectiveCursor) return;
    const ghosts = getGhostFootprints(effectiveCursor);
    if (!ghosts || ghosts.length === 0) return;

    // ADR-398 §ghost coloring — imperatively read μέσα στο RAF (zero React subscription).
    const statusColor = resolveGhostStatusColor(getColumnGhostStatus());

    new ColumnAnchorGhostRenderer(ctx).render({ ghosts, kind, transform: t, viewport, statusColor });
  }, [getGhostFootprints, kind]);

  useCanvasGhostPreview({
    isActive: isAwaitingPosition,
    getCanvas,
    getViewportElement,
    transform,
    useImmediateSnap: true,
    draw,
  });
}
