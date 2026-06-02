/**
 * ADR-408 Φ3 — Electrical panel parametric 2D grips (wall-parity).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. 1:1 mirror of the
 * MEP fixture grip pattern (`bim/mep-fixtures/mep-fixture-grips.ts`, ADR-406)
 * minus the circular shape — a panel is **always rectangular** (no diameter
 * handle, no circular fallback). Exposes:
 *
 *   index 0 → `electrical-panel-move`     (centre, MOVE glyph) — translate position.
 *   index 1 → `electrical-panel-rotation` (handle beyond +Y edge, ROTATION glyph).
 *   index 2-5 → `electrical-panel-corner-{ne,nw,sw,se}` — two-direction resize. The
 *               diagonally-opposite corner stays pinned; width × length grow
 *               toward the dragged corner and `position` re-centres. ORTHO (F8)
 *               constrains to the dominant local axis (pure width OR length).
 *
 * SSoT:
 *   - Geometry math lives in `computeElectricalPanelGeometry()` (called by
 *     `UpdateElectricalPanelParamsCommand` at commit time) — this module returns
 *     ONLY new `ElectricalPanelParams`.
 *   - `params.position` is in scene units (the click point); `width`/`length` are
 *     mm, so all local offsets scale by `mmScaleFor(params)` (mirror fixture).
 *   - ALL rotation math is the shared grip-math SSoT (`rotateVector` /
 *     `projectToLocalFrame` / `sweptAngleDegAboutPivot` + canonical `rotatePoint`,
 *     ADR-188) — NO re-implemented cos/sin.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see bim/mep-fixtures/mep-fixture-grips.ts — rectangular blueprint
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, ElectricalPanelGripKind } from '../../hooks/grip-types';
import type { ElectricalPanelEntity, ElectricalPanelParams } from '../types/electrical-panel-types';
import { MIN_PANEL_DIMENSION_MM } from '../types/electrical-panel-types';
import { mmScaleFor } from '../../utils/scene-units';
// ADR-397 §D3 — ALL rotation math is shared SSoT: local-frame `rotateVector` /
// `projectToLocalFrame` + anchor-relative `sweptAngleDegAboutPivot` from grip-math
// (which delegate to the canonical `rotatePoint`, ADR-188). No re-implemented cos/sin.
import { rotateVector, projectToLocalFrame, sweptAngleDegAboutPivot } from '../grips/grip-math';
import { rotatePoint } from '../../utils/rotation-math';

const RAD_TO_DEG = 180 / Math.PI;

/** mm — rotation handle stand-off beyond the +Y (length) edge (visual separation). */
const ROTATION_HANDLE_OFFSET_MM = 200;

/** Diagonal corners as (signX, signY) in the panel's local frame. */
interface CornerSign {
  readonly sx: 1 | -1;
  readonly sy: 1 | -1;
}
const CORNER_SIGNS: Readonly<Record<string, CornerSign>> = {
  'electrical-panel-corner-ne': { sx: 1, sy: 1 },
  'electrical-panel-corner-nw': { sx: -1, sy: 1 },
  'electrical-panel-corner-sw': { sx: -1, sy: -1 },
  'electrical-panel-corner-se': { sx: 1, sy: -1 },
};
const CORNER_ORDER: readonly ElectricalPanelGripKind[] = [
  'electrical-panel-corner-ne',
  'electrical-panel-corner-nw',
  'electrical-panel-corner-sw',
  'electrical-panel-corner-se',
];

// ─── Local-frame helpers ─────────────────────────────────────────────────────
// Rotation primitives (`rotateVector` = local→world, `projectToLocalFrame` =
// world→local) live in the shared SSoT `bim/grips/grip-math.ts` (ADR-397 §D3).

function centre(params: ElectricalPanelParams): Point2D {
  return { x: params.position.x, y: params.position.y };
}

/** World position of a corner (signX, signY) of the rotated footprint. */
function cornerWorld(params: ElectricalPanelParams, sx: number, sy: number): Point2D {
  const s = mmScaleFor(params);
  const local = { x: (sx * params.width * s) / 2, y: (sy * params.length * s) / 2 };
  const c = centre(params);
  const rot = rotateVector(local, params.rotation);
  return { x: c.x + rot.x, y: c.y + rot.y };
}

/** World position of the rotation handle (beyond the +Y / length edge midpoint). */
function rotationHandleWorld(params: ElectricalPanelParams): Point2D {
  const s = mmScaleFor(params);
  const local = { x: 0, y: (params.length / 2 + ROTATION_HANDLE_OFFSET_MM) * s };
  const c = centre(params);
  const rot = rotateVector(local, params.rotation);
  return { x: c.x + rot.x, y: c.y + rot.y };
}

// ─── Grip emission ───────────────────────────────────────────────────────────

/**
 * Compute parametric grip positions for an `ElectricalPanelEntity`. Stable order
 * (6 grips, rectangular only): 0 → move, 1 → rotation, 2-5 → corners (ne, nw, sw, se).
 */
