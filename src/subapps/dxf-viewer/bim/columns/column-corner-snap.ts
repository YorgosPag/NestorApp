/**
 * Column Body Corner Projection Snap — ADR-398 (sibling of ADR-371 wall faces).
 *
 * When the user MOVES, RESIZES or DRAWS a BIM column, the cursor sits on the
 * move base / resize handle / placement anchor — NOT on a corner. This module
 * projects the column's OWN footprint corners to their proposed positions, asks
 * the unified snap engine (ADR-378 `findSnapPoint`) whether any corner lands on
 * a nearby target, and returns the cursor correction so the matched corner snaps
 * EXACTLY onto that target.
 *
 * Mirror of `systems/cursor/wall-face-corner-snap.ts`, generalised for whole-body
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
 * @see systems/cursor/wall-face-corner-snap.ts — wall sibling (ADR-371)
 * @see docs/centralized-systems/reference/adrs/ADR-371-wall-face-corner-projection-snap.md §Column
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import type { ColumnGripKind } from '../../hooks/useGripMovement';
import type { ColumnParamOverrides } from '../../hooks/drawing/column-completion';
import type { SceneUnits } from '../../utils/scene-units';
import { getColumnCornerWorldPointsFromParams } from './column-corner-anchors';
import { applyColumnGripDrag } from './column-grips';
import { buildDefaultColumnParams } from '../../hooks/drawing/column-completion';
import {
  findBestCornerProjection,
  type CornerProjectionResult,
  type FindSnapPoint,
} from '../../systems/cursor/corner-projection-snap';

// Re-export the shared types so column callers keep one import path.
export type { FindSnapPoint };
/** @deprecated alias — use {@link CornerProjectionResult}. */
export type ColumnCornerSnapResult = CornerProjectionResult;

/** Grip kinds that translate/resize the body — corner projection applies. */
const PROJECTION_GRIP_KINDS = new Set<ColumnGripKind>([
  'column-center',
  'column-width',
  'column-depth',
  'column-arm-length',
  'column-arm-width',
  'column-flange-length',
  'column-web-thickness',
  'column-i-flange-thickness',
  'column-i-web-thickness',
]);

/**
 * True for grip kinds where the column's corners should project & snap. Excludes
 * `column-rotation` (rotation is angular, not a corner-alignment operation).
 */
export function isColumnCornerSnapGrip(kind: string | null | undefined): boolean {
  return kind != null && PROJECTION_GRIP_KINDS.has(kind as ColumnGripKind);
}

/**
 * Corner projection for an in-progress MOVE or RESIZE grip drag.
 *
 * @param column        The column entity being dragged.
 * @param gripKind      The active parametric grip kind (`column-center` = move,
 *                      `column-width`/`-depth`/variant = resize).
 * @param dragAnchor    Drag origin (move base point / resize handle position).
 * @param cursorPos     Current world cursor.
 * @param findSnapPoint Snap engine query.
 */
export function findColumnGripCornerSnap(
  column: Readonly<ColumnEntity>,
  gripKind: ColumnGripKind,
  dragAnchor: Point2D,
  cursorPos: Point2D,
  findSnapPoint: FindSnapPoint,
): CornerProjectionResult | null {
  if (!isColumnCornerSnapGrip(gripKind)) return null;
  const delta: Point2D = { x: cursorPos.x - dragAnchor.x, y: cursorPos.y - dragAnchor.y };
  const proposed = applyColumnGripDrag(gripKind, {
    originalParams: column.params,
    delta,
    currentPos: cursorPos,
  });
  return projectColumn(proposed, cursorPos, findSnapPoint, column.id);
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
 * Column-specific adapter: derive the proposed column's footprint corners (SSoT
 * `getColumnCornerWorldPointsFromParams`) and delegate the query/best/correction
 * loop to the shared {@link findBestCornerProjection} core (zero duplication).
 */
function projectColumn(
  proposed: Readonly<ColumnParams>,
  cursorPos: Point2D,
  findSnapPoint: FindSnapPoint,
  excludeEntityId: string | null,
): CornerProjectionResult | null {
  const corners = getColumnCornerWorldPointsFromParams(proposed).map((c) => c.point);
  return findBestCornerProjection(corners, cursorPos, findSnapPoint, excludeEntityId);
}
