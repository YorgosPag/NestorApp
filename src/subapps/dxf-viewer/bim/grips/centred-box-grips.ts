/**
 * ADR-397 / ADR-408 — Centre-anchored rotatable-box grip SSoT.
 *
 * The CENTRE-anchored consumer of the rotated-rectangle grip SSoT, shared by
 * EVERY point-based BIM element whose footprint is a **centre-anchored, rotatable
 * rectangle**: MEP fixture, electrical panel, water-heater, manifold, boiler,
 * radiator, furniture, floorplan-symbol (8 entities). Each consumes it through a
 * thin role→kind adapter (N.0.2 Boy-Scout de-duplication).
 *
 * SSoT layering (2026-06-10 unification — Giorgio «παντού ίδιος κώδικας»): the
 * corner GEOMETRY + opposite-corner-fixed RESIZE math live in the entity-agnostic
 * `bim/grips/rect-grip-engine` + `rect-frame` core (the SAME code the anchored
 * pad / column / wall grips use). This module adds the centre-anchored mapping
 * (`position` IS the centre), the grip ROLES, the MOVE + ROTATION (legacy +
 * 6-click pivot) transforms, and ORTHO — none of which belong in the pure core.
 *
 * What stays per-entity (NOT here):
 *   - the entity-specific grip-kind STRINGS (`'mep-fixture-corner-ne'` vs
 *     `'electrical-panel-corner-ne'`) — they must match the discriminator unions
 *     + glyph / hot-grip / commit registries, so each caller maps role↔kind.
 *   - shape variants outside a centred rectangle (e.g. the fixture's `circular`
 *     diameter handle) — the caller keeps those and only delegates its
 *     rectangular path here.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. ALL rotation math is
 * the shared grip-math SSoT (`rotateVector` / `projectToLocalFrame` /
 * `sweptAngleDegAboutPivot` + canonical `rotatePoint`, ADR-188) — NO re-implemented
 * cos/sin. `params.position` is in scene units (the click point); `width`/`length`
 * are mm, so local offsets scale by `mmScaleFor(params)`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md §D3
 * @see bim/grips/grip-math.ts — rotation primitives
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { mmScaleFor } from '../../utils/scene-units';
import { rotateVector, sweptAngleDegAboutPivot } from './grip-math';
import { rotatePoint } from '../../utils/rotation-math';
// ADR-363 SSoT unification (2026-06-10) — corner geometry + opposite-corner-fixed
// resize are the shared `rect-grip-engine` core (same code pad/column/wall use).
// This module is now the CENTRE-anchored consumer (+ roles / move / rotation / ORTHO).
import type { RectFrame } from './rect-frame';
import { rectCornerWorld } from './rect-frame';
import { applyRectCornerDrag } from './rect-grip-engine';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * mm — rotation handle stand-off. Single source = `rotation-handle-policy`;
 * re-exported here for existing importers (e.g. `opening-grips`). This family
 * emits ONLY corners + rotation (NO perpendicular edge dimension handle), so there
 * is no face to avoid — the handle stays on the +Y (length) side. The shared policy
 * still owns the offset magnitude so it changes in one place.
 */
export { ROTATION_HANDLE_OFFSET_MM } from './rotation-handle-policy';
import { ROTATION_HANDLE_OFFSET_MM } from './rotation-handle-policy';

/**
 * Entity-agnostic grip role of a centred rotatable box. Stable order:
 * 0 → move, 1 → rotation, 2-5 → corners (ne, nw, sw, se). Each consuming entity
 * maps these to/from its own grip-kind strings.
 */
export type CentredBoxGripRole =
  | 'move'
  | 'rotation'
  | 'corner-ne'
  | 'corner-nw'
  | 'corner-sw'
  | 'corner-se';

/** Stable corner emission order (matches grip indices 2-5). */
export const CENTRED_BOX_CORNER_ROLES: readonly CentredBoxGripRole[] = [
  'corner-ne',
  'corner-nw',
  'corner-sw',
  'corner-se',
];

/** Diagonal corners as (signX, signY) in the box's local frame. */
interface CornerSign {
  readonly sx: 1 | -1;
  readonly sy: 1 | -1;
}
const CORNER_SIGNS: Readonly<Record<string, CornerSign>> = {
  'corner-ne': { sx: 1, sy: 1 },
  'corner-nw': { sx: -1, sy: 1 },
  'corner-sw': { sx: -1, sy: -1 },
  'corner-se': { sx: 1, sy: -1 },
};

/**
 * The minimal box parameters this SSoT reads. Both `MepFixtureParams` and
 * `ElectricalPanelParams` are structurally assignable (they carry exactly these
 * fields), so callers pass their params object directly — no mapping needed.
 */
