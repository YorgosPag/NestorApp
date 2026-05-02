/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Pure ΝΟΚ bonus calculator functions (ν.4067/2012 πολεοδομικά κίνητρα).
 * Phase 1: A1 (urban incentives), A3 (nZEB energy), A5 (minimum coverage 120 m²).
 * All functions are stateless — no side effects.
 */

import type { PlotSite } from '@/services/building-code/types/site.types';
import type {
  A1Scenario,
  A3Tier,
  BonusLineItem,
  BonusResult,
  BonusSelections,
} from '@/services/building-code/types/bonus.types';
import {
  BONUS_A1_COVERAGE_REDUCTION,
  BONUS_A5_MIN_COVERAGE_M2,
  BONUS_A5_MAX_COVERAGE_PCT,
  NZEB_SD_5PCT,
  NZEB_SD_10PCT,
} from '@/services/building-code/constants/bonuses.constants';

const A1_SUFFIX: Record<A1Scenario, string> = {
  A1a: 'α',
  A1b: 'β',
  A1c: 'γ',
  A1d: 'δ',
};

const A1_SCENARIOS: readonly A1Scenario[] = ['A1a', 'A1b', 'A1c', 'A1d'];

type SiteForBonuses = Pick<
  PlotSite,
  'area' | 'synt' | 'maxCoveragePct' | 'maxBuildableM2' | 'maxCoverageM2' | 'syntEfarm'
> & {
  nokBonusEligible?: boolean;
  isProtectionZone?: boolean;
};

// ─── Individual bonus calculators ───────────────────────────────────────────────

/**
 * A1: Πολεοδομικά κίνητρα (α–δ) — ν.4067/2012, Άρθρο 10 §2.
 * Grants +ΣΔ = baseSynt × pct, penalizes coverage by -area × coveragePct/100 × pct.
 */
export function calcA1Bonus(
  scenario: A1Scenario,
  area: number,
  baseSynt: number,
  maxCoveragePct: number,
): BonusLineItem {
  const pct = BONUS_A1_COVERAGE_REDUCTION[scenario];
  return {
    id: scenario,
    label: `bonus_${scenario}`,
    extraSd: baseSynt * pct,
    extraCoverageM2: -(area * maxCoveragePct / 100 * pct),
    citation: `ν.4067/2012, Άρθρο 10, §2${A1_SUFFIX[scenario]}`,
  };
}

/**
 * A3: nZEB ενεργειακή αναβάθμιση — ν.4067/2012, Άρθρο 25.
 * Grants +5% or +10% ΣΔ. No coverage impact.
 */
export function calcA3Bonus(
  tier: A3Tier,
  _area: number,
  _baseSynt: number,
): BonusLineItem {
  const extraSd = tier === '5pct' ? NZEB_SD_5PCT : NZEB_SD_10PCT;
  const id = tier === '5pct' ? ('A3_5' as const) : ('A3_10' as const);
  return {
    id,
    label: `bonus_${id}`,
    extraSd,
    extraCoverageM2: 0,
    citation: 'ν.4067/2012, Άρθρο 25',
  };
}

/**
 * A5: Ελάχιστη κάλυψη 120 m² — ν.4067/2012, Άρθρο 15 §7.
 * Auto-applied when current coverage < 120 m² and maxCoveragePct ≤ 70%.
 * Returns null if bonus not applicable.
 */
export function calcA5Bonus(
  currentCoverageM2: number,
  area: number,
  maxCoveragePct: number,
): BonusLineItem | null {
  if (currentCoverageM2 >= BONUS_A5_MIN_COVERAGE_M2) return null;
  if (maxCoveragePct > BONUS_A5_MAX_COVERAGE_PCT) return null;

  const cap = area * BONUS_A5_MAX_COVERAGE_PCT / 100;
  const extra = Math.min(
    BONUS_A5_MIN_COVERAGE_M2 - currentCoverageM2,
    cap - currentCoverageM2,
  );
  if (extra <= 0) return null;

  return {
    id: 'A5',
    label: 'bonus_A5',
    extraSd: 0,
    extraCoverageM2: extra,
    citation: 'ν.4067/2012, Άρθρο 15, §7',
  };
}

// ─── Empty result ───────────────────────────────────────────────────────────────

const EMPTY_RESULT: BonusResult = {
  items: [],
  totalExtraSd: 0,
  totalExtraCoverageM2: 0,
  adjustedMaxBuildableM2: 0,
  adjustedMaxCoverageM2: 0,
  warnings: [],
};

// ─── Internal helpers (split for ≤40-line function rule) ───────────────────────

/** Apply A1 bonus respecting protection-zone rule (C6). */
function applyA1(
  site: SiteForBonuses,
  selections: BonusSelections,
  warnings: string[],
): BonusLineItem | null {
  const active = A1_SCENARIOS.find((s) => selections[s]);
  if (!active) return null;
  if (site.isProtectionZone) {
    warnings.push('bonus_warn_protection_zone_a1');
    return null;
  }
  return calcA1Bonus(active, site.area, site.syntEfarm, site.maxCoveragePct);
}

/** Apply A3 bonus (mutually exclusive 5pct/10pct, 10pct wins). */
function applyA3(site: SiteForBonuses, selections: BonusSelections): BonusLineItem | null {
  const tier: A3Tier | null =
    selections.A3_10 ? '10pct' : selections.A3_5 ? '5pct' : null;
  if (!tier) return null;
  return calcA3Bonus(tier, site.area, site.syntEfarm);
}

/** Aggregate items into final BonusResult. */
function aggregate(
  site: SiteForBonuses,
  items: readonly BonusLineItem[],
  warnings: readonly string[],
): BonusResult {
  const totalExtraSd = items.reduce((s, i) => s + i.extraSd, 0);
  const totalExtraCoverageM2 = items.reduce((s, i) => s + i.extraCoverageM2, 0);
  return {
    items,
    totalExtraSd,
    totalExtraCoverageM2,
    adjustedMaxBuildableM2: site.maxBuildableM2 + totalExtraSd * site.area,
    adjustedMaxCoverageM2: site.maxCoverageM2 + totalExtraCoverageM2,
    warnings,
  };
}

// ─── Master bonus aggregator ────────────────────────────────────────────────────

/**
 * Applies all selected bonuses to a site and returns the aggregated result.
 * - Guard: nokBonusEligible must be true
 * - C1: A1 + A3 calculated separately on base ΣΔ (not stacked)
 * - C6: A1 disabled in protection zones
 * - A5: auto-applied (no selection needed)
 */
export function applyBonuses(
  site: SiteForBonuses,
  selections: BonusSelections,
): BonusResult {
  if (!site.nokBonusEligible) {
    return {
      ...EMPTY_RESULT,
      adjustedMaxBuildableM2: site.maxBuildableM2,
      adjustedMaxCoverageM2: site.maxCoverageM2,
    };
  }

  const items: BonusLineItem[] = [];
  const warnings: string[] = [];

  const a1 = applyA1(site, selections, warnings);
  if (a1) items.push(a1);

  const a3 = applyA3(site, selections);
  if (a3) items.push(a3);

  const coverageAfterA1 = site.maxCoverageM2 + items.reduce((s, i) => s + i.extraCoverageM2, 0);
  const a5 = calcA5Bonus(coverageAfterA1, site.area, site.maxCoveragePct);
  if (a5) items.push(a5);

  return aggregate(site, items, warnings);
}
