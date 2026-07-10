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
  Polygon3D,
  Polyline3D,
  Segment3D,
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
} from './stair-geometry-shared';
import {
  type FlightGeometry,
  assembleMultiFlight,
  buildFlightFromEdge,
  buildRectilinearFlight,
} from './stair-geometry-generators';
import {
  type BalancedWinderRule,
  computeBalancedWinderRule,
  radialEdgeIntersect,
} from './stair-winder-walkline-rule';

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
 * ADR-630 Phase 2 — **balanced / dancing winders**. `computeBalancedWinderRule`
 * distributes the turn so every band tread keeps equal walkline going; the
 * wedges reach the inner corner P (no gap) and the two flight-end treads become
 * transition trapezoids that share their P→outer edge with the neighbouring
 * wedge (`junctionOuters`). Winder method is validated by the callers via
 * `assertWinderMethodSupported`; it no longer changes the wedge shape.
 */
export function assembleWinderRun(
  params: Readonly<StairParams>,
  layout: WinderLayout,
  arrow: (walkline: Polyline3D) => StairArrowSymbol,
): StairGeometry {
  const rule = computeBalancedWinderRule({
    turnRad: layout.signedSweepRad * layout.winderCount,
    winderCount: layout.winderCount,
    tread: params.tread,
    walklineRadius: params.width * 0.5,
  });
  const junctions = computeJunctionOuters(params, layout, rule);
  const flight1 = buildWinderFlight1(params, layout, rule, junctions.flight1);
  const winders = buildWinderTreads(params, layout, rule, junctions);
  const flight2 = buildWinderFlight2(params, layout, rule, junctions.flight2);
  const allTreads: readonly Polygon3D[] = [
    ...flight1.treads,
    ...winders,
    ...flight2.treads,
  ];
  const risers: readonly Segment3D[] = [...flight1.risers, ...flight2.risers];
  const walkline = buildWinderWalkline(params, layout);
  const midRay = rotateVec(layout.ray0, (layout.winderCount / 2) * layout.signedSweepRad);
  const midTangent = winderTangentAt(midRay, layout.turnSign);
  return assembleMultiFlight(params, {
    treads: allTreads,
    risers,
    walkline,
    cutDirs: [layout.u1, midTangent, layout.u2],
    flightSplit: [layout.n1, layout.winderCount, layout.n2],
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

/**
 * ADR-630 Phase 2 — the two junction outer points where the balanced winder fan
 * meets the straight flight outer edges. Both the wedges and the transition
 * trapezoids anchor their shared P→outer edge here, so the corner tiles with no
 * sliver regardless of the encroachment sign.
 */
interface JunctionOuters {
  readonly flight1: Vec2;
  readonly flight2: Vec2;
}

export function computeJunctionOuters(
  params: Readonly<StairParams>,
  layout: WinderLayout,
  rule: BalancedWinderRule,
): JunctionOuters {
  const { basePoint, width } = params;
  const { u1, u2, v1, ray0, pivotXY, turnSign, signedSweepRad, winderCount } = layout;
  const halfW = width * 0.5;
  const dirBack1 = rotateVec(ray0, rule.startAngleRad);
  const dirFront2 = rotateVec(ray0, rule.startAngleRad + winderCount * rule.winderSweepRad);
  // Flight-1 outer edge = the width edge opposite the pivot (−turnSign·v1 side).
  const f1OuterPt: Vec2 = {
    x: basePoint.x - v1.x * turnSign * halfW,
    y: basePoint.y - v1.y * turnSign * halfW,
  };
  // Flight-2 outer edge = the far corner of the pivot edge along u2.
  const widthAxis = rotateVec(ray0, signedSweepRad * winderCount);
  const f2OuterPt: Vec2 = {
    x: pivotXY.x + widthAxis.x * width,
    y: pivotXY.y + widthAxis.y * width,
  };
  return {
    flight1: radialEdgeIntersect(pivotXY, dirBack1, f1OuterPt, u1),
    flight2: radialEdgeIntersect(pivotXY, dirFront2, f2OuterPt, u2),
  };
}

/**
 * Flight 1: rectilinear treads from the centreline base point along `u1`; the
 * LAST tread is reshaped into a balanced transition trapezoid (perpendicular
 * back edge, radial front edge from the pivot P). ADR-611 — the straight treads
 * delegate to the shared `buildRectilinearFlight` generator.
 */
export function buildWinderFlight1(
  params: Readonly<StairParams>,
  layout: WinderLayout,
  rule: BalancedWinderRule,
  frontOuter: Vec2,
): FlightGeometry {
  const flight = buildRectilinearFlight(
    params.basePoint, layout.u1, params.rise, params.tread, params.nosing, params.width, layout.n1,
  );
  if (layout.n1 <= 0 || layout.winderCount <= 0 || rule.winderSweepRad === 0) return flight;
  const { basePoint, rise, tread, width } = params;
  const { u1, v1, pivotXY, turnSign, n1 } = layout;
  const halfW = width * 0.5;
  const along = tread * (n1 - 1);
  const z = basePoint.z + rise * (n1 - 1);
  const backOuter: Vec2 = {
    x: basePoint.x + u1.x * along - v1.x * turnSign * halfW,
    y: basePoint.y + u1.y * along - v1.y * turnSign * halfW,
  };
  const backInner: Vec2 = {
    x: basePoint.x + u1.x * along + v1.x * turnSign * halfW,
    y: basePoint.y + u1.y * along + v1.y * turnSign * halfW,
  };
  const treads = [...flight.treads];
  treads[n1 - 1] = liftCCW([backOuter, frontOuter, pivotXY, backInner], z);
  return { treads, risers: flight.risers };
}

/**
 * ADR-630 Phase 2 — balanced winder wedges. Each wedge is a triangle from the
 * pivot P (reaching the inner corner, no gap). The two end wedges land their
 * encroaching outer vertex on the flight edge (`junctions`) so the P→outer edge
 * is shared with the neighbouring transition trapezoid.
 */
export function buildWinderTreads(
  params: Readonly<StairParams>,
  layout: WinderLayout,
  rule: BalancedWinderRule,
  junctions: JunctionOuters,
): readonly Polygon3D[] {
  const { basePoint, rise, width } = params;
  const { pivotXY, ray0, turnSign, n1, winderCount } = layout;
  const out: Polygon3D[] = new Array(winderCount);
  for (let i = 0; i < winderCount; i++) {
    const rayA = rotateVec(ray0, rule.startAngleRad + i * rule.winderSweepRad);
    const rayB = rotateVec(ray0, rule.startAngleRad + (i + 1) * rule.winderSweepRad);
    const outerA: Vec2 = i === 0
      ? junctions.flight1
      : { x: pivotXY.x + width * rayA.x, y: pivotXY.y + width * rayA.y };
    const outerB: Vec2 = i === winderCount - 1
      ? junctions.flight2
      : { x: pivotXY.x + width * rayB.x, y: pivotXY.y + width * rayB.y };
    const z = basePoint.z + rise * (n1 + i);
    out[i] = turnSign === 1
      ? liftPoly([pivotXY, outerA, outerB], z)
      : liftPoly([pivotXY, outerB, outerA], z);
  }
  return out;
}

/**
 * Flight 2: rectilinear treads from the pivot edge along `u2`; the FIRST tread
 * is reshaped into a balanced transition trapezoid (its pivot-edge outer corner
 * moves onto the last winder's front radial). ADR-611 — the straight treads
 * delegate to the shared `buildFlightFromEdge` generator.
 */
export function buildWinderFlight2(
  params: Readonly<StairParams>,
  layout: WinderLayout,
  rule: BalancedWinderRule,
  backOuter: Vec2,
): FlightGeometry {
  const { pivotXY, u2, ray0, signedSweepRad, n1, n2, winderCount } = layout;
  // Width axis = ray_winderCount (trailing winder boundary direction).
  // 90° turn → widthAxis ≈ u1; 180° turn → widthAxis = ±v1.
  const widthAxis = rotateVec(ray0, signedSweepRad * winderCount);
  const flight = buildFlightFromEdge(
    pivotXY, u2, widthAxis, params.rise, params.tread, params.nosing, params.width, n2,
    params.basePoint.z + params.rise * (n1 + winderCount),
  );
  if (n2 <= 0 || winderCount <= 0 || rule.winderSweepRad === 0) return flight;
  const first = flight.treads[0];
  const z = first[0].z;
  const treads = [...flight.treads];
  // Replace the pivot-edge outer corner (index 3) with the balanced front radial.
  treads[0] = [first[0], first[1], first[2], point(backOuter.x, backOuter.y, z)];
  return { treads, risers: flight.risers };
}

/** Lift 2-D vertices to a `Polygon3D` at fixed `z` (winding preserved). */
function liftPoly(pts: readonly Vec2[], z: number): Polygon3D {
  return pts.map((p) => point(p.x, p.y, z));
}

/** Lift 2-D vertices to a `Polygon3D` at fixed `z`, forcing CCW winding. */
function liftCCW(pts: readonly Vec2[], z: number): Polygon3D {
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  const ordered = area2 < 0 ? [...pts].reverse() : pts;
  return liftPoly(ordered, z);
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

export function rotateVec(v: Vec2, angleRad: number): Vec2 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export function winderTangentAt(ray: Vec2, turnSign: 1 | -1): Vec2 {
  // d/dθ rotate(ray_0, θ) = rotate(ray_0, θ + π/2). Sign flips for cw sweep.
  return turnSign === 1 ? { x: -ray.y, y: ray.x } : { x: ray.y, y: -ray.x };
}
