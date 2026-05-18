/**
 * ADR-363 Phase 5.5a — Beam parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `bim/walls/wall-grips.ts` (Phase 1C) και exposes τα grips που
 * περιγράφει το ADR-363 §6 Phase 5.5a:
 *
 *   - `beam-start`     → translate axis start endpoint (no other params change)
 *   - `beam-end`       → translate axis end endpoint
 *   - `beam-midpoint`  → translate whole beam (axis midpoint anchor, moves
 *                        startPoint + endPoint + curveControl όπου υπάρχει)
 *   - `beam-curve`     → move quadratic Bezier control point (curved kind only).
 *                        Όταν `curveControl === undefined`, seed στο axis
 *                        midpoint και applies το delta (mirrors wall pattern).
 *
 * SSoT:
 *   - Geometry math via `computeBeamGeometry()` (called by
 *     `UpdateBeamParamsCommand` at commit time — this module returns ONLY new
 *     `BeamParams`).
 *   - Grip wire-up via the unified grip system (`BeamRenderer.getGrips`).
 *
 * Phase 5.5a scope deliberately ΔΕΝ περιλαμβάνει width/depth dimension grips
 * — αυτά αναβάλλονται για Phase 5.5b (mirror του wall-thickness handle αλλά
 * με 2 διαστάσεις).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5.5a
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, BeamGripKind } from '../../hooks/useGripMovement';
import type { BeamEntity, BeamParams } from '../types/beam-types';
import type { Point3D } from '../types/bim-base';

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
