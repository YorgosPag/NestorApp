/**
 * ADR-436 Slice 1b — Foundation (pad) parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. 1:1 mirror του
 * `bim/columns/column-grips.ts` (rectangular branch) — pad-only, πολύ μικρότερο
 * (μηδέν circular/polygon/variant kinds). Exposes τα grips του ADR-436 §4.3:
 *
 *   - `foundation-rotation` → rotate γύρω από `position` (anchor invariant).
 *   - `foundation-width`    → resize `width` on the far edge from anchor (local X).
 *   - `foundation-length`   → resize `length` on the far edge from anchor (local Y).
 *
 * ΠΡΟΣΟΧΗ: pad = **width × length** (ΟΧΙ width × depth όπως column). Ο δεύτερος
 * άξονας (local Y) είναι το `length`.
 *
 * Declutter (mirror column Φ1G.5 Slice 2): το central MOVE grip
 * (`foundation-center`, gripIndex 0) ΔΕΝ εκπέμπεται — Alt+drag από οποιοδήποτε
 * grip μετακινεί όλο το πέδιλο. Το `foundation-center` transform (`moveCenter`)
 * παραμένει για το Alt-move μονοπάτι.
 *
 * SSoT:
 *   - Geometry math via `computeFoundationGeometry()` (called by
 *     `UpdateFoundationParamsCommand` at commit time — αυτό το module επιστρέφει
 *     ΜΟΝΟ νέα `FoundationParams`).
 *   - Local-frame primitives = shared `bim/grips/grip-math` (rotateVector /
 *     projectToLocalFrame / sweptAngleDegAboutPivot) + canonical `rotatePoint`
 *     (ADR-188). Anchor invariant during drag — `position` stays fixed για
 *     width/length/rotation grips· centroid shifts μέσω της geometry pipeline.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4.3
 * @see bim/columns/column-grips.ts — πρότυπο
 */

import type { Point2D } from '../../rendering/types/Types';
import type { FoundationGripKind, GripInfo } from '../../hooks/useGripMovement';
import type {
  FoundationEntity,
  FoundationParams,
  PadFootingParams,
} from '../types/foundation-types';
import { ANCHOR_OFFSETS, MIN_FOUNDATION_DIMENSION_MM } from '../types/foundation-types';
import { rotatePoint } from '../../utils/rotation-math';
import {
  rotateVector,
  projectToLocalFrame,
  sweptAngleDegAboutPivot,
} from '../grips/grip-math';
import { mmScaleFor } from '../../utils/scene-units';

const RAD_TO_DEG = 180 / Math.PI;

/** mm. Offset της λαβής rotation πάνω από το north edge (visual separation). */
const ROTATION_HANDLE_OFFSET_MM = 200;

// ─── Local-frame helpers (mirror column-grip-utils, pad width×length) ─────────

/** Far-edge sign along local X: `+1` (east) for `dx <= 0`, `-1` (west) otherwise. */
function farEdgeSignX(dx: number): number {
  return dx <= 0 ? +1 : -1;
}

/** Far-edge sign along local Y: `+1` (north) for `dy <= 0`, `-1` (south) otherwise. */
function farEdgeSignY(dy: number): number {
  return dy <= 0 ? +1 : -1;
}

/** Project world delta onto the pad's local rotated axes (`{ dxLocal, dyLocal }`). */
function projectDeltaToLocal(delta: Point2D, rotDeg: number): { dxLocal: number; dyLocal: number } {
  const local = projectToLocalFrame(delta, rotDeg);
  return { dxLocal: local.x, dyLocal: local.y };
}

/**
 * Centroid (bbox centre) του pad footprint σε world coords.
 * `centroid = position + rotatedR(-dx*width*s, -dy*length*s)` (s = scene-unit
 * scale ώστε τα grips να μένουν πάνω στο σώμα σε metre/cm scenes, mirror column).
 */
