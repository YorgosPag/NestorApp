/**
 * ADR-406 — MEP fixture (light fixture) parametric 2D grips.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the column
 * grip pattern (ADR-397, `bim/columns/column-grips.ts`) but for the simpler
 * centre-anchored rectangular fixture (no anchor enum — `params.position` is the
 * box centre). Exposes, for the rectangular shape:
 *
 *   index 0 → `mep-fixture-move`     (centre, MOVE glyph) — translate position.
 *   index 1 → `mep-fixture-rotation` (handle beyond +Y edge, ROTATION glyph).
 *   index 2-5 → `mep-fixture-corner-{ne,nw,sw,se}` — two-direction resize. The
 *               diagonally-opposite corner stays pinned; width × length grow
 *               toward the dragged corner and `position` re-centres. ORTHO (F8)
 *               constrains to the dominant local axis (pure width OR length).
 *
 * Circular shape (non-live fallback): centre + a single `mep-fixture-diameter`
 * handle (symmetric 2× resize, centre fixed).
 *
 * SSoT:
 *   - Geometry math lives in `computeMepFixtureGeometry()` (called by
 *     `UpdateMepFixtureParamsCommand` at commit time) — this module returns ONLY
 *     new `MepFixtureParams`.
 *   - `params.position` is in scene units (the click point); `width`/`length` are
 *     mm, so all local offsets scale by `mmScaleFor(params)` (mirror column).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, MepFixtureGripKind } from '../../hooks/grip-types';
import type { MepFixtureEntity, MepFixtureParams } from '../types/mep-fixture-types';
import { MIN_FIXTURE_DIMENSION_MM } from '../types/mep-fixture-types';
import { mmScaleFor } from '../../utils/scene-units';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** mm — rotation handle stand-off beyond the +Y (length) edge (visual separation). */
const ROTATION_HANDLE_OFFSET_MM = 200;

/** Diagonal corners as (signX, signY) in the fixture's local frame. */
interface CornerSign {
  readonly sx: 1 | -1;
  readonly sy: 1 | -1;
}
const CORNER_SIGNS: Readonly<Record<string, CornerSign>> = {
  'mep-fixture-corner-ne': { sx: 1, sy: 1 },
  'mep-fixture-corner-nw': { sx: -1, sy: 1 },
  'mep-fixture-corner-sw': { sx: -1, sy: -1 },
  'mep-fixture-corner-se': { sx: 1, sy: -1 },
};
const CORNER_ORDER: readonly MepFixtureGripKind[] = [
  'mep-fixture-corner-ne',
  'mep-fixture-corner-nw',
  'mep-fixture-corner-sw',
  'mep-fixture-corner-se',
];

// ─── Local-frame helpers ─────────────────────────────────────────────────────

/** Rotate vector `v` by `rotDeg` (CCW) about the origin. */
function rotate(v: Point2D, rotDeg: number): Point2D {
  const r = rotDeg * DEG_TO_RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** Project a world delta onto the fixture's local rotated axes (+X width, +Y length). */
function projectToLocal(delta: Point2D, rotDeg: number): Point2D {
  const r = rotDeg * DEG_TO_RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: delta.x * c + delta.y * s, y: -delta.x * s + delta.y * c };
}

function centre(params: MepFixtureParams): Point2D {
  return { x: params.position.x, y: params.position.y };
}

/** World position of a corner (signX, signY) of the rotated footprint. */
function cornerWorld(params: MepFixtureParams, sx: number, sy: number): Point2D {
  const s = mmScaleFor(params);
  const local = { x: (sx * params.width * s) / 2, y: (sy * params.length * s) / 2 };
  const c = centre(params);
  const rot = rotate(local, params.rotation);
  return { x: c.x + rot.x, y: c.y + rot.y };
}

/** World position of the rotation handle (beyond the +Y / length edge midpoint). */
function rotationHandleWorld(params: MepFixtureParams): Point2D {
  const s = mmScaleFor(params);
  const local = { x: 0, y: (params.length / 2 + ROTATION_HANDLE_OFFSET_MM) * s };
  const c = centre(params);
  const rot = rotate(local, params.rotation);
  return { x: c.x + rot.x, y: c.y + rot.y };
}

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for a `MepFixtureEntity`. Stable order:
 *   rectangular (6 grips): 0 → move, 1 → rotation, 2-5 → corners (ne, nw, sw, se)
 *   circular   (2 grips):  0 → move, 1 → diameter
 */
