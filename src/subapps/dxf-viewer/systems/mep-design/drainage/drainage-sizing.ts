/**
 * ADR-427 — Stage 4/5 Sizing: drainage diameter from cumulative DU + slope from DN (SSoT).
 *
 * The Revit/EN 12056-2 behaviour, INVERTED relative to water supply: a collector run near
 * the φρεάτιο carries ΣDU of everything upstream → **large DN**; a branch from one fixture
 * carries that fixture's DU → small DN. So diameters **grow toward the collector** (the
 * gravity root). The actual run diameter is then floored by the appliance's minimum branch
 * DN (a WC line is ≥ DN100 the whole way) — that floor is the router's `cumulativeMinDiameterMm`.
 *
 * Each DN has a **minimum gradient** (EN 12056-2 / Greek H/M practice): smaller pipes need a
 * steeper fall to stay self-cleansing. The ΣDU→DN map and the DN→slope map are **pluggable**
 * (`DrainageSizingStandard`); a validated hydraulic engine (Manning, fill ratio, velocity
 * check) swaps in behind the same interface later (ADR-423 §4 gap).
 */

/** Pluggable drainage sizing standard: ΣDU → DN, and DN → minimum gradient. */
export interface DrainageSizingStandard {
  readonly id: string;
  /** Nominal DN (mm) for a cumulative discharge-unit sum. */
  diameterForDU(sumDU: number): number;
  /** Minimum self-cleansing gradient (% fall) for a nominal DN. */
  minSlopePercentForDN(dnMm: number): number;
}

/** One ΣDU threshold → DN step (ascending by `maxDU`). */
interface DrainageSizingStep {
  readonly maxDU: number;
  readonly dn: number;
}

/**
 * Simplified EN 12056-2 System I ΣDU → DN ladder. Ascending thresholds; the first step
 * whose `maxDU` ≥ ΣDU wins. Above the last threshold → the largest DN.
 */
const EN12056_SIZING_STEPS: readonly DrainageSizingStep[] = [
  { maxDU: 0.5, dn: 40 },
  { maxDU: 1.5, dn: 50 },
  { maxDU: 4, dn: 70 },
  { maxDU: 20, dn: 100 },
  { maxDU: 70, dn: 125 },
];

/** DN used when ΣDU exceeds the last tabulated threshold. */
const EN12056_MAX_DN = 150;

/**
 * Minimum gradient (% fall) per DN — smaller bore ⇒ steeper. EN 12056-2 / common Greek
 * H/M practice (DN40–50 ≈ 1:40, DN70 ≈ 1:50, DN100 ≈ 1:67, DN≥125 ≈ 1:100). The first
 * step whose DN ≥ the pipe DN wins.
 */
const EN12056_MIN_SLOPE_STEPS: readonly { readonly maxDN: number; readonly slopePercent: number }[] = [
  { maxDN: 50, slopePercent: 2.5 },
  { maxDN: 70, slopePercent: 2.0 },
  { maxDN: 100, slopePercent: 1.5 },
];

/** Min gradient above the last DN threshold (large building drains). */
const EN12056_MIN_SLOPE_LARGE = 1.0;

/** The pilot drainage sizing standard (simplified EN 12056-2 System I). */
export const EN12056_DRAINAGE_SIZING: DrainageSizingStandard = {
  id: 'EN12056-2(simplified)',
  diameterForDU(sumDU: number): number {
    for (const step of EN12056_SIZING_STEPS) {
      if (sumDU <= step.maxDU) return step.dn;
    }
    return EN12056_MAX_DN;
  },
  minSlopePercentForDN(dnMm: number): number {
    for (const step of EN12056_MIN_SLOPE_STEPS) {
      if (dnMm <= step.maxDN) return step.slopePercent;
    }
    return EN12056_MIN_SLOPE_LARGE;
  },
};
