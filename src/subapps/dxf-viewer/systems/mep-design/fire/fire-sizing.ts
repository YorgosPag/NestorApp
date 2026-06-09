/**
 * ADR-433 — Stage 4 Sizing: wet-pipe DN from cumulative discharge flow (SSoT, pluggable).
 *
 * The Revit / MagiCAD / 4M-FINE / Hydratec-grade behaviour: a trunk near the riser carries
 * the flow of every head downstream → larger DN; a branch to a single head carries that
 * head's flow → small DN. So diameters **diminish** toward the heads (mirror of the water
 * ΣLU→DN sizing). The flow→DN mapping is a **pluggable `FireSizingStandard`**.
 *
 * The pilot standard is **velocity-limited** (wet pipe v ≤ ~6 m/s, the common fire-pipe
 * design ceiling): for each cumulative flow it picks the smallest standard DN whose
 * cross-section keeps the velocity at or below the limit. Pre-evaluated here as an ascending
 * step table (the velocity inequality solved at standard DN sizes) so the lookup is O(steps)
 * and Date/Math.random-free (survives workflow replay). A full hydraulic engine (Hazen-
 * Williams head loss + a solved area-of-operation) swaps in behind this same interface
 * (ADR-433 §gap), exactly as the water sizing reserves the full hydraulic engine.
 *
 * Velocity check (v = Q / A, A = π/4·DN²): at v = 6 m/s a DN20 pipe passes ≈ 113 L/min,
 * DN25 ≈ 177, DN32 ≈ 290, DN40 ≈ 452, DN50 ≈ 707, DN65 ≈ 1194, DN80 ≈ 1810; the thresholds
 * below are those capacities (rounded down for a safety margin).
 *
 * @see ../water/water-sizing.ts (the DN-from-LU analogue / template)
 */

/** Pluggable fire sizing standard: cumulative flow (L/min) → nominal pipe DN (mm). */
export interface FireSizingStandard {
  readonly id: string;
  /** Nominal DN (mm) for a cumulative discharge-flow sum (L/min). */
  diameterForFlow(sumLpm: number): number;
}

/** One flow threshold → standard DN step (ascending by `maxLpm`). */
interface FireSizingStep {
  readonly maxLpm: number;
  readonly dn: number;
}

/**
 * Velocity-limited (v ≤ ~6 m/s) wet-pipe DN selection table. Ascending thresholds; the first
 * step whose `maxLpm` ≥ Σflow wins. Above the last threshold → the largest DN. Each `maxLpm`
 * is the flow a that DN passes at the velocity ceiling (see file header).
 */
const VELOCITY_LIMITED_STEPS: readonly FireSizingStep[] = [
  { maxLpm: 110, dn: 20 },
  { maxLpm: 175, dn: 25 },
  { maxLpm: 285, dn: 32 },
  { maxLpm: 450, dn: 40 },
  { maxLpm: 705, dn: 50 },
  { maxLpm: 1190, dn: 65 },
  { maxLpm: 1805, dn: 80 },
];

/** DN used when Σflow exceeds the last tabulated threshold (L/min). */
const VELOCITY_LIMITED_MAX_DN = 100;

/** The pilot fire sizing standard (velocity-limited wet pipe, v ≤ ~6 m/s). */
export const VELOCITY_LIMITED_FIRE_SIZING: FireSizingStandard = {
  id: 'velocity-limited(v≤6m/s,wet)',
  diameterForFlow(sumLpm: number): number {
    for (const step of VELOCITY_LIMITED_STEPS) {
      if (sumLpm <= step.maxLpm) return step.dn;
    }
    return VELOCITY_LIMITED_MAX_DN;
  },
};