export function getMepFixtureGrips(entity: Readonly<MepFixtureEntity>): GripInfo[] {
  const { params } = entity;
  const grips: GripInfo[] = [];
  const c = centre(params);

  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'center',
    position: c,
    movesEntity: true,
    mepFixtureGripKind: 'mep-fixture-move',
  });

  if (params.shape === 'circular') {
    const s = mmScaleFor(params);
    grips.push({
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      // Diameter handle on the world +X radius from centre (rotation is ignored
      // for circular fixtures, mirror of the column circular width handle).
      position: { x: c.x + (params.width / 2) * s, y: c.y },
      movesEntity: false,
      mepFixtureGripKind: 'mep-fixture-diameter',
    });
    return grips;
  }

  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: rotationHandleWorld(params),
    movesEntity: false,
    mepFixtureGripKind: 'mep-fixture-rotation',
  });

  CORNER_ORDER.forEach((kind, i) => {
    const { sx, sy } = CORNER_SIGNS[kind];
    grips.push({
      entityId: entity.id,
      gripIndex: 2 + i,
      type: 'corner',
      position: cornerWorld(params, sx, sy),
      movesEntity: false,
      mepFixtureGripKind: kind,
    });
  });

  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface MepFixtureGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: MepFixtureParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: Point2D;
  /**
   * ORTHO (F8) active → corner resize is constrained to the dominant local axis
   * (pure width OR pure length). Ignored for move/rotation/diameter.
   */
  readonly ortho?: boolean;
  /**
   * ADR-406 / ADR-397 — rotation centre for the `mep-fixture-rotation` 6-click
   * hot-grip (AutoCAD ROTATE→Reference). When set together with `currentPos`, the
   * fixture orbits this picked centre (both `position` AND `rotation` change),
   * mirroring `applyWallGripDrag('wall-rotation', { pivot })`. Absent → the legacy
   * rotate-about-own-centre path runs (handle-relative `delta`).
   */
  readonly pivot?: Point2D;
  /**
   * World cursor position (= grip anchor + `delta`). Required only for the
   * pivot-rotate path so the swept angle can be measured around `pivot`.
   */
  readonly currentPos?: Point2D;
}

/**
 * Pure transform: MEP fixture grip kind + drag input → new `MepFixtureParams`.
 * Geometry is NOT recomputed here — the caller (`UpdateMepFixtureParamsCommand`)
 * recomputes geometry + validation so the math SSoT stays in one place.
 *
 * Zero delta / unknown kind → returns `originalParams` referentially unchanged so
 * the caller can short-circuit the commit (no-op).
 */
export function applyMepFixtureGripDrag(
  kind: MepFixtureGripKind,
  input: Readonly<MepFixtureGripDragInput>,
): MepFixtureParams {
  if (input.delta.x === 0 && input.delta.y === 0) return input.originalParams;
  if (kind === 'mep-fixture-move') return moveCentre(input);
  if (kind === 'mep-fixture-rotation') return rotateAboutCentre(input);
  if (kind === 'mep-fixture-diameter') return resizeDiameter(input);
  if (CORNER_SIGNS[kind]) return resizeCorner(kind, input);
  return input.originalParams;
}

