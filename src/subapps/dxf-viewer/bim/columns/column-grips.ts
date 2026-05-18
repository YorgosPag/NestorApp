/**
 * ADR-363 Phase 4.5 — Column parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors το
 * `bim/beams/beam-grips.ts` (Phase 5.5a) pattern και exposes τα grips που
 * περιγράφει το ADR-363 §6 Phase 4.5:
 *
 *   - `column-center`   → translate `position` (movesEntity=true)
 *   - `column-rotation` → rotate γύρω από `position` (anchor invariant). Skip
 *                          για `circular` kind.
 *   - `column-width`    → resize width on the far edge from anchor (local X
 *                          axis). For circular kind: resize diameter (handle
 *                          στο +X world).
 *   - `column-depth`    → resize depth on the far edge from anchor (local Y
 *                          axis). Skip για `circular` kind.
 *
 * Variant-specific arm/flange grips (L-shape, T-shape) DEFER στο Phase 4.5b.
 *
 * SSoT:
 *   - Geometry math via `computeColumnGeometry()` (called by
 *     `UpdateColumnParamsCommand` at commit time — this module returns ONLY
 *     new `ColumnParams`).
 *   - Anchor invariant during drag — `position` stays fixed για width/depth/
 *     rotation grips; centroid shifts automatically μέσω της geometry pipeline.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnGripKind, GripInfo } from '../../hooks/useGripMovement';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import { ANCHOR_OFFSETS, MIN_COLUMN_DIMENSION_MM } from '../types/column-types';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** mm. Offset της λαβής rotation πάνω από το north edge (visual separation). */
const ROTATION_HANDLE_OFFSET_MM = 200;

// ─── Local-frame geometry helpers ────────────────────────────────────────────

/**
 * Rotate vector `v` by `rotDeg` (CCW) around the origin. Returns new vector.
 */
function rotate(v: Point2D, rotDeg: number): Point2D {
  const r = rotDeg * DEG_TO_RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * Project world delta onto the column's local rotated axes. Returns
 * `{ dxLocal, dyLocal }` where dxLocal is the component along the rotated +X
 * axis και dyLocal along rotated +Y.
 */
function projectDeltaToLocal(delta: Point2D, rotDeg: number): { dxLocal: number; dyLocal: number } {
  const r = rotDeg * DEG_TO_RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { dxLocal: delta.x * c + delta.y * s, dyLocal: -delta.x * s + delta.y * c };
}

/**
 * Compute the centroid (bbox centre) of the column footprint σε world coords.
 * For non-circular: `centroid = position + rotatedR(-dx*width, -dy*depth)`.
 * For circular: anchor effectively 'center', `centroid = position`.
 */
function computeCentroidWorld(params: ColumnParams): Point2D {
  if (params.kind === 'circular') {
    return { x: params.position.x, y: params.position.y };
  }
  const { dx, dy } = ANCHOR_OFFSETS[params.anchor];
  const shift = rotate({ x: -dx * params.width, y: -dy * params.depth }, params.rotation);
  return { x: params.position.x + shift.x, y: params.position.y + shift.y };
}

/**
 * Resolve far-edge sign along local X axis. Returns `+1` (east edge) for
 * `dx <= 0`, `-1` (west edge) for `dx > 0`. Guarantees non-zero coefficient
 * for width handle even when anchor sits on east/west edge.
 */
function farEdgeSignX(dx: number): number {
  return dx <= 0 ? +1 : -1;
}

/**
 * Same as `farEdgeSignX` but for local Y axis (north / south).
 */
function farEdgeSignY(dy: number): number {
  return dy <= 0 ? +1 : -1;
}

/**
 * World position of the width grip handle (far edge midpoint along local X).
 * Local coords (centered on centroid): `(signX*width/2, 0)`.
 */
function widthHandleWorld(params: ColumnParams): Point2D {
  if (params.kind === 'circular') {
    return { x: params.position.x + params.width / 2, y: params.position.y };
  }
  const centroid = computeCentroidWorld(params);
  const { dx } = ANCHOR_OFFSETS[params.anchor];
  const signX = farEdgeSignX(dx);
  const local = { x: (signX * params.width) / 2, y: 0 };
  const rotated = rotate(local, params.rotation);
  return { x: centroid.x + rotated.x, y: centroid.y + rotated.y };
}

/**
 * World position of the depth grip handle (far edge midpoint along local Y).
 */
function depthHandleWorld(params: ColumnParams): Point2D {
  const centroid = computeCentroidWorld(params);
  const { dy } = ANCHOR_OFFSETS[params.anchor];
  const signY = farEdgeSignY(dy);
  const local = { x: 0, y: (signY * params.depth) / 2 };
  const rotated = rotate(local, params.rotation);
  return { x: centroid.x + rotated.x, y: centroid.y + rotated.y };
}

/**
 * World position of the rotation grip handle. Sits centroid + rotated(0,
 * depth/2 + offset) — visually πάνω από το north edge.
 */
function rotationHandleWorld(params: ColumnParams): Point2D {
  const centroid = computeCentroidWorld(params);
  const local = { x: 0, y: params.depth / 2 + ROTATION_HANDLE_OFFSET_MM };
  const rotated = rotate(local, params.rotation);
  return { x: centroid.x + rotated.x, y: centroid.y + rotated.y };
}

// ─── Grip emission (ADR-363 §6 Phase 4.5) ────────────────────────────────────

/**
 * Compute parametric grip positions για ένα `ColumnEntity`. Stable order:
 *
 *   rectangular / L-shape / T-shape:
 *     0 → center        (translate position)
 *     1 → rotation      (rotate around position)
 *     2 → width         (resize width, far edge)
 *     3 → depth         (resize depth, far edge)
 *
 *   circular:
 *     0 → center
 *     1 → width (= diameter resize, handle στο +X world)
 */
export function getColumnGrips(entity: Readonly<ColumnEntity>): GripInfo[] {
  const { params } = entity;
  const grips: GripInfo[] = [];
  const centroid = computeCentroidWorld(params);

  // 0 — center (translate)
  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'center',
    position: centroid,
    movesEntity: true,
    columnGripKind: 'column-center',
  });

  if (params.kind === 'circular') {
    // 1 — width (= diameter) — non-rotated handle στο world +X
    grips.push({
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: widthHandleWorld(params),
      movesEntity: false,
      columnGripKind: 'column-width',
    });
    return grips;
  }

  // 1 — rotation (rectangular / L-shape / T-shape)
  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: rotationHandleWorld(params),
    movesEntity: false,
    columnGripKind: 'column-rotation',
  });

  // 2 — width
  grips.push({
    entityId: entity.id,
    gripIndex: 2,
    type: 'vertex',
    position: widthHandleWorld(params),
    movesEntity: false,
    columnGripKind: 'column-width',
  });

  // 3 — depth
  grips.push({
    entityId: entity.id,
    gripIndex: 3,
    type: 'vertex',
    position: depthHandleWorld(params),
    movesEntity: false,
    columnGripKind: 'column-depth',
  });

  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface ColumnGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: ColumnParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
}

