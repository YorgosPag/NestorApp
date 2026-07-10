/**
 * Winder walkline rule — SSoT for direction-changing stairs (ADR-630).
 *
 * When a stair turns WITHOUT a landing, the corner steps ("winders" /
 * σκαλοπάτια κουρμπαριστά) fan out from the inner pivot P. This module is the
 * single source of truth for the **balanced / dancing winder** construction
 * that Revit, ArchiCAD and the classic stair-drafting method (continental-EU
 * practice, ΝΟΚ) all use: the going measured on the walkline is kept **equal**
 * across the turn steps, the risers are swung gradually rather than in one
 * abrupt jump, and — for a monolithic RC stair — the wedges reach the inner
 * corner P (no gap / "hole", no zero-going miter left visible).
 *
 * Balanced model (ADR-630 Phase 2), plan view, pivot P at the inner corner:
 *   - Straight going target = `tread`. Walkline arc radius `R = width/2` about P
 *     (the geometric centreline path, tangent to both flight centrelines).
 *   - The turn Θ is shared by the `winderCount` wedges **plus one transition
 *     tread on each side** (band = W + 2). Every band tread gets the SAME
 *     walkline going `g = (2·tread + R·Θ) / (W + 2)`.
 *   - Each winder wedge sweeps `φ = g/R`; the fan spans `W·φ` centred on Θ, so
 *     it encroaches `δ = (W·φ − Θ)/2` into each flight. The two flight-end
 *     treads become **trapezoids** (perpendicular back edge, radial front edge
 *     from P) that share their P→outer edge with the neighbouring wedge — the
 *     turn tiles cleanly, filling to P.
 *   - The code minimum going stays a **validator WARNING**
 *     (`winderWalklineWarnings`), never a geometric cut that would re-open a gap.
 *
 * UNIT-AGNOSTIC: every length input shares ONE unit system; results come back in
 * that same system. `resolveWinderMinimums` derives the code minimums in
 * whatever units `sampleWidth` is expressed in (scene units in the geometry
 * pipeline, mm in the code-profile validator) by keying off the width magnitude.
 *
 * Consumers (ADR-630):
 *   - `stair-geometry-winder.ts` `assembleWinderRun` — balanced wedges + the two
 *     transition trapezoids (winder kind + l-shape-with-winders share it).
 *   - `services/building-code/engines/gate-stair-checker.ts` — going warnings.
 *   - (future) `stair-region-walkline.ts` reflex arcs, gamma-with-winders.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-630-winder-walkline-rule.md
 */

import type { Polygon3D } from '../../types/stair-types';
import type { StairCodeProfile } from '../../types/stair-types';
import { type Vec2, point } from './stair-geometry-shared';
import { inferSceneUnitsFromWidth, mmToSceneUnits } from '../../../utils/scene-units';

/** Below this inner radius the wedge is emitted as a plain triangle (apex). */
export const WINDER_INNER_EPS = 1e-6;

// ─── Code minimums (mm, per profile) ─────────────────────────────────────────

export interface WinderCodeMinimumsMm {
  /** Walkline distance from the inner edge (mm). */
  readonly walklineOffsetMm: number;
  /** Minimum going measured on the walkline (mm). */
  readonly minWalklineGoingMm: number;
  /** Minimum going at the narrow (inner) end (mm). */
  readonly minInnerGoingMm: number;
}

/**
 * Per-code-profile winder minimums (mm). Sources:
 *   - `nok`: ΝΟΚ Ν.4067/2012 + Κτιριοδομικός Άρθρο 13 — walkline going ≥ κύριας
 *     σκάλας πάτημα (~250), narrow end kept ≥130 (EU practice).
 *   - `ibc`/`nfpa`/`ada`: IRC R311.7.5.2.1 / IBC §1011 — walkline 12″≈305 from
 *     inner edge, going ≥10″≈254 at walkline, ≥6″≈152 at narrow end.
 *   - `eurocode`/`din`: DIN 18065 — walkline going ≥230-250, narrow end ≥100-130.
 *   - `none`: disabled — no cut (apex triangle preserved for back-compat).
 */
