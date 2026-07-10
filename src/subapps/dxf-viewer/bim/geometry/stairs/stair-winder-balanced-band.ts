/**
 * Balanced winder band — SSoT for the k≥1 "dancing steps" turn (ADR-630 Phase 2b).
 *
 * The turn region (last `k` treads of flight 1 + `W` winders + first `k` treads
 * of flight 2) is rebuilt as ONE balanced band of `M = W + 2k` treads that all
 * share equal walkline going, with the risers **swung gradually** from
 * perpendicular (flight side) to radial (corner) — the classic balanced /
 * dancing-winder construction (Revit default, continental-EU / ΝΟΚ practice).
 *
 * Construction (plan view, pivot P at the inner corner, R = width/2):
 *   - Band walkline = straight1 tail (k·t) + arc(R about P, angle Θ) + straight2
 *     head (k·t). Its total length `S = 2·k·t + R·Θ` is divided into `M` EQUAL
 *     goings `g = S/M`; a riser sits at every mark.
 *   - Each riser is perpendicular to the walkline tangent and runs from the
 *     INNER boundary (flight-1 inner edge → corner P → flight-2 inner edge) to
 *     the OUTER boundary (flight-1 outer edge → circle radius `width` → flight-2
 *     outer edge). In the arc the riser is radial → passes through P, so the
 *     wedges reach the corner (no hole); in the straights it is perpendicular;
 *     across the junction the swing is gradual → "dancing".
 *   - The band occupies EXACTLY the footprint of the `k+W+k` treads it replaces,
 *     so the pure flights (first `n1−k`, last `n2−k`) are untouched — zero
 *     ripple. Only the band's straight treads shrink from `t` to `g` (the small,
 *     graduated transition), which is what keeps the turn uniform.
 *
 * `k` is chosen automatically (`computeBalancedBandPlan`): 1 transition tread per
 * side, widened to 2 when the equal going is more than 3 % off the straight
 * tread (the "spread to steps 6/12" case). `k = 0` (very short flights) falls
 * back to a pure fan of `W` wedges reaching P — still no hole.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-630-winder-walkline-rule.md
 */

import type { Point3D } from '../../../rendering/types/Types';
import type { Polygon3D, Segment3D } from '../../../bim/types/stair-types';
import { type Vec2, point, rotateVec } from './stair-geometry-shared';
import {
  type FlightGeometry,
  buildFlightFromEdge,
  buildRectilinearFlight,
} from './stair-geometry-generators';

const BAND_EPS = 1e-6;
/** Max transition treads per side (k). k=2 = "also make steps 6 & 12 trapezoidal". */
const MAX_BAND_STEPS_PER_SIDE = 2;
/** Widen the band while the equal going is more than this fraction off `tread`. */
const BAND_GOING_TOL = 0.03;

export interface BalancedBandInput {
  readonly basePoint: Readonly<Point3D>;
  readonly u1: Vec2;
  readonly v1: Vec2;
  readonly u2: Vec2;
  readonly ray0: Vec2;
  readonly pivotXY: Vec2;
  readonly turnSign: 1 | -1;
  /** Signed total turn (radians). */
  readonly turnRad: number;
  readonly width: number;
  readonly tread: number;
  readonly nosing: number;
  readonly rise: number;
  readonly n1: number;
  readonly n2: number;
  readonly winderCount: number;
}

export interface BalancedBandPlan {
  /** Transition treads per side (0 = pure fan, no flights to borrow from). */
  readonly bandStepsPerSide: number;
  /** Equal walkline going shared by every band tread. */
  readonly walklineGoing: number;
  /** Total band treads `M = W + 2k`. */
  readonly totalBandSteps: number;
}

export interface BalancedWinderRunGeometry {
  readonly treads: readonly Polygon3D[];
  readonly risers: readonly Segment3D[];
  /** `[n1−k, M, n2−k]` for label numbering + cut-line flight boundaries. */
  readonly flightSplit: readonly [number, number, number];
  readonly plan: BalancedBandPlan;
}

