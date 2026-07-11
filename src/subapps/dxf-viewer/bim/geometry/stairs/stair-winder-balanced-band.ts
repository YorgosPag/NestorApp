/**
 * Balanced "dancing" winder band — SSoT for the direction-changing turn
 * (ADR-630 Phase 2c: spread inner ends — risers directed to different points).
 *
 * The turn region (last `k` treads of flight 1 + `W` winders + first `k` treads
 * of flight 2) is rebuilt as ONE balanced band of `M = W + 2k` treads that all
 * share equal walkline going — the classic balanced / dancing-winder construction
 * (Revit, ArchiCAD, French drafting method, US Patent 6,845,595).
 *
 * Construction (plan view, pivot P at the inner corner, R = width/2):
 *   - Band walkline = straight1 tail (k·t) + arc(R about P, angle Θ) + straight2
 *     head (k·t). Its total length `S = 2·k·t + R·Θ` is divided into `M` EQUAL
 *     goings `g = S/M`; a walkline mark sits at every riser.
 *   - OUTER end of each riser: flight-1 outer edge → circle radius `width` about P
 *     → flight-2 outer edge (perpendicular on the straights, radial on the arc).
 *   - INNER end of each riser sits on the reflex L boundary
 *     `flight-1 inner edge → P → flight-2 inner edge`, but the ends are **SPREAD**
 *     so the risers are **directed to different points** — never all onto P. The
 *     spread keeps a **minimum inner spacing `minInnerGoing`** (code narrow-end
 *     going) near the corner; the two innermost meet at P, so the winder treads'
 *     own extensions **fill the corner** (no hole, no separate polygon, no acute
 *     zero-going miter). Away from the corner the spacing relaxes back to the
 *     perpendicular feet → the transition fades out over the trapezoidal treads.
 *   - The band occupies EXACTLY the footprint of the `k+W+k` treads it replaces,
 *     so the pure flights (first `n1−k`, last `n2−k`) are untouched.
 *
 * `k` **auto-grows** (`computeBalancedBandPlan`) until the equal walkline going is
 * within tolerance of the straight tread (≈ 280) — as many neighbouring treads
 * become trapezoidal as needed (bounded by the flight lengths). `minInnerGoing = 0`
 * (profile `none`) → the inner ends collapse onto P (legacy reach-P apex).
 *
 * ADR-630 Phase 2d (option C: **UNIFORM going**) — the equal going is measured on
 * the balanced-winder walking line (DIN Lauflinie), placed at the radius
 * `R* = W·tread/Θ` where the winder going equals the straight tread (not the
 * centre radius `width/2`). At `R*` the band going is EXACTLY `tread` for any `k`
 * (`(2k·t + R*·Θ)/(W+2k) = t`), so every step — straight flights AND band — keeps
 * a uniform going = `tread`; the flights never spread and `k` collapses to its
 * minimum. The physical outer edge stays at `width/2` (straights) / `width` (arc);
 * only the going-reference radius moves inward, so the drawn walkline, stringers
 * and handrails (derived at the centre) are untouched. When `R* > width/2` (turn
 * too wide / too few winders to reach `tread` inside the stair) it clamps to the
 * centre radius → best-effort centre going (legacy Φ2c behaviour).
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
/**
 * Safety cap on transition treads per side (k). The real bound is the flight
 * lengths (`n1−1`, `n2−1`); `k` grows toward the tolerance below, spreading the
 * trapezoidal transition over as many neighbouring treads as needed to keep the
 * walkline going ≈ tread. High enough to never bind for realistic stairs.
 */
const MAX_BAND_STEPS_PER_SIDE = 12;
/** Grow the band while the equal going is more than this fraction off `tread`. */
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
  /**
   * Minimum going at the narrow (inner) end, in the SAME units as `width`
   * (`resolveWinderMinimums(codeProfile, width).minInnerGoing`). Sets the MINIMUM
   * spacing between consecutive inner riser ends near the corner, so the risers
   * spread onto the flight-edge L (directed to different points) instead of
   * collapsing onto P — the two innermost meet at P and the winder treads fill the
   * corner. `0` (codeProfile `none`) → inner ends collapse onto P (legacy apex).
   */
  readonly minInnerGoing: number;
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
 * Choose `k` and the equal going. Grow `k` from 1 (bounded by the flight lengths
 * and `MAX_BAND_STEPS_PER_SIDE`) until the going is within `BAND_GOING_TOL` of the
 * straight tread — the transition spreads over as many trapezoidal treads as
 * needed to keep the going ≈ tread. `k = 0` when there is no flight tread to
 * borrow (pure fan going `R·Θ/W`).
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

