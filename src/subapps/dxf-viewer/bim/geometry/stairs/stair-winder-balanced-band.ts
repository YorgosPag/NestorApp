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
import {
  BAND_EPS,
  add,
  dedupe,
  liftCCW,
  extendToCircle,
  extendToLine,
} from './stair-winder-band-geometry';

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
  /**
   * ADR-630 Φ2g — the code narrow-end minimum (same units as `tread`). When > 0
   * it drives a SHAPE-based `k` so the inner-edge going ramps smoothly from this
   * minimum out to `tread` (gradual face/riser rotation, no abrupt miter); `0`
   * (legacy fan) leaves `k` on the going-tolerance choice.
   */
  readonly minInnerGoing?: number;
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
  // Going-driven `k` (legacy Φ2c/d): smallest `k` whose equal going ≈ tread. At
  // `R*` this is already `k = 1`; for a clamped narrow stair it grows to trim the
  // going toward the tread.
  let kGoing = kMax;
  for (let k = 1; k <= kMax; k++) {
    if (t <= BAND_EPS || Math.abs(t - going(k)) / t <= BAND_GOING_TOL) {
      kGoing = k;
      break;
    }
  }
  // Shape-driven `k` (Φ2g): spread the rotation over enough "dancing" treads that
  // the inner going ramps minInnerGoing → tread with no abrupt miter. The wider of
  // the two wins; the going stays uniform (going(k) = tread for any k at `R*`).
  const kShape = shapeStepsPerSide(t, input.minInnerGoing ?? 0, w);
  const finalK = Math.max(1, Math.min(kMax, Math.max(kGoing, kShape)));
  return { bandStepsPerSide: finalK, walklineGoing: going(finalK), totalBandSteps: w + 2 * finalK };
}

/**
 * ADR-630 Φ2g — transition ("dancing") steps per side so the inner-edge going
 * ramps smoothly from `minInnerGoing` (at the corner) out to ~`tread` (the
 * straight flights), spreading the face/riser rotation over several treads with
 * no abrupt miter.
 *
 * Closed form (no magic constant, unit-safe): the band's inner going averages
 * `2k·t/(W+2k)`; a symmetric ramp whose corner gap is `minInnerGoing` lands its
 * OUTER gap exactly on `tread` when that average equals `(t + minInnerGoing)/2`,
 * i.e. `k = W·(t + minInnerGoing) / (2·(t − minInnerGoing))`. Fewer steps → ends
 * short of the tread (still gentle); more → ends flare past it. `0` when there is
 * no code minimum (legacy fan) — the going-driven `k` stands.
 */
