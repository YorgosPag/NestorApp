/**
 * Grip-drag AutoAlign tracking — ADR-562 Φ9.2 / ADR-357 SSoT
 *
 * Extracted from `mouse-handler-move` (ADR-065 SRP / N.7.1 size budget). While a
 * DIMENSION or plain-LINE grip is being dragged, this runs the SAME Object-Snap-
 * Tracking brain as the dimension + drawing flows: it overrides the effective world
 * point (→ grip delta → ghost geometry) AND publishes the tracking result for the
 * ghost paint — ONE resolve, WYSIWYG (preview ≡ commit). No-op (null anchors) → clear
 * so nothing lingers on a wall/column drag.
 */
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import { getActiveDragGrip } from './GripDragStore';
import { resolveActionAlignmentTracking } from '../../hooks/dimensions/dim-alignment-tracking';
import { toDimensionEntity, getDimGripAlignmentAnchors } from '../../hooks/dimensions/useDimensionGrips';
import { setGripAlignmentTracking, clearGripAlignmentTracking } from './GripAlignmentTrackingStore';
// ADR-357/363 — plain-line grip alignment anchors (SSoT sibling of getDimGripAlignmentAnchors).
import { getLineGripAlignmentAnchors } from '../../systems/line/line-grips';
import { isLineEntity, type Entity } from '../../types/entities';

type WorldPoint = ReturnType<typeof CoordinateTransforms.screenToWorld>;

/**
 * Resolve grip-drag alignment tracking and return the possibly-overridden world point.
 * Must be called AFTER the OSNAP + face/corner snaps (same override point) and only
 * while a grip drag is active.
 */
export function applyGripDragAlignmentTracking(
  moveWorldPos: WorldPoint,
  scene: DxfScene | null,
  transformScale: number,
): WorldPoint {
  let moved = moveWorldPos;
  const dimGrip = getActiveDragGrip();
  if (dimGrip?.dimGripKind) {
    // Anchors = the dimension's OTHER defPoints ⊕ acquired ⊕ ambient (AutoAlign-gated → lazy read).
    const dimEntity = toDimensionEntity(scene?.entities?.find(en => en.id === dimGrip.entityId));
    const anchors = dimEntity ? getDimGripAlignmentAnchors(dimGrip.dimGripKind, dimEntity) : null;
    if (anchors) {
      const dimTracking = resolveActionAlignmentTracking(
        moved, anchors, transformScale,
        (scene?.entities ?? null) as unknown as readonly Entity[] | null,
      );
      setGripAlignmentTracking(dimTracking);
      if (dimTracking) moved = dimTracking.point;
    } else {
      clearGripAlignmentTracking();
    }
  } else if (dimGrip) {
    // ADR-357/363 — plain DXF LINE grip drag: anchors per grip (fixed endpoint / move base)
    // come from the line SSoT; the rotation handle returns null (its traces run in the ghost).
    const lineEnt = scene?.entities?.find(en => en.id === dimGrip.entityId) as unknown as Entity | undefined;
    const anchors = lineEnt && isLineEntity(lineEnt) && dimGrip.gripIndex !== undefined
      ? getLineGripAlignmentAnchors(dimGrip.gripIndex, dimGrip.lineGripKind, lineEnt, dimGrip.dragAnchor)
      : null;
    if (anchors) {
      const lineTracking = resolveActionAlignmentTracking(
        moved, anchors, transformScale,
        (scene?.entities ?? null) as unknown as readonly Entity[] | null,
      );
      setGripAlignmentTracking(lineTracking);
      if (lineTracking) moved = lineTracking.point;
    } else {
      clearGripAlignmentTracking();
    }
  }
  return moved;
}
