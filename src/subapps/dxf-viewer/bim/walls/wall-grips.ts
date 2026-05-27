/**
 * ADR-363 Phase 1C — Wall parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `bim/stairs/stair-grips.ts` (ADR-358 Phase 5b) and exposes the
 * grips described in ADR-363 §6 Phase 1C:
 *
 *   - `wall-start`     → translate axis start endpoint (no other params change)
 *   - `wall-end`       → translate axis end endpoint
 *   - `wall-midpoint`  → translate whole wall (axis midpoint anchor, moves both endpoints)
 *   - `wall-thickness` → resize thickness perpendicular to axis (symmetric);
 *                        manual override drops `dna`
 *   - `wall-curve`     → move quadratic Bezier control point (curved kind only)
 *   - `wall-vertex-N`  → translate polyline interior vertex N (polyline kind only)
 *
 * Phase 1C-bis (2026-05-27) — Asymmetric corner grips
 * (ArchiCAD / Vectorworks / AutoCAD reference-line pattern). Each corner is a
 * 2-DOF grip: axial component moves only the nearest axis endpoint; perpendicular
 * component grows/shrinks ONLY the corner's side while the opposite face stays
 * fixed and the axis re-centers by half the displacement so the wall remains
 * rectangular (parallel faces preserved). Manual override drops `dna`.
 *
 *   - `wall-corner-start-pos` / `wall-corner-start-neg` → start-side corners
 *   - `wall-corner-end-pos`   / `wall-corner-end-neg`   → end-side corners
 *
 * SSoT:
 *   - Geometry math via `computeWallGeometry()` (called by `UpdateWallParamsCommand`
 *     at commit time — this module returns ONLY new `WallParams`).
 *   - Grip wire-up via the unified grip system (`computeDxfEntityGrips`).
 *
 * Manual-thickness override semantics mirror the ribbon bridge
 * (`ui/ribbon/hooks/bridge/wall-param-helpers.ts`): when the user drags the
 * thickness handle or any corner we drop `dna` so the validator does not fire
 * `dnaThicknessMismatch` against the legacy preset.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §6 Phase 1C / 1C-bis
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.12
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, WallGripKind } from '../../hooks/useGripMovement';
import type { WallEntity, WallParams } from '../types/wall-types';
import {
  MIN_WALL_THICKNESS_MM,
  MAX_WALL_THICKNESS_MM,
} from '../types/wall-types';
import type { Point3D } from '../types/bim-base';

const DEGENERATE_EPS = 0.001;

// ─── Direction helpers ───────────────────────────────────────────────────────

/** Unit axis vector from `params.start → params.end`. Returns null when degenerate. */
function unitAxis(params: WallParams): { x: number; y: number } | null {
  const dx = params.end.x - params.start.x;
  const dy = params.end.y - params.start.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_EPS) return null;
  return { x: dx / len, y: dy / len };
}

/** CCW 90° rotation: (x,y) → (-y,x). Mirrors `wall-geometry` segment normal sign. */
function perpUnit(u: { x: number; y: number }): { x: number; y: number } {
  return { x: -u.y, y: u.x };
}

function project2D(p: Point3D): Point2D {
  return { x: p.x, y: p.y };
}

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

// ─── Grip position computation (ADR-363 §6 Phase 1C) ─────────────────────────

/**
 * Compute the parametric grip positions for a `WallEntity`. Order is stable
 * so `gripIndex` is a deterministic identifier across drags.
 *
 * Layout:
 *   0 → axis start (translate start endpoint)
 *   1 → axis end (translate end endpoint)
 *   2 → axis midpoint (translate whole wall)
 *   3 → thickness handle (symmetric resize, mid-axis offset by thickness/2)
 *   straight kind only:
 *     4 → corner start-pos   (Phase 1C-bis, asymmetric 2-DOF)
 *     5 → corner start-neg
 *     6 → corner end-pos
 *     7 → corner end-neg
 *   curved kind only:
 *     4 → curve control (emitted only when `params.curveControl` set)
 *   polyline kind only:
 *     4..N → interior vertex handles
 */
