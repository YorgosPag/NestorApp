/**
 * ADR-363 Phase 5.5a + 5.5b + 5.5c — Beam parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `bim/walls/wall-grips.ts` (Phase 1C) και exposes τα grips που
 * περιγράφει το ADR-363 §6 Phase 5.5a/5.5b/5.5c:
 *
 *   - `beam-start`     → translate axis start endpoint (no other params change)
 *   - `beam-end`       → translate axis end endpoint
 *   - `beam-midpoint`  → translate whole beam (axis midpoint anchor, moves
 *                        startPoint + endPoint + curveControl όπου υπάρχει)
 *   - `beam-curve`     → move quadratic Bezier control point (curved kind only).
 *                        Όταν `curveControl === undefined`, seed στο axis
 *                        midpoint και applies το delta (mirrors wall pattern).
 *   - `beam-width`     → Phase 5.5b — perpendicular-to-axis dimension handle
 *                        στο axis midpoint, offset κατά `width/2` along
 *                        `rot90(axis_unit)`. Drag projection × 2 (symmetric)
 *                        → new width, clamped σε `MIN_BEAM_WIDTH_MM`.
 *   - `beam-depth`     → Phase 5.5c — out-of-plane (gravity axis) dimension
 *                        indicator. Stands στην ΑΝΤΙΘΕΤΗ πλευρά του width
 *                        handle (NEGATIVE perpendicular), με offset
 *                        `width/2 + DEPTH_GRIP_OFFSET_MM` ώστε ο user να βλέπει
 *                        ξεκάθαρα ότι είναι out-of-plane control. Renderer
 *                        ζωγραφίζει dashed leader line + "d=X" label.
 *                        Symmetric drag projection × 2 → new depth, clamps
 *                        στο `MIN_BEAM_DEPTH_MM`. ΟΧΙ footprint mutation
 *                        (depth ζει στον z-axis, μόνο το `params.depth` αλλάζει).
 *
 * SSoT:
 *   - Geometry math via `computeBeamGeometry()` (called by
 *     `UpdateBeamParamsCommand` at commit time — this module returns ONLY new
 *     `BeamParams`).
 *   - Grip wire-up via the unified grip system (`BeamRenderer.getGrips`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5.5a/5.5b/5.5c
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, BeamGripKind } from '../../hooks/useGripMovement';
import type { BeamEntity, BeamParams } from '../types/beam-types';
import { MIN_BEAM_WIDTH_MM, MIN_BEAM_DEPTH_MM } from '../types/beam-types';
import type { Point3D } from '../types/bim-base';
// ADR-397 §12 D3 — shared BIM grip math SSoT (no per-entity copies of
// project2D / perpUnit / axis-unit). Replaces the local duplicates flagged in
// ADR-393 §8.2.
import { project2D, perpUnit, unitVector, rotateAxisPointsAboutPivot } from '../grips/grip-math';
// ADR-363 (2026-06-11) — straight-beam 7-grip wall parity via the shared
// axis-anchored box grip SSoT (same code as wall straight + foundation strip).
import {
  getAxisBoxGrips,
  applyAxisBoxGripDrag,
  invertAxisBoxRoleMap,
  type AxisBoxParams,
  type AxisBoxGripRole,
} from '../grips/axis-box-grips';

/** Map a shared axis-box grip ROLE → the beam discriminator kind (stable order). */
const BEAM_ROLE_TO_KIND: Readonly<Record<AxisBoxGripRole, BeamGripKind>> = {
  'width-edge': 'beam-width',
  'length-edge': 'beam-edge-length',
  'corner-start-pos': 'beam-corner-start-pos',
  'corner-start-neg': 'beam-corner-start-neg',
  'corner-end-pos': 'beam-corner-end-pos',
  'corner-end-neg': 'beam-corner-end-neg',
  rotation: 'beam-rotation',
};

/** Inverse (derived ONCE — no hand-written drift). Rotation handled bespoke. */
const BEAM_KIND_TO_AXIS_ROLE = invertAxisBoxRoleMap(BEAM_ROLE_TO_KIND);