/**
 * Pure transform: column grip kind + drag input → new `ColumnParams`. Geometry
 * is NOT recomputed here — ο caller (`UpdateColumnParamsCommand.execute`) είναι
 * υπεύθυνος για την `computeColumnGeometry()` κλήση ώστε το math SSoT να μένει
 * σε ένα σημείο.
 *
 * Zero delta ή unknown grip kind → επιστρέφει `originalParams` referentially
 * unchanged ώστε ο caller να μπορεί να short-circuit το commit (no-op).
 */
export function applyColumnGripDrag(
  gripKind: ColumnGripKind,
  input: Readonly<ColumnGripDragInput>,
): ColumnParams {
  if (input.delta.x === 0 && input.delta.y === 0) return input.originalParams;
  if (gripKind === 'column-center') return moveCenter(input);
  if (gripKind === 'column-rotation') return rotateAroundPosition(input);
  if (gripKind === 'column-width') return resizeWidth(input);
  if (gripKind === 'column-depth') return resizeDepth(input);
  return input.originalParams;
}

// ─── Per-grip transforms ─────────────────────────────────────────────────────

function moveCenter(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  return {
    ...originalParams,
    position: {
      x: originalParams.position.x + delta.x,
      y: originalParams.position.y + delta.y,
      z: originalParams.position.z ?? 0,
    },
  };
}

function rotateAroundPosition(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind === 'circular') return originalParams; // no-op
  const oldHandle = rotationHandleWorld(originalParams);
  const newHandle = { x: oldHandle.x + delta.x, y: oldHandle.y + delta.y };
  // Vector handle → position in world (drag pivot = position, not centroid).
  const oldVec = { x: oldHandle.x - originalParams.position.x, y: oldHandle.y - originalParams.position.y };
  const newVec = { x: newHandle.x - originalParams.position.x, y: newHandle.y - originalParams.position.y };
  const oldAngle = Math.atan2(oldVec.y, oldVec.x);
  const newAngle = Math.atan2(newVec.y, newVec.x);
  const deltaDeg = (newAngle - oldAngle) * RAD_TO_DEG;
  return { ...originalParams, rotation: originalParams.rotation + deltaDeg };
}

function resizeWidth(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind === 'circular') {
    // Diameter resize: handle στο +X world, symmetric resize around position.
    const newWidth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.width + 2 * delta.x);
    return { ...originalParams, width: newWidth };
  }
  const { dx } = ANCHOR_OFFSETS[originalParams.anchor];
  const signX = farEdgeSignX(dx);
  // Handle local X coefficient (relative to position): signX/2 - dx
  // — guaranteed non-zero by farEdgeSignX selection.
  const coefX = signX * 0.5 - dx;
  const { dxLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newWidth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.width + dxLocal / coefX);
  return { ...originalParams, width: newWidth };
}

function resizeDepth(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind === 'circular') return originalParams; // no-op
  const { dy } = ANCHOR_OFFSETS[originalParams.anchor];
  const signY = farEdgeSignY(dy);
  const coefY = signY * 0.5 - dy;
  const { dyLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newDepth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.depth + dyLocal / coefY);
  return { ...originalParams, depth: newDepth };
}
