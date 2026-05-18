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
 *   - `wall-thickness` → resize thickness perpendicular to axis; manual override drops `dna`
 *   - `wall-curve`     → move quadratic Bezier control point (curved kind only)
 *   - `wall-vertex-N`  → translate polyline interior vertex N (polyline kind only)
 *
 * SSoT:
 *   - Geometry math via `computeWallGeometry()` (called by `UpdateWallParamsCommand`
 *     at commit time — this module returns ONLY new `WallParams`).
 *   - Grip wire-up via the unified grip system (`computeDxfEntityGrips`).
 *
 * Manual-thickness override semantics mirror the ribbon bridge
 * (`ui/ribbon/hooks/bridge/wall-param-helpers.ts`): when the user drags the
 * thickness handle we drop `dna` so the validator does not fire
 * `dnaThicknessMismatch` against the legacy preset.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §6 Phase 1C
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
 *   3 → thickness handle (mid-axis offset by thickness/2 along perpendicular)
 *   4 → curve control (curved kind only, emitted only when `params.curveControl` set)
 *   5..N → polyline interior vertex handles (polyline kind only)
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
