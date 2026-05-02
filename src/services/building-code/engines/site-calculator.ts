/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Pure ΝΟΚ derivation functions for site/plot data.
 * All functions are stateless — no side effects.
 * Called automatically on every PlotSite mutation to refresh derived fields.
 */

import type { PlotFrontage, PlotSite } from '@/services/building-code/types/site.types';
import { applyBonuses } from '@/services/building-code/engines/bonus-calculator';
import { computeSetbackResult } from '@/services/building-code/engines/setback-calculator';
import { DEFAULT_DELTA_MIN_M } from '@/services/building-code/constants/setback.constants';

/**
 * ΣΔ_εφαρμοστέος = Σ(μήκος_i × ΣΔ_i) / Σ(μήκος_i)
 *
 * Each frontage uses its own syntOverride if set, otherwise the zone-wide defaultSynt.
 * Single-zone plots (all syntOverride = null): result = defaultSynt.
 * Multi-zone plots: weighted average of per-frontage ΣΔ values.
 */
export function calcSyntEfarm(
  frontages: readonly PlotFrontage[],
  defaultSynt: number,
): number {
  if (frontages.length === 0) return defaultSynt;

  const totalLength = frontages.reduce((sum, f) => sum + f.frontageLength, 0);
  if (totalLength === 0) return defaultSynt;

  const weighted = frontages.reduce(
    (sum, f) => sum + f.frontageLength * (f.syntOverride ?? defaultSynt),
    0,
  );
  return weighted / totalLength;
}

/** Κάλυψη m² = area × pct / 100 */
export function calcMaxCoverageM2(area: number, pct: number): number {
  return area * pct / 100;
}

/** Υποχρεωτικός Ακάλυπτος = area × (1 − pct/100) */
export function calcMandatoryOpenM2(area: number, pct: number): number {
  return area * (1 - pct / 100);
}

/** Μέγιστο Δομήσιμο m² = syntEfarm × area */
export function calcMaxBuildableM2(area: number, syntEfarm: number): number {
  return syntEfarm * area;
}

/** Εμβαδό τεμαχίου (gross) = net area + expropriated area */
export function calcOriginalArea(area: number, expropriationArea: number): number {
  return area + expropriationArea;
}

type DerivedFields =
  | 'syntEfarm'
  | 'maxCoverageM2'
  | 'mandatoryOpenM2'
  | 'maxBuildableM2'
  | 'originalArea'
  | 'bonusResult'
  | 'setbackResult';

/**
 * Derives all computed fields in a single pass.
 * Input is a PlotSite without derived fields.
 * Returns only the derived fields — merge with partial to produce a full PlotSite.
 */
export function deriveSiteValues(
  partial: Omit<PlotSite, DerivedFields>,
): Pick<PlotSite, DerivedFields> {
  const syntEfarm = calcSyntEfarm(partial.frontages, partial.synt);
  const maxCoverageM2 = calcMaxCoverageM2(partial.area, partial.maxCoveragePct);
  const maxBuildableM2 = calcMaxBuildableM2(partial.area, syntEfarm);

  return {
    syntEfarm,
    maxCoverageM2,
    mandatoryOpenM2: calcMandatoryOpenM2(partial.area, partial.maxCoveragePct),
    maxBuildableM2,
    originalArea: calcOriginalArea(
      partial.area,
      partial.expropriation.hasExpropriation ? partial.expropriation.area : 0,
    ),
    bonusResult: applyBonuses(
      { ...partial, syntEfarm, maxCoverageM2, maxBuildableM2 },
      partial.bonuses ?? {},
    ),
    setbackResult: partial.polyOutline && partial.polyFrontageEdges
      ? computeSetbackResult({
          polyOutline: partial.polyOutline,
          polyFrontageEdges: partial.polyFrontageEdges,
          plotType: partial.plotType,
          D_m: partial.D_m,
          delta_m: partial.delta_m ?? DEFAULT_DELTA_MIN_M,
          frontages: partial.frontages,
        })
      : null,
  };
}
