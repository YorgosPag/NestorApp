/**
 * ADR-363 Phase 1C — Wall parametric grip drag transforms.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. `applyWallGripDrag`
 * maps a wall grip kind + drag input → new `WallParams`. Geometry is NOT
 * recomputed here — the caller (`UpdateWallParamsCommand.execute`) is responsible
 * for the `computeWallGeometry()` call so the math SSoT stays in one place and
 * command merging preserves the original delta semantics. Re-exported from
 * `wall-grips.ts` for a stable public API (mirror `stair-grip-transforms.ts`).
 *
 * Manual-thickness override semantics mirror the ribbon bridge
 * (`ui/ribbon/hooks/bridge/wall-param-helpers.ts`): when the user drags the
 * thickness handle or any corner we drop `dna` so the validator does not fire
 * `dnaThicknessMismatch` against the legacy preset.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §6 Phase 1C / 1C-bis
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallGripKind } from '../../hooks/useGripMovement';
import type { WallParams } from '../types/wall-types';
import {
  MIN_WALL_THICKNESS_MM,
  MAX_WALL_THICKNESS_MM,
} from '../types/wall-types';
import type { Point3D } from '../types/bim-base';
import { mmScaleFor } from '../../utils/scene-units';
import { unitAxis, perpUnit } from './wall-grip-math';
// ADR-397 §D3 — rotate-about-pivot is shared SSoT: `rotateAxisPointsAboutPivot`
// (swept angle from grip-math + canonical rotatePoint, ADR-188) is consumed by
// both the wall and beam rotation grips. No re-implemented cos/sin here.
import { rotateAxisPointsAboutPivot } from '../grips/grip-math';

// ─── Thickness unit floor (scene-unit-aware) ─────────────────────────────────

/**
 * Pick a minimum-thickness floor in whatever scene units the current `thickness`
 * is expressed in. Mirrors `bim/stairs/stair-grips.minWidthFloorFor()` — a
 * thickness default of 0.2 (m), 20 (cm), 200 (mm) → respective floors 0.05, 5,
 * 50 (same physical 50 mm everywhere).
 */
function minThicknessFloorFor(currentThickness: number): number {
  if (!Number.isFinite(currentThickness) || currentThickness <= 0) {
    return MIN_WALL_THICKNESS_MM;
  }
  if (currentThickness < 10) return 0.05;   // metres
  if (currentThickness < 100) return 5;     // centimetres
  return MIN_WALL_THICKNESS_MM;             // millimetres (or larger units)
}

/** Same heuristic, max side. */
function maxThicknessCeilingFor(currentThickness: number): number {
  if (!Number.isFinite(currentThickness) || currentThickness <= 0) {
    return MAX_WALL_THICKNESS_MM;
  }
  if (currentThickness < 10) return 2;         // metres (2 m)
  if (currentThickness < 100) return 200;      // centimetres (200 cm = 2 m)
  return MAX_WALL_THICKNESS_MM;                // millimetres
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface WallGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: WallParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /** Current world cursor position (used for thickness resolve). */
  readonly currentPos: Point2D;
  /**
   * ADR-363 Phase 1G — optional rotation pivot for `wall-rotation`. When set, the
   * wall rotates around this point instead of its midpoint (the AutoCAD ROTATE
   * "specify center" flow where the user picks an arbitrary rotation centre). The
   * swept angle is still anchor-relative (`currentPos − delta` → `currentPos`),
   * so there is no snap when rotation starts. Undefined → legacy midpoint pivot.
   */
  readonly pivot?: Point2D;
}

/**
 * Pure transform: wall grip kind + drag input → new `WallParams`. Geometry is
 * NOT recomputed here — the caller (`UpdateWallParamsCommand.execute`) is
 * responsible for the `computeWallGeometry()` call so the math SSoT stays in
 * one place and command merging preserves the original delta semantics.
 *
 * For `wall-vertex-N` the numeric index `N` is parsed from the discriminator
 * suffix; an out-of-range index yields `originalParams` unchanged.
 */
export function applyWallGripDrag(
  gripKind: WallGripKind,
  input: Readonly<WallGripDragInput>,
): WallParams {
  if (gripKind === 'wall-start') return moveStart(input);
  if (gripKind === 'wall-end') return moveEnd(input);
  if (gripKind === 'wall-midpoint') return moveMidpoint(input);
  if (gripKind === 'wall-thickness') return resizeThickness(input);
  if (gripKind === 'wall-corner-start-pos') return moveCorner(input, 'start', +1);
  if (gripKind === 'wall-corner-start-neg') return moveCorner(input, 'start', -1);
  if (gripKind === 'wall-corner-end-pos') return moveCorner(input, 'end', +1);
  if (gripKind === 'wall-corner-end-neg') return moveCorner(input, 'end', -1);
  if (gripKind === 'wall-rotation') return rotateWall(input);
  if (gripKind === 'wall-curve') return moveCurveControl(input);
  if (gripKind.startsWith('wall-vertex-')) {
    const idx = parseInt(gripKind.slice('wall-vertex-'.length), 10);
    if (Number.isFinite(idx) && idx >= 1) return movePolylineVertex(input, idx);
  }
  return input.originalParams;
}

