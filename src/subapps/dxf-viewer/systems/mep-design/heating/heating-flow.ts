/**
 * ADR-428 — Stage 1 Demand: hydronic design flow from thermal output (SSoT, pluggable).
 *
 * A heating terminal's design mass-flow follows the heat-carrier equation:
 *
 *     Q [W] = ṁ [kg/s] · c [J/kgK] · ΔΤ [K]      ⇒   ṁ = Q / (c · ΔΤ)
 *     V̇ [l/s] = ṁ / ρ [kg/m³] · 1000             ⇒   V̇ = Q / (ρ · c · ΔΤ) · 1000
 *
 * The design ΔΤ (supply − return) is the regime the system is balanced to — Revit's
 * "System Type temperatures". v1 LOCKs the common residential **70/50 regime (ΔΤ = 20K)**.
 * Water properties (c, ρ) and the fallback output for an unsized terminal are part of the
 * pluggable `HeatingDemandStandard`, so a different regime (e.g. low-temp 45/35 for heat
 * pumps) is a new standard, never an engine change.
 *
 * @see ./heating-discipline.ts (selects the standard)
 * @see ../water/water-loading-units.ts (the water-supply demand counterpart)
 */

/** A pluggable heating demand standard: thermal output (W) → design flow (l/s). */
export interface HeatingDemandStandard {
  readonly id: string;
  /** Design temperature difference supply − return (K). */
  readonly designDeltaTK: number;
  /** Specific heat capacity of the carrier (J/kg·K) — water ≈ 4187. */
  readonly specificHeatJperKgK: number;
  /** Carrier density (kg/m³) — water ≈ 1000 (1 l = 1 kg). */
  readonly densityKgPerM3: number;
  /** Output (W) assumed for a terminal that has no `thermalOutputW` set yet. */
  readonly defaultTerminalOutputW: number;
  /** Design volumetric flow (l/s) for a thermal output (W). */
  flowLpsForOutputW(thermalOutputW: number): number;
}

/** The pilot heating demand standard (70/50 regime, ΔΤ = 20K, water). */
export const HEATING_70_50_DEMAND_STANDARD: HeatingDemandStandard = {
  id: 'EN12831/70-50(ΔΤ20K)',
  designDeltaTK: 20,
  specificHeatJperKgK: 4187,
  densityKgPerM3: 1000,
  defaultTerminalOutputW: 1500,
  flowLpsForOutputW(thermalOutputW: number): number {
    if (!(thermalOutputW > 0)) return 0;
    // V̇ [m³/s] = Q / (ρ · c · ΔΤ); ×1000 → l/s.
    return (thermalOutputW / (this.densityKgPerM3 * this.specificHeatJperKgK * this.designDeltaTK)) * 1000;
  },
};

/**
 * Design flow (l/s) for a terminal, using its catalogue output or the standard's fallback
 * when the terminal has not been sized yet (ADR-422 L2 may not have run). Never negative.
 */
export function flowLpsForTerminal(
  standard: HeatingDemandStandard,
  thermalOutputW: number | undefined,
): { readonly thermalOutputW: number; readonly flowLps: number } {
  const output = thermalOutputW != null && thermalOutputW > 0
    ? thermalOutputW
    : standard.defaultTerminalOutputW;
  return { thermalOutputW: output, flowLps: standard.flowLpsForOutputW(output) };
}
