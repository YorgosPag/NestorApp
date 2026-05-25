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
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  Polyline3D,
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantWinder,
  StairWinderMethod,
} from '../../../bim/types/stair-types';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  perp,
  directionToUnitVector,
  point,
  arrowSymbol,
  bboxOfPolygons,
  splitTreadsByCutPlane,
  buildCutLineForFlights,
  buildStringersFromWalkline,
  buildHandrailsFromParams,
} from './stair-geometry-shared';
import { buildTreadLabels } from './stair-geometry-labels';

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
  const flight1 = buildWinderFlight1(params, layout);
  const winders = buildWinderTreads(params, variant.winderMethod, layout);
  const flight2 = buildWinderFlight2(params, layout);
  const allTreads: readonly Polygon3D[] = [
    ...flight1.treads,
    ...winders,
    ...flight2.treads,
  ];
  const risers: readonly Segment3D[] = [...flight1.risers, ...flight2.risers];
  const walkline = buildWinderWalkline(params, layout);
  const stringers = buildStringersFromWalkline(walkline, params.width);
  const arrow = arrowSymbol(params.basePoint, walkline[walkline.length - 1], params.upDirection);
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(allTreads, cutPlaneHeight);
  const midRay = rotateVec(layout.ray0, (layout.winderCount / 2) * layout.signedSweepRad);
  const midTangent = winderTangentAt(midRay, layout.turnSign);
  const cutLine = buildCutLineForFlights(
    allTreads,
    [layout.n1, layout.winderCount, layout.n2],
    [layout.u1, midTangent, layout.u2],
    params.width,
    cutPlaneHeight,
  );
  const treadLabels = buildTreadLabels(
    allTreads,
    [layout.n1, layout.winderCount, layout.n2],
    params.treadLabelDisplay,
    params.treadLabelEveryN,
    params.treadLabelRestartPerFlight,
    params.treadNumberStart,
  );
  return {
    treads: split.below,
    treadsBelowCut: split.below,
    treadsAboveCut: split.above,
    risers,
    stringers,
    walkline,
    handrails: buildHandrailsFromParams(walkline, params.width, params.handrails),
    landings: [],
    arrowSymbol: arrow,
    cutLine,
    treadLabels,
    bbox: bboxOfPolygons(allTreads),
  };
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

export function buildWinderFlight1(
  params: Readonly<StairParams>,
  layout: WinderLayout,
): { readonly treads: readonly Polygon3D[]; readonly risers: readonly Segment3D[] } {
  const { basePoint, rise, tread, nosing, width } = params;
  const { u1, v1, n1 } = layout;
  const halfW = width * 0.5;
  const depth = tread + nosing;
  const treads: Polygon3D[] = new Array(n1);
  for (let i = 0; i < n1; i++) {
    const ox = basePoint.x + u1.x * (tread * i) - v1.x * halfW;
    const oy = basePoint.y + u1.y * (tread * i) - v1.y * halfW;
    const tz = basePoint.z + rise * i;
    treads[i] = [
      point(ox, oy, tz),
      point(ox + u1.x * depth, oy + u1.y * depth, tz),
      point(ox + u1.x * depth + v1.x * width, oy + u1.y * depth + v1.y * width, tz),
      point(ox + v1.x * width, oy + v1.y * width, tz),
    ];
  }
  const risers: Segment3D[] = [];
  for (let i = 0; i < n1 - 1; i++) {
    const along = tread * (i + 1);
    const cx = basePoint.x + u1.x * along - v1.x * halfW;
    const cy = basePoint.y + u1.y * along - v1.y * halfW;
    // ADR-370 Phase 5.3 — diagonal Segment3D (see StairGeometryService.buildStraightRisers).
    risers.push({
      start: point(cx, cy, basePoint.z + rise * i),
      end: point(cx + v1.x * width, cy + v1.y * width, basePoint.z + rise * (i + 1)),
    });
  }
  return { treads, risers };
}

export function buildWinderTreads(
  params: Readonly<StairParams>,
  winderMethod: StairWinderMethod,
  layout: WinderLayout,
): readonly Polygon3D[] {
  const { basePoint, rise, width } = params;
  const { pivotXY, ray0, signedSweepRad, turnSign, n1, winderCount } = layout;
  const out: Polygon3D[] = new Array(winderCount);
  for (let i = 0; i < winderCount; i++) {
    const rayA = rotateVec(ray0, i * signedSweepRad);
    const rayB = rotateVec(ray0, (i + 1) * signedSweepRad);
    const tz = basePoint.z + rise * (n1 + i);
    const apex = point(pivotXY.x, pivotXY.y, tz);
    const outerA = point(pivotXY.x + width * rayA.x, pivotXY.y + width * rayA.y, tz);
    const outerB = point(pivotXY.x + width * rayB.x, pivotXY.y + width * rayB.y, tz);
    if (winderMethod === 'pie') {
      out[i] = turnSign === 1 ? [apex, outerA, outerB] : [apex, outerB, outerA];
    } else {
      out[i] = turnSign === 1
        ? [apex, outerA, outerB, apex]
        : [apex, outerB, outerA, apex];
    }
  }
  return out;
}

export function buildWinderFlight2(
  params: Readonly<StairParams>,
  layout: WinderLayout,
): { readonly treads: readonly Polygon3D[]; readonly risers: readonly Segment3D[] } {
  const { basePoint, rise, tread, nosing, width } = params;
  const { u2, pivotXY, ray0, signedSweepRad, n1, n2, winderCount } = layout;
  const depth = tread + nosing;
  // Width axis = ray_winderCount (trailing winder boundary direction).
  // 90° turn → widthAxis ≈ u1; 180° turn → widthAxis = ±v1.
  const widthAxis = rotateVec(ray0, signedSweepRad * winderCount);
  const treads: Polygon3D[] = new Array(n2);
  for (let i = 0; i < n2; i++) {
    const ox = pivotXY.x + u2.x * (tread * i);
    const oy = pivotXY.y + u2.y * (tread * i);
    const tz = basePoint.z + rise * (n1 + winderCount + i);
    treads[i] = [
      point(ox, oy, tz),
      point(ox + u2.x * depth, oy + u2.y * depth, tz),
      point(ox + u2.x * depth + widthAxis.x * width, oy + u2.y * depth + widthAxis.y * width, tz),
      point(ox + widthAxis.x * width, oy + widthAxis.y * width, tz),
    ];
  }
  const risers: Segment3D[] = [];
  for (let i = 0; i < n2 - 1; i++) {
    const along = (i + 1) * tread;
    const cx = pivotXY.x + u2.x * along;
    const cy = pivotXY.y + u2.y * along;
    // ADR-370 Phase 5.3 — diagonal Segment3D. Flight 2 width axis = widthAxis
    // (trailing winder boundary), pivotXY is the near edge, far edge at +widthAxis·width.
    risers.push({
      start: point(cx, cy, basePoint.z + rise * (n1 + winderCount + i)),
      end: point(cx + widthAxis.x * width, cy + widthAxis.y * width, basePoint.z + rise * (n1 + winderCount + i + 1)),
    });
  }
  return { treads, risers };
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
