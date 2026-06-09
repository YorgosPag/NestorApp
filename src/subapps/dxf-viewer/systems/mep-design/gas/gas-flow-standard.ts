/**
 * ADR-434 — Stage 1 Demand: gas flow per appliance (SSoT, pluggable standard).
 *
 * The pilot demand model assigns a design gas flow (m³/h) per appliance kind — the simplest
 * honest model (mirror of the HVAC constant-air-flow pilot). A gas cooker draws less than a
 * boiler, so the standard is kind-aware with a small lookup + a default. The standard is
 * **pluggable** (`GasDemandStandard`) so a thermal-output-derived model (appliance kW ÷ gas
 * calorific value ≈ 9.5–10 kWh/m³) swaps in as a new standard, never an engine change.
 *
 * @see ../hvac/air-flow-standard.ts (the air analogue / template)
 */

/** A pluggable gas-flow demand standard. */
export interface GasDemandStandard {
  readonly id: string;
  /** Design gas flow (m³/h) for an appliance kind. */
  gasFlowForTerminal(terminalKind: string): number;
}

/** Pilot gas cooker / hob design flow (m³/h) — a typical domestic four-burner hob. */
export const DEFAULT_GAS_COOKER_FLOW_CMH = 1.1;

/** Pilot default gas flow (m³/h) for any other gas appliance (boiler-dominant). */
export const DEFAULT_GAS_APPLIANCE_FLOW_CMH = 2.5;

/**
 * The pilot gas-flow demand standard: a per-appliance design flow. A gas cooker draws the
 * cooker flow; every other gas appliance (boiler, …) draws the default. A richer per-kW /
 * per-appliance table swaps in behind this interface.
 */
export const CONSTANT_GAS_DEMAND_STANDARD: GasDemandStandard = {
  id: 'constant/appliance-flow(m3h)',
  gasFlowForTerminal(terminalKind: string): number {
    return terminalKind === 'gas-cooker'
      ? DEFAULT_GAS_COOKER_FLOW_CMH
      : DEFAULT_GAS_APPLIANCE_FLOW_CMH;
  },
};