export interface CentredBoxParams {
  readonly position: { readonly x: number; readonly y: number; readonly z?: number };
  /** Degrees CCW about `position` (plan). */
  readonly rotation: number;
  /** mm. Footprint width (local X). */
  readonly width: number;
  /** mm. Footprint length (local Y). */
  readonly length: number;
  /** DXF canvas coordinate unit (mm scalars → canvas units). Defaults to `'mm'`. */
  readonly sceneUnits?: SceneUnits;
}

/** One emitted grip (role-tagged). The caller wraps it into its own `GripInfo`. */
export interface CentredBoxGrip {
  readonly gripIndex: number;
  readonly role: CentredBoxGripRole;
  readonly type: 'center' | 'corner' | 'vertex';
  readonly position: Point2D;
  readonly movesEntity: boolean;
}

/**
 * The mutated box fields produced by a grip drag. The caller spreads this over
 * its full params (`{ ...originalParams, ...patch }`). `null` patch → no-op (the
 * caller returns `originalParams` referentially unchanged so the commit can
 * short-circuit).
 */
export interface CentredBoxPatch {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly rotation: number;
  readonly width: number;
  readonly length: number;
}

export interface CentredBoxGripDragInput {
  readonly originalParams: CentredBoxParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: Point2D;
  /** mm — minimum footprint dimension; corner resize clamps to this (entity-specific). */
  readonly minDimensionMm: number;
  /**
   * ORTHO (F8) active → corner resize is constrained to the dominant local axis
   * (pure width OR pure length). Ignored for move/rotation.
   */
  readonly ortho?: boolean;
  /**
   * Rotation centre for the `rotation` 6-click hot-grip (AutoCAD ROTATE→Reference).
   * When set together with `currentPos`, the box orbits this picked centre (both
   * `position` AND `rotation` change). Absent → legacy rotate-about-own-centre.
   */
  readonly pivot?: Point2D;
  /** World cursor position (= grip anchor + `delta`). Required only for the pivot-rotate path. */
  readonly currentPos?: Point2D;
}

// ─── Local-frame helpers ─────────────────────────────────────────────────────

function centre(params: CentredBoxParams): Point2D {
  return { x: params.position.x, y: params.position.y };
}

/** Centre-anchored box params → shared `RectFrame` (centre = `position`, scene units). */
function centredBoxToRectFrame(params: CentredBoxParams): RectFrame {
  const s = mmScaleFor(params);
  return {
    center: centre(params),
    rotationDeg: params.rotation,
    halfWidth: (params.width * s) / 2,
    halfLength: (params.length * s) / 2,
  };
}

/** World position of a corner (signX, signY) — shared `rect-frame` SSoT. */
function cornerWorld(params: CentredBoxParams, sx: 1 | -1, sy: 1 | -1): Point2D {
  return rectCornerWorld(centredBoxToRectFrame(params), { sx, sy });
}

/** World position of the rotation handle (beyond the +Y / length edge midpoint). */
export function centredBoxRotationHandleWorld(params: CentredBoxParams): Point2D {
  const s = mmScaleFor(params);
  const local = { x: 0, y: (params.length / 2 + ROTATION_HANDLE_OFFSET_MM) * s };
  const c = centre(params);
  const rot = rotateVector(local, params.rotation);
  return { x: c.x + rot.x, y: c.y + rot.y };
}

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute the role-tagged grips of a centred rotatable box. Stable order:
 * 1 → rotation, 2-5 → corners (ne, nw, sw, se).
 *
 * ADR-363 Φ1G.5 Slice 2 (2026-06-09) — the gripIndex-0 MOVE grip (4-way arrow at
 * the centre) is NO LONGER emitted: it is redundant now that Alt+drag from any
 * characteristic point translates the whole entity (declutter, Giorgio request).
 * gripIndex 0 is left intentionally unused — NO reindex, so the rotation handle
 * stays at 1 and the corners at 2-5 (downstream keys on role/kind, not index).
 * The `'move'` role + `moveCentre` transform in `applyCentredBoxGripDrag` are
 * RETAINED (drag-math SSoT / dead hot-grip move path) but never produced here.
 */
