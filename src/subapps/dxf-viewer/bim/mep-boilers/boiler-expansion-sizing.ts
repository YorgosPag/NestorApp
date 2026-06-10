/**
 * Boiler expansion-vessel sizing — pure SSoT (ADR-408 Εύρος Β #2).
 *
 * Revit / IFC sealed-system accessory sizing. A sealed heating system must carry a
 * diaphragm EXPANSION VESSEL ({@link MepBoilerParams.expansionVessel}) sized to absorb
 * the thermal expansion of the system water as it heats from cold-fill to flow
 * temperature. This module resolves an INDICATIVE recommended vessel volume from the
 * boiler's WATER CONTENT ({@link MepBoilerParams.waterContentL}), snapped up to the
 * nearest standard rating ({@link BOILER_EXPANSION_VESSEL_VOLUMES_L}).
 *
 * ⚠️ HONESTY (N.HONESTY): this is an ENGINEERING-GUIDANCE ESTIMATE, NOT a code-exact
 * sizing. Correct vessel sizing uses the TOTAL system water volume (boiler body +
 * pipework + emitters) and the actual cold-fill / relief pressures — none of which is
 * known at the boiler entity. The boiler water content alone is only a FRACTION of the
 * total system volume, so we scale it by a documented typical-domestic multiplier and
 * apply a documented expansion/acceptance factor. Treat the result as an indicative
 * lower-bound starting point — a full hydraulic take-off will refine it (mirrors the
 * guidance-heuristic discipline of `boiler-acoustics.ts`).
 *
 *     V_recommended ≈ waterContentL × SYSTEM_VOLUME_MULTIPLIER × EXPANSION_ACCEPTANCE_FACTOR
 *                     → snapped UP to the nearest standard vessel rating.
 *
 * Pure + unit-tested; NO import from `mep-boiler-symbol`/renderer (mirrors the
 * `boiler-acoustics.ts` / `boiler-nox.ts` discipline). Feeds the «Προτεινόμενο δοχείο»
 * readout today (data-only, no glyph).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see ./boiler-acoustics
 */

import { BOILER_EXPANSION_VESSEL_VOLUMES_L } from '../types/mep-boiler-types';

/**
 * Typical-domestic ratio of TOTAL system water volume to the boiler's own water content.
 * The boiler body holds roughly a fifth of a small domestic system's water (the rest is
 * pipework + radiators), so the full volume is estimated as `waterContentL × 5`. A
 * documented assumption, NOT a measured value — see the file-level HONESTY note.
 */
export const SYSTEM_VOLUME_MULTIPLIER = 5;

/**
 * Combined thermal-expansion fraction × vessel-acceptance reciprocal at typical domestic
 * charge/relief pressures. Water expands ≈ 3% heating to ~75 °C; a diaphragm vessel only
 * accepts ≈ half its nominal volume between fill and relief pressure, so the required
 * vessel volume is ≈ 6% of the system water. A documented engineering factor, not a
 * code-exact figure — see the file-level HONESTY note.
 */
export const EXPANSION_ACCEPTANCE_FACTOR = 0.06;

/**
 * Resolves an INDICATIVE recommended expansion-vessel volume (L) from a boiler's water
 * content, snapped UP to the nearest standard rating in {@link BOILER_EXPANSION_VESSEL_VOLUMES_L}.
 * Pure. Returns `null` when the figure cannot apply — absent, non-numeric or non-positive
 * water content (treated as unspecified).
 *
 * The raw estimate `waterContentL × SYSTEM_VOLUME_MULTIPLIER × EXPANSION_ACCEPTANCE_FACTOR`
 * is rounded UP to the smallest standard rating that meets it; an estimate above the
 * largest rating clamps to the largest (so the recommendation is always a real vessel size).
 *
 * Examples (with the standard [8, 12, 18, 24, 35] L ratings): `(2.5) → 8` (small wall-hung
 * gas), `(28) → 12`, `(38) → 12` (floor-standing oil), `(undefined) → null`, `(0) → null`.
 *
 * @param waterContentL Boiler water content (L) — `MepBoilerParams.waterContentL`.
 */
export function resolveRecommendedExpansionVesselL(
  waterContentL: number | undefined,
): number | null {
  if (typeof waterContentL !== 'number' || waterContentL <= 0) return null;
  const rawL = waterContentL * SYSTEM_VOLUME_MULTIPLIER * EXPANSION_ACCEPTANCE_FACTOR;
  // Standard ratings are authored ascending; snap UP to the first rating that meets the
  // estimate, clamping to the largest available (the recommendation is always a real size).
  const ratings = BOILER_EXPANSION_VESSEL_VOLUMES_L;
  for (const rating of ratings) {
    if (rating >= rawL) return rating;
  }
  return ratings[ratings.length - 1];
}
