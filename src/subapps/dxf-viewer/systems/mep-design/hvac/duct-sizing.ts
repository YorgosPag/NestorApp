/**
 * ADR-432 — Stage 4 Sizing: round duct diameter from cumulative air-flow (SSoT).
 *
 * The Revit/MagiCAD/4M-FINE-grade behaviour: a trunk near the AHU carries the air-flow
 * of every terminal downstream → larger Ø; a branch to a single diffuser carries that
 * diffuser's air-flow → small Ø. So diameters **diminish** toward the terminals (mirror
 * of the water ΣLU→DN sizing). The air-flow→Ø mapping is a **pluggable `DuctSizingStandard`**.
 *
 * The pilot standard is **ASHRAE equal-friction** at a constant ~0.8–1.0 Pa/m design
 * friction rate, snapped to the next standard round-duct size — represented here as a
 * step table (the equal-friction chart pre-evaluated at standard sizes, velocity-checked
 * for ≤ main-duct limits). A full iterative equal-friction / velocity solver
 * (Colebrook + Altshul) swaps in behind this same interface (ADR-432 §gap), exactly as
 * the water sizing reserves the full hydraulic engine behind `SizingStandard`.
 *
 * @see ../water/water-sizing.ts (the DN-from-LU analogue / template)
 */

/** Pluggable duct sizing standard: cumulative air-flow (m³/h) → round duct Ø (mm). */
export interface DuctSizingStandard {
  readonly id: string;
  /** Round duct nominal Ø (mm) for a cumulative air-flow sum (m³/h). */
  diameterForAirflow(sumCmh: number): number;
}

/** One air-flow threshold → standard round-duct Ø step (ascending by `maxCmh`). */
interface DuctSizingStep {
  readonly maxCmh: number;
  readonly diameterMm: number;
}

/**
 * ASHRAE equal-friction round-duct selection table (~0.8–1.0 Pa/m, velocity-checked).
 * Ascending thresholds; the first step whose `maxCmh` ≥ Σair-flow wins. Above the last
 * threshold → the largest size. Sizes are the standard spiral-duct diameters.
 */
const EQUAL_FRICTION_STEPS: readonly DuctSizingStep[] = [
  { maxCmh: 100, diameterMm: 100 },
  { maxCmh: 180, diameterMm: 125 },
  { maxCmh: 320, diameterMm: 160 },
  { maxCmh: 540, diameterMm: 200 },
  { maxCmh: 900, diameterMm: 250 },
  { maxCmh: 1500, diameterMm: 315 },
  { maxCmh: 2500, diameterMm: 400 },
];

/** Ø used when Σair-flow exceeds the last tabulated threshold (m³/h). */
const EQUAL_FRICTION_MAX_DIAMETER_MM = 500;

/** The pilot duct sizing standard (ASHRAE equal-friction, round duct). */
export const ASHRAE_EQUAL_FRICTION_SIZING: DuctSizingStandard = {
  id: 'ASHRAE/equal-friction(~0.9Pa/m)',
  diameterForAirflow(sumCmh: number): number {
    for (const step of EQUAL_FRICTION_STEPS) {
      if (sumCmh <= step.maxCmh) return step.diameterMm;
    }
    return EQUAL_FRICTION_MAX_DIAMETER_MM;
  },
};