function shapeStepsPerSide(tread: number, minInnerGoing: number, w: number): number {
  const gap = tread - minInnerGoing;
  if (minInnerGoing <= BAND_EPS || w <= 0 || gap <= BAND_EPS) return 0;
  return Math.round((w * (tread + minInnerGoing)) / (2 * gap));
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

// ─── Balanced band — locked walkline marks + spread fill to P (Φ2f) ────────────

type BandZone = 'A' | 'B' | 'C';

/**
 * Assemble the full winder run: pure flight 1 (`n1−k` straight treads) + a
 * balanced band of `M = W + 2k` treads + pure flight 2 (`n2−k` straight treads).
 *
 * ADR-630 Phase 2f (Giorgio's construction). The band walkline sits at
 * `R* = W·tread/Θ` and is cut into EQUAL going marks — the "blue" crossings where
 * the walkline, the riser and the tread face meet; those marks are LOCKED (equal
 * going = `tread`). Each riser passes THROUGH its locked mark but is rotated off
 * the radial: its inner end spreads onto the reflex flight-edge boundary `L`
 * (flight-1 inner edge → P → flight-2 inner edge), the two innermost meeting at
 * `P`, so the corner is FILLED by the winders' own treads (no hole, no newel, no
 * separate polygon). The outer end is the mark→inner ray extended to the outer
 * boundary, so the riser stays on the walkline mark (no kink). `k` auto-grows so
 * the spread fades out over as many neighbouring treads as the flights allow.
 */
export function buildBalancedWinderRun(input: BalancedBandInput): BalancedWinderRunGeometry {
  const { basePoint, u1, u2, pivotXY, width, tread, nosing, rise, n1, n2 } = input;
  const w = Math.max(0, Math.floor(input.winderCount));
  const walklineRadius = resolveBandWalklineRadius(width, tread, w, input.turnRad);
  const plan = computeBalancedBandPlan({
    turnRad: input.turnRad, winderCount: w, tread, walklineRadius, n1, n2,
    minInnerGoing: input.minInnerGoing,
  });
  const k = plan.bandStepsPerSide;
  const widthAxis = rotateVec(input.ray0, input.turnRad);

  const flight1 = buildRectilinearFlight(basePoint, u1, rise, tread, nosing, width, n1 - k);
  const band = buildBand(input, plan, widthAxis, walklineRadius);
  const flight2Origin: Vec2 = {
    x: pivotXY.x + u2.x * (k * tread),
    y: pivotXY.y + u2.y * (k * tread),
  };
  const flight2 = buildFlightFromEdge(
    flight2Origin, u2, widthAxis, rise, tread, nosing, width, n2 - k,
    basePoint.z + rise * (n1 + w + k),
  );

  return {
    treads: [...flight1.treads, ...band.treads, ...flight2.treads],
    risers: [...flight1.risers, ...band.risers, ...flight2.risers],
    flightSplit: [n1 - k, plan.totalBandSteps, n2 - k],
    plan,
  };
}

function buildBand(
  input: BalancedBandInput,
  plan: BalancedBandPlan,
  widthAxis: Vec2,
  walklineRadius: number,
): FlightGeometry {
  const { basePoint, width, tread, rise, n1, pivotXY: P } = input;
  const k = plan.bandStepsPerSide;
  const m = plan.totalBandSteps;
  if (m <= 0) return { treads: [], risers: [] };
  const halfW = width * 0.5;
  const bandStartAlong = (n1 - k) * tread;
  const zoneAEnd = k * tread;
  const zoneBEnd = zoneAEnd + walklineRadius * Math.abs(input.turnRad);
  const g = plan.walklineGoing;
  const t1Outer = add(P, input.ray0, width); // outer tangent (arc start, at width)
  const t2Outer = add(P, widthAxis, width);  // outer tangent (arc end, at width)

  // Inner riser ends spread on the reflex L — two innermost meet at P (fill corner).
  const inners = spreadInnerEnds(input, m, g, zoneAEnd, zoneBEnd, k * tread);
  // Outer ends: EVERY riser passes through its LOCKED R* walkline mark. The
  // (inner → mark) ray is extended to the outer boundary — the width circle on the
  // arc, the flight outer edge on the straight tails — so no riser drifts off the
  // walkline (the whole point of Giorgio's locked-marks construction).
  const outerEdgeA: Vec2 = {
    x: input.basePoint.x - input.v1.x * input.turnSign * halfW,
    y: input.basePoint.y - input.v1.y * input.turnSign * halfW,
  };
  const outerEdgeC: Vec2 = add(P, widthAxis, width);
  const outers: Vec2[] = [];
  const zones: BandZone[] = [];
  for (let j = 0; j <= m; j++) {
    const s = j * g;
    const zone: BandZone = s <= zoneAEnd + BAND_EPS ? 'A' : s <= zoneBEnd + BAND_EPS ? 'B' : 'C';
    const mark = walklineMark(input, s, zone, bandStartAlong, zoneAEnd, zoneBEnd, walklineRadius, widthAxis, halfW);
    // At the zone boundaries (arc tangents) the outer end IS the tangent point on
    // both the flight edge AND the width circle. Snap it there so the straight-tail
    // extension never overshoots past the tangent (ADR-630 Φ2g — no protrusion, no
    // reversed lean at the seam). `j === k` = A↔B tangent, `j === m − k` = B↔C.
    outers.push(
      j === k
        ? t1Outer
        : j === m - k
          ? t2Outer
          : zone === 'B'
            ? extendToCircle(inners[j], mark, P, width)
            : extendToLine(inners[j], mark, zone === 'A' ? outerEdgeA : outerEdgeC, zone === 'A' ? input.u1 : input.u2),
    );
    zones.push(zone);
  }

  const treads: Polygon3D[] = [];
  const risers: Segment3D[] = [];
  for (let j = 0; j < m; j++) {
    const z = basePoint.z + rise * (n1 - k + j);
    const seam = seamPoint(zones[j], zones[j + 1], t1Outer, t2Outer);
    const ring: Vec2[] = seam
      ? [inners[j], outers[j], seam, outers[j + 1], inners[j + 1]]
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
 * flight-1 along `u1`, positive = forward onto flight-2 along `u2`). The corner
 * mark `jMid` stays on P (`d = 0`) so the two innermost treads meet at P and fill
 * the corner.
 *
 * ADR-630 Φ2g — when a code minimum applies, the offsets form a SYMMETRIC LINEAR
 * RAMP (`rampInnerOffsets`): the inner going grows in equal increments from
 * `minInnerGoing` (at the corner) out to ~`tread` at each flight junction, so the
 * face/riser rotation spreads gradually over the whole band — no abrupt miter.
 * `minInnerGoing = 0` (legacy fan) → arc feet stay on P (perpendicular tails).
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
    fillRampSide(d, jMid, 1, m - jMid, bandTail, minInnerGoing, input.tread);
    fillRampSide(d, jMid, -1, jMid, bandTail, minInnerGoing, input.tread);
  }
  return d.map((dj) => {
    const c = Math.max(-bandTail, Math.min(bandTail, dj));
    return c <= 0
      ? { x: pv.x + u1.x * c, y: pv.y + u1.y * c }
      : { x: pv.x + u2.x * c, y: pv.y + u2.y * c };
  });
}