export function getCentredBoxGrips(params: CentredBoxParams): CentredBoxGrip[] {
  const grips: CentredBoxGrip[] = [];

  grips.push({
    gripIndex: 1,
    role: 'rotation',
    type: 'vertex',
    position: centredBoxRotationHandleWorld(params),
    movesEntity: false,
  });
  CENTRED_BOX_CORNER_ROLES.forEach((role, i) => {
    const { sx, sy } = CORNER_SIGNS[role];
    grips.push({
      gripIndex: 2 + i,
      role,
      type: 'corner',
      position: cornerWorld(params, sx, sy),
      movesEntity: false,
    });
  });

  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

/**
 * Pure transform: box grip role + drag input → mutated box fields (`CentredBoxPatch`),
 * or `null` for a no-op (zero delta / degenerate pivot / unknown role). The caller
 * spreads the patch over its full params and recomputes geometry at commit time.
 */
export function applyCentredBoxGripDrag(
  role: CentredBoxGripRole,
  input: Readonly<CentredBoxGripDragInput>,
): CentredBoxPatch | null {
  if (input.delta.x === 0 && input.delta.y === 0) return null;
  if (role === 'move') return moveCentre(input);
  if (role === 'rotation') return rotateAboutCentre(input);
  if (CORNER_SIGNS[role]) return resizeCorner(role, input);
  return null;
}

function basePatch(params: CentredBoxParams): CentredBoxPatch {
  return {
    position: { x: params.position.x, y: params.position.y, z: params.position.z ?? 0 },
    rotation: params.rotation,
    width: params.width,
    length: params.length,
  };
}

function moveCentre(input: Readonly<CentredBoxGripDragInput>): CentredBoxPatch {
  const { originalParams, delta } = input;
  return {
    ...basePatch(originalParams),
    position: {
      x: originalParams.position.x + delta.x,
      y: originalParams.position.y + delta.y,
      z: originalParams.position.z ?? 0,
    },
  };
}

function rotateAboutCentre(input: Readonly<CentredBoxGripDragInput>): CentredBoxPatch | null {
  const { originalParams, delta, pivot, currentPos } = input;

  // ── Pivot path (ADR-397 6-click ROTATE→Reference) ──────────────────────────
  // The hot-grip flow publishes {pivot, anchor} and passes the swept
  // `delta = alignDir − refDir`, so `currentPos = anchor + delta = pivot + alignDir`
  // and `anchor = currentPos − delta = pivot + refDir`. The box orbits `pivot`:
  // BOTH its centre `position` and its `rotation` sweep by
  // angle(currentPos−pivot) − angle(anchor−pivot).
  if (pivot && currentPos) {
    const anchor = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
    const sweepDeg = sweptAngleDegAboutPivot(pivot, anchor, currentPos);
    if (sweepDeg === null) return null;
    const newPos = rotatePoint(
      { x: originalParams.position.x, y: originalParams.position.y },
      pivot,
      sweepDeg,
    );
    return {
      ...basePatch(originalParams),
      rotation: originalParams.rotation + sweepDeg,
      position: { x: newPos.x, y: newPos.y, z: originalParams.position.z ?? 0 },
    };
  }

  // ── Legacy own-centre path (handle-relative drag; non-hot-grip fallback) ──
  const c = centre(originalParams);
  const oldHandle = centredBoxRotationHandleWorld(originalParams);
  const oldVec = { x: oldHandle.x - c.x, y: oldHandle.y - c.y };
  const newVec = { x: oldHandle.x + delta.x - c.x, y: oldHandle.y + delta.y - c.y };
  const deltaDeg = (Math.atan2(newVec.y, newVec.x) - Math.atan2(oldVec.y, oldVec.x)) * RAD_TO_DEG;
  return { ...basePatch(originalParams), rotation: originalParams.rotation + deltaDeg };
}

/**
 * Opposite-corner-anchored two-direction resize. Delegates the geometry to the
 * shared `rect-grip-engine` SSoT (same opposite-corner-fixed math pad/column/wall
 * use): the corner diagonally opposite the dragged one is pinned, `width`/`length`
 * grow toward the dragged corner and `position` re-centres. ORTHO constrains the
 * drag to the dominant local axis. The centre-anchored frame ⇔ params mapping is
 * trivial here (`position` IS the centre — no 9-position anchor layer).
 */
function resizeCorner(
  role: CentredBoxGripRole,
  input: Readonly<CentredBoxGripDragInput>,
): CentredBoxPatch {
  const { originalParams, delta, ortho, minDimensionMm } = input;
  const { sx, sy } = CORNER_SIGNS[role];
  const s = mmScaleFor(originalParams);
  const minHalf = (minDimensionMm * s) / 2;
  const frame = applyRectCornerDrag(
    centredBoxToRectFrame(originalParams),
    { sx, sy },
    delta,
    { minHalfWidth: minHalf, minHalfLength: minHalf },
    ortho,
  );
  return {
    ...basePatch(originalParams),
    width: (frame.halfWidth * 2) / s,
    length: (frame.halfLength * 2) / s,
    position: { x: frame.center.x, y: frame.center.y, z: originalParams.position.z ?? 0 },
  };
}
