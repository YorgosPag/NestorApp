/**
 * ADR-397 / ADR-408 — Centre-anchored rotatable-box grip SSoT.
 *
 * The single source of truth for the grip geometry + drag math shared by EVERY
 * point-based BIM element whose footprint is a **centre-anchored, rotatable
 * rectangle**: a MEP fixture (`bim/mep-fixtures/mep-fixture-grips.ts`, rectangular
 * shape) and an electrical panel (`bim/electrical-panels/electrical-panel-grips.ts`).
 * Before this module the two owned ~200 lines of byte-identical grip math
 * (`cornerWorld` / `rotationHandleWorld` / `moveCentre` / `rotateAboutCentre` /
 * `resizeCorner`); this collapses them into ONE implementation that each entity
 * consumes through a thin role→kind adapter (N.0.2 Boy-Scout de-duplication).
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
import { rotateVector, projectToLocalFrame, sweptAngleDegAboutPivot } from './grip-math';
import { rotatePoint } from '../../utils/rotation-math';

const RAD_TO_DEG = 180 / Math.PI;

/** mm — rotation handle stand-off beyond the +Y (length) edge (visual separation). */
export const ROTATION_HANDLE_OFFSET_MM = 200;

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

/** World position of a corner (signX, signY) of the rotated footprint. */
function cornerWorld(params: CentredBoxParams, sx: number, sy: number): Point2D {
  const s = mmScaleFor(params);
  const local = { x: (sx * params.width * s) / 2, y: (sy * params.length * s) / 2 };
  const c = centre(params);
  const rot = rotateVector(local, params.rotation);
  return { x: c.x + rot.x, y: c.y + rot.y };
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
 * Compute the 6 role-tagged grips of a centred rotatable box. Stable order:
 * 0 → move, 1 → rotation, 2-5 → corners (ne, nw, sw, se).
 */
export function getCentredBoxGrips(params: CentredBoxParams): CentredBoxGrip[] {
  const grips: CentredBoxGrip[] = [];
  const c = centre(params);

  grips.push({ gripIndex: 0, role: 'move', type: 'center', position: c, movesEntity: true });
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
 * Opposite-corner-anchored two-direction resize. The corner diagonally opposite
 * the dragged one is pinned in world space; `width`/`length` grow toward the
 * dragged corner and `position` re-centres to the new box centre. ORTHO snaps
 * the motion to the dominant local axis (pure width OR length).
 */
function resizeCorner(
  role: CentredBoxGripRole,
  input: Readonly<CentredBoxGripDragInput>,
): CentredBoxPatch {
  const { originalParams, delta, ortho, minDimensionMm } = input;
  const { sx, sy } = CORNER_SIGNS[role];
  const s = mmScaleFor(originalParams);
  const c = centre(originalParams);
  const rot = originalParams.rotation;

  // Anchor = opposite corner, fixed in world.
  const anchorLocal = { x: (-sx * originalParams.width * s) / 2, y: (-sy * originalParams.length * s) / 2 };
  const anchorRot = rotateVector(anchorLocal, rot);
  const anchorWorld = { x: c.x + anchorRot.x, y: c.y + anchorRot.y };

  // anchor → dragged corner vector in the local frame (scene units).
  const baseLocal = { x: sx * originalParams.width * s, y: sy * originalParams.length * s };

  // Drag projected to local axes; ORTHO zeroes the smaller component.
  let dLocal = projectToLocalFrame(delta, rot);
  if (ortho) {
    dLocal = Math.abs(dLocal.x) >= Math.abs(dLocal.y)
      ? { x: dLocal.x, y: 0 }
      : { x: 0, y: dLocal.y };
  }

  const newWidth = Math.max(minDimensionMm, Math.abs(baseLocal.x + dLocal.x) / s);
  const newLength = Math.max(minDimensionMm, Math.abs(baseLocal.y + dLocal.y) / s);

  // Re-form the anchor→dragged vector with the original signs + clamped span, so
  // the dragged corner stays diagonally opposite the anchor. New centre = midpoint.
  const clampedLocal = { x: sx * newWidth * s, y: sy * newLength * s };
  const halfRot = rotateVector({ x: clampedLocal.x / 2, y: clampedLocal.y / 2 }, rot);
  const newCentre = { x: anchorWorld.x + halfRot.x, y: anchorWorld.y + halfRot.y };

  return {
    ...basePatch(originalParams),
    width: newWidth,
    length: newLength,
    position: { x: newCentre.x, y: newCentre.y, z: originalParams.position.z ?? 0 },
  };
}