/**
 * ADR-630 Φ2g — fill one side of the inner-offset ramp. Starting at the corner
 * mark (`d = 0`), `p` monotonically **non-decreasing** gaps ramp from
 * `minInnerGoing` (nearest the corner) up to — and CAPPED at — `tread`, so the
 * offsets land EXACTLY on the flight junction (`dir·bandTail`) and the inner
 * going never overshoots the straight-flight tread (no bulge / no lean flip).
 * The gap `i` is `min(tread, minInnerGoing + i·delta)`; `delta` is solved so the
 * gaps sum to `bandTail` (a monotone bisection — the sum rises with `delta`). If
 * the code minimum is already too large to rise (sum at `delta = 0` ≥ bandTail),
 * the side falls back to uniform spacing.
 */
function fillRampSide(
  d: number[],
  jMid: number,
  dir: 1 | -1,
  p: number,
  bandTail: number,
  minInnerGoing: number,
  tread: number,
): void {
  if (p <= 0) return;
  if (p === 1) { d[jMid + dir] = dir * bandTail; return; }
  const sumFor = (delta: number): number => {
    let s = 0;
    for (let i = 0; i < p; i++) s += Math.min(tread, minInnerGoing + i * delta);
    return s;
  };
  const write = (gap: (i: number) => number): void => {
    let acc = 0;
    for (let i = 0; i < p; i++) { acc += gap(i); d[jMid + dir * (i + 1)] = dir * acc; }
    d[jMid + dir * p] = dir * bandTail; // snap the junction exactly onto the flight edge
  };
  if (sumFor(0) >= bandTail) { const u = bandTail / p; write(() => u); return; }
  let lo = 0;
  let hi = bandTail; // delta ≥ this caps every gap at tread → sum = min + (p−1)·tread ≥ bandTail
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    if (sumFor(mid) < bandTail) lo = mid; else hi = mid;
  }
  const delta = (lo + hi) / 2;
  write((i) => Math.min(tread, minInnerGoing + i * delta));
}

/**
 * The LOCKED equal-going walkline mark at developed distance `s` — on the straight
 * tail / head it rides the flight walkline at radius `R` from the inner edge; on
 * the arc it is the R-circle point. Continuous across the zone junctions.
 */
function walklineMark(
  input: BalancedBandInput,
  s: number,
  zone: BandZone,
  bandStartAlong: number,
  zoneAEnd: number,
  zoneBEnd: number,
  walklineRadius: number,
  widthAxis: Vec2,
  halfW: number,
): Vec2 {
  const { basePoint, u1, u2, v1, turnSign, pivotXY: P } = input;
  const off = turnSign * (halfW - walklineRadius); // inner-edge → walkline offset
  if (zone === 'A') {
    const along = bandStartAlong + s;
    return { x: basePoint.x + u1.x * along + v1.x * off, y: basePoint.y + u1.y * along + v1.y * off };
  }
  if (zone === 'B') {
    const angle = ((s - zoneAEnd) / walklineRadius) * turnSign;
    return add(P, rotateVec(input.ray0, angle), walklineRadius);
  }
  const sC = s - zoneBEnd;
  const start = add(P, widthAxis, walklineRadius);
  return { x: start.x + u2.x * sC, y: start.y + u2.y * sC };
}

/** Outer boundary tangent point when a tread straddles a straight↔arc junction. */
function seamPoint(za: BandZone, zb: BandZone, t1Outer: Vec2, t2Outer: Vec2): Vec2 | null {
  if (za === 'A' && zb === 'B') return t1Outer;
  if (za === 'B' && zb === 'C') return t2Outer;
  return null;
}
