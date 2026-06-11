/**
 * ADR-436 Slice 1b/1c — Foundation (pad) parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Exposes τα 7 grips
 * του pad (Slice 1c — wall/column parity, Giorgio 2026-06-10):
 *
 *   - `foundation-rotation`              → rotate γύρω από `position` (anchor invariant).
 *   - `foundation-width` / `-length`     → edge-midpoint resize (opposite edge fixed).
 *   - `foundation-corner-{ne,nw,sw,se}`  → 2-DOF corner resize (opposite corner fixed).
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
 *   - Corner/edge resize math = shared `bim/grips/rect-grip-engine` (RectFrame
 *     SSoT, κοινό με wall/column)· ο pad adapter (`padToRectFrame` /
 *     `rectFrameToPadParams`) μεταφράζει params ↔ frame + preserves anchor.
 *     Rotation = shared `grip-math` (sweptAngleDegAboutPivot) + canonical
 *     `rotatePoint` (ADR-188).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4.3
 * @see bim/grips/rect-grip-engine.ts — shared corner/edge SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { FoundationGripKind, GripInfo } from '../../hooks/useGripMovement';
import type {
  FoundationEntity,
  FoundationParams,
  PadFootingParams,
  StripFootingParams,
  TieBeamParams,
} from '../types/foundation-types';
import { ANCHOR_OFFSETS, MIN_FOUNDATION_DIMENSION_MM } from '../types/foundation-types';
import { rotatePoint } from '../../utils/rotation-math';
import {
  rotateVector,
  sweptAngleDegAboutPivot,
} from '../grips/grip-math';
import type { RectFrame, RectCorner } from '../grips/rect-frame';
import {
  applyRectCornerDrag,
  applyRectEdgeDrag,
  type RectResizeLimits,
} from '../grips/rect-grip-engine';
// ADR-436 (2026-06-11) — strip / tie-beam 7-grip wall parity via the shared
// axis-anchored box grip SSoT (same code as wall straight + beam).
import {
  getAxisBoxGrips,
  applyAxisBoxGripDrag,
  type AxisBoxParams,
  type AxisBoxGripRole,
} from '../grips/axis-box-grips';
import { mmScaleFor } from '../../utils/scene-units';

/** Line-based foundation params (strip / tie-beam) — share start/end/width. */
type LineFoundationParams = StripFootingParams | TieBeamParams;

function isLineFoundation(params: FoundationParams): params is LineFoundationParams {
  return params.kind === 'strip' || params.kind === 'tie-beam';
}

/** Map a shared axis-box grip ROLE → the line-foundation discriminator kind. */
const FOUNDATION_LINE_ROLE_TO_KIND: Readonly<Record<AxisBoxGripRole, FoundationGripKind>> = {
  'width-edge': 'foundation-line-width',
  'length-edge': 'foundation-line-length',
  'corner-start-pos': 'foundation-corner-start-pos',
  'corner-start-neg': 'foundation-corner-start-neg',
  'corner-end-pos': 'foundation-corner-end-pos',
  'corner-end-neg': 'foundation-corner-end-neg',
  rotation: 'foundation-rotation',
};

/** Inverse map: corner/edge line kinds → axis-box role (rotation handled inline). */
const FOUNDATION_LINE_KIND_TO_ROLE: Partial<Record<FoundationGripKind, AxisBoxGripRole>> = {
  'foundation-line-width': 'width-edge',
  'foundation-line-length': 'length-edge',
  'foundation-corner-start-pos': 'corner-start-pos',
  'foundation-corner-start-neg': 'corner-start-neg',
  'foundation-corner-end-pos': 'corner-end-pos',
  'foundation-corner-end-neg': 'corner-end-neg',
};

/** `StripFootingParams`/`TieBeamParams` → the minimal `AxisBoxParams` the SSoT reads. */
function lineAxisBoxParams(params: LineFoundationParams): AxisBoxParams {
  return {
    start: { x: params.start.x, y: params.start.y },
    end: { x: params.end.x, y: params.end.y },
    width: params.width,
    sceneUnits: params.sceneUnits,
  };
}

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

/** World position μιας γωνιακής λαβής (local signs `sx`/`sy` × half-extents). */
function cornerHandleWorld(params: PadFootingParams, sx: number, sy: number): Point2D {
  return localToWorld({ x: (sx * params.width) / 2, y: (sy * params.length) / 2 }, params);
}

// ─── RectFrame adapter (ADR-436 Slice 1c — shared rect-grip-engine SSoT) ──────