/**
 * Choose `k` and the equal going. Widen from 1 to `MAX_BAND_STEPS_PER_SIDE` until
 * the going is within `BAND_GOING_TOL` of the straight tread; `k = 0` when there
 * is no flight tread to borrow (pure fan going `R·Θ/W`).
 */
export function computeBalancedBandPlan(input: {
  readonly turnRad: number;
  readonly winderCount: number;
  readonly tread: number;
  readonly walklineRadius: number;
  readonly n1: number;
  readonly n2: number;
}): BalancedBandPlan {
  const w = Math.max(0, Math.floor(input.winderCount));
  const turnMag = Math.abs(input.turnRad);
  const r = Math.max(BAND_EPS, input.walklineRadius);
  const t = Math.max(0, input.tread);
  const kMax = Math.min(input.n1 - 1, input.n2 - 1, MAX_BAND_STEPS_PER_SIDE);
  const going = (k: number): number => (2 * k * t + r * turnMag) / (w + 2 * k);
  if (w === 0 || turnMag < BAND_EPS || kMax < 1) {
    return {
      bandStepsPerSide: 0,
      walklineGoing: w > 0 ? (r * turnMag) / w : t,
      totalBandSteps: w,
    };
  }
  let chosen = kMax;
  for (let k = 1; k <= kMax; k++) {
    if (t <= BAND_EPS || Math.abs(t - going(k)) / t <= BAND_GOING_TOL) {
      chosen = k;
      break;
    }
  }
  return { bandStepsPerSide: chosen, walklineGoing: going(chosen), totalBandSteps: w + 2 * chosen };
}

// ─── One riser sample along the band walkline ─────────────────────────────────

type BandZone = 'A' | 'B' | 'C';

interface RiserSample {
  readonly inner: Vec2;
  readonly outer: Vec2;
  readonly zone: BandZone;
}

/**
 * Assemble the full winder run (pure flight 1 + balanced band + pure flight 2)
 * as one tread + riser list. Reaches the pivot P at the corner (no hole) and
 * keeps equal walkline going across the band.
 */
export function buildBalancedWinderRun(input: BalancedBandInput): BalancedWinderRunGeometry {
  const { basePoint, u1, u2, width, tread, nosing, rise, n1, n2, winderCount } = input;
  const plan = computeBalancedBandPlan({
    turnRad: input.turnRad,
    winderCount,
    tread,
    walklineRadius: width * 0.5,
    n1,
    n2,
  });
  const k = plan.bandStepsPerSide;
  const widthAxis = rotateVec(input.ray0, input.turnRad);

  const flight1 = buildRectilinearFlight(basePoint, u1, rise, tread, nosing, width, n1 - k);
  const band = buildBand(input, plan, widthAxis);
  const flight2Origin: Vec2 = {
    x: input.pivotXY.x + u2.x * (k * tread),
    y: input.pivotXY.y + u2.y * (k * tread),
  };
  const flight2 = buildFlightFromEdge(
    flight2Origin, u2, widthAxis, rise, tread, nosing, width, n2 - k,
    basePoint.z + rise * (n1 + winderCount + k),
  );

  return {
    treads: [...flight1.treads, ...band.treads, ...flight2.treads],
    risers: [...flight1.risers, ...band.risers, ...flight2.risers],
    flightSplit: [n1 - k, plan.totalBandSteps, n2 - k],
    plan,
  };
}

// ─── Band interior ────────────────────────────────────────────────────────────

