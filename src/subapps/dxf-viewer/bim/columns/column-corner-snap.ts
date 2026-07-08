/**
 * Column Body Corner Projection Snap — ADR-398 (sibling of ADR-597 wall faces).
 *
 * When the user MOVES, RESIZES or DRAWS a BIM column, the cursor sits on the
 * move base / resize handle / placement anchor — NOT on a corner. This module
 * projects the column's OWN footprint corners to their proposed positions, asks
 * the unified snap engine (ADR-378 `findSnapPoint`) whether any corner lands on
 * a nearby target, and returns the cursor correction so the matched corner snaps
 * EXACTLY onto that target.
 *
 * Mirror of `bim/walls/wall-face-corner-snap.ts`, generalised for whole-body
 * transforms:
 *   - the wall projects 2 face corners at a dragged endpoint (axis ± thickness/2);
 *   - the column projects all 4 (N for polygon) footprint corners and the BEST
 *     match wins, exactly like the wall picks the closer of its two faces.
 *
 * SSoT (zero re-implemented geometry/transform math):
 *   - corner positions ← `getColumnCornerWorldPointsFromParams` (column-corner-
 *     anchors → column-anchors → mirrors `transformFootprint`).
 *   - proposed params for move/resize ← `applyColumnGripDrag` (column-grips), the
 *     SAME transform the commit uses, so preview === commit (ADR-397 lesson).
 *   - proposed params for draw ← `buildDefaultColumnParams` (column-completion).
 *
 * The returned `adjustedCursorPos` is fed back as the effective cursor:
 *   - move   → translation delta shifts every corner by (target − corner);
 *   - resize → `applyColumnGripDrag` consumes only the local-axis component, so
 *              the dragged dimension snaps along its own axis;
 *   - draw   → the placement anchor shifts so the corner lands on target.
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see bim/walls/wall-face-corner-snap.ts — wall sibling (ADR-597)
 * @see docs/centralized-systems/reference/adrs/ADR-597-bim-corner-snap-system.md §17 (Column)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { ColumnGripKind } from '../../hooks/useGripMovement';
import type { ColumnParamOverrides } from '../../hooks/drawing/column-completion';
import type { SceneUnits } from '../../utils/scene-units';
import { computeColumnGeometry } from '../geometry/column-geometry';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import { buildDefaultColumnParams } from '../../hooks/drawing/column-completion';
import { findMemberGripCornerSnap, isColumnCornerSnapGrip } from '../structural/member-grip-corner-snap';
import {
  findBestCornerProjection,
  type CornerProjectionResult,
  type FindSnapPoint,
} from '../../systems/cursor/corner-projection-snap';

// Re-export the shared types so column callers keep one import path.
export type { FindSnapPoint };
/** @deprecated alias — use {@link CornerProjectionResult}. */
export type ColumnCornerSnapResult = CornerProjectionResult;

// The column projection-grip predicate now lives with the generic member SSoT
// (κολόνα/δοκός/θεμέλιο μοιράζονται ΕΝΑ corner-source). Re-exported for callers/tests.
export { isColumnCornerSnapGrip };

/**
 * Corner projection for an in-progress column MOVE / RESIZE / Alt whole-body grip drag.
 *
 * Thin back-compat wrapper: delegates to the generic {@link findMemberGripCornerSnap}
 * (κολόνα/δοκός/θεμέλιο, ίδιος shared core) so a column behaves EXACTLY like a wall/
 * beam/foundation during grip Alt-drag OSNAP. Kept for column call-sites + tests.
 *
 * @param column        The column entity being dragged.
 * @param gripKind      The active parametric grip kind (`column-center` = move,
 *                      `column-width`/`-depth`/variant = resize).
 * @param dragAnchor    Drag origin (move base point / resize handle position).
 * @param cursorPos     Current world cursor.
 * @param findSnapPoint Snap engine query.
 * @param altMove       ADR-363 Φ1G.5 — Alt whole-entity move (whole-body translate).
 */
export function findColumnGripCornerSnap(
  column: Readonly<ColumnEntity>,
  gripKind: ColumnGripKind,
  dragAnchor: Point2D,
  cursorPos: Point2D,
  findSnapPoint: FindSnapPoint,
  altMove = false,
): CornerProjectionResult | null {
  return findMemberGripCornerSnap(column, gripKind, dragAnchor, cursorPos, findSnapPoint, altMove);
}

/**
 * Corner projection for the column DRAW (placement) tool. Builds the would-be
 * column at the cursor and snaps a corner onto a nearby target.
 */
export function findColumnDrawCornerSnap(
  cursorPos: Point2D,
  overrides: Readonly<ColumnParamOverrides>,
  sceneUnits: SceneUnits,
  findSnapPoint: FindSnapPoint,
): CornerProjectionResult | null {
  const proposed = buildDefaultColumnParams(cursorPos, overrides.kind, overrides, sceneUnits);
  // Draw has no existing entity to exclude from the snap index.
  return projectColumn(proposed, cursorPos, findSnapPoint, null);
}

/**
 * Column-specific adapter: derive the proposed column's footprint corners and
 * delegate the query/best/correction loop to the shared {@link findBestCornerProjection}
 * core (zero duplication).
 *
 * ADR-363 Φ1G.5 — projects the ACTUAL footprint vertices (all N for L/T/U/Π/polygon),
 * via the SAME `computeColumnGeometry` footprint SSoT the per-vertex grips use, NOT the
 * 4 bounding-box corners. An L-shape's bbox corners include a PHANTOM point in the
 * reentrant notch (empty space) and miss the real vertices the user aligns, so
 * corner-to-corner snap never fired against a neighbour. Rectangular → the 4 real
 * corners = the bbox corners (zero regression).
 */
function projectColumn(
  proposed: Readonly<ColumnParams>,
  cursorPos: Point2D,
  findSnapPoint: FindSnapPoint,
  excludeEntityId: string | null,
): CornerProjectionResult | null {
  const corners = projectVerticesTo2D(computeColumnGeometry(proposed).footprint.vertices);
  return findBestCornerProjection(corners, cursorPos, findSnapPoint, excludeEntityId);
}
