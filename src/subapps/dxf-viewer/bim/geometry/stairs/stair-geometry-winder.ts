/**
 * Winder stair geometry — ADR-358 Phase 4b.
 *
 * Three-zone layout:
 *   Flight 1 (n1 rectilinear treads along u1) → Winder zone (`winderCount`
 *   wedges rotating by `turnAngle`) → Flight 2 (n2 rectilinear treads along
 *   u2 = rotate(u1, turnAngle)).
 *
 * `stepCount = n1 + winderCount + n2`. Straight flight count distributed as
 * `n1 = floor((stepCount − winderCount)/2)`, `n2 = remainder`.
 *
 * Pivot (corner between flight 1 and flight 2) sits on the inner side of the
 * L turn at `pivot = basePoint + u1·(n1·tread) + v1·(turnSign·halfW)` where
 * `turnSign = sign(turnAngle)`. Winder treads fan out from the pivot.
 *
 * Phase 4b implements `winderMethod ∈ {'equal-going', 'pie'}` (industry-most-
 * common pair). `'kite'` and `'balanced'` throw a `Phase 4c` sentinel.
 *
 * Conventions:
 *   - Plan view: +X right, +Y up.
 *   - z progression: tread i at z = i·rise for ALL treads (flight 1, winder,
 *     flight 2) — no landing inserts an extra rise.
 *   - Outer radius of winder wedges = `params.width`.
 *   - Walkline radius from pivot = `width/2`.
 *   - Risers within each straight flight only — winder risers degenerate at
 *     pivot and are omitted.
 *
 * ADR-611 — the two rectilinear flights delegate to shared generators
 * (`buildRectilinearFlight` / `buildFlightFromEdge`) and the `StairGeometry`
 * assembly tail comes from `stair-geometry-generators.ts`. The winder-zone
 * helpers stay local (fan geometry is unique to this kind) and remain exported
 * for the l-shape-with-winders variant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polyline3D,
  StairArrowSymbol,
  StairGeometry,
  StairParams,
  StairVariantWinder,
  StairWinderMethod,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  perp,
  directionToUnitVector,
  point,
  arrowSymbol,
  rotateVec,
} from './stair-geometry-shared';
import { assembleMultiFlight } from './stair-geometry-generators';
import { buildBalancedWinderRun } from './stair-winder-balanced-band';
import { resolveWinderMinimums } from './stair-winder-walkline-rule';

const DEG2RAD = Math.PI / 180;

/**
 * ADR-358 Phase 3f export — l-shape with winders reuses this layout.
 * Caller (l-shape) supplies user-controlled `n1`/`n2`; winder kind computes
 * them from `stepCount − winderCount` symmetrically.
 */
export interface WinderLayout {
  readonly turnSign: 1 | -1;
  readonly n1: number;
  readonly n2: number;
  readonly winderCount: number;
  readonly u1: Vec2;
  readonly v1: Vec2;
  readonly u2: Vec2;
  readonly pivotXY: { readonly x: number; readonly y: number };
  readonly ray0: Vec2;
  readonly signedSweepRad: number;
}

// ─── WINDER entry ─────────────────────────────────────────────────────────────

export function computeWinder(
  params: Readonly<StairParams>,
  variant: StairVariantWinder,
): StairGeometry {
  assertWinderMethodSupported(variant.winderMethod);
  // Winder kind auto-computes n1/n2 symmetrically; l-shape with winders
  // passes user-controlled values via `buildWinderLayout` directly (Phase 3f).
  const remaining = Math.max(0, params.stepCount - variant.winderCount);
  const n1 = Math.floor(remaining / 2);
  const n2 = remaining - n1;
  const layout = buildWinderLayout(params, variant.turnAngle, variant.winderCount, n1, n2);
  return assembleWinderRun(params, layout,
    (wl) => arrowSymbol(params.basePoint, wl[wl.length - 1], params.upDirection));
}

/**
 * ADR-611 SSoT — assemble a full winder-zone `StairGeometry` from a
 * `WinderLayout`. Shared by the winder kind (arrow = base→top) and
 * l-shape-with-winders (arrow = first walkline segment); the caller supplies
 * the up-arrow via `arrow(walkline)`.
 *
 * ADR-630 Phase 2 — **balanced / dancing winders**. `buildBalancedWinderRun`
 * distributes the turn over the winders + `k` transition treads per side (auto,
 * "dancing steps") so every band tread keeps equal walkline going; the wedges
 * reach the inner corner P (no gap) and the transition treads swing their risers
 * gradually from perpendicular to radial. Winder method is validated by the
 * callers via `assertWinderMethodSupported`; it no longer changes the shape.
 */
