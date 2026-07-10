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
 * This module owns the **code minimums** (per `StairCodeProfile`) and the
 * **validator warning** for direction-changing stairs. The balanced geometry
 * itself (wedges reaching P + swung transition treads, equal walkline going)
 * lives in `stair-winder-balanced-band.ts`; `computeBalancedBandPlan` there is
 * the single source of the walkline going `g` that this validator checks.
 *
 * The code minimum going stays a **warning** (`winderWalklineWarnings`), never a
 * geometric cut — the narrow inner tip reaching P is intentional RC fill.
 *
 * UNIT-AGNOSTIC: every length input shares ONE unit system; results come back in
 * that same system. `resolveWinderMinimums` derives the code minimums in
 * whatever units `sampleWidth` is expressed in (scene units in the geometry
 * pipeline, mm in the code-profile validator) by keying off the width magnitude.
 *
 * Consumers (ADR-630):
 *   - `stair-winder-balanced-band.ts` — the balanced geometry (via the minimums).
 *   - `services/building-code/engines/gate-stair-checker.ts` — going warnings.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-630-winder-walkline-rule.md
 */

import type { StairCodeProfile } from '../../types/stair-types';
import { inferSceneUnitsFromWidth, mmToSceneUnits } from '../../../utils/scene-units';

/** Numerical epsilon for going comparisons (same unit system as the input). */
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

// ─── Validator warnings ───────────────────────────────────────────────────────

export type WinderRuleWarningCode =
  | 'winder-inner-going-below-min'
  | 'winder-walkline-going-below-min'
  | 'winder-walkline-offset-clamped';

/**
 * Validator-facing warning for a balanced winder corner: the equal walkline
 * going (from `computeBalancedBandPlan`) must stay ≥ the code minimum. The narrow
 * inner tip reaching the pivot P is intentional (RC fill), NOT a geometric error,
 * so only the walkline going is checked.
 */
export function winderWalklineWarnings(
  walklineGoing: number,
  minWalklineGoing: number,
): readonly WinderRuleWarningCode[] {
  if (minWalklineGoing > 0 && walklineGoing + WINDER_INNER_EPS < minWalklineGoing) {
    return ['winder-walkline-going-below-min'];
  }
  return [];
}
