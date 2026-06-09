/**
 * ADR-433 — Stage 1 Demand: design discharge flow per sprinkler head (SSoT, pluggable).
 *
 * The pilot demand model assigns a constant design discharge flow (L/min) per sprinkler
 * head — the simplest honest model (mirror of the water Loading-Units / HVAC constant
 * air-flow pilots). The default ≈ NFPA 13 light-hazard (Ordinary Hazard) practice: a
 * design density of ~5 mm/min over a ~12 m² coverage area ⇒ ~60 L/min, raised to ~80 L/min
 * to bracket the minimum K-factor head discharge (Q = K·√P) at typical residual pressure.
 *
 * The standard is **pluggable** (`FireDemandStandard`) so a full hydraulic model (per
 * hazard class density × area-of-operation, or the explicit K-factor Q = K·√P with a
 * solved residual pressure) swaps in as a new standard, never an engine change — exactly as
 * the water demand reserves the full EN 806 model behind `DemandStandard`.
 *
 * @see ../water/water-loading-units.ts (the Loading-Units analogue / template)
 * @see ../hvac/air-flow-standard.ts (the constant-per-terminal analogue)
 */

/** A pluggable fire-protection demand standard (the design-flow source). */
export interface FireDemandStandard {
  readonly id: string;
  /** Design discharge flow (L/min) for a sprinkler-head kind. */
  flowForTerminal(terminalKind: string): number;
}

/** Pilot constant design discharge flow per sprinkler head (L/min) — NFPA 13 light hazard. */
export const DEFAULT_SPRINKLER_FLOW_LPM = 80;

/**
 * The pilot fire demand standard: a flat per-head design discharge flow. Kind-agnostic for
 * now (every sprinkler head draws the same); a richer per-hazard-class / density-area table
 * swaps in behind this interface.
 */
export const NFPA13_LIGHT_HAZARD_DEMAND_STANDARD: FireDemandStandard = {
  id: 'NFPA13/light-hazard(80lpm-per-head)',
  flowForTerminal(_terminalKind: string): number {
    return DEFAULT_SPRINKLER_FLOW_LPM;
  },
};
