/**
 * Boiler NOx emission compliance — pure SSoT (ADR-408 Εύρος Β #2).
 *
 * Revit «NOx Emission» / IFC `Pset_BoilerTypeCommon` emissions family. The natural
 * companion of the ErP energy class: EU Ecodesign Regulation 813/2013 gates space
 * heaters on TWO axes — seasonal energy efficiency (→ `boiler-efficiency.ts`) AND a
 * NITROGEN-OXIDE EMISSION CEILING that an appliance must not exceed to be placed on
 * the market. The ceiling is fuel-dependent (the combustion chemistry differs):
 *
 *     gaseous fuel  →  ≤  56 mg/kWh (GCV)
 *     liquid fuel   →  ≤ 120 mg/kWh (GCV)
 *
 * Electric and heat-pump appliances burn no fuel, so they have no combustion NOx and
 * the concept does not apply (`null`). The boiler stores its measured emission figure
 * (`noxMgKwh`); this module resolves the COMPLIANCE VERDICT against the per-fuel legal
 * ceiling — the actual market gate, faithful across both combustion fuels (the EN
 * 15502 1–6 class ladder is gas-centric and would not generalise cleanly to oil).
 *
 * Pure + unit-tested; NO import from `mep-boiler-symbol`/renderer (mirrors the
 * `boiler-efficiency.ts` discipline). Feeds the plan tag + «Θερμικά» readout today.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see ./boiler-efficiency
 */

import type { BoilerFuelType } from './boiler-model-catalog';

/**
 * NOx emission compliance verdict against the EU Ecodesign 813/2013 per-fuel ceiling.
 *   - `'compliant'`: measured NOx ≤ the fuel's legal limit (sellable).
 *   - `'exceeds'`:   measured NOx above the limit (non-conforming for the EU market).
 */
export type NoxComplianceClass = 'compliant' | 'exceeds';

/** EU Ecodesign 813/2013 NOx ceiling for gaseous fuels — mg/kWh (GCV). */
export const NOX_LIMIT_GAS_MG_KWH = 56;

/** EU Ecodesign 813/2013 NOx ceiling for liquid fuels — mg/kWh (GCV). */
export const NOX_LIMIT_OIL_MG_KWH = 120;

/**
 * Per-fuel NOx ceiling (mg/kWh). Only the two COMBUSTION fuels have a limit; electric
 * and heat-pump appliances burn nothing → no entry (and therefore no NOx concept).
 */
const NOX_LIMITS: Partial<Record<BoilerFuelType, number>> = {
  gas: NOX_LIMIT_GAS_MG_KWH,
  oil: NOX_LIMIT_OIL_MG_KWH,
};

/**
 * Returns the EU Ecodesign NOx ceiling (mg/kWh) for a fuel, or `null` when the fuel is
 * absent or non-combustion (electric/heat-pump → no combustion NOx, no limit).
 */
export function boilerNoxLimit(fuelType: BoilerFuelType | undefined): number | null {
  if (!fuelType) return null;
  return NOX_LIMITS[fuelType] ?? null;
}

/**
 * Resolves a boiler's NOx compliance verdict from its measured emission figure and fuel.
 * Pure: compares `noxMgKwh` against the fuel's Ecodesign ceiling. Returns `null` when the
 * verdict cannot apply — a missing/invalid figure, or a non-combustion fuel (no ceiling).
 *
 * Examples: `(40,'gas') → 'compliant'`, `(56,'gas') → 'compliant'` (≤ inclusive),
 * `(70,'gas') → 'exceeds'`, `(110,'oil') → 'compliant'`, `(40,'electric') → null`,
 * `(undefined,'gas') → null`.
 *
 * @param noxMgKwh Measured NOx emissions (mg/kWh) — `MepBoilerParams.noxMgKwh`.
 * @param fuelType Heating fuel — `MepBoilerParams.fuelType`.
 */
export function resolveNoxClass(
  noxMgKwh: number | undefined,
  fuelType: BoilerFuelType | undefined,
): NoxComplianceClass | null {
  if (typeof noxMgKwh !== 'number' || noxMgKwh < 0) return null;
  const limit = boilerNoxLimit(fuelType);
  if (limit === null) return null;
  return noxMgKwh <= limit ? 'compliant' : 'exceeds';
}
