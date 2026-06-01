/**
 * bim3d-tilt-bridge.ts — pure tilt math bridge: gizmo X/Z rotate-ring drag → new entity params.
 *
 * ADR-404 Phase 2 (3D BIM Element Tilt). The tilt sibling of `bim3d-resize-bridge`:
 * it turns a finished tilt drag (the world X or Z rotate ring + a signed, snapped
 * angle) into the new entity `params` per type, reusing the SAME view-agnostic
 * `Update*ParamsCommand` the resize path uses — NO new commands.
 *
 * Pure (no React, no Zustand, no THREE, no scene mutation, no command dispatch).
 *
 * Per-type model (ADR-404 §"Μοντέλο κλίσης ανά τύπο", Revit-aligned):
 *   • column → `tilt {direction, angle}` (raking, any plan direction). Set-per-plane:
 *     each ring drag replaces the column tilt with a single direction+angle.
 *   • wall   → `tilt {angle}` signed (battered, lean ⟂ run, 1 DOF). The ring whose
 *     axis is ∥ to the run tips the wall ⟂ run; the ⟂-run ring is a roll → no-op.
 *   • beam   → `topElevationEnd` (ramp along the axis). The ring ⟂ to the run tips
 *     the end up/down by `run·tan(angle)`; the ∥-run ring is a roll → no-op.
 *   • slab   → `geometryType:'tilted' + slope {direction, angle%}` (sloped plane).
 *
 * Sign / direction convention is derived from the converter shear SSoT (so the live
 * preview, which rebuilds via the converters, equals the committed result). The exact
 * lean SIDE is a UX detail Giorgio verifies in the browser; magnitude + snapping are
 * the contract here.
 *
 * Angle = degrees from vertical (column/wall) / horizontal (beam/slab). A drag that
 * snaps back to ~0 STRAIGHTENS the element (drops the tilt field) — the natural
 * "un-tilt" gesture.
 *
 * @see bim/geometry/column-tilt.ts / wall-tilt.ts / beam-slope.ts / slab-slope.ts (geometry SSoT)
 * @see bim-3d/converters/mesh-slope-shear.ts (3D shear consumers)
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md §Phase 2
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnParams } from '../../bim/types/column-types';
import type { WallParams } from '../../bim/types/wall-types';
import type { BeamParams } from '../../bim/types/beam-types';
import type { SlabParams } from '../../bim/types/slab-types';
import { AngleUtils } from '../../systems/constraints/constraints-geometry';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const LEN_EPS = 1e-9;
const ELEV_EPS_MM = 1e-6;

/** Below this |angle| (deg) the tilt is treated as "vertical/flat" → straighten / no-op. */
const TILT_EPS_DEG = 0.05;
/** Below this |perp/tip component| the chosen ring is "roll" for the element → no-op. */
const ROLL_EPS = 0.02;
/** Tolerance (deg) for the magnetic angle snap (reuses the AngleUtils SSoT for 15° multiples). */
const TILT_SNAP_TOL_DEG = 4;

/** A finished gizmo tilt drag — the X or Z rotate ring + signed angle (deg, already snapped). */
export interface TiltDragDeg {
  /** Only the X/Z rings reach here (the Y ring is plan rotation, ADR-402). */
  readonly axis: 'x' | 'z';
  /** Signed angle in degrees. */
  readonly angleDeg: number;
}

/**
 * Magnetic snap for a tilt angle (deg, signed) — 15° multiples via the angle-snap
 * SSoT (`AngleUtils.snapAngleToStep`) plus the standalone 5° increment Giorgio asked
 * for; otherwise the angle stays free (continuous). Sign is preserved. Shift→free is
 * handled by the caller (it simply skips this). ADR-404 Phase 2 (snap 5/15/30/45°).
 */
export function snapTiltAngleDeg(deg: number): number {
  const sign = deg < 0 ? -1 : 1;
  const abs = Math.abs(deg);
  const step = AngleUtils.snapAngleToStep(abs, 15, TILT_SNAP_TOL_DEG); // 0/15/30/45/60/75/90
  if (step !== null) return sign * step;
  if (Math.abs(abs - 5) <= TILT_SNAP_TOL_DEG) return sign * 5;
  return deg;
}