/** `BeamParams` → the minimal `AxisBoxParams` the shared SSoT reads. */
function beamAxisBoxParams(params: BeamParams): AxisBoxParams {
  return {
    start: project2D(params.startPoint),
    end: project2D(params.endPoint),
    width: params.width,
    sceneUnits: params.sceneUnits,
  };
}

/**
 * Phase 5.5c — Extra perpendicular offset (mm) πέρα από `width/2` ώστε το
 * depth handle να στέκεται ξεκάθαρα έξω από το footprint. Παρέχει visual
 * separation από το width handle (που στέκεται στο όριο του footprint).
 * Renderer χρησιμοποιεί την ίδια σταθερά για το dashed leader line endpoint.
 */
export const DEPTH_GRIP_OFFSET_MM = 250;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function axisMidpoint2D(params: BeamParams): Point2D {
  return {
    x: (params.startPoint.x + params.endPoint.x) / 2,
    y: (params.startPoint.y + params.endPoint.y) / 2,
  };
}

function translate3D(p: Point3D, delta: Point2D): Point3D {
  return { x: p.x + delta.x, y: p.y + delta.y, z: p.z ?? 0 };
}

/** Unit axis vector (params.startPoint → params.endPoint). null on degenerate. */
function unitAxis(params: BeamParams): { x: number; y: number } | null {
  return unitVector(params.startPoint, params.endPoint);
}

/**
 * Width-handle position: axis midpoint offset κατά `width/2` along perpendicular.
 * Exported για unit-test reuse (avoids duplicating math σε assertions).
 * Returns null όταν το axis είναι degenerate.
 */
export function beamWidthHandlePosition(params: BeamParams): Point2D | null {
  const u = unitAxis(params);
  if (!u) return null;
  const p = perpUnit(u);
  const mid = axisMidpoint2D(params);
  const halfW = params.width / 2;
  return { x: mid.x + halfW * p.x, y: mid.y + halfW * p.y };
}

/**
 * Phase 5.5c — Depth-handle position: axis midpoint offset κατά
 * `−(width/2 + DEPTH_GRIP_OFFSET_MM)` along perpendicular (ΑΝΤΙΘΕΤΗ πλευρά
 * από το width handle). Stands έξω από το footprint ώστε ο user να
 * διαφοροποιεί το depth (out-of-plane indicator) από το width (in-plane).
 * Returns null όταν το axis είναι degenerate.
 */
export function beamDepthHandlePosition(params: BeamParams): Point2D | null {
  const u = unitAxis(params);
  if (!u) return null;
  const p = perpUnit(u);
  const mid = axisMidpoint2D(params);
  const offset = -(params.width / 2 + DEPTH_GRIP_OFFSET_MM);
  return { x: mid.x + offset * p.x, y: mid.y + offset * p.y };
}

// ─── Grip position computation (ADR-363 §6 Phase 5.5a) ───────────────────────

/**
 * Compute the parametric grip positions για ένα `BeamEntity`. Order is stable
 * ώστε `gripIndex` να είναι deterministic identifier κατά τη διάρκεια drag.
 *
 * Layout:
 *   0 → axis start (translate startPoint)
 *   1 → axis end (translate endPoint)
 *   2 → axis midpoint (translate whole beam — moves start+end+curveControl)
 *   3 → curve control (curved kind only, emitted only when `kind === 'curved'`).
 *       Όταν `params.curveControl` undefined, position seeded στο axis midpoint
 *       ώστε ο user να μπορεί να ξεκινήσει drag να σχηματίσει την καμπύλη.
 */