/**
 * ADR-630 Φ2d (option C) — the radius at which the equal going is measured. The
 * winder going scales with radius (`going = R·Θ/W`); at `R* = W·tread/Θ` it equals
 * the straight tread, so the whole run keeps a UNIFORM going = `tread` with no
 * spread. Clamped to the centre radius `width/2`: when `R* > width/2` (turn too
 * wide / too few winders), `tread` is unreachable inside the stair → fall back to
 * the centre radius (best-effort centre going > tread, legacy Φ2c).
 */
export function resolveBandWalklineRadius(
  width: number,
  tread: number,
  winderCount: number,
  turnRad: number,
): number {
  const halfW = width * 0.5;
  const turnMag = Math.abs(turnRad);
  if (winderCount <= 0 || turnMag < BAND_EPS || tread <= 0) return halfW;
  return Math.min(halfW, (winderCount * tread) / turnMag);
}

// ─── One riser sample along the band walkline ─────────────────────────────────

type BandZone = 'A' | 'B' | 'C';

/**
 * Assemble the full winder run (pure flight 1 + balanced band + pure flight 2)
 * as one tread + riser list. The band risers are directed to different inner
 * points (spread on the flight-edge L, min spacing `minInnerGoing`) so the corner
 * is filled by the winder treads' own extensions with equal walkline going.
 */
export function buildBalancedWinderRun(input: BalancedBandInput): BalancedWinderRunGeometry {
  const { basePoint, u1, u2, width, tread, nosing, rise, n1, n2, winderCount } = input;
  // ADR-630 Φ2d (option C) — measure the equal going on the balanced walking line
  // `R*` (uniform going = `tread`, no spread), not the centre radius `width/2`.
  const walklineRadius = resolveBandWalklineRadius(width, tread, winderCount, input.turnRad);
  const plan = computeBalancedBandPlan({
    turnRad: input.turnRad,
    winderCount,
    tread,
    walklineRadius,
    n1,
    n2,
  });
  const k = plan.bandStepsPerSide;
  const widthAxis = rotateVec(input.ray0, input.turnRad);

  const flight1 = buildRectilinearFlight(basePoint, u1, rise, tread, nosing, width, n1 - k);
  const band = buildBand(input, plan, widthAxis, walklineRadius);
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
  walklineRadius: number,
): FlightGeometry {
  const { basePoint, width, tread, rise, n1 } = input;
  const k = plan.bandStepsPerSide;
  const m = plan.totalBandSteps;
  if (m <= 0) return { treads: [], risers: [] };
  const halfW = width * 0.5;
  const bandStartAlong = (n1 - k) * tread;
  const zoneAEnd = k * tread;
  // ADR-630 Φ2d — arc developed on the going-reference walkline `R*` (not halfW),
  // so the equal marks `s = j·g` tile it into exactly W equal-angle winders.
  const zoneBEnd = zoneAEnd + walklineRadius * Math.abs(input.turnRad);
  const g = plan.walklineGoing;
  const t1Outer = add(input.pivotXY, input.ray0, width); // outer tangent (arc start)
  const t2Outer = add(input.pivotXY, widthAxis, width);  // outer tangent (arc end)

  // Outer riser ends + zone (equal-going walkline marks).
  const outers: Vec2[] = [];
  const zones: BandZone[] = [];
  for (let j = 0; j <= m; j++) {
    const s = j * g;
    const o = sampleOuter(input, widthAxis, s, bandStartAlong, zoneAEnd, zoneBEnd, halfW, walklineRadius);
    outers.push(o.outer);
    zones.push(o.zone);
  }
  // Inner riser ends spread on the flight-edge L (dancing winders).
  const inners = spreadInnerEnds(input, m, g, zoneAEnd, zoneBEnd, k * tread);

  const treads: Polygon3D[] = [];
  const risers: Segment3D[] = [];
  for (let j = 0; j < m; j++) {
    const z = basePoint.z + rise * (n1 - k + j);
    const outerSeam = seamPoint(zones[j], zones[j + 1], t1Outer, t2Outer);
    const ring: Vec2[] = outerSeam
      ? [inners[j], outers[j], outerSeam, outers[j + 1], inners[j + 1]]
      : [inners[j], outers[j], outers[j + 1], inners[j + 1]];
    treads.push(liftCCW(dedupe(ring), z));
  }
  for (let j = 1; j < m; j++) {
    risers.push({
      start: point(inners[j].x, inners[j].y, basePoint.z + rise * (n1 - k + j - 1)),
      end: point(outers[j].x, outers[j].y, basePoint.z + rise * (n1 - k + j)),
    });
  }
  return { treads, risers };
}

