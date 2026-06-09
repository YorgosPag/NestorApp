/**
 * ADR-434 — Stage 4 Sizing: round fuel-pipe diameter from cumulative gas flow (SSoT).
 *
 * The Revit/MagiCAD/4M-FINE-grade behaviour: a trunk near the meter carries the gas flow of
 * every appliance downstream → larger Ø; a branch to a single hob carries that hob's flow →
 * small Ø. So diameters **diminish** toward the appliances (mirror of the duct Σair-flow→Ø
 * sizing). The flow→Ø mapping is a **pluggable `GasSizingStandard`**.
 *
 * The pilot standard is a **velocity-limited low-pressure** selection (DVGW G600 / EN 1775,
 * v ≤ 6 m/s for low-pressure domestic gas), pre-evaluated at standard nominal diameters and
 * represented here as a step table. A full pressure-drop solver (Renouard / Pole equation,
 * allowable Δp over the longest run) swaps in behind this same interface (ADR-434 §gap),
 * exactly as the HVAC sizing reserves the full equal-friction solver.
 *
 * @see ../hvac/duct-sizing.ts (the Ø-from-flow analogue / template)
 */

/** Pluggable gas sizing standard: cumulative gas flow (m³/h) → round fuel-pipe Ø (mm). */
export interface GasSizingStandard {
  readonly id: string;
  /** Round fuel-pipe nominal Ø (mm) for a cumulative gas-flow sum (m³/h). */
  diameterForFlow(sumCmh: number): number;
}

/** One gas-flow threshold → standard nominal Ø step (ascending by `maxCmh`). */
interface GasSizingStep {
  readonly maxCmh: number;
  readonly diameterMm: number;
}

/**
 * Velocity-limited low-pressure gas selection table (DVGW G600 / EN 1775, v ≤ 6 m/s).
 * Ascending thresholds; the first step whose `maxCmh` ≥ Σflow wins. Above the last threshold
 * → the largest size. Sizes are standard nominal diameters (DN15…DN50).
 */
const LOW_PRESSURE_STEPS: readonly GasSizingStep[] = [
  { maxCmh: 2.5, diameterMm: 15 },
  { maxCmh: 6, diameterMm: 20 },
  { maxCmh: 16, diameterMm: 25 },
  { maxCmh: 40, diameterMm: 32 },
  { maxCmh: 100, diameterMm: 40 },
];

/** Ø used when Σflow exceeds the last tabulated threshold (m³/h). */
const LOW_PRESSURE_MAX_DIAMETER_MM = 50;

/** The pilot gas sizing standard (velocity-limited low-pressure, round fuel pipe). */
export const LOW_PRESSURE_VELOCITY_SIZING: GasSizingStandard = {
  id: 'DVGW-G600/EN1775/velocity-limited(v≤6m/s)',
  diameterForFlow(sumCmh: number): number {
    for (const step of LOW_PRESSURE_STEPS) {
      if (sumCmh <= step.maxCmh) return step.diameterMm;
    }
    return LOW_PRESSURE_MAX_DIAMETER_MM;
  },
};