export const WINDER_CODE_MINIMUMS_MM: Readonly<Record<StairCodeProfile, WinderCodeMinimumsMm>> = {
  nok: { walklineOffsetMm: 300, minWalklineGoingMm: 250, minInnerGoingMm: 130 },
  ibc: { walklineOffsetMm: 305, minWalklineGoingMm: 254, minInnerGoingMm: 152 },
  eurocode: { walklineOffsetMm: 300, minWalklineGoingMm: 250, minInnerGoingMm: 130 },
  nbc: { walklineOffsetMm: 300, minWalklineGoingMm: 240, minInnerGoingMm: 150 },
  nfpa: { walklineOffsetMm: 305, minWalklineGoingMm: 279, minInnerGoingMm: 152 },
  as1657: { walklineOffsetMm: 300, minWalklineGoingMm: 240, minInnerGoingMm: 130 },
  din: { walklineOffsetMm: 250, minWalklineGoingMm: 230, minInnerGoingMm: 100 },
  ada: { walklineOffsetMm: 305, minWalklineGoingMm: 279, minInnerGoingMm: 152 },
  none: { walklineOffsetMm: 0, minWalklineGoingMm: 0, minInnerGoingMm: 0 },
};

export interface WinderMinimums {
  readonly walklineOffset: number;
  readonly minWalklineGoing: number;
  readonly minInnerGoing: number;
}

/**
 * Resolve the code minimums into the unit system of `sampleWidth`. The mm-baked
 * table is scaled by `mmToSceneUnits(inferSceneUnitsFromWidth(sampleWidth))`, so
 * a scene-unit width (e.g. `1.2` m) yields scene-unit minimums, while a mm width
 * (`1200`) yields mm minimums (scale = 1). Reuses the units SSoT — no local
 * `mmFactorFromWidth` clone (jscpd N.18).
 */
export function resolveWinderMinimums(
  codeProfile: StairCodeProfile,
  sampleWidth: number,
): WinderMinimums {
  const mm = WINDER_CODE_MINIMUMS_MM[codeProfile] ?? WINDER_CODE_MINIMUMS_MM.none;
  const scale = mmToSceneUnits(inferSceneUnitsFromWidth(sampleWidth));
  return {
    walklineOffset: mm.walklineOffsetMm * scale,
    minWalklineGoing: mm.minWalklineGoingMm * scale,
    minInnerGoing: mm.minInnerGoingMm * scale,
  };
}

// ─── Balanced winder rule ─────────────────────────────────────────────────────

export interface BalancedWinderInput {
  /** Signed total turn of the stair at the corner (radians). */
  readonly turnRad: number;
  /** Number of winder wedges at the corner. */
  readonly winderCount: number;
  /** Straight-flight going (`params.tread`) — the balance target. */
  readonly tread: number;
  /** Walkline arc radius about the pivot = `width/2`. */
  readonly walklineRadius: number;
}

export type WinderRuleWarningCode =
  | 'winder-inner-going-below-min'
  | 'winder-walkline-going-below-min'
  | 'winder-walkline-offset-clamped';

export interface BalancedWinderRule {
  /** Signed sweep per winder wedge (equal walkline going). */
  readonly winderSweepRad: number;
  /** Signed angle of the winder-0 back edge from `ray0` (= −δ·sign(turn)). */
  readonly startAngleRad: number;
  /** Encroachment half-angle δ into each flight (>0 = wedges steal from flights). */
  readonly encroachRad: number;
  /** Equal going produced on the walkline for every band tread. */
  readonly walklineGoing: number;
  /** Transition treads per side that share the turn (Phase 2 = 1). */
  readonly bandStepsPerSide: number;
}

/**
 * Compute the balanced-winder angles for one corner. Pure, deterministic,
 * unit-agnostic (see module header). The band = `winderCount` wedges + one
 * transition tread per side; all get equal walkline going `g`.
 */