/**
 * Inner riser ends on the reflex L boundary `flight-1 inner edge → P → flight-2
 * inner edge`, developed as a signed offset `d` from P (negative = back onto
 * flight-1 along `u1`, positive = forward onto flight-2 along `u2`).
 *
 * The perpendicular feet (`d = s − zoneAEnd` on the flight side, `d = s − zoneBEnd`
 * on the far side) collapse to `d = 0` across the arc → all risers would hit P.
 * We instead SPREAD them: from the corner mark `jMid` (`d = 0`, the one riser that
 * stays on P) push the neighbours out to a minimum spacing `minInnerGoing`, fading
 * back to the natural feet once the flight spacing (≈ tread) already exceeds it.
 * The result: risers directed to different points, the two innermost meet at P,
 * the winder treads fill the corner. `minInnerGoing = 0` → feet unchanged (P apex).
 */
function spreadInnerEnds(
  input: BalancedBandInput,
  m: number,
  g: number,
  zoneAEnd: number,
  zoneBEnd: number,
  bandTail: number,
): Vec2[] {
  const { pivotXY: pv, u1, u2, minInnerGoing } = input;
  const sMid = (zoneAEnd + zoneBEnd) * 0.5;
  const d: number[] = [];
  let jMid = 0;
  let best = Infinity;
  for (let j = 0; j <= m; j++) {
    const s = j * g;
    const dj = s <= zoneAEnd + BAND_EPS ? s - zoneAEnd : s >= zoneBEnd - BAND_EPS ? s - zoneBEnd : 0;
    d.push(dj);
    if (Math.abs(s - sMid) < best) { best = Math.abs(s - sMid); jMid = j; }
  }
  if (minInnerGoing > BAND_EPS) {
    d[jMid] = 0;
    for (let j = jMid + 1; j <= m; j++) d[j] = Math.max(d[j], d[j - 1] + minInnerGoing);
    for (let j = jMid - 1; j >= 0; j--) d[j] = Math.min(d[j], d[j + 1] - minInnerGoing);
  }
  return d.map((dj) => {
    const c = Math.max(-bandTail, Math.min(bandTail, dj)); // keep within the band's flight tails
    return c <= 0
      ? { x: pv.x + u1.x * c, y: pv.y + u1.y * c }
      : { x: pv.x + u2.x * c, y: pv.y + u2.y * c };
  });
}

/** Outer riser end (+ zone) at walkline distance `s` along the band. */
function sampleOuter(
  input: BalancedBandInput,
  widthAxis: Vec2,
  s: number,
  bandStartAlong: number,
  zoneAEnd: number,
  zoneBEnd: number,
  halfW: number,
  walklineRadius: number,
): { readonly outer: Vec2; readonly zone: BandZone } {
  const { basePoint, u1, u2, v1, ray0, pivotXY, turnSign, width } = input;
  if (zoneAEnd > BAND_EPS && s <= zoneAEnd + BAND_EPS) {
    const along = bandStartAlong + s;
    const center: Vec2 = { x: basePoint.x + u1.x * along, y: basePoint.y + u1.y * along };
    return { outer: { x: center.x - v1.x * turnSign * halfW, y: center.y - v1.y * turnSign * halfW }, zone: 'A' };
  }
  if (s <= zoneBEnd + BAND_EPS) {
    // ADR-630 Φ2d — arc angle from the going-reference radius `R*` (not halfW), so
    // equal going marks map to equal-angle winders; the outer end stays on `width`.
    const angle = ((s - zoneAEnd) / walklineRadius) * turnSign;
    const ray = rotateVec(ray0, angle);
    return { outer: add(pivotXY, ray, width), zone: 'B' };
  }
  const sC = s - zoneBEnd;
  const t2: Vec2 = add(pivotXY, widthAxis, halfW);
  const center: Vec2 = { x: t2.x + u2.x * sC, y: t2.y + u2.y * sC };
  return { outer: { x: center.x + widthAxis.x * halfW, y: center.y + widthAxis.y * halfW }, zone: 'C' };
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
