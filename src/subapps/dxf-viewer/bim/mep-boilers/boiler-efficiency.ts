/**
 * Boiler combustion efficiency + EU ErP energy class — pure SSoT (ADR-408 Εύρος Β #2).
 *
 * Revit «Boiler Efficiency» / IFC `Pset_BoilerTypeCommon.NominalEfficiency`. A boiler
 * stores a SEASONAL APPLIANCE EFFICIENCY (`seasonalEfficiencyPercent`) — what the user
 * reads on the equipment (e.g. condensing gas ≈94%, heat-pump ≈156%). The EU energy
 * label CLASS (Regulation 811/2013, "ErP / ecodesign") is a SEPARATE concept derived
 * from the *primary-energy-adjusted* seasonal space-heating efficiency η_s:
 *
 *     η_s = seasonalEfficiencyPercent / primaryEnergyFactor(fuel)
 *
 * For fossil fuels (gas/oil) and heat-pumps the factor is 1.0 (the heat-pump value is
 * already an SCOP-derived η_s well above 100%). For DIRECT ELECTRIC heating the EU
 * conversion coefficient CC = 2.5 applies, so a ~99% resistance boiler lands at
 * η_s ≈ 40% → class D — the physically-correct ErP outcome (NOT "A+").
 *
 * The official 811/2013 class ladder is applied to η_s. Pure + unit-tested; NO import
 * from `mep-boiler-symbol`/renderer (mirrors the `boiler-flue-terminal.ts` discipline).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see ./boiler-model-catalog
 */

import type { BoilerFuelType } from './boiler-model-catalog';

/** EU ErP (811/2013) space-heater energy-efficiency class, best → worst. */
export type ErpEfficiencyClass =
  | 'A+++'
  | 'A++'
  | 'A+'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G';

/** Ordered registry of every ErP class (best → worst) — drives validation/UI. */
export const ERP_EFFICIENCY_CLASSES: readonly ErpEfficiencyClass[] = [
  'A+++',
  'A++',
  'A+',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
];

const ERP_CLASS_SET: ReadonlySet<string> = new Set<string>(ERP_EFFICIENCY_CLASSES);

/** Narrowing guard — `true` when `value` is a known {@link ErpEfficiencyClass}. */
export function isErpEfficiencyClass(value: string): value is ErpEfficiencyClass {
  return ERP_CLASS_SET.has(value);
}

/**
 * EU primary-energy conversion factor per fuel (Regulation 811/2013). Direct electric
 * heating carries the CC = 2.5 grid coefficient; combustion + heat-pump η_s already
 * embed their own conversion, so the factor is 1.0. Unknown/parametric ⇒ treated as
 * fossil (1.0) — the conservative default.
 */
const PRIMARY_ENERGY_FACTOR: Readonly<Record<BoilerFuelType, number>> = {
  gas: 1.0,
  oil: 1.0,
  'heat-pump': 1.0,
  electric: 2.5,
};

/**
 * Lower-bound η_s threshold (inclusive) for each ErP class, best → worst. The first
 * class whose threshold `seasonalEfficiency` meets/exceeds wins; anything below the
 * last threshold falls through to `'G'`.
 */
const ERP_THRESHOLDS: readonly { readonly min: number; readonly cls: ErpEfficiencyClass }[] = [
  { min: 150, cls: 'A+++' },
  { min: 125, cls: 'A++' },
  { min: 98, cls: 'A+' },
  { min: 90, cls: 'A' },
  { min: 82, cls: 'B' },
  { min: 75, cls: 'C' },
  { min: 36, cls: 'D' },
  { min: 34, cls: 'E' },
  { min: 30, cls: 'F' },
];

/** Default ErP class when efficiency is unspecified — the worst (`'G'`), defensively. */
export const DEFAULT_ERP_EFFICIENCY_CLASS: ErpEfficiencyClass = 'G';

/**
 * Resolves the EU ErP energy class for a boiler from its seasonal *appliance* efficiency
 * (%) and fuel type. Pure: divides by the fuel's primary-energy factor to obtain η_s,
 * then walks the official 811/2013 ladder. `fuelType` absent ⇒ fossil factor (1.0).
 *
 * Examples: `(94,'gas') → 'A'`, `(89,'oil') → 'B'`, `(156,'heat-pump') → 'A+++'`,
 * `(99,'electric') → 'D'` (99 / 2.5 = 39.6 → D).
 */
export function resolveErpClass(
  seasonalEfficiencyPercent: number,
  fuelType?: BoilerFuelType,
): ErpEfficiencyClass {
  const factor = fuelType ? PRIMARY_ENERGY_FACTOR[fuelType] : 1.0;
  const etaS = seasonalEfficiencyPercent / factor;
  const hit = ERP_THRESHOLDS.find((t) => etaS >= t.min);
  return hit ? hit.cls : 'G';
}