function moveStart(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, delta } = input;
  const newStart: Point3D = {
    x: originalParams.start.x + delta.x,
    y: originalParams.start.y + delta.y,
    z: originalParams.start.z,
  };
  return { ...originalParams, start: newStart };
}

function moveEnd(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, delta } = input;
  const newEnd: Point3D = {
    x: originalParams.end.x + delta.x,
    y: originalParams.end.y + delta.y,
    z: originalParams.end.z,
  };
  return { ...originalParams, end: newEnd };
}

function moveMidpoint(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, delta } = input;
  const newStart: Point3D = {
    x: originalParams.start.x + delta.x,
    y: originalParams.start.y + delta.y,
    z: originalParams.start.z,
  };
  const newEnd: Point3D = {
    x: originalParams.end.x + delta.x,
    y: originalParams.end.y + delta.y,
    z: originalParams.end.z,
  };
  return { ...originalParams, start: newStart, end: newEnd };
}

/**
 * Phase 1C-ter — rotate the whole wall around its midpoint. Mirror of the stair
 * `rotateDirection` (anchor-relative): the handle sits just outside the end
 * short edge (OFF the start→end axis), so using the cursor's absolute bearing
 * would snap the wall the instant the handle is grabbed. Instead we rotate by
 * the angle SWEPT from the anchor (the grip world position at mousedown =
 * `currentPos − delta`) about the midpoint, then spin both endpoints by it.
 *
 * ADR-397 §D3 — swept angle + point rotation are the shared
 * `rotateAxisPointsAboutPivot` SSoT (`grip-math` `sweptAngleDegAboutPivot` +
 * canonical `rotatePoint`), the same primitive the beam + column rotation grips
 * use. No re-implemented cos/sin.
 */
function rotateWall(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, currentPos, delta, pivot } = input;
  // ADR-363 Phase 1G — rotate around the picked pivot when supplied, else the
  // wall midpoint (legacy drag-handle behaviour).
  const centre: Point2D = pivot
    ? pivot
    : {
        x: (originalParams.start.x + originalParams.end.x) / 2,
        y: (originalParams.start.y + originalParams.end.y) / 2,
      };
  const anchor = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
  const rotated = rotateAxisPointsAboutPivot(
    [
      { x: originalParams.start.x, y: originalParams.start.y },
      { x: originalParams.end.x, y: originalParams.end.y },
    ],
    { pivot: centre, anchor, currentPos },
  );
  if (!rotated) return originalParams;
  const [ns, ne] = rotated;
  return {
    ...originalParams,
    start: { x: ns.x, y: ns.y, z: originalParams.start.z },
    end: { x: ne.x, y: ne.y, z: originalParams.end.z },
  };
}

function resizeThickness(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, currentPos } = input;
  const u = unitAxis(originalParams);
  if (!u) return originalParams;
  const p = perpUnit(u);
  const sign = originalParams.flip ? -1 : 1;
  const mid: Point2D = {
    x: (originalParams.start.x + originalParams.end.x) / 2,
    y: (originalParams.start.y + originalParams.end.y) / 2,
  };
  // Signed projection of (cursor − mid) onto the (signed) perpendicular.
  // Thickness = 2 * |proj| (handle is mid-axis offset by ±t/2). `proj` is in
  // canvas units; thickness is stored in mm, so divide by sceneScale.
  const dx = currentPos.x - mid.x;
  const dy = currentPos.y - mid.y;
  const proj = (dx * p.x + dy * p.y) * sign;
  const rawThickness = (Math.abs(proj) * 2) / mmScaleFor(originalParams);
  const minT = minThicknessFloorFor(originalParams.thickness);
  const maxT = maxThicknessCeilingFor(originalParams.thickness);
  const clamped = Math.max(minT, Math.min(maxT, rawThickness));
  // Manual override drops DNA so the validator does not fire
  // `dnaThicknessMismatch` (parity with `wall-param-helpers` ribbon path).
  const { dna: _dropped, ...rest } = originalParams;
  return { ...rest, thickness: clamped };
}