export function getWallGrips(entity: Readonly<WallEntity>): GripInfo[] {
  const { params, kind } = entity;
  const grips: GripInfo[] = [];

  const start = project2D(params.start);
  const end = project2D(params.end);
  const mid: Point2D = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  // 0 — start endpoint
  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'vertex',
    position: start,
    movesEntity: false,
    wallGripKind: 'wall-start',
  });

  // 1 — end endpoint
  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: end,
    movesEntity: false,
    wallGripKind: 'wall-end',
  });

  // 2 — axis midpoint translate (moves both endpoints)
  grips.push({
    entityId: entity.id,
    gripIndex: 2,
    type: 'center',
    position: mid,
    movesEntity: true,
    wallGripKind: 'wall-midpoint',
  });

  // 3 — thickness handle (mid-axis offset by half-thickness along perpendicular)
  const u = unitAxis(params);
  if (u) {
    const p = perpUnit(u);
    const sign = params.flip ? -1 : 1;
    const halfT = params.thickness / 2;
    grips.push({
      entityId: entity.id,
      gripIndex: 3,
      type: 'edge',
      position: {
        x: mid.x + sign * halfT * p.x,
        y: mid.y + sign * halfT * p.y,
      },
      movesEntity: false,
      wallGripKind: 'wall-thickness',
    });

    // 4..7 — Phase 1C-bis corner handles. Emitted for straight kind (default)
    // and for legacy walls without a `kind` field (permissive — undefined kind
    // is treated as straight, since older Firestore docs may predate the kind
    // discriminator). Explicitly skipped only for curved/polyline kinds where
    // the rectangular outline assumption does not hold.
    //
    // Type is `vertex` (not 'corner') so the unified grip pipeline
    // (`grip-registry.wrapDxfGrip`) does NOT subject them to the
    // `showMidpoints` filter — corners are primary editing affordances per the
    // direct-manipulation principle, not secondary midpoint helpers.
    //
    // Both perpendicular sides are emitted regardless of `params.flip` (flip
    // is a presentation hint, not a structural mirror). See header for
    // ArchiCAD/Vectorworks/AutoCAD parity rationale.
    if (kind !== 'curved' && kind !== 'polyline') {
      const halfTNoFlip = params.thickness / 2;
      const startPos: Point2D = { x: start.x + halfTNoFlip * p.x, y: start.y + halfTNoFlip * p.y };
      const startNeg: Point2D = { x: start.x - halfTNoFlip * p.x, y: start.y - halfTNoFlip * p.y };
      const endPos: Point2D = { x: end.x + halfTNoFlip * p.x, y: end.y + halfTNoFlip * p.y };
      const endNeg: Point2D = { x: end.x - halfTNoFlip * p.x, y: end.y - halfTNoFlip * p.y };
      grips.push({
        entityId: entity.id,
        gripIndex: grips.length,
        type: 'vertex',
        position: startPos,
        movesEntity: false,
        wallGripKind: 'wall-corner-start-pos',
      });
      grips.push({
        entityId: entity.id,
        gripIndex: grips.length,
        type: 'vertex',
        position: startNeg,
        movesEntity: false,
        wallGripKind: 'wall-corner-start-neg',
      });
      grips.push({
        entityId: entity.id,
        gripIndex: grips.length,
        type: 'vertex',
        position: endPos,
        movesEntity: false,
        wallGripKind: 'wall-corner-end-pos',
      });
      grips.push({
        entityId: entity.id,
        gripIndex: grips.length,
        type: 'vertex',
        position: endNeg,
        movesEntity: false,
        wallGripKind: 'wall-corner-end-neg',
      });
    }
  }

  // 4 — curve control (curved kind only)
  if (kind === 'curved' && params.curveControl) {
    grips.push({
      entityId: entity.id,
      gripIndex: 4,
      type: 'vertex',
      position: project2D(params.curveControl),
      movesEntity: false,
      wallGripKind: 'wall-curve',
    });
  }

  // 5..N — polyline interior vertex handles (skip endpoints at 0/last)
  if (kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 3) {
    const verts = params.polylineVertices;
    for (let i = 1; i < verts.length - 1; i++) {
      grips.push({
        entityId: entity.id,
        gripIndex: grips.length,
        type: 'vertex',
        position: project2D(verts[i]),
        movesEntity: false,
        wallGripKind: `wall-vertex-${i}`,
      });
    }
  }

  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface WallGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: WallParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /** Current world cursor position (used for thickness resolve). */
  readonly currentPos: Point2D;
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
  // Thickness = 2 * |proj| (handle is mid-axis offset by ±t/2).
  const dx = currentPos.x - mid.x;
  const dy = currentPos.y - mid.y;
  const proj = (dx * p.x + dy * p.y) * sign;
  const rawThickness = Math.abs(proj) * 2;
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
  // Decompose delta into axial (along u) + perpendicular (along p, signed).
  const axialD = delta.x * u.x + delta.y * u.y;
  const perpD = delta.x * p.x + delta.y * p.y;
  // Thickness change: outward drag on the corner's face grows thickness.
  // perpSign * perpD > 0 means the dragged face moved AWAY from the axis.
  const rawThickness = originalParams.thickness + perpSign * perpD;
  const minT = minThicknessFloorFor(originalParams.thickness);
  const maxT = maxThicknessCeilingFor(originalParams.thickness);
  const clampedThickness = Math.max(minT, Math.min(maxT, rawThickness));
  // Back-derive the actual perpendicular displacement after clamping. The
  // opposite face stays at its original position; the moving face has shifted
  // by `perpSign * (clampedThickness - thickness)` in the +p basis.
  const actualPerpD = perpSign * (clampedThickness - originalParams.thickness);
  // Axis recenter: midpoint of faces shifts by half the moving face displacement.
  const axisShiftPerp = actualPerpD / 2;
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