/** `foundation-corner-*` grip kind → local-axis signs for the engine. */
const FOUNDATION_CORNER_MAP: Partial<Record<FoundationGripKind, RectCorner>> = {
  'foundation-corner-ne': { sx: 1, sy: 1 },
  'foundation-corner-nw': { sx: -1, sy: 1 },
  'foundation-corner-sw': { sx: -1, sy: -1 },
  'foundation-corner-se': { sx: 1, sy: -1 },
};

/**
 * Pad params → centroid `RectFrame` (scene units). The centroid + half-extents
 * are exactly what `computeCentroidWorld` / `mmScaleFor` already derive, so the
 * engine math is unit- and anchor-agnostic.
 */
function padToRectFrame(pad: PadFootingParams): RectFrame {
  const s = mmScaleFor(pad);
  return {
    center: computeCentroidWorld(pad),
    rotationDeg: pad.rotation,
    halfWidth: (pad.width * s) / 2,
    halfLength: (pad.length * s) / 2,
  };
}

/**
 * `RectFrame` (post-resize) → pad params, preserving the anchor: `position` is
 * recomputed as the anchor reference point of the new rectangle
 * (`centroid + R(dx·width, dy·length)`), the inverse of `computeCentroidWorld`.
 */
function rectFrameToPadParams(frame: RectFrame, pad: PadFootingParams): PadFootingParams {
  const s = mmScaleFor(pad);
  const width = (frame.halfWidth * 2) / s;
  const length = (frame.halfLength * 2) / s;
  const { dx, dy } = ANCHOR_OFFSETS[pad.anchor];
  const shift = rotateVector({ x: dx * width * s, y: dy * length * s }, frame.rotationDeg);
  return {
    ...pad,
    width,
    length,
    position: { x: frame.center.x + shift.x, y: frame.center.y + shift.y, z: pad.position.z ?? 0 },
  };
}

/** Min half-extents (scene units) for the engine clamp = `MIN_FOUNDATION_DIMENSION_MM`. */
function padResizeLimits(pad: PadFootingParams): RectResizeLimits {
  const half = (MIN_FOUNDATION_DIMENSION_MM * mmScaleFor(pad)) / 2;
  return { minHalfWidth: half, minHalfLength: half };
}

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions για ένα `FoundationEntity`. Stable order.
 * Declutter: NO central move grip — Alt+drag μετακινεί. ΟΛΑ τα kinds εκπέμπουν 7.
 *
 *   pad (7 grips — ADR-436 Slice 1c, anchor+W×L frame):
 *     1 → rotation, 2 → width edge, 3 → length edge,
 *     4 → corner-ne, 5 → corner-nw, 6 → corner-sw, 7 → corner-se
 *   strip / tie-beam (7 grips — ADR-436 2026-06-11, shared axis-box SSoT,
 *     wall/beam parity): width edge, length edge, 4 axis corners, rotation.
 */
export function getFoundationGrips(entity: Readonly<FoundationEntity>): GripInfo[] {
  const { params } = entity;
  if (isLineFoundation(params)) return getLineFoundationGrips(entity, params);

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
      type: 'edge',
      position: widthHandleWorld(params),
      movesEntity: false,
      foundationGripKind: 'foundation-width',
    },
    {
      entityId: entity.id,
      gripIndex: 3,
      type: 'edge',
      position: lengthHandleWorld(params),
      movesEntity: false,
      foundationGripKind: 'foundation-length',
    },
    {
      entityId: entity.id,
      gripIndex: 4,
      type: 'vertex',
      position: cornerHandleWorld(params, +1, +1),
      movesEntity: false,
      foundationGripKind: 'foundation-corner-ne',
    },
    {
      entityId: entity.id,
      gripIndex: 5,
      type: 'vertex',
      position: cornerHandleWorld(params, -1, +1),
      movesEntity: false,
      foundationGripKind: 'foundation-corner-nw',
    },
    {
      entityId: entity.id,
      gripIndex: 6,
      type: 'vertex',
      position: cornerHandleWorld(params, -1, -1),
      movesEntity: false,
      foundationGripKind: 'foundation-corner-sw',
    },
    {
      entityId: entity.id,
      gripIndex: 7,
      type: 'vertex',
      position: cornerHandleWorld(params, +1, -1),
      movesEntity: false,
      foundationGripKind: 'foundation-corner-se',
    },
  ];
}

/**
 * Line-based foundation grips (strip / tie-beam) — ADR-436 (2026-06-11): 7-grip
 * wall parity via the shared axis-box SSoT (4 corners + width edge + length edge +
 * rotation), ίδιος κώδικας με τοίχο/δοκό. Declutter: no central MOVE / endpoint
 * grips — the corners cover length, Alt+drag translates. Empty on a degenerate axis.
 */
