/**
 * ADR-363 Phase 5.5a + 5.5b — Beam parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `bim/walls/wall-grips.ts` (Phase 1C) και exposes τα grips που
 * περιγράφει το ADR-363 §6 Phase 5.5a/5.5b:
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
 *
 * SSoT:
 *   - Geometry math via `computeBeamGeometry()` (called by
 *     `UpdateBeamParamsCommand` at commit time — this module returns ONLY new
 *     `BeamParams`).
 *   - Grip wire-up via the unified grip system (`BeamRenderer.getGrips`).
 *
 * Phase 5.5b adds the in-plane width handle. Depth dimension grip
 * (out-of-plane / gravity axis) DEFERRED στο Phase 5.5c — δεν φαίνεται σε plan
 * view χωρίς ξεχωριστό visual indicator.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5.5a/5.5b
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, BeamGripKind } from '../../hooks/useGripMovement';
import type { BeamEntity, BeamParams } from '../types/beam-types';
import { MIN_BEAM_WIDTH_MM } from '../types/beam-types';
import type { Point3D } from '../types/bim-base';

const DEGENERATE_EPS = 0.001;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function project2D(p: Point3D): Point2D {
  return { x: p.x, y: p.y };
}

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
  const dx = params.endPoint.x - params.startPoint.x;
  const dy = params.endPoint.y - params.startPoint.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_EPS) return null;
  return { x: dx / len, y: dy / len };
}

/** CCW 90° rotation: (x,y) → (-y,x). */
function perpUnit(u: { x: number; y: number }): { x: number; y: number } {
  return { x: -u.y, y: u.x };
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
  const grips: GripInfo[] = [];

  const start = project2D(params.startPoint);
  const end = project2D(params.endPoint);
  const mid = axisMidpoint2D(params);

  // 0 — start endpoint
  grips.push({
    entityId: entity.id,
    gripIndex: 0,
    type: 'vertex',
    position: start,
    movesEntity: false,
    beamGripKind: 'beam-start',
  });

  // 1 — end endpoint
  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: end,
    movesEntity: false,
    beamGripKind: 'beam-end',
  });

  // 2 — axis midpoint translate (moves both endpoints + curveControl)
  grips.push({
    entityId: entity.id,
    gripIndex: 2,
    type: 'center',
    position: mid,
    movesEntity: true,
    beamGripKind: 'beam-midpoint',
  });

  // 3 — curve control (curved kind only). Seed στο midpoint όταν undefined.
  let widthGripIndex = 3;
  if (kind === 'curved') {
    const curvePos = params.curveControl ? project2D(params.curveControl) : mid;
    grips.push({
      entityId: entity.id,
      gripIndex: 3,
      type: 'vertex',
      position: curvePos,
      movesEntity: false,
      beamGripKind: 'beam-curve',
    });
    widthGripIndex = 4;
  }

  // 3 ή 4 — width dimension handle (Phase 5.5b). Mid-axis offset κατά
  // `width/2` along perpendicular. Skip σε degenerate axis (start === end).
  const widthPos = beamWidthHandlePosition(params);
  if (widthPos) {
    grips.push({
      entityId: entity.id,
      gripIndex: widthGripIndex,
      type: 'edge',
      position: widthPos,
      movesEntity: false,
      beamGripKind: 'beam-width',
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
  if (gripKind === 'beam-start') return moveStart(input);
  if (gripKind === 'beam-end') return moveEnd(input);
  if (gripKind === 'beam-midpoint') return moveMidpoint(input);
  if (gripKind === 'beam-curve') return moveCurveControl(input);
  if (gripKind === 'beam-width') return resizeWidth(input);
  return input.originalParams;
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