/**
 * Phase 1C-bis — Asymmetric corner drag.
 *
 * Decomposes the cursor delta into axial (along axis) + perpendicular components.
 *   - axial → translates only the corner's nearest axis endpoint (start or end);
 *     opposite endpoint stays anchored (besides the axis recenter shift below).
 *   - perpendicular → grows/shrinks the corner's perpendicular face only;
 *     the opposite face stays anchored, and the axis re-centers by half the
 *     displacement so the wall remains rectangular (parallel faces preserved).
 *
 * Thickness is clamped scene-unit-aware (mirror `resizeThickness`). When the
 * clamp engages, the perpendicular shift is back-derived from the clamped
 * thickness so the opposite face never moves past its original position.
 *
 * Manual override drops `dna` (parity με `resizeThickness` και `wall-param-helpers`).
 */
function moveCorner(
  input: Readonly<WallGripDragInput>,
  side: 'start' | 'end',
  perpSign: 1 | -1,
): WallParams {
  const { originalParams, delta } = input;
  const u = unitAxis(originalParams);
  if (!u) return originalParams;
  const p = perpUnit(u);
  const s = mmScaleFor(originalParams);
  // Decompose delta into axial (along u) + perpendicular (along p, signed).
  // `delta` is in canvas units; convert the perpendicular component to mm
  // before mixing with `thickness` (mm). Axial stays in canvas (applied to
  // start/end which are canvas coords).
  const axialD = delta.x * u.x + delta.y * u.y;
  const perpDCanvas = delta.x * p.x + delta.y * p.y;
  const perpDMm = perpDCanvas / s;
  // Thickness change: outward drag on the corner's face grows thickness.
  // perpSign * perpDMm > 0 means the dragged face moved AWAY from the axis.
  const rawThickness = originalParams.thickness + perpSign * perpDMm;
  const minT = minThicknessFloorFor(originalParams.thickness);
  const maxT = maxThicknessCeilingFor(originalParams.thickness);
  const clampedThickness = Math.max(minT, Math.min(maxT, rawThickness));
  // Back-derive the actual perpendicular displacement after clamping (mm). The
  // opposite face stays at its original position; the moving face has shifted
  // by `perpSign * (clampedThickness - thickness)` in the +p basis.
  const actualPerpMm = perpSign * (clampedThickness - originalParams.thickness);
  // Axis recenter: midpoint of faces shifts by half the moving face
  // displacement. Convert mm → canvas before applying to start/end.
  const axisShiftPerp = (actualPerpMm * s) / 2;
  const axisShiftX = axisShiftPerp * p.x;
  const axisShiftY = axisShiftPerp * p.y;
  const startAxial = side === 'start' ? axialD : 0;
  const endAxial = side === 'end' ? axialD : 0;
  const newStart: Point3D = {
    x: originalParams.start.x + startAxial * u.x + axisShiftX,
    y: originalParams.start.y + startAxial * u.y + axisShiftY,
    z: originalParams.start.z,
  };
  const newEnd: Point3D = {
    x: originalParams.end.x + endAxial * u.x + axisShiftX,
    y: originalParams.end.y + endAxial * u.y + axisShiftY,
    z: originalParams.end.z,
  };
  const { dna: _dropped, ...rest } = originalParams;
  return { ...rest, start: newStart, end: newEnd, thickness: clampedThickness };
}

function moveCurveControl(input: Readonly<WallGripDragInput>): WallParams {
  const { originalParams, delta } = input;
  const existing = originalParams.curveControl;
  if (!existing) {
    // Seed from current cursor: handle was implicitly at axis midpoint.
    const mid: Point3D = {
      x: (originalParams.start.x + originalParams.end.x) / 2 + delta.x,
      y: (originalParams.start.y + originalParams.end.y) / 2 + delta.y,
      z: 0,
    };
    return { ...originalParams, curveControl: mid };
  }
  const next: Point3D = {
    x: existing.x + delta.x,
    y: existing.y + delta.y,
    z: existing.z,
  };
  return { ...originalParams, curveControl: next };
}

function movePolylineVertex(
  input: Readonly<WallGripDragInput>,
  index: number,
): WallParams {
  const { originalParams, delta } = input;
  const verts = originalParams.polylineVertices;
  if (!verts || index < 1 || index >= verts.length - 1) return originalParams;
  const next: Point3D[] = verts.map((v, i) =>
    i === index
      ? { x: v.x + delta.x, y: v.y + delta.y, z: v.z }
      : { x: v.x, y: v.y, z: v.z },
  );
  // Polyline endpoints stay anchored to params.start/end (axis-aligned SSoT).
  return { ...originalParams, polylineVertices: next };
}