function buildBand(
  input: BalancedBandInput,
  plan: BalancedBandPlan,
  widthAxis: Vec2,
): FlightGeometry {
  const { basePoint, width, tread, rise, n1 } = input;
  const k = plan.bandStepsPerSide;
  const m = plan.totalBandSteps;
  if (m <= 0) return { treads: [], risers: [] };
  const halfW = width * 0.5;
  const bandStartAlong = (n1 - k) * tread;
  const zoneAEnd = k * tread;
  const zoneBEnd = zoneAEnd + halfW * Math.abs(input.turnRad);
  const g = plan.walklineGoing;
  const t1Outer = add(input.pivotXY, input.ray0, width); // outer tangent (arc start)
  const t2Outer = add(input.pivotXY, widthAxis, width);  // outer tangent (arc end)

  const samples: RiserSample[] = [];
  for (let j = 0; j <= m; j++) {
    samples.push(sampleRiser(input, widthAxis, j * g, bandStartAlong, zoneAEnd, zoneBEnd, halfW));
  }

  const treads: Polygon3D[] = [];
  const risers: Segment3D[] = [];
  for (let j = 0; j < m; j++) {
    const a = samples[j];
    const b = samples[j + 1];
    const z = basePoint.z + rise * (n1 - k + j);
    const outerSeam = seamPoint(a.zone, b.zone, t1Outer, t2Outer);
    const ring: Vec2[] = outerSeam
      ? [a.inner, a.outer, outerSeam, b.outer, b.inner]
      : [a.inner, a.outer, b.outer, b.inner];
    treads.push(liftCCW(dedupe(ring), z));
  }
  for (let j = 1; j < m; j++) {
    risers.push({
      start: point(samples[j].inner.x, samples[j].inner.y, basePoint.z + rise * (n1 - k + j - 1)),
      end: point(samples[j].outer.x, samples[j].outer.y, basePoint.z + rise * (n1 - k + j)),
    });
  }
  return { treads, risers };
}

function sampleRiser(
  input: BalancedBandInput,
  widthAxis: Vec2,
  s: number,
  bandStartAlong: number,
  zoneAEnd: number,
  zoneBEnd: number,
  halfW: number,
): RiserSample {
  const { basePoint, u1, u2, v1, ray0, pivotXY, turnSign, width } = input;
  if (zoneAEnd > BAND_EPS && s <= zoneAEnd + BAND_EPS) {
    const along = bandStartAlong + s;
    const center: Vec2 = { x: basePoint.x + u1.x * along, y: basePoint.y + u1.y * along };
    return {
      inner: { x: center.x + v1.x * turnSign * halfW, y: center.y + v1.y * turnSign * halfW },
      outer: { x: center.x - v1.x * turnSign * halfW, y: center.y - v1.y * turnSign * halfW },
      zone: 'A',
    };
  }
  if (s <= zoneBEnd + BAND_EPS) {
    const angle = ((s - zoneAEnd) / halfW) * turnSign;
    const ray = rotateVec(ray0, angle);
    return { inner: pivotXY, outer: add(pivotXY, ray, width), zone: 'B' };
  }
  const sC = s - zoneBEnd;
  const t2: Vec2 = add(pivotXY, widthAxis, halfW);
  const center: Vec2 = { x: t2.x + u2.x * sC, y: t2.y + u2.y * sC };
  return {
    inner: { x: center.x - widthAxis.x * halfW, y: center.y - widthAxis.y * halfW },
    outer: { x: center.x + widthAxis.x * halfW, y: center.y + widthAxis.y * halfW },
    zone: 'C',
  };
}

/** Outer boundary tangent point when a tread straddles a straight↔arc junction. */
function seamPoint(za: BandZone, zb: BandZone, t1Outer: Vec2, t2Outer: Vec2): Vec2 | null {
  if (za === 'A' && zb === 'B') return t1Outer;
  if (za === 'B' && zb === 'C') return t2Outer;
  return null;
}

// ─── Small vec / polygon helpers ──────────────────────────────────────────────

function add(p: Vec2, dir: Vec2, s: number): Vec2 {
  return { x: p.x + dir.x * s, y: p.y + dir.y * s };
}

/** Drop consecutive coincident vertices (winder wedges collapse to triangles). */
function dedupe(pts: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > BAND_EPS) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && Math.hypot(first.x - last.x, first.y - last.y) <= BAND_EPS) {
    out.pop();
  }
  return out;
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
  return ordered.map((p) => point(p.x, p.y, z));
}