export function getElectricalPanelGrips(entity: Readonly<ElectricalPanelEntity>): GripInfo[] {
  const { params } = entity;
  const grips: GripInfo[] = [];
  const c = centre(params);

  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'center',
    position: c,
    movesEntity: true,
    electricalPanelGripKind: 'electrical-panel-move',
  });

  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: rotationHandleWorld(params),
    movesEntity: false,
    electricalPanelGripKind: 'electrical-panel-rotation',
  });

  CORNER_ORDER.forEach((kind, i) => {
    const { sx, sy } = CORNER_SIGNS[kind];
    grips.push({
      entityId: entity.id,
      gripIndex: 2 + i,
      type: 'corner',
      position: cornerWorld(params, sx, sy),
      movesEntity: false,
      electricalPanelGripKind: kind,
    });
  });

  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface ElectricalPanelGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: ElectricalPanelParams;
  /** World-space delta from the grip anchor to the current cursor position. */
  readonly delta: Point2D;
  /**
   * ORTHO (F8) active → corner resize is constrained to the dominant local axis
   * (pure width OR pure length). Ignored for move/rotation.
   */
  readonly ortho?: boolean;
  /**
   * ADR-408 / ADR-397 — rotation centre for the `electrical-panel-rotation`
   * 6-click hot-grip (AutoCAD ROTATE→Reference). When set together with
   * `currentPos`, the panel orbits this picked centre (both `position` AND
   * `rotation` change), mirroring `applyMepFixtureGripDrag('mep-fixture-rotation',
   * { pivot })`. Absent → the legacy rotate-about-own-centre path runs
   * (handle-relative `delta`).
   */
  readonly pivot?: Point2D;
  /**
   * World cursor position (= grip anchor + `delta`). Required only for the
   * pivot-rotate path so the swept angle can be measured around `pivot`.
   */
  readonly currentPos?: Point2D;
}

/**
 * Pure transform: electrical panel grip kind + drag input → new
 * `ElectricalPanelParams`. Geometry is NOT recomputed here — the caller
 * (`UpdateElectricalPanelParamsCommand`) recomputes geometry + validation so the
 * math SSoT stays in one place.
 *
 * Zero delta / unknown kind → returns `originalParams` referentially unchanged so
 * the caller can short-circuit the commit (no-op).
 */
export function applyElectricalPanelGripDrag(
  kind: ElectricalPanelGripKind,
  input: Readonly<ElectricalPanelGripDragInput>,
): ElectricalPanelParams {
  if (input.delta.x === 0 && input.delta.y === 0) return input.originalParams;
  if (kind === 'electrical-panel-move') return moveCentre(input);
  if (kind === 'electrical-panel-rotation') return rotateAboutCentre(input);
  if (CORNER_SIGNS[kind]) return resizeCorner(kind, input);
  return input.originalParams;
}

function moveCentre(input: Readonly<ElectricalPanelGripDragInput>): ElectricalPanelParams {
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

function rotateAboutCentre(input: Readonly<ElectricalPanelGripDragInput>): ElectricalPanelParams {
  const { originalParams, delta, pivot, currentPos } = input;

  // ── Pivot path (ADR-397 6-click ROTATE→Reference) ──────────────────────────
  // The hot-grip flow publishes {pivot, anchor} in BimRotateHotGripStore and
  // passes the swept `delta = alignDir − refDir`, so `currentPos = anchor + delta`
  // = pivot + alignDir and `anchor = currentPos − delta` = pivot + refDir. The
  // panel orbits `pivot`: BOTH its centre `position` and its `rotation` sweep by
  // angle(currentPos−pivot) − angle(anchor−pivot). Mirrors the fixture rotate.
  if (pivot && currentPos) {
    const anchor = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
    const sweepDeg = sweptAngleDegAboutPivot(pivot, anchor, currentPos);
    if (sweepDeg === null) return originalParams;
    const newPos = rotatePoint(
      { x: originalParams.position.x, y: originalParams.position.y },
      pivot,
      sweepDeg,
    );
    return {
      ...originalParams,
      rotation: originalParams.rotation + sweepDeg,
      position: { x: newPos.x, y: newPos.y, z: originalParams.position.z ?? 0 },
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

/**
 * Opposite-corner-anchored two-direction resize. The corner diagonally opposite
 * the dragged one is pinned in world space; `width`/`length` grow toward the
 * dragged corner and `position` re-centres to the new box centre. ORTHO snaps
 * the motion to the dominant local axis (pure width OR length).
 */
function resizeCorner(
  kind: ElectricalPanelGripKind,
  input: Readonly<ElectricalPanelGripDragInput>,
): ElectricalPanelParams {
  const { originalParams, delta, ortho } = input;
  const { sx, sy } = CORNER_SIGNS[kind];
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

  const newWidth = Math.max(MIN_PANEL_DIMENSION_MM, Math.abs(baseLocal.x + dLocal.x) / s);
  const newLength = Math.max(MIN_PANEL_DIMENSION_MM, Math.abs(baseLocal.y + dLocal.y) / s);

  // Re-form the anchor→dragged vector with the original signs + clamped span, so
  // the dragged corner stays diagonally opposite the anchor. New centre = midpoint.
  const clampedLocal = { x: sx * newWidth * s, y: sy * newLength * s };
  const halfRot = rotateVector({ x: clampedLocal.x / 2, y: clampedLocal.y / 2 }, rot);
  const newCentre = { x: anchorWorld.x + halfRot.x, y: anchorWorld.y + halfRot.y };

  return {
    ...originalParams,
    width: newWidth,
    length: newLength,
    position: { x: newCentre.x, y: newCentre.y, z: originalParams.position.z ?? 0 },
  };
}