export function computeBalancedWinderRule(input: BalancedWinderInput): BalancedWinderRule {
  const turnMag = Math.abs(input.turnRad);
  const sign = input.turnRad >= 0 ? 1 : -1;
  const w = Math.max(0, Math.floor(input.winderCount));
  const r = Math.max(WINDER_INNER_EPS, input.walklineRadius);
  const t = Math.max(0, input.tread);
  if (w === 0 || turnMag < WINDER_INNER_EPS) {
    return {
      winderSweepRad: 0,
      startAngleRad: 0,
      encroachRad: 0,
      walklineGoing: t,
      bandStepsPerSide: 1,
    };
  }
  // Equal walkline going across the band (W wedges + 2 transition treads).
  const walklineGoing = (2 * t + r * turnMag) / (w + 2);
  const sweepMag = walklineGoing / r;
  const encroachRad = (w * sweepMag - turnMag) / 2;
  return {
    winderSweepRad: sweepMag * sign,
    startAngleRad: -encroachRad * sign,
    encroachRad,
    walklineGoing,
    bandStepsPerSide: 1,
  };
}

/**
 * Validator-facing warnings for a balanced winder corner. The equal walkline
 * going must stay ≥ the code minimum; the narrow inner tip reaching P is
 * intentional (RC fill) and NOT flagged as a geometric error.
 */
export function winderWalklineWarnings(
  rule: BalancedWinderRule,
  minWalklineGoing: number,
): readonly WinderRuleWarningCode[] {
  if (minWalklineGoing > 0 && rule.walklineGoing + WINDER_INNER_EPS < minWalklineGoing) {
    return ['winder-walkline-going-below-min'];
  }
  return [];
}

/**
 * Intersection of the ray `pivot + s·dir` with the infinite line
 * `edgePt + r·edgeDir` (2-D). Falls back to `edgePt` when the two directions are
 * parallel. Used to land a winder wedge / transition trapezoid outer vertex
 * exactly on a straight flight edge so the corner tiles with no sliver.
 */
export function radialEdgeIntersect(
  pivot: Vec2,
  dir: Vec2,
  edgePt: Vec2,
  edgeDir: Vec2,
): Vec2 {
  const denom = dir.x * edgeDir.y - dir.y * edgeDir.x;
  if (Math.abs(denom) < WINDER_INNER_EPS) return { x: edgePt.x, y: edgePt.y };
  const wx = edgePt.x - pivot.x;
  const wy = edgePt.y - pivot.y;
  const s = (wx * edgeDir.y - wy * edgeDir.x) / denom;
  return { x: pivot.x + dir.x * s, y: pivot.y + dir.y * s };
}

// ─── Wedge polygon (the geometric expression of the rule) ─────────────────────

/**
 * Build one winder tread polygon (CCW) between rays `rayA` and `rayB` from the
 * `pivotXY`, spanning `innerRadius`→`outerRadius`. When `innerRadius` is ~0 the
 * apex is a single point (plain triangle, back-compat); otherwise the apex is
 * cut into an inner edge and the tread is a trapezoid `[innerA, outerA, outerB,
 * innerB]`. Winding follows `turnSign` (CCW for +1, reversed for −1) to match
 * the existing winder fan orientation.
 *
 * SSoT wedge shape — reused by the winder kind, l-shape-with-winders, and
 * (future) the stair-from-region reflex arcs.
 */
export function buildWinderWedge(
  pivotXY: Vec2,
  rayA: Vec2,
  rayB: Vec2,
  innerRadius: number,
  outerRadius: number,
  z: number,
  turnSign: 1 | -1,
): Polygon3D {
  const outerA = point(pivotXY.x + outerRadius * rayA.x, pivotXY.y + outerRadius * rayA.y, z);
  const outerB = point(pivotXY.x + outerRadius * rayB.x, pivotXY.y + outerRadius * rayB.y, z);
  if (innerRadius <= WINDER_INNER_EPS) {
    const apex = point(pivotXY.x, pivotXY.y, z);
    return turnSign === 1 ? [apex, outerA, outerB] : [apex, outerB, outerA];
  }
  const innerA = point(pivotXY.x + innerRadius * rayA.x, pivotXY.y + innerRadius * rayA.y, z);
  const innerB = point(pivotXY.x + innerRadius * rayB.x, pivotXY.y + innerRadius * rayB.y, z);
  return turnSign === 1
    ? [innerA, outerA, outerB, innerB]
    : [innerB, outerB, outerA, innerA];
}
