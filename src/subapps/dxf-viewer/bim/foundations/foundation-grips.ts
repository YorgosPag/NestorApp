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
  sweptAngleDegAboutPivot,
  farEdgeSign,
} from '../grips/grip-math';
import {
  applyRectCornerDrag,
  applyRectEdgeDrag,
} from '../grips/rect-grip-engine';
// ADR-436 (2026-06-11) — strip / tie-beam 7-grip wall parity via the shared
// axis-anchored box grip SSoT (same code as wall straight + beam).
import {
  getAxisBoxGrips,
  applyAxisBoxGripDrag,
  invertAxisBoxRoleMap,
  type AxisBoxParams,
  type AxisBoxGripRole,
} from '../grips/axis-box-grips';
import { stripJustifiedAxis, unjustifyStripAxis } from '../geometry/foundation-geometry';
// ADR-436 Slice 1c — pad frame/handle geometry adapter SSoT (500-line SRP split).
import {
  widthHandleWorld,
  lengthHandleWorld,
  rotationHandleWorld,
  cornerHandleWorld,
  FOUNDATION_CORNER_MAP,
  padToRectFrame,
  rectFrameToPadParams,
  padResizeLimits,
} from './foundation-grips-pad-frame';

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

/** Inverse (derived ONCE — no hand-written drift). Rotation handled inline (line branch). */
const FOUNDATION_LINE_KIND_TO_ROLE = invertAxisBoxRoleMap(FOUNDATION_LINE_ROLE_TO_KIND);

/**
 * `StripFootingParams`/`TieBeamParams` → the minimal `AxisBoxParams` the SSoT reads.
 *
 * ADR-441 Slice 5a fix: the axis fed to the grip engine is the JUSTIFIED centerline
 * (`stripJustifiedAxis`), i.e. the axis the body is actually DRAWN around, not the raw
 * location-line axis. Otherwise the handles sit half a width off the rendered band for
 * any `left`/`right`-justified strip (every perimeter strip of a managed grid). `center`
 * → identical to the raw axis. The drag write-back undoes the shift (`lineFromAxisPatch`).
 */
function lineAxisBoxParams(params: LineFoundationParams): AxisBoxParams {
  const axis = stripJustifiedAxis(params);
  return {
    start: axis.start,
    end: axis.end,
    width: params.width,
    sceneUnits: params.sceneUnits,
  };
}

const RAD_TO_DEG = 180 / Math.PI;

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
      padToRectFrame(pad), { axis: 'x', sign: farEdgeSign(dx) === 1 ? 1 : -1 }, input.delta, padResizeLimits(pad),
    );
    return rectFrameToPadParams(frame, pad);
  }
  if (gripKind === 'foundation-length') {
    const frame = applyRectEdgeDrag(
      padToRectFrame(pad), { axis: 'y', sign: farEdgeSign(dy) === 1 ? 1 : -1 }, input.delta, padResizeLimits(pad),
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
 *
 * ADR-441 Slice 5a fix: the patch is expressed on the JUSTIFIED (body) axis — the same
 * space `lineAxisBoxParams` fed the engine. We un-justify it back to the RAW location-line
 * axis (using the patch's NEW width) so the entity keeps storing `start`/`end` as the
 * location line + `justification` separately; the renderer re-justifies on display, so the
 * round-trip is exact. `center` → identity (no shift).
 */
function lineFromAxisPatch(
  line: LineFoundationParams,
  patch: { start: Point2D; end: Point2D; width: number },
): LineFoundationParams {
  const raw = unjustifyStripAxis(patch.start, patch.end, patch.width, line.justification, line.sceneUnits);
  return {
    ...line,
    start: { x: raw.start.x, y: raw.start.y, z: line.start.z ?? 0 },
    end: { x: raw.end.x, y: raw.end.y, z: line.end.z ?? 0 },
    width: patch.width,
  };
}