export function assembleWinderRun(
  params: Readonly<StairParams>,
  layout: WinderLayout,
  arrow: (walkline: Polyline3D) => StairArrowSymbol,
): StairGeometry {
  const run = buildBalancedWinderRun({
    basePoint: params.basePoint,
    u1: layout.u1,
    v1: layout.v1,
    u2: layout.u2,
    ray0: layout.ray0,
    pivotXY: layout.pivotXY,
    turnSign: layout.turnSign,
    turnRad: layout.signedSweepRad * layout.winderCount,
    width: params.width,
    tread: params.tread,
    nosing: params.nosing,
    rise: params.rise,
    n1: layout.n1,
    n2: layout.n2,
    winderCount: layout.winderCount,
    // ADR-630 Φ2c — newel / min-inner radius from the stair's code profile (ΝΟΚ
    // 130mm etc.); resolved into `width`'s unit system by the walkline-rule SSoT.
    minInnerGoing: resolveWinderMinimums(params.codeProfile, params.width).minInnerGoing,
  });
  const walkline = buildWinderWalkline(params, layout);
  const midRay = rotateVec(layout.ray0, (layout.winderCount / 2) * layout.signedSweepRad);
  const midTangent = winderTangentAt(midRay, layout.turnSign);
  // ADR-630 Φ2c — the newel core is appended AFTER the numbered treads so it fills
  // the inner corner up to the pivot P (the wedges themselves stop on the `r_in`
  // arc, no acute miter). It rides the `treads` channel — the only one the 2D
  // `StairRenderer` fills — but sits past `Σ flightSplit`, so `buildTreadLabels`
  // never numbers it (winder steps stay 1..N) and the 3D converter extrudes it as
  // a corner slab. No hole, no acute tip, numbering intact.
  const treads = run.newelCore ? [...run.treads, run.newelCore] : run.treads;
  return assembleMultiFlight(params, {
    treads,
    risers: run.risers,
    walkline,
    cutDirs: [layout.u1, midTangent, layout.u2],
    flightSplit: run.flightSplit,
    arrowSymbol: arrow(walkline),
  });
}

// ─── WINDER private helpers ───────────────────────────────────────────────────

export function assertWinderMethodSupported(method: StairWinderMethod): void {
  if (method === 'kite' || method === 'balanced') {
    throw new Error(
      `StairGeometryService: winderMethod '${method}' not implemented yet (Phase 4c)`,
    );
  }
}

/**
 * ADR-358 Phase 3f export — `n1`/`n2` supplied by caller (l-shape passes
 * user-controlled `flightSplit`, winder kind computes them symmetrically).
 */
export function buildWinderLayout(
  params: Readonly<StairParams>,
  turnAngleDeg: number,
  winderCount: number,
  n1: number,
  n2: number,
): WinderLayout {
  const u1 = directionToUnitVector(params.direction);
  const v1 = perp(u1);
  const turnSign: 1 | -1 = turnAngleDeg >= 0 ? 1 : -1;
  const turnRad = turnAngleDeg * DEG2RAD;
  const u2 = rotateVec(u1, turnRad);
  const halfW = params.width * 0.5;
  const pivotXY = {
    x: params.basePoint.x + u1.x * (n1 * params.tread) + v1.x * (turnSign * halfW),
    y: params.basePoint.y + u1.y * (n1 * params.tread) + v1.y * (turnSign * halfW),
  };
  const ray0: Vec2 = { x: -turnSign * v1.x, y: -turnSign * v1.y };
  const signedSweepRad = winderCount > 0 ? turnRad / winderCount : 0;
  return {
    turnSign,
    n1,
    n2,
    winderCount,
    u1,
    v1,
    u2,
    pivotXY,
    ray0,
    signedSweepRad,
  };
}

export function buildWinderWalkline(
  params: Readonly<StairParams>,
  layout: WinderLayout,
): Polyline3D {
  const { basePoint, rise, tread, width } = params;
  const { u2, pivotXY, ray0, signedSweepRad, n1, n2, winderCount } = layout;
  const halfW = width * 0.5;
  const out: Point3D[] = [];
  out.push(point(basePoint.x, basePoint.y, basePoint.z));
  // Winder samples j=0..winderCount. j=0 coincides with flight-1 end centerline.
  for (let j = 0; j <= winderCount; j++) {
    const ray = rotateVec(ray0, j * signedSweepRad);
    out.push(point(
      pivotXY.x + halfW * ray.x,
      pivotXY.y + halfW * ray.y,
      basePoint.z + rise * (n1 + j),
    ));
  }
  if (n2 > 0) {
    const last = out[out.length - 1];
    out.push(point(
      last.x + u2.x * (n2 * tread),
      last.y + u2.y * (n2 * tread),
      basePoint.z + rise * params.stepCount,
    ));
  }
  return out;
}

// ─── Vec utilities ────────────────────────────────────────────────────────────

export function winderTangentAt(ray: Vec2, turnSign: 1 | -1): Vec2 {
  // d/dθ rotate(ray_0, θ) = rotate(ray_0, θ + π/2). Sign flips for cw sweep.
  return turnSign === 1 ? { x: -ray.y, y: ray.x } : { x: ray.y, y: -ray.x };
}
