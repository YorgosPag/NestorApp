/**
 * Boiler modulation / turndown ratio — pure SSoT (ADR-408 Εύρος Β #2).
 *
 * Revit «Turndown Ratio» / IFC `Pset_BoilerTypeCommon.PartialLoadEfficiency` family of
 * part-load properties. A MODULATING boiler does not run on/off — it continuously varies
 * its firing rate between a MINIMUM output and its NOMINAL (maximum) output. The boiler
 * stores the minimum modulating output (`minThermalOutputW`); the nominal/maximum is the
 * existing `thermalOutputW`. The TURNDOWN RATIO is the headline equipment figure:
 *
 *     turndown = thermalOutputW (max) / minThermalOutputW (min)
 *
 * e.g. a 24 kW boiler that modulates down to 6 kW has a 4:1 turndown. A boiler with no
 * minimum (`minThermalOutputW` absent) is a fixed-output / on-off appliance — no turndown.
 *
 * Pure + unit-tested; NO import from `mep-boiler-symbol`/renderer (mirrors the
 * `boiler-efficiency.ts` discipline). Feeds the plan tag today and future part-load sizing.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see ./boiler-efficiency
 */

/**
 * Resolves a boiler's turndown ratio from its minimum modulating output and its nominal
 * (maximum) output. Pure: returns `max / min` rounded to one decimal when BOTH are present,
 * positive, and `min < max` (a genuine modulating range); otherwise `null` — meaning the
 * boiler is a fixed-output / on-off appliance (or the inputs are invalid).
 *
 * Examples: `(6000, 24000) → 4` (4:1), `(7000, 24000) → 3.4`, `(24000, 24000) → null`
 * (no range), `(undefined, 24000) → null` (on/off).
 *
 * @param minW Minimum modulating output (W) — `MepBoilerParams.minThermalOutputW`.
 * @param maxW Nominal / maximum output (W) — `MepBoilerParams.thermalOutputW`.
 */
export function resolveTurndownRatio(
  minW: number | undefined,
  maxW: number | undefined,
): number | null {
  if (typeof minW !== 'number' || typeof maxW !== 'number') return null;
  if (minW <= 0 || maxW <= 0 || minW >= maxW) return null;
  return Math.round((maxW / minW) * 10) / 10;
}