export function getBeamGrips(entity: Readonly<BeamEntity>): GripInfo[] {
  const { params, kind } = entity;

  // ── Straight beam → 7 wall-parity grips via the shared axis-box SSoT ─────────
  // (4 corners + width edge + length edge + rotation — ίδιος κώδικας με τοίχο /
  // πεδιλοδοκό, Giorgio 2026-06-11). `depth` δεν εκπέμπεται πλέον ως grip (Revit
  // plan behavior — επεξεργάζεται στο Properties / 3Δ· το `beamDepthHandlePosition`
  // μένει για τον read-only depth indicator του renderer).
  if (kind !== 'curved') {
    return getAxisBoxGrips(beamAxisBoxParams(params)).map((g, i) => ({
      entityId: entity.id,
      gripIndex: i,
      type: g.type,
      position: g.position,
      movesEntity: false,
      beamGripKind: BEAM_ROLE_TO_KIND[g.role],
    }));
  }

  // ── Curved beam → bespoke (no rectangular footprint to read corners from) ────
  // start / end / curve control / width / rotation. Mirror του curved wall path.
  const grips: GripInfo[] = [];
  const start = project2D(params.startPoint);
  const end = project2D(params.endPoint);
  const mid = axisMidpoint2D(params);

  grips.push({ entityId: entity.id, gripIndex: 0, type: 'vertex', position: start, movesEntity: false, beamGripKind: 'beam-start' });
  grips.push({ entityId: entity.id, gripIndex: 1, type: 'vertex', position: end, movesEntity: false, beamGripKind: 'beam-end' });

  // 3 — curve control. Seed στο midpoint όταν undefined.
  const curvePos = params.curveControl ? project2D(params.curveControl) : mid;
  grips.push({ entityId: entity.id, gripIndex: 3, type: 'vertex', position: curvePos, movesEntity: false, beamGripKind: 'beam-curve' });

  // 4 — width dimension handle (mid-axis offset κατά width/2). Skip σε degenerate axis.
  const widthPos = beamWidthHandlePosition(params);
  if (widthPos) {
    grips.push({ entityId: entity.id, gripIndex: 4, type: 'edge', position: widthPos, movesEntity: false, beamGripKind: 'beam-width' });
  }

  // 5 — rotation handle (axis fraction 0.75, scale-free). Spins start/end/curveControl.
  if (unitAxis(params)) {
    grips.push({
      entityId: entity.id,
      gripIndex: 5,
      type: 'vertex',
      position: { x: start.x + 0.75 * (end.x - start.x), y: start.y + 0.75 * (end.y - start.y) },
      movesEntity: false,
      beamGripKind: 'beam-rotation',
    });
  }

  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface BeamGripDragInput {
  /** Original params at drag start (preserves invariants). */
  readonly originalParams: BeamParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
  /**
   * ADR-363 — current world cursor position. Required only by `beam-rotation`
   * (the anchor-relative swept-angle rotate); every other beam grip is purely
   * delta-driven and ignores it. Undefined → rotation no-ops.
   */
  readonly currentPos?: Point2D;
  /**
   * ADR-363 — optional rotation pivot for `beam-rotation`. When set the beam
   * rotates around this picked centre (the AutoCAD ROTATE "specify centre" flow);
   * undefined → the axis midpoint. Mirror of `WallGripDragInput.pivot`.
   */
  readonly pivot?: Point2D;
}

/**
 * Pure transform: beam grip kind + drag input → new `BeamParams`. Geometry is
 * NOT recomputed here — ο caller (`UpdateBeamParamsCommand.execute`) είναι
 * υπεύθυνος για την `computeBeamGeometry()` κλήση ώστε το math SSoT να μένει
 * σε ένα σημείο και το command merging να διατηρεί το original delta semantics.
 *
 * Zero delta ή unknown grip kind → επιστρέφει `originalParams` referentially
 * unchanged ώστε ο caller να μπορεί να short-circuit το commit (no-op).
 */
export function applyBeamGripDrag(
  gripKind: BeamGripKind,
  input: Readonly<BeamGripDragInput>,
): BeamParams {
  if (input.delta.x === 0 && input.delta.y === 0) return input.originalParams;
  // Straight beam corner / width-edge / length-edge resize → shared axis-box engine
  // (opposite-element-fixed, ίδιος κώδικας με τοίχο/πεδιλοδοκό). Returns null για
  // curved beams OR non-rect kinds → fall through στους bespoke handlers.
  const rect = applyBeamRectGrip(gripKind, input);
  if (rect) return rect;
  if (gripKind === 'beam-start') return moveStart(input);
  if (gripKind === 'beam-end') return moveEnd(input);
  if (gripKind === 'beam-midpoint') return moveMidpoint(input);
  if (gripKind === 'beam-rotation') return rotateBeam(input);
  if (gripKind === 'beam-curve') return moveCurveControl(input);
  if (gripKind === 'beam-width') return resizeWidth(input); // curved-beam path only
  if (gripKind === 'beam-depth') return resizeDepth(input);
  return input.originalParams;
}

/** A plain straight beam (no Bezier control) — the rect-footprint discriminator. */
function isRectBeam(params: BeamParams): boolean {
  return params.curveControl === undefined;
}

/**
 * Straight-beam corner / width-edge / length-edge drag via the shared axis-box
 * SSoT (opposite-element-fixed). Returns `null` για curved beams (no rectangular
 * footprint) OR non-rect kinds → caller falls back to the bespoke handlers. The
 * `{start,end,width}` patch maps to `startPoint`/`endPoint`/`width`, preserving Z.
 */
function applyBeamRectGrip(
  gripKind: BeamGripKind,
  input: Readonly<BeamGripDragInput>,
): BeamParams | null {
  if (!isRectBeam(input.originalParams)) return null;
  const role = BEAM_KIND_TO_AXIS_ROLE[gripKind];
  if (!role || role === 'rotation') return null; // rotation → bespoke rotateBeam (handles curveControl)
  const patch = applyAxisBoxGripDrag(role, {
    originalParams: beamAxisBoxParams(input.originalParams),
    delta: input.delta,
    minWidthMm: MIN_BEAM_WIDTH_MM,
  });
  if (!patch) return input.originalParams;
  return {
    ...input.originalParams,
    startPoint: { x: patch.start.x, y: patch.start.y, z: input.originalParams.startPoint.z ?? 0 },
    endPoint: { x: patch.end.x, y: patch.end.y, z: input.originalParams.endPoint.z ?? 0 },
    width: patch.width,
  };
}

/**
 * Rotate the whole beam (startPoint + endPoint + curveControl) about a picked
 * centre or the axis midpoint. Mirror of the wall `rotateWall`: anchor-relative
 * swept angle (`anchor = currentPos − delta`) so grabbing the off-axis handle does
 * not snap the beam. ADR-397 §D3 — delegates to the shared
 * `rotateAxisPointsAboutPivot` SSoT (swept angle + canonical `rotatePoint`), the
 * SAME primitive the wall rotation grip uses. NEVER raw cos/sin.
 *
 * Returns `originalParams` unchanged when `currentPos` is absent or the swept
 * angle is degenerate (cursor on the pivot), so the caller short-circuits the
 * commit (no-op).
 */
function rotateBeam(input: Readonly<BeamGripDragInput>): BeamParams {
  const { originalParams, delta, currentPos, pivot } = input;
  if (!currentPos) return originalParams;
  const centre: Point2D = pivot ?? axisMidpoint2D(originalParams);
  const anchor: Point2D = { x: currentPos.x - delta.x, y: currentPos.y - delta.y };
  const hasCurve = originalParams.curveControl !== undefined;
  const pts: Point2D[] = [
    project2D(originalParams.startPoint),
    project2D(originalParams.endPoint),
  ];
  if (hasCurve) pts.push(project2D(originalParams.curveControl!));
  const rotated = rotateAxisPointsAboutPivot(pts, { pivot: centre, anchor, currentPos });
  if (!rotated) return originalParams;
  const next: BeamParams = {
    ...originalParams,
    startPoint: { x: rotated[0].x, y: rotated[0].y, z: originalParams.startPoint.z ?? 0 },
    endPoint: { x: rotated[1].x, y: rotated[1].y, z: originalParams.endPoint.z ?? 0 },
  };
  if (hasCurve) {
    return {
      ...next,
      curveControl: { x: rotated[2].x, y: rotated[2].y, z: originalParams.curveControl!.z ?? 0 },
    };
  }
  return next;
}

function moveStart(input: Readonly<BeamGripDragInput>): BeamParams {
  const { originalParams, delta } = input;
  return {
    ...originalParams,
    startPoint: translate3D(originalParams.startPoint, delta),
  };
}

function moveEnd(input: Readonly<BeamGripDragInput>): BeamParams {
  const { originalParams, delta } = input;
  return {
    ...originalParams,
    endPoint: translate3D(originalParams.endPoint, delta),
  };
}

function moveMidpoint(input: Readonly<BeamGripDragInput>): BeamParams {
  const { originalParams, delta } = input;
  const next: BeamParams = {
    ...originalParams,
    startPoint: translate3D(originalParams.startPoint, delta),
    endPoint: translate3D(originalParams.endPoint, delta),
  };
  if (originalParams.curveControl) {
    return { ...next, curveControl: translate3D(originalParams.curveControl, delta) };
  }
  return next;
}

function moveCurveControl(input: Readonly<BeamGripDragInput>): BeamParams {
  const { originalParams, delta } = input;
  const existing = originalParams.curveControl;
  if (!existing) {
    // Seed από axis midpoint + delta (handle πριν το drag stood στο midpoint).
    const mid = axisMidpoint2D(originalParams);
    const seeded: Point3D = { x: mid.x + delta.x, y: mid.y + delta.y, z: 0 };
    return { ...originalParams, curveControl: seeded };
  }
  return { ...originalParams, curveControl: translate3D(existing, delta) };
}

/**
 * Phase 5.5b — symmetric width resize perpendicular to axis. Handle stands στη
 * μία πλευρά (offset `width/2`), οπότε ένα perpendicular delta `d` αντιστοιχεί
 * σε `2d` συνολικό πλάτος (mirror του wall-thickness `* 2` factor).
 *
 * Parallel-to-axis delta projects σε 0 → width stays unchanged. Degenerate
 * axis (start === end) → unchanged. Clamps κάτω από `MIN_BEAM_WIDTH_MM`.
 */
function resizeWidth(input: Readonly<BeamGripDragInput>): BeamParams {
  const { originalParams, delta } = input;
  const u = unitAxis(originalParams);
  if (!u) return originalParams;
  const p = perpUnit(u);
  const deltaPerp = delta.x * p.x + delta.y * p.y;
  const rawWidth = originalParams.width + 2 * deltaPerp;
  const clamped = Math.max(MIN_BEAM_WIDTH_MM, rawWidth);
  return { ...originalParams, width: clamped };
}

/**
 * Phase 5.5c — symmetric depth resize. Handle stands στην NEGATIVE-perpendicular
 * πλευρά (αντίθετα από το width handle), οπότε drag προς τα έξω (μακριά από
 * τον axis → δηλαδή προς MORE-NEGATIVE perpendicular) σημαίνει INCREASE depth.
 *
 * Math:
 *   deltaPerp = delta · perpUnit  (CCW perpendicular, ίδιος που χρησιμοποιεί
 *                                  το width handle)
 *   Drag "outward" από το handle = delta·p < 0 (γιατί το handle έχει NEGATIVE
 *   perpendicular offset). Άρα newDepth = depth + 2·(-deltaPerp) = depth − 2·deltaPerp.
 *
 * Parallel-to-axis drag projects σε 0 → depth unchanged. Degenerate axis → no-op.
 * Clamps στο `MIN_BEAM_DEPTH_MM`.
 */
function resizeDepth(input: Readonly<BeamGripDragInput>): BeamParams {
  const { originalParams, delta } = input;
  const u = unitAxis(originalParams);
  if (!u) return originalParams;
  const p = perpUnit(u);
  const deltaPerp = delta.x * p.x + delta.y * p.y;
  const rawDepth = originalParams.depth - 2 * deltaPerp;
  const clamped = Math.max(MIN_BEAM_DEPTH_MM, rawDepth);
  return { ...originalParams, depth: clamped };
}
