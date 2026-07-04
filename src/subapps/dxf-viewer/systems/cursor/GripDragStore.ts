/**
 * GripDragStore — Imperative store for active grip drag context
 *
 * Pattern identical to ImmediateSnapStore: zero-React, mutable singleton.
 * Written by useUnifiedGripInteraction on drag start/end.
 * Read by mouse-handler-move + mouse-handler-up for face corner projection snap.
 *
 * ADR-371 extension: Wall Face Corner Projection Snap
 * ADR-398 extension: `dragAnchor` carries the drag origin (move base / resize
 * handle) so the column Body Corner Projection snap can compute the proposed
 * footprint from the SAME anchor the commit math uses.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionGripKind, LineGripKind } from '../../hooks/grip-types';
import { clearGripAlignmentTracking } from './GripAlignmentTrackingStore';
import { clearMoveOrthoAxis } from '../grip/MoveOrthoAxisStore';

export interface ActiveDragGripInfo {
  entityId: string;
  gripKind: string | null; // 'wall-start' | 'wall-end' | 'column-center' | etc.
  /**
   * ADR-398 — drag origin in world coords: resize handle position (press-drag)
   * or the move base point (hot-grip move). Set later for hot-grip move because
   * the base is picked on the 2nd click; consumers must guard for `undefined`.
   */
  dragAnchor?: Point2D;
  /**
   * ADR-562 Φ9.2 — dimension grip discriminator. Set when a `dim-*` grip is dragged
   * so the mouse handlers run AutoAlign tracking (`resolveDimAlignmentTracking`) with
   * the dimension's other defPoints as anchors, exactly like the creation flow.
   */
  dimGripKind?: DimensionGripKind | null;
  /**
   * ADR-357/363 — plain-line grip discriminators. `gripIndex` (0=start, 1=end, 2=midpoint,
   * 3=rotation, 4=MOVE-cross) + `lineGripKind` let the mouse handlers pick the alignment
   * anchor (`getLineGripAlignmentAnchors`) so a line endpoint / centre drag lights up the
   * SAME Object-Snap-Tracking traces as every other tool. Set only for line-entity grips.
   */
  gripIndex?: number;
  lineGripKind?: LineGripKind | null;
  /**
   * ADR-363 Φ1G.5 / ADR-560 — whole-entity Alt-move flag, captured ONCE at grip mousedown.
   * A BLUR-PROOF mirror of `GripAltMoveStore.getActive()`: on Windows holding Alt can fire a
   * window `blur` that clears the live store MID-drag, so the AutoAlign resolve read it as false
   * and the cyan traces + neighbour pull vanished. This baked flag survives the whole gesture, so
   * a column/wall/any Alt-move keeps its base-point tracking. Set only when the drag armed with Alt.
   */
  altMove?: boolean;
}

let activeDragGrip: ActiveDragGripInfo | null = null;

/** Write — called by useUnifiedGripInteraction when DXF grip drag starts */
export function setActiveDragGrip(info: ActiveDragGripInfo): void {
  activeDragGrip = info;
}

/**
 * ADR-398 — patch the drag anchor of the active record. Called when the hot-grip
 * move base point is picked (after `setActiveDragGrip` ran at hot-grip enter).
 * No-op if there is no active record.
 */
export function setActiveDragGripAnchor(anchor: Point2D): void {
  if (activeDragGrip) {
    activeDragGrip = { ...activeDragGrip, dragAnchor: { x: anchor.x, y: anchor.y } };
  }
}

/** Read — called by mouse handlers to know which grip is being dragged */
export function getActiveDragGrip(): ActiveDragGripInfo | null {
  return activeDragGrip;
}

/** Clear — called by resetToIdle in useUnifiedGripInteraction */
export function clearActiveDragGrip(): void {
  activeDragGrip = null;
  // ADR-357/562/363 — drag lifecycle SSoT: any active grip AutoAlign traces (dim OR line)
  // end with the drag (release / ESC / cancel) so a stale result never bleeds into the next.
  clearGripAlignmentTracking();
  // ADR-363 §line local-ortho — ο τοπικός άξονας μετακίνησης λήγει επίσης με το drag.
  clearMoveOrthoAxis();
}