function getLineFoundationGrips(
  entity: Readonly<FoundationEntity>,
  params: LineFoundationParams,
): GripInfo[] {
  return getAxisBoxGrips(lineAxisBoxParams(params)).map((g, i) => ({
    entityId: entity.id,
    gripIndex: i,
    type: g.type,
    position: g.position,
    movesEntity: false,
    foundationGripKind: FOUNDATION_LINE_ROLE_TO_KIND[g.role],
  }));
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
  // Line-based grips (strip / tie-beam) — shared axis-box SSoT (wall/beam parity).
  if (isLineFoundation(input.originalParams)) {
    const line = input.originalParams;
    // Rotation → anchor-relative swept angle about midpoint / picked pivot.
    if (gripKind === 'foundation-rotation') {
      const patch = applyAxisBoxGripDrag('rotation', {
        originalParams: lineAxisBoxParams(line),
        delta: input.delta,
        minWidthMm: MIN_FOUNDATION_DIMENSION_MM,
        currentPos: input.currentPos,
        pivot: input.pivot,
      });
      return patch ? lineFromAxisPatch(line, patch) : line;
    }
    // Corner / width-edge / length-edge → shared opposite-element-fixed engine.
    const role = FOUNDATION_LINE_KIND_TO_ROLE[gripKind];
    if (role) {
      const patch = applyAxisBoxGripDrag(role, {
        originalParams: lineAxisBoxParams(line),
        delta: input.delta,
        minWidthMm: MIN_FOUNDATION_DIMENSION_MM,
      });
      return patch ? lineFromAxisPatch(line, patch) : line;
    }
    // Legacy endpoint translate grips (retained for back-compat; not emitted).
    if (gripKind === 'foundation-start') return moveLineStart(line, input.delta);
    if (gripKind === 'foundation-end') return moveLineEnd(line, input.delta);
    return input.originalParams;
  }
  // Rotation / width / length / corners apply only to pad.
  if (input.originalParams.kind !== 'pad') return input.originalParams;
  const pad = input.originalParams;
  if (gripKind === 'foundation-rotation') {
    return input.pivot ? rotateAroundPivot(pad, input) : rotateAroundPosition(pad, input);
  }
  // Corner + edge resize → shared rect-grip-engine SSoT (opposite element fixed).
  const corner = FOUNDATION_CORNER_MAP[gripKind];
  if (corner) {
    const frame = applyRectCornerDrag(padToRectFrame(pad), corner, input.delta, padResizeLimits(pad));
    return rectFrameToPadParams(frame, pad);
  }
  const { dx, dy } = ANCHOR_OFFSETS[pad.anchor];
  if (gripKind === 'foundation-width') {
    const frame = applyRectEdgeDrag(
      padToRectFrame(pad), { axis: 'x', sign: farEdgeSignX(dx) === 1 ? 1 : -1 }, input.delta, padResizeLimits(pad),
    );
    return rectFrameToPadParams(frame, pad);
  }
  if (gripKind === 'foundation-length') {
    const frame = applyRectEdgeDrag(
      padToRectFrame(pad), { axis: 'y', sign: farEdgeSignY(dy) === 1 ? 1 : -1 }, input.delta, padResizeLimits(pad),
    );
    return rectFrameToPadParams(frame, pad);
  }
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

// ─── Line transforms (strip / tie-beam — mirror beam-grips) ───────────────────

/** Translate axis start endpoint (no other params change). */
function moveLineStart(line: LineFoundationParams, delta: Point2D): LineFoundationParams {
  return {
    ...line,
    start: { x: line.start.x + delta.x, y: line.start.y + delta.y, z: line.start.z ?? 0 },
  };
}

/** Translate axis end endpoint. */
function moveLineEnd(line: LineFoundationParams, delta: Point2D): LineFoundationParams {
  return {
    ...line,
    end: { x: line.end.x + delta.x, y: line.end.y + delta.y, z: line.end.z ?? 0 },
  };
}

/**
 * Apply a shared axis-box `{start,end,width}` patch back onto line-foundation params,
 * preserving Z (corner / edge / rotation resize via the common SSoT, wall/beam parity).
 */
function lineFromAxisPatch(
  line: LineFoundationParams,
  patch: { start: Point2D; end: Point2D; width: number },
): LineFoundationParams {
  return {
    ...line,
    start: { x: patch.start.x, y: patch.start.y, z: line.start.z ?? 0 },
    end: { x: patch.end.x, y: patch.end.y, z: line.end.z ?? 0 },
    width: patch.width,
  };
}