function moveCentre(input: Readonly<MepFixtureGripDragInput>): MepFixtureParams {
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

function rotateAboutCentre(input: Readonly<MepFixtureGripDragInput>): MepFixtureParams {
  const { originalParams, delta, pivot, currentPos } = input;
  if (originalParams.shape === 'circular') return originalParams;

  // ── Pivot path (ADR-397 6-click ROTATE→Reference) ──────────────────────────
  // The hot-grip flow publishes {pivot, anchor} in BimRotateHotGripStore and
  // passes the swept `delta = alignDir − refDir`, so `currentPos = anchor + delta`
  // = pivot + alignDir and `anchor = currentPos − delta` = pivot + refDir. The
  // fixture orbits `pivot`: BOTH its centre `position` and its `rotation` sweep by
  // angle(currentPos−pivot) − angle(anchor−pivot). Mirrors the wall/column rotate.
  if (pivot && currentPos) {
    const anchor = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
    const a0 = Math.atan2(anchor.y - pivot.y, anchor.x - pivot.x);
    const a1 = Math.atan2(currentPos.y - pivot.y, currentPos.x - pivot.x);
    const sweepDeg = (a1 - a0) * RAD_TO_DEG;
    const rel = { x: originalParams.position.x - pivot.x, y: originalParams.position.y - pivot.y };
    const rotated = rotate(rel, sweepDeg);
    return {
      ...originalParams,
      rotation: originalParams.rotation + sweepDeg,
      position: { x: pivot.x + rotated.x, y: pivot.y + rotated.y, z: originalParams.position.z ?? 0 },
    };
  }

  // ── Legacy own-centre path (handle-relative drag; e.g. non-hot-grip fallback) ──
  const c = centre(originalParams);
  const oldHandle = rotationHandleWorld(originalParams);
  const oldVec = { x: oldHandle.x - c.x, y: oldHandle.y - c.y };
  const newVec = { x: oldHandle.x + delta.x - c.x, y: oldHandle.y + delta.y - c.y };
  const deltaDeg = (Math.atan2(newVec.y, newVec.x) - Math.atan2(oldVec.y, oldVec.x)) * RAD_TO_DEG;
  return { ...originalParams, rotation: originalParams.rotation + deltaDeg };
}

function resizeDiameter(input: Readonly<MepFixtureGripDragInput>): MepFixtureParams {
  const { originalParams, delta } = input;
  // Handle sits on world +X; symmetric 2× resize about the fixed centre (mirror
  // column circular width). Convert scene-unit delta back to mm (÷ s).
  const s = mmScaleFor(originalParams);
  const newWidth = Math.max(MIN_FIXTURE_DIMENSION_MM, originalParams.width + (2 * delta.x) / s);
  return { ...originalParams, width: newWidth };
}

/**
 * Opposite-corner-anchored two-direction resize. The corner diagonally opposite
 * the dragged one is pinned in world space; `width`/`length` grow toward the
 * dragged corner and `position` re-centres to the new box centre. ORTHO snaps
 * the motion to the dominant local axis (pure width OR length).
 */
function resizeCorner(
  kind: MepFixtureGripKind,
  input: Readonly<MepFixtureGripDragInput>,
): MepFixtureParams {
  const { originalParams, delta, ortho } = input;
  if (originalParams.shape === 'circular') return originalParams;
  const { sx, sy } = CORNER_SIGNS[kind];
  const s = mmScaleFor(originalParams);
  const c = centre(originalParams);
  const rot = originalParams.rotation;

  // Anchor = opposite corner, fixed in world.
  const anchorLocal = { x: (-sx * originalParams.width * s) / 2, y: (-sy * originalParams.length * s) / 2 };
  const anchorRot = rotate(anchorLocal, rot);
  const anchorWorld = { x: c.x + anchorRot.x, y: c.y + anchorRot.y };

  // anchor → dragged corner vector in the local frame (scene units).
  const baseLocal = { x: sx * originalParams.width * s, y: sy * originalParams.length * s };

  // Drag projected to local axes; ORTHO zeroes the smaller component.
  let dLocal = projectToLocal(delta, rot);
  if (ortho) {
    dLocal = Math.abs(dLocal.x) >= Math.abs(dLocal.y)
      ? { x: dLocal.x, y: 0 }
      : { x: 0, y: dLocal.y };
  }

  const newWidth = Math.max(MIN_FIXTURE_DIMENSION_MM, Math.abs(baseLocal.x + dLocal.x) / s);
  const newLength = Math.max(MIN_FIXTURE_DIMENSION_MM, Math.abs(baseLocal.y + dLocal.y) / s);

  // Re-form the anchor→dragged vector with the original signs + clamped span, so
  // the dragged corner stays diagonally opposite the anchor. New centre = midpoint.
  const clampedLocal = { x: sx * newWidth * s, y: sy * newLength * s };
  const halfRot = rotate({ x: clampedLocal.x / 2, y: clampedLocal.y / 2 }, rot);
  const newCentre = { x: anchorWorld.x + halfRot.x, y: anchorWorld.y + halfRot.y };

  return {
    ...originalParams,
    width: newWidth,
    length: newLength,
    position: { x: newCentre.x, y: newCentre.y, z: originalParams.position.z ?? 0 },
  };
}