/**
 * Plan-space unit direction the TOP of a vertical element moves for a POSITIVE
 * rotation about the world ring axis. Derived from the converter shear convention
 * (coords after ROT_X_NEG_90: `worldX += dx`, `worldZ += −dy` → plan = {x: worldX,
 * y: −worldZ}, see `mesh-slope-shear.ts`):
 *   • X-ring (+θ rotates +Y toward +Z world) → top moves to −plan-Y → (0, −1).
 *   • Z-ring (+θ rotates +Y toward −X world) → top moves to −plan-X → (−1, 0).
 */
function topMotionDirPlan(axis: 'x' | 'z'): Point2D {
  return axis === 'x' ? { x: 0, y: -1 } : { x: -1, y: 0 };
}

/** Normalize an angle to [0, 360). Maps `-0` to `0` for clean equality. */
function normalizeDeg(deg: number): number {
  const r = deg % 360;
  const n = r < 0 ? r + 360 : r;
  return n === 0 ? 0 : n;
}

// ─── Column ──────────────────────────────────────────────────────────────────

/**
 * Column tilt → new `ColumnParams` (set-per-plane: the drag replaces the tilt with a
 * single direction + angle). A near-vertical drag straightens it. `null` = no-op.
 */
export function computeColumnTiltParams(params: ColumnParams, drag: TiltDragDeg): ColumnParams | null {
  const mag = Math.abs(drag.angleDeg);
  if (mag < TILT_EPS_DEG) return straightenColumn(params);
  const motion = topMotionDirPlan(drag.axis);
  const sign = drag.angleDeg >= 0 ? 1 : -1;
  const direction = normalizeDeg(Math.atan2(motion.y * sign, motion.x * sign) * RAD_TO_DEG);
  const next: ColumnParams = { ...params, tilt: { direction, angle: mag } };
  return sameColumnTilt(params, next) ? null : next;
}

function straightenColumn(params: ColumnParams): ColumnParams | null {
  if (params.tilt === undefined) return null;
  const { tilt: _drop, ...rest } = params;
  return rest;
}

function sameColumnTilt(a: ColumnParams, b: ColumnParams): boolean {
  if (a.tilt === undefined || b.tilt === undefined) return a.tilt === b.tilt;
  return Math.abs(a.tilt.angle - b.tilt.angle) < TILT_EPS_DEG &&
    Math.abs(a.tilt.direction - b.tilt.direction) < TILT_EPS_DEG;
}

// ─── Wall ────────────────────────────────────────────────────────────────────

/**
 * Wall tilt → new `WallParams` (battered, 1 DOF ⟂ run). The ring whose axis is ∥ to
 * the run tips the wall ⟂ run (full magnitude, snapped); the ⟂-run ring is a roll →
 * no-op. The lean magnitude equals the snapped drag angle; the SIDE comes from the
 * perp component sign (matching `wallTiltShearAt`'s left-perp convention). `null` =
 * roll / no-op; a near-vertical drag straightens the wall.
 */
export function computeWallTiltParams(params: WallParams, drag: TiltDragDeg): WallParams | null {
  const ax = params.end.x - params.start.x;
  const ay = params.end.y - params.start.y;
  const len = Math.hypot(ax, ay);
  if (len < LEN_EPS) return null; // degenerate wall
  // Left perp of run (matches `wallTiltShearAt`): (−ay, ax)/len.
  const px = -ay / len;
  const py = ax / len;
  const motion = topMotionDirPlan(drag.axis);
  const c = motion.x * px + motion.y * py; // ∈ [−1, 1] — perp component of the tilt
  if (Math.abs(c) < ROLL_EPS) return null; // chosen ring is roll for this wall → no lean
  const mag = Math.abs(drag.angleDeg);
  if (mag < TILT_EPS_DEG) return straightenWall(params);
  const angle = drag.angleDeg * Math.sign(c);
  const next: WallParams = { ...params, tilt: { angle } };
  return sameWallTilt(params, next) ? null : next;
}

