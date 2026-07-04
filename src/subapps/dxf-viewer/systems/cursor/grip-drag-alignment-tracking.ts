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
import { getActiveDragGrip, isActiveGripAltMove } from './GripDragStore';
import { resolveActionAlignmentTracking } from '../../hooks/dimensions/dim-alignment-tracking';
import { toDimensionEntity, getDimGripAlignmentAnchors } from '../../hooks/dimensions/useDimensionGrips';
import { setGripAlignmentTracking, clearGripAlignmentTracking } from './GripAlignmentTrackingStore';
// ADR-357/363 — plain-line grip alignment anchors (SSoT sibling of getDimGripAlignmentAnchors).
import { getLineGripAlignmentAnchors } from '../../systems/line/line-grips';
import { isLineEntity, type Entity } from '../../types/entities';
// ADR-560 — body-drag (grab body → move/copy) as a THIRD consumer of the same AutoAlign SSoT.
import { EntityBodyDragStore } from '../drag/EntityBodyDragStore';
import type { Point2D } from '../../rendering/types/Types';

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
    // ADR-560 parity — whole-entity Alt-move (κολόνα / τοίχος / κύκλος / ΟΠΟΙΑΔΗΠΟΤΕ BIM|DXF):
    // base-point tracking, ΠΑΝΟΜΟΙΟΤΥΠΟ με το body-drag. Η λαβή είναι μόνο το base point, οπότε
    // όλη η οντότητα γλιστρά σε ortho/aligned ίχνη από εκεί ⊕ ambient γείτονες (τα κυανά ίχνη +
    // η έλξη προς κάθε οντότητα). Τρέχει ΠΡΙΝ τα line-specific anchors ώστε ένα Alt-move γραμμής
    // να παρακολουθεί κι αυτό από το base (όχι από άκρο). ΕΝΑ base-point brain (κοινό με body-drag).
    // ADR-560 — blur-proof altMove via the SSoT resolver (`isActiveGripAltMove`): prefers the
    // baked flag over the live `GripAltMoveStore` that the Windows Alt→blur clears mid-drag. ONE
    // resolver shared with the OSNAP corner-projection so the two paths can never disagree.
    if (isActiveGripAltMove() && dimGrip.dragAnchor) {
      return resolveBasePointTracking(moved, dimGrip.dragAnchor, scene, transformScale);
    }
    // ADR-357/363 — plain DXF LINE grip drag (χωρίς Alt): anchors per grip (fixed endpoint / move
    // base) from the line SSoT; the rotation handle returns null (its traces run in the ghost).
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

/**
 * ADR-560 — SSoT base-point AutoAlign tracking: a whole-entity MOVE from ONE base point
 * (AutoCAD MOVE base tracking). Resolves the SAME Object-Snap-Tracking brain against
 * `[anchor]` ⊕ acquired ⊕ ambient, publishes the result for the ghost paint, and returns the
 * possibly-overridden world point (→ ghost delta). Generic over entity type (the base point is
 * all that matters), so line / wall / column / circle get identical cyan traces + neighbour pull.
 *
 * The ONE brain shared by BOTH whole-entity move gestures — body-drag AND grip Alt-move — so the
 * two cannot diverge (ΕΝΑ resolve + ΕΝΑ store + ΕΝΑ paint, zero copy).
 */
function resolveBasePointTracking(
  moved: WorldPoint,
  anchor: Point2D,
  scene: DxfScene | null,
  transformScale: number,
): WorldPoint {
  const tracking = resolveActionAlignmentTracking(
    moved, [anchor], transformScale,
    (scene?.entities ?? null) as unknown as readonly Entity[] | null,
  );
  setGripAlignmentTracking(tracking);
  return tracking ? tracking.point : moved;
}

/**
 * ADR-560 — body-drag AutoAlign tracking. While an entity is dragged by its BODY (not a grip),
 * track the SINGLE grabbed base point via the shared `resolveBasePointTracking` brain. Overrides
 * the effective world point (→ ghost delta) AND publishes the tracking for the ghost paint →
 * WYSIWYG (preview ≡ commit). Must be called only while a body-drag is active.
 */
export function applyBodyDragAlignmentTracking(
  moveWorldPos: WorldPoint,
  scene: DxfScene | null,
  transformScale: number,
): WorldPoint {
  const anchor = EntityBodyDragStore.getAnchor();
  if (!anchor) {
    clearGripAlignmentTracking();
    return moveWorldPos;
  }
  return resolveBasePointTracking(moveWorldPos, anchor, scene, transformScale);
}
