/**
 * ADR-428 — Stage 4 Sizing: hydronic pipe diameter from cumulative flow (SSoT).
 *
 * Heating is sized on **velocity**, not loading units: a run carrying cumulative flow V̇
 * (l/s) gets the smallest nominal DN whose bore velocity stays at or below a design maximum
 * (v_max ≈ 1.0 m/s for residential hydronics — quiet, low erosion). So a trunk near the
 * boiler carries Σ-of-all flow → larger DN, and a branch to one terminal → small DN; the
 * diameters diminish toward the terminals (supply) / converge to the boiler (return),
 * identically — the network-level direction is the only difference.
 *
 * The DN is DERIVED from physics (v = V̇ / A, A = π·(d/2)²), not a magic table: we walk a
 * standard DN ladder and pick the first bore that satisfies the velocity limit. v_max and
 * the ladder are part of the pluggable `HeatingSizingStandard`, so a different velocity
 * policy or pipe series is a new standard, never an engine change. A full validated
 * hydraulic engine (pressure-drop balancing per kv) swaps in behind the same interface
 * later (ADR-423 §4 gap; ADR-422 L4 already does kv balancing on placed networks).
 */

/** Pluggable hydronic sizing standard: cumulative flow (l/s) → nominal DN (mm). */
export interface HeatingSizingStandard {
  readonly id: string;
  /** Maximum design velocity (m/s) the bore may run at. */
  readonly maxVelocityMps: number;
  /** Ascending nominal-DN ladder (mm) — internal bore approximated as DN. */
  readonly diameterLadderMm: readonly number[];
  /** Smallest DN whose velocity at this flow ≤ `maxVelocityMps` (≥ smallest ladder DN). */
  diameterForFlowLps(flowLps: number): number;
}

/** Bore velocity (m/s) for a volumetric flow (l/s) through a nominal diameter (mm). */
function velocityMps(flowLps: number, diameterMm: number): number {
  const radiusM = diameterMm / 2 / 1000;
  const areaM2 = Math.PI * radiusM * radiusM;
  const flowM3s = flowLps / 1000;
  return flowM3s / areaM2;
}

/** Standard EN copper/steel hydronic DN ladder (mm). */
const HYDRONIC_DN_LADDER: readonly number[] = [10, 12, 15, 20, 25, 32, 40, 50, 65, 80, 100];

/** The pilot hydronic sizing standard (velocity-limited, v_max = 1.0 m/s). */
export const HYDRONIC_VELOCITY_SIZING: HeatingSizingStandard = {
  id: 'velocity(v≤1.0m/s)',
  maxVelocityMps: 1.0,
  diameterLadderMm: HYDRONIC_DN_LADDER,
  diameterForFlowLps(flowLps: number): number {
    const ladder = this.diameterLadderMm;
    if (!(flowLps > 0)) return ladder[0];
    for (const dn of ladder) {
      if (velocityMps(flowLps, dn) <= this.maxVelocityMps) return dn;
    }
    return ladder[ladder.length - 1];
  },
};