function computeCentroidWorld(params: PadFootingParams): Point2D {
  const s = mmScaleFor(params);
  const { dx, dy } = ANCHOR_OFFSETS[params.anchor];
  const shift = rotateVector(
    { x: -dx * params.width * s, y: -dy * params.length * s },
    params.rotation,
  );
  return { x: params.position.x + shift.x, y: params.position.y + shift.y };
}

/** Local-frame mm point (centered on centroid, no anchor shift) → world coords. */
function localToWorld(local: Point2D, params: PadFootingParams): Point2D {
  const s = mmScaleFor(params);
  const centroid = computeCentroidWorld(params);
  const rotated = rotateVector({ x: local.x * s, y: local.y * s }, params.rotation);
  return { x: centroid.x + rotated.x, y: centroid.y + rotated.y };
}

/** World position της λαβής width (far edge midpoint κατά local X). */
function widthHandleWorld(params: PadFootingParams): Point2D {
  const { dx } = ANCHOR_OFFSETS[params.anchor];
  const signX = farEdgeSignX(dx);
  return localToWorld({ x: (signX * params.width) / 2, y: 0 }, params);
}

/** World position της λαβής length (far edge midpoint κατά local Y). */
function lengthHandleWorld(params: PadFootingParams): Point2D {
  const { dy } = ANCHOR_OFFSETS[params.anchor];
  const signY = farEdgeSignY(dy);
  return localToWorld({ x: 0, y: (signY * params.length) / 2 }, params);
}

/** World position της λαβής rotation (πάνω από το north edge). */
function rotationHandleWorld(params: PadFootingParams): Point2D {
  return localToWorld({ x: 0, y: params.length / 2 + ROTATION_HANDLE_OFFSET_MM }, params);
}

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions για ένα `FoundationEntity`. Stable order.
 * Μόνο `pad` εκπέμπει grips (strip / tie-beam = Slice 2). Declutter: NO central
 * move grip (gripIndex 0 unused) — Alt+drag μετακινεί.
 *
 *   pad (3 grips):
 *     1 → rotation, 2 → width, 3 → length
 */
export function getFoundationGrips(entity: Readonly<FoundationEntity>): GripInfo[] {
  const { params } = entity;
  if (params.kind !== 'pad') return [];

  return [
    {
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: rotationHandleWorld(params),
      movesEntity: false,
      foundationGripKind: 'foundation-rotation',
    },
    {
      entityId: entity.id,
      gripIndex: 2,
      type: 'vertex',
      position: widthHandleWorld(params),
      movesEntity: false,
      foundationGripKind: 'foundation-width',
    },
    {
      entityId: entity.id,
      gripIndex: 3,
      type: 'vertex',
      position: lengthHandleWorld(params),
      movesEntity: false,
      foundationGripKind: 'foundation-length',
    },
  ];
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface FoundationGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: FoundationParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /** Current world cursor position (6-click rotation; anchor = currentPos − delta). */
  readonly currentPos?: Point2D;
  /** Rotation pivot for `foundation-rotation` (6-click AutoCAD ROTATE→Reference). */
  readonly pivot?: Point2D;
}

/**
 * Pure transform: foundation grip kind + drag input → new `FoundationParams`.
 * Geometry is NOT recomputed here — ο caller (`UpdateFoundationParamsCommand`)
 * καλεί `computeFoundationGeometry()` ώστε το math SSoT να μένει σε ένα σημείο.
 *
 * Zero delta / unknown kind / non-pad → επιστρέφει `originalParams` referentially
 * unchanged ώστε ο caller να short-circuit-άρει το commit (no-op).
 */
export function applyFoundationGripDrag(
  gripKind: FoundationGripKind,
  input: Readonly<FoundationGripDragInput>,
): FoundationParams {
  if (input.delta.x === 0 && input.delta.y === 0) return input.originalParams;
  if (gripKind === 'foundation-center') return moveCenter(input);
  // Rotation / width / length apply only to pad (line-based kinds = Slice 2).
  if (input.originalParams.kind !== 'pad') return input.originalParams;
  const pad = input.originalParams;
  if (gripKind === 'foundation-rotation') {
    return input.pivot ? rotateAroundPivot(pad, input) : rotateAroundPosition(pad, input);
  }
  if (gripKind === 'foundation-width') return resizeWidth(pad, input.delta);
  if (gripKind === 'foundation-length') return resizeLength(pad, input.delta);
  return input.originalParams;
}

