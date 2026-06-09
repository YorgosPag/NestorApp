/**
 * ADR-432 — Stage 1 Demand: supply air-flow per terminal (SSoT, pluggable standard).
 *
 * The pilot demand model assigns a constant design air-flow (m³/h) per supply diffuser —
 * the simplest honest model (mirror of the water Loading-Units pilot table). The standard
 * is **pluggable** (`AirDemandStandard`) so a per-space model (ASHRAE 62.1 ventilation rate
 * = area × outdoor-air-rate + people, or an ACH-based room model) swaps in as a new
 * standard, never an engine change.
 *
 * @see ../water/water-loading-units.ts (the Loading-Units analogue / template)
 */

/** A pluggable supply air-flow demand standard. */
export interface AirDemandStandard {
  readonly id: string;
  /** Design supply air-flow (m³/h) for a terminal kind. */
  airflowForTerminal(terminalKind: string): number;
}

/** Pilot constant supply air-flow per diffuser (m³/h) — a typical residential room supply. */
export const DEFAULT_TERMINAL_AIRFLOW_CMH = 150;

/**
 * The pilot air-flow demand standard: a flat per-terminal design air-flow. Kind-agnostic
 * for now (every supply diffuser draws the same); a richer per-kind / per-space table
 * swaps in behind this interface.
 */
export const CONSTANT_AIRFLOW_DEMAND_STANDARD: AirDemandStandard = {
  id: 'constant/150cmh-per-terminal',
  airflowForTerminal(_terminalKind: string): number {
    return DEFAULT_TERMINAL_AIRFLOW_CMH;
  },
};
