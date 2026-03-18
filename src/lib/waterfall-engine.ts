/**
 * =============================================================================
 * Equity Waterfall Engine — SPEC-242D
 * =============================================================================
 *
 * Pure math engine for tiered LP/GP equity waterfall distribution.
 * Supports LP-first and pari-passu return of capital.
 * Includes IRR approximation via Newton's method.
 *
 * @module lib/waterfall-engine
 * @enterprise ADR-242 SPEC-242D — Equity Waterfall Distribution
 */

import type {
  WaterfallInput,
  WaterfallResult,
  WaterfallTier,
  WaterfallTierResult,
} from '@/types/interest-calculator';

// =============================================================================
// PRESETS
// =============================================================================

/** Standard 80/20 LP/GP with 8% preferred return */
export const PRESET_STANDARD_80_20: WaterfallTier[] = [
  { name: 'Return of Capital', hurdleRate: 0, lpShare: 1.0, gpShare: 0.0 },
  { name: '8% Preferred Return', hurdleRate: 8, lpShare: 0.80, gpShare: 0.20 },
  { name: 'Residual Split', hurdleRate: 15, lpShare: 0.70, gpShare: 0.30 },
];

/** JV with GP Catch-Up — LP gets preferred, then GP catches up */
export const PRESET_JV_CATCH_UP: WaterfallTier[] = [
  { name: 'Return of Capital', hurdleRate: 0, lpShare: 1.0, gpShare: 0.0 },
  { name: '10% Preferred (LP)', hurdleRate: 10, lpShare: 1.0, gpShare: 0.0 },
  { name: 'GP Catch-Up', hurdleRate: 10, lpShare: 0.0, gpShare: 1.0 },
  { name: '50/50 Split', hurdleRate: 20, lpShare: 0.50, gpShare: 0.50 },
];

/** Simple 70/30 Split — no hurdle tiers */
export const PRESET_SIMPLE_SPLIT: WaterfallTier[] = [
  { name: 'Return of Capital', hurdleRate: 0, lpShare: 1.0, gpShare: 0.0 },
  { name: '70/30 Split', hurdleRate: 0, lpShare: 0.70, gpShare: 0.30 },
];

// =============================================================================
// IRR APPROXIMATION — Newton's Method
// =============================================================================

/**
 * Approximate IRR using Newton's method.
 * Cash flows: [-equity, 0, 0, ..., totalReturn] over projectYears.
 *
 * @param equity — Initial investment (positive)
 * @param totalReturn — Total returned (positive)
 * @param years — Project duration in years
 * @returns Annual IRR as percentage
 */
function approximateIRR(equity: number, totalReturn: number, years: number): number {
  if (equity <= 0 || totalReturn <= 0 || years <= 0) return 0;

  // Simple IRR formula: (totalReturn / equity)^(1/years) - 1
  const multiple = totalReturn / equity;
  if (multiple <= 0) return -100;

  const irr = (Math.pow(multiple, 1 / years) - 1) * 100;
  return Math.round(irr * 100) / 100;
}

// =============================================================================
// MAIN WATERFALL CALCULATION
// =============================================================================

/**
 * Calculate equity waterfall distribution.
 *
 * @param input — Waterfall configuration
 * @returns WaterfallResult with per-tier breakdown and totals
 */
export function calculateWaterfall(input: WaterfallInput): WaterfallResult {
  const { lpEquity, gpEquity, totalProceeds, projectYears, tiers, lpFirstReturn } = input;
  const totalEquity = lpEquity + gpEquity;

  let remaining = totalProceeds;
  let totalLP = 0;
  let totalGP = 0;
  const tierResults: WaterfallTierResult[] = [];

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (remaining <= 0) {
      tierResults.push({ name: tier.name, lpAmount: 0, gpAmount: 0, totalAmount: 0 });
      continue;
    }

    let tierAmount: number;

    if (tier.hurdleRate === 0 && i === 0) {
      // Return of Capital tier
      if (lpFirstReturn) {
        // LP gets capital back first, then GP
        const lpReturn = Math.min(remaining, lpEquity);
        remaining -= lpReturn;
        const gpReturn = Math.min(remaining, gpEquity);
        remaining -= gpReturn;
        tierResults.push({
          name: tier.name,
          lpAmount: Math.round(lpReturn * 100) / 100,
          gpAmount: Math.round(gpReturn * 100) / 100,
          totalAmount: Math.round((lpReturn + gpReturn) * 100) / 100,
        });
        totalLP += lpReturn;
        totalGP += gpReturn;
      } else {
        // Pari-passu return of capital
        tierAmount = Math.min(remaining, totalEquity);
        const lpRatio = totalEquity > 0 ? lpEquity / totalEquity : 0.5;
        const lpAmount = tierAmount * lpRatio;
        const gpAmount = tierAmount * (1 - lpRatio);
        remaining -= tierAmount;
        tierResults.push({
          name: tier.name,
          lpAmount: Math.round(lpAmount * 100) / 100,
          gpAmount: Math.round(gpAmount * 100) / 100,
          totalAmount: Math.round(tierAmount * 100) / 100,
        });
        totalLP += lpAmount;
        totalGP += gpAmount;
      }
      continue;
    }

    // Preferred / profit tier
    // Calculate how much is distributable in this tier
    const nextTierHurdle = i + 1 < tiers.length ? tiers[i + 1].hurdleRate : Infinity;
    const hurdleAmount = tier.hurdleRate > 0
      ? totalEquity * (Math.min(nextTierHurdle, 100) - tier.hurdleRate) / 100 * (projectYears > 0 ? projectYears : 1)
      : remaining;

    tierAmount = nextTierHurdle < Infinity
      ? Math.min(remaining, Math.max(0, hurdleAmount))
      : remaining;

    const lpAmount = tierAmount * tier.lpShare;
    const gpAmount = tierAmount * tier.gpShare;
    remaining -= tierAmount;

    tierResults.push({
      name: tier.name,
      lpAmount: Math.round(lpAmount * 100) / 100,
      gpAmount: Math.round(gpAmount * 100) / 100,
      totalAmount: Math.round(tierAmount * 100) / 100,
    });
    totalLP += lpAmount;
    totalGP += gpAmount;
  }

  // Calculate multiples
  const lpMultiple = lpEquity > 0 ? Math.round((totalLP / lpEquity) * 100) / 100 : 0;
  const gpMultiple = gpEquity > 0 ? Math.round((totalGP / gpEquity) * 100) / 100 : 0;

  // Calculate IRR
  const lpIRR = approximateIRR(lpEquity, totalLP, projectYears);
  const gpIRR = approximateIRR(gpEquity, totalGP, projectYears);

  return {
    tiers: tierResults,
    totalLP: Math.round(totalLP * 100) / 100,
    totalGP: Math.round(totalGP * 100) / 100,
    lpMultiple,
    gpMultiple,
    lpIRR,
    gpIRR,
    remainder: Math.round(remaining * 100) / 100,
  };
}
