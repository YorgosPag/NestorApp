/**
 * ADR-426 — Stage 4 Sizing: pipe diameter from cumulative Loading Units (SSoT).
 *
 * The Revit-grade behaviour: a trunk near the source carries ΣLU of everything
 * downstream → larger DN; a branch to a single fixture carries that fixture's LU →
 * small DN. So diameters **diminish** toward the terminals. The ΣLU→DN mapping is a
 * **pluggable `SizingStandard`** (here a simplified DIN 1988-3 peak-flow table); a
 * full validated hydraulic engine (Colebrook/CIBSE, velocity check) is a later stage
 * (ADR-423 §4 gap) that swaps in behind this same interface.
 */

/** Pluggable sizing standard: ΣLU → nominal diameter (mm). */
export interface SizingStandard {
  readonly id: string;
  /** Nominal DN (mm) for a cumulative loading-unit sum (≥ smallest branch DN). */
  diameterForLU(sumLU: number): number;
}

/** One ΣLU threshold → DN step (ascending by `maxLU`). */
interface SizingStep {
  readonly maxLU: number;
  readonly dn: number;
}

/**
 * Simplified DIN 1988-3 peak-flow → copper/PEX DN table. Ascending thresholds; the
 * first step whose `maxLU` ≥ ΣLU wins. Above the last threshold → the largest DN.
 */
const DIN1988_SIZING_STEPS: readonly SizingStep[] = [
  { maxLU: 1, dn: 15 },
  { maxLU: 4, dn: 18 },
  { maxLU: 10, dn: 22 },
  { maxLU: 20, dn: 28 },
  { maxLU: 50, dn: 35 },
  { maxLU: 100, dn: 42 },
];

/** DN used when ΣLU exceeds the last tabulated threshold. */
const DIN1988_MAX_DN = 54;

/** The pilot sizing standard (simplified DIN 1988-3). */
export const DIN1988_SIZING_STANDARD: SizingStandard = {
  id: 'DIN1988-3(simplified)',
  diameterForLU(sumLU: number): number {
    for (const step of DIN1988_SIZING_STEPS) {
      if (sumLU <= step.maxLU) return step.dn;
    }
    return DIN1988_MAX_DN;
  },
};