function straightenWall(params: WallParams): WallParams | null {
  if (params.tilt === undefined) return null;
  const { tilt: _drop, ...rest } = params;
  return rest;
}

function sameWallTilt(a: WallParams, b: WallParams): boolean {
  if (a.tilt === undefined || b.tilt === undefined) return a.tilt === b.tilt;
  return Math.abs(a.tilt.angle - b.tilt.angle) < TILT_EPS_DEG;
}

// ─── Beam ────────────────────────────────────────────────────────────────────

/**
 * Beam tilt → new `BeamParams` (ramp along the axis via `topElevationEnd`). The ring
 * ⟂ to the run tips the end up/down by `run·tan(angle)`; the ∥-run ring is a roll →
 * no-op. `runMm` is the plan axis length (start→end, mm — beam coords are mm).
 * A near-horizontal drag flattens the beam (drops `topElevationEnd`). `null` = no-op.
 */
export function computeBeamTiltParams(params: BeamParams, drag: TiltDragDeg): BeamParams | null {
  const bx = params.endPoint.x - params.startPoint.x;
  const by = params.endPoint.y - params.startPoint.y;
  const runMm = Math.hypot(bx, by);
  if (runMm < LEN_EPS) return null; // degenerate beam
  // Tipping component: a · perpB, perpB_world = (−by, 0, −bx)/len → a=X: −by/len, a=Z: −bx/len.
  const k = (drag.axis === 'x' ? -by : -bx) / runMm;
  if (Math.abs(k) < ROLL_EPS) return null; // ring ∥ run → roll, no ramp
  const mag = Math.abs(drag.angleDeg);
  if (mag < TILT_EPS_DEG) return straightenBeam(params);
  const tip = drag.angleDeg * Math.sign(k) * DEG_TO_RAD;
  const topElevationEnd = params.topElevation + runMm * Math.tan(tip);
  const prevEnd = params.topElevationEnd ?? params.topElevation;
  return Math.abs(topElevationEnd - prevEnd) < ELEV_EPS_MM ? null : { ...params, topElevationEnd };
}

function straightenBeam(params: BeamParams): BeamParams | null {
  if (params.topElevationEnd === undefined || params.topElevationEnd === params.topElevation) return null;
  const { topElevationEnd: _drop, ...rest } = params;
  return rest;
}

// ─── Slab ────────────────────────────────────────────────────────────────────

/**
 * Slab tilt → new `SlabParams` (sloped plane via `geometryType:'tilted' + slope`).
 * Uphill plan direction for +θ: X-ring → +plan-Y (90°), Z-ring → +plan-X (0°). The
 * `SlabSlope.angle` is a PERCENTAGE → `tan(deg)·100`. A near-flat drag returns the
 * slab to `box`. `null` = no-op.
 */
export function computeSlabTiltParams(params: SlabParams, drag: TiltDragDeg): SlabParams | null {
  const mag = Math.abs(drag.angleDeg);
  if (mag < TILT_EPS_DEG) return straightenSlab(params);
  const uphill: Point2D = drag.axis === 'x' ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const sign = drag.angleDeg >= 0 ? 1 : -1;
  const direction = normalizeDeg(Math.atan2(uphill.y * sign, uphill.x * sign) * RAD_TO_DEG);
  const anglePct = Math.tan(mag * DEG_TO_RAD) * 100;
  const next: SlabParams = {
    ...params,
    geometryType: 'tilted',
    slope: { direction, angle: anglePct, pivotEdge: params.slope?.pivotEdge ?? 'center' },
  };
  return sameSlabSlope(params, next) ? null : next;
}

function straightenSlab(params: SlabParams): SlabParams | null {
  if (params.geometryType !== 'tilted') return null;
  const { slope: _drop, ...rest } = params;
  return { ...rest, geometryType: 'box' };
}

function sameSlabSlope(a: SlabParams, b: SlabParams): boolean {
  if (a.geometryType !== 'tilted' || !a.slope || !b.slope) return false;
  return Math.abs(a.slope.angle - b.slope.angle) < 1e-3 &&
    Math.abs(a.slope.direction - b.slope.direction) < TILT_EPS_DEG;
}
