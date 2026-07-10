/**
 * Winder walkline rule — SSoT for direction-changing stairs (ADR-630).
 *
 * When a stair turns WITHOUT a landing, the corner steps ("winders" /
 * σκαλοπάτια κουρμπαριστά) fan out from the inner pivot. If they are drawn as
 * bare triangles their apex has ZERO going at the inner edge — the dangerous
 * "miter" a real building code forbids. This module is the single source of
 * truth for the two rules every code (NOK / IBC-IRC / Eurocode / …) imposes on
 * such corners:
 *
 *   1. **Minimum going at the narrow (inner) end** — the apex is cut back to an
 *      inner radius `r_in` so the going measured along the inner arc is never
 *      below the code minimum. The wedge becomes a TRAPEZOID, never a spike.
 *   2. **Minimum going at the walkline** — the going measured on the walkline
 *      (a line offset `walklineOffset` from the inner edge, where a person
 *      actually treads) must stay ≥ the code minimum, else a warning fires.
 *
 * Geometry model (plan view, pivot at the inner corner):
 *   - A winder tread spans the angular sweep `sweepPerTreadRad`.
 *   - Going measured at radius `r` from the pivot = arc length = `r · sweep`.
 *   - Inner edge at `r_in`, outer edge at `outerRadius` (= stair width).
 *   - Walkline at `r_wl = r_in + walklineOffset` (clamped inside the tread).
 *
 * UNIT-AGNOSTIC: every length input (`outerRadius`, `walklineOffset`,
 * `minInnerGoing`, `minWalklineGoing`) must share ONE unit system; the result
 * radii/goings come back in that same system. `resolveWinderMinimums` derives
 * the code minimums in whatever units `sampleWidth` is expressed in (scene
 * units in the geometry pipeline, mm in the code-profile validator) by keying
 * off the width magnitude — so the SAME rule serves both callers.
 *
 * Consumers (ADR-630):
 *   - `stair-geometry-winder.ts` `buildWinderTreads` — cuts the apex (winder
 *     kind + l-shape-with-winders share it).
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

// ─── Rule computation ─────────────────────────────────────────────────────────

export interface WinderWalklineRuleInput {
  /** Absolute angular sweep of a single winder tread (radians, > 0). */
  readonly sweepPerTreadRad: number;
  /** Outer radius of the winder fan from the pivot = stair width. */
  readonly outerRadius: number;
  /** Requested walkline offset from the inner edge (`params.walklineOffset`). */
  readonly walklineOffset: number;
  /** Minimum going at the narrow (inner) end. */
  readonly minInnerGoing: number;
  /** Minimum going measured on the walkline. */
  readonly minWalklineGoing: number;
}

export type WinderRuleWarningCode =
  | 'winder-inner-going-below-min'
  | 'winder-walkline-going-below-min'
  | 'winder-walkline-offset-clamped';

export interface WinderWalklineRule {
  /** Inner cut radius from the pivot — treads become trapezoids, never a spike. */
  readonly innerRadius: number;
  /** Walkline radius from the pivot (inner edge + offset, clamped in-tread). */
  readonly walklineRadius: number;
  /** Going produced at the inner edge (same units as input). */
  readonly innerGoing: number;
  /** Going produced at the walkline (same units as input). */
  readonly walklineGoing: number;
  readonly warnings: readonly WinderRuleWarningCode[];
}

/**
 * Compute the inner cut radius, walkline radius and code warnings for one
 * winder wedge sweep. Pure, deterministic, unit-agnostic (see module header).
 */
export function computeWinderWalklineRule(input: WinderWalklineRuleInput): WinderWalklineRule {
  const sweep = Math.max(WINDER_INNER_EPS, Math.abs(input.sweepPerTreadRad));
  const outer = Math.max(0, input.outerRadius);
  const warnings: WinderRuleWarningCode[] = [];

  // 1. Cut the apex so going at the inner edge (r · sweep) ≥ minInnerGoing.
  //    The inner radius may never eat the whole tread — keep a radial sliver.
  const maxInner = outer * 0.9;
  let innerRadius = input.minInnerGoing > 0 ? input.minInnerGoing / sweep : 0;
  if (innerRadius > maxInner) {
    innerRadius = maxInner;
    warnings.push('winder-inner-going-below-min');
  }
  const innerGoing = innerRadius * sweep;

  // 2. Walkline = inner edge + requested offset, clamped inside the tread.
  let walklineRadius = innerRadius + Math.max(0, input.walklineOffset);
  if (walklineRadius > outer) {
    walklineRadius = (innerRadius + outer) * 0.5;
    warnings.push('winder-walkline-offset-clamped');
  }
  const walklineGoing = walklineRadius * sweep;

  // 3. Walkline going compliance (the ergonomic minimum where a person treads).
  if (input.minWalklineGoing > 0 && walklineGoing + WINDER_INNER_EPS < input.minWalklineGoing) {
    warnings.push('winder-walkline-going-below-min');
  }

  return { innerRadius, walklineRadius, innerGoing, walklineGoing, warnings };
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
