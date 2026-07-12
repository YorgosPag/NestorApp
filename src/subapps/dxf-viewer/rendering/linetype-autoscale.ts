/**
 * Linetype auto-scale — ADR-510 Φ2H (per-scene LTSCALE density fit).
 *
 * Nestor treats every linetype pattern (ISO catalog AND DXF-imported custom) as a
 * numeric mm-convention array, scaled at stroke time by `LTSCALE × zoom`
 * (`linetype-dash-resolver.ts`). That is correct for mm-native drawings, but a DXF
 * authored in METERS is baked to canonical mm at import (ADR-462, geometry ×1000)
 * while its dash pattern keeps its raw magnitude — so an `ACAD_ISO10W100` pattern
 * (period 18) on a 13 m line renders 13272mm / 18mm ≈ 737 periods, i.e. each dash is
 * far sub-pixel → the line looks SOLID (the reported bug).
 *
 * Rather than rescale the pattern (which would diverge custom from catalog linetypes
 * and break round-trip), we resolve ONE per-scene base `LTSCALE` at import so dashed
 * linework lands at a visible density — exactly what an AutoCAD user does with the
 * `LTSCALE` command. The file's own `$LTSCALE` wins when it is non-default; otherwise
 * this heuristic fits the density. The user can always override live via the
 * status-bar `LinetypeScaleControl` (the two compose multiplicatively).
 *
 * Deliberately conservative: when the natural density is already in a good visible
 * band, it returns `1` (no change) so mm-native scenes that render fine today are
 * untouched — only pathological (too-dense meter scenes / too-sparse) are adjusted.
 */

import { resolveLinetypeDef } from './linetype-dash-resolver';

/** Target dash periods across the drawing diagonal when an adjustment is applied. */
export const AUTO_LTSCALE_TARGET_PERIODS = 24;
/** Natural density (periods across diagonal) at/above which we leave the scene alone. */
export const AUTO_LTSCALE_MIN_GOOD_PERIODS = 6;
/** Natural density (periods across diagonal) up to which we leave the scene alone. */
export const AUTO_LTSCALE_MAX_GOOD_PERIODS = 80;
/** Safety clamps so a degenerate input can never produce a 0 / runaway LTSCALE. */
export const AUTO_LTSCALE_CLAMP_MIN = 1e-4;
export const AUTO_LTSCALE_CLAMP_MAX = 1e4;

/** Neutral LTSCALE (no scaling) — mirrors `LinetypeScaleStore.DEFAULT_LTSCALE`. */
const NEUTRAL_LTSCALE = 1;

/** Total pattern period in mm (sum of |dash| + |gap| + |dot|). `0` for solid. */
export function linetypePeriodMm(pattern: ReadonlyArray<number>): number {
  let total = 0;
  for (const v of pattern) total += Math.abs(v);
  return total;
}

/**
 * The coarsest (largest-period) non-solid linetype period in mm among the given
 * names, resolved through the catalog∪registry SSoT. Basing the fit on the COARSEST
 * pattern guarantees even it lands visible; finer patterns become denser but still
 * read as dashed. Returns `0` when no name resolves to a non-solid pattern.
 */
export function maxUsedLinetypePeriodMm(names: Iterable<string>): number {
  let max = 0;
  for (const name of names) {
    const def = resolveLinetypeDef(name);
    if (!def) continue;
    const period = linetypePeriodMm(def.pattern);
    if (period > max) max = period;
  }
  return max;
}

/**
 * Resolve the per-scene base LTSCALE that brings a representative dash pattern to a
 * visible density on the drawing. Returns `1` (no change) when the natural density is
 * already in the good band or when inputs are degenerate — so it is a safe no-op for
 * every scene that renders fine today.
 */
export function computeAutoLinetypeScale(params: {
  diagonalMm: number;
  representativePeriodMm: number;
}): number {
  const { diagonalMm, representativePeriodMm } = params;
  if (
    !Number.isFinite(diagonalMm) || diagonalMm <= 0 ||
    !Number.isFinite(representativePeriodMm) || representativePeriodMm <= 0
  ) {
    return NEUTRAL_LTSCALE;
  }
  const naturalPeriods = diagonalMm / representativePeriodMm;
  // Already a good visible density → stay faithful (no scaling).
  if (naturalPeriods >= AUTO_LTSCALE_MIN_GOOD_PERIODS && naturalPeriods <= AUTO_LTSCALE_MAX_GOOD_PERIODS) {
    return NEUTRAL_LTSCALE;
  }
  // Too dense (meter-scale drawings) or too sparse (one long dash) → fit to target.
  const lt = naturalPeriods / AUTO_LTSCALE_TARGET_PERIODS;
  return Math.min(AUTO_LTSCALE_CLAMP_MAX, Math.max(AUTO_LTSCALE_CLAMP_MIN, lt));
}