// ─── Per-grip transforms ─────────────────────────────────────────────────────

/** Whole-entity translate (Alt+drag move). Works on every kind via its origin. */
function moveCenter(input: Readonly<FoundationGripDragInput>): FoundationParams {
  const { originalParams, delta } = input;
  if (originalParams.kind === 'pad') {
    return {
      ...originalParams,
      position: {
        x: originalParams.position.x + delta.x,
        y: originalParams.position.y + delta.y,
        z: originalParams.position.z ?? 0,
      },
    };
  }
  // strip / tie-beam: translate both axis endpoints (Slice 2 will emit grips).
  return {
    ...originalParams,
    start: {
      x: originalParams.start.x + delta.x,
      y: originalParams.start.y + delta.y,
      z: originalParams.start.z ?? 0,
    },
    end: {
      x: originalParams.end.x + delta.x,
      y: originalParams.end.y + delta.y,
      z: originalParams.end.z ?? 0,
    },
  };
}

function rotateAroundPosition(
  pad: PadFootingParams,
  input: Readonly<FoundationGripDragInput>,
): PadFootingParams {
  const { delta } = input;
  const oldHandle = rotationHandleWorld(pad);
  const newHandle = { x: oldHandle.x + delta.x, y: oldHandle.y + delta.y };
  const oldAngle = Math.atan2(oldHandle.y - pad.position.y, oldHandle.x - pad.position.x);
  const newAngle = Math.atan2(newHandle.y - pad.position.y, newHandle.x - pad.position.x);
  const deltaDeg = (newAngle - oldAngle) * RAD_TO_DEG;
  return { ...pad, rotation: pad.rotation + deltaDeg };
}

/**
 * 6-click AutoCAD ROTATE→Reference rotation about a user-picked pivot. Both
 * `position` and `rotation` change so the pad ORBITS the pivot. Swept angle is
 * anchor-relative (`currentPos − delta` → `currentPos`) so grabbing the handle
 * does not snap. Point rotation via canonical `rotatePoint` SSoT (ADR-188).
 */
function rotateAroundPivot(
  pad: PadFootingParams,
  input: Readonly<FoundationGripDragInput>,
): PadFootingParams {
  const { delta, currentPos, pivot } = input;
  if (!currentPos || !pivot) return pad;
  const anchor = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
  const sweptDeg = sweptAngleDegAboutPivot(pivot, anchor, currentPos);
  if (sweptDeg === null) return pad;
  const newPos = rotatePoint({ x: pad.position.x, y: pad.position.y }, pivot, sweptDeg);
  return {
    ...pad,
    position: { x: newPos.x, y: newPos.y, z: pad.position.z ?? 0 },
    rotation: pad.rotation + sweptDeg,
  };
}

function resizeWidth(pad: PadFootingParams, delta: Point2D): PadFootingParams {
  const s = mmScaleFor(pad);
  const { dx } = ANCHOR_OFFSETS[pad.anchor];
  const signX = farEdgeSignX(dx);
  const coefX = signX * 0.5 - dx;
  const { dxLocal } = projectDeltaToLocal(delta, pad.rotation);
  const newWidth = Math.max(MIN_FOUNDATION_DIMENSION_MM, pad.width + dxLocal / (coefX * s));
  return { ...pad, width: newWidth };
}

function resizeLength(pad: PadFootingParams, delta: Point2D): PadFootingParams {
  const s = mmScaleFor(pad);
  const { dy } = ANCHOR_OFFSETS[pad.anchor];
  const signY = farEdgeSignY(dy);
  const coefY = signY * 0.5 - dy;
  const { dyLocal } = projectDeltaToLocal(delta, pad.rotation);
  const newLength = Math.max(MIN_FOUNDATION_DIMENSION_MM, pad.length + dyLocal / (coefY * s));
  return { ...pad, length: newLength };
}
