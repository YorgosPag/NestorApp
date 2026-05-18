/**
 * ADR-363 Phase 4.5 + 4.5b — Column parametric grip handlers (base + variants).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors το
 * `bim/beams/beam-grips.ts` (Phase 5.5a/5.5b) pattern και exposes τα grips που
 * περιγράφει το ADR-363 §6 Phase 4.5 + 4.5b:
 *
 *   Base (Phase 4.5):
 *   - `column-center`   → translate `position` (movesEntity=true)
 *   - `column-rotation` → rotate γύρω από `position` (anchor invariant). Skip
 *                          για `circular` kind.
 *   - `column-width`    → resize width on the far edge from anchor (local X
 *                          axis). For circular kind: resize diameter (handle
 *                          στο +X world).
 *   - `column-depth`    → resize depth on the far edge from anchor (local Y
 *                          axis). Skip για `circular` kind.
 *
 *   Variant-specific (Phase 4.5b — see `column-variant-grips.ts`):
 *   - `column-arm-length`    → L-shape only (asymmetric, 1× factor)
 *   - `column-arm-width`     → L-shape only (asymmetric, 1× factor)
 *   - `column-flange-length` → T-shape only (symmetric, 2× factor)
 *   - `column-web-thickness` → T-shape only (symmetric, 2× factor)
 *
 * SSoT:
 *   - Geometry math via `computeColumnGeometry()` (called by
 *     `UpdateColumnParamsCommand` at commit time — this module returns ONLY
 *     new `ColumnParams`).
 *   - Local-frame primitives live in `column-grip-utils.ts` (shared με variant
 *     module). Anchor invariant during drag — `position` stays fixed για
 *     width/depth/rotation/variant grips· centroid shifts automatically μέσω
 *     της geometry pipeline.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5/4.5b
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnGripKind, GripInfo } from '../../hooks/useGripMovement';
import type { ColumnEntity, ColumnParams } from '../types/column-types';
import { ANCHOR_OFFSETS, MIN_COLUMN_DIMENSION_MM } from '../types/column-types';
import {
  RAD_TO_DEG,
  ROTATION_HANDLE_OFFSET_MM,
  computeCentroidWorld,
  farEdgeSignX,
  farEdgeSignY,
  projectDeltaToLocal,
  rotate,
} from './column-grip-utils';
import {
  armLengthHandlePosition,
  armWidthHandlePosition,
  flangeLengthHandlePosition,
  resizeArmLength,
  resizeArmWidth,
  resizeFlangeLength,
  resizeWebThickness,
  webThicknessHandlePosition,
} from './column-variant-grips';

// ─── Base grip handle positions (Phase 4.5) ──────────────────────────────────

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

// ─── Grip emission (ADR-363 §6 Phase 4.5 + 4.5b) ─────────────────────────────

/**
 * Compute parametric grip positions για ένα `ColumnEntity`. Stable order:
 *
 *   rectangular:
 *     0 → center, 1 → rotation, 2 → width, 3 → depth
 *
 *   L-shape (Phase 4.5b adds 2 variant grips):
 *     0 → center, 1 → rotation, 2 → width, 3 → depth,
 *     4 → arm-length (inner-corner horizontal edge, asymmetric),
 *     5 → arm-width  (inner-corner vertical edge, asymmetric)
 *
 *   T-shape (Phase 4.5b adds 2 variant grips):
 *     0 → center, 1 → rotation, 2 → width, 3 → depth,
 *     4 → flange-length (right side edge of πέλμα, symmetric),
 *     5 → web-thickness (right side edge of κορμός, symmetric)
 *
 *   circular:
 *     0 → center, 1 → width (= diameter, handle στο world +X)
 */
export function getColumnGrips(entity: Readonly<ColumnEntity>): GripInfo[] {
  const { params } = entity;
  const grips: GripInfo[] = [];
  const centroid = computeCentroidWorld(params);

  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'center',
    position: centroid,
    movesEntity: true,
    columnGripKind: 'column-center',
  });

  if (params.kind === 'circular') {
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

  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: rotationHandleWorld(params),
    movesEntity: false,
    columnGripKind: 'column-rotation',
  });
  grips.push({
    entityId: entity.id,
    gripIndex: 2,
    type: 'vertex',
    position: widthHandleWorld(params),
    movesEntity: false,
    columnGripKind: 'column-width',
  });
  grips.push({
    entityId: entity.id,
    gripIndex: 3,
    type: 'vertex',
    position: depthHandleWorld(params),
    movesEntity: false,
    columnGripKind: 'column-depth',
  });

  if (params.kind === 'L-shape') {
    grips.push({
      entityId: entity.id,
      gripIndex: 4,
      type: 'edge',
      position: armLengthHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-arm-length',
    });
    grips.push({
      entityId: entity.id,
      gripIndex: 5,
      type: 'edge',
      position: armWidthHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-arm-width',
    });
  } else if (params.kind === 'T-shape') {
    grips.push({
      entityId: entity.id,
      gripIndex: 4,
      type: 'edge',
      position: flangeLengthHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-flange-length',
    });
    grips.push({
      entityId: entity.id,
      gripIndex: 5,
      type: 'edge',
      position: webThicknessHandlePosition(params),
      movesEntity: false,
      columnGripKind: 'column-web-thickness',
    });
  }

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
  if (gripKind === 'column-arm-length') return resizeArmLength(input);
  if (gripKind === 'column-arm-width') return resizeArmWidth(input);
  if (gripKind === 'column-flange-length') return resizeFlangeLength(input);
  if (gripKind === 'column-web-thickness') return resizeWebThickness(input);
  return input.originalParams;
}

// ─── Per-grip base transforms ────────────────────────────────────────────────

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
  if (originalParams.kind === 'circular') return originalParams;
  const oldHandle = rotationHandleWorld(originalParams);
  const newHandle = { x: oldHandle.x + delta.x, y: oldHandle.y + delta.y };
  const oldVec = {
    x: oldHandle.x - originalParams.position.x,
    y: oldHandle.y - originalParams.position.y,
  };
  const newVec = {
    x: newHandle.x - originalParams.position.x,
    y: newHandle.y - originalParams.position.y,
  };
  const oldAngle = Math.atan2(oldVec.y, oldVec.x);
  const newAngle = Math.atan2(newVec.y, newVec.x);
  const deltaDeg = (newAngle - oldAngle) * RAD_TO_DEG;
  return { ...originalParams, rotation: originalParams.rotation + deltaDeg };
}

function resizeWidth(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind === 'circular') {
    const newWidth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.width + 2 * delta.x);
    return { ...originalParams, width: newWidth };
  }
  const { dx } = ANCHOR_OFFSETS[originalParams.anchor];
  const signX = farEdgeSignX(dx);
  const coefX = signX * 0.5 - dx;
  const { dxLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newWidth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.width + dxLocal / coefX);
  return { ...originalParams, width: newWidth };
}

function resizeDepth(input: Readonly<ColumnGripDragInput>): ColumnParams {
  const { originalParams, delta } = input;
  if (originalParams.kind === 'circular') return originalParams;
  const { dy } = ANCHOR_OFFSETS[originalParams.anchor];
  const signY = farEdgeSignY(dy);
  const coefY = signY * 0.5 - dy;
  const { dyLocal } = projectDeltaToLocal(delta, originalParams.rotation);
  const newDepth = Math.max(MIN_COLUMN_DIMENSION_MM, originalParams.depth + dyLocal / coefY);
  return { ...originalParams, depth: newDepth };
}
