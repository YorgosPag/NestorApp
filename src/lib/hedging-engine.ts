/**
 * Hedging Engine — SPEC-242E
 *
 * Pure math functions for comparing interest rate hedging strategies:
 * Floating, Swap, Cap, and Collar. Zero side effects.
 *
 * @module lib/hedging-engine
 * @enterprise ADR-242 SPEC-242E - Hedging Simulator
 */

import type {
  HedgingInput,
  HedgingStrategy,
  HedgingStrategyResult,
  HedgingAnnualEntry,
  HedgingComparisonResult,
} from '@/types/interest-calculator';

// =============================================================================
// STRATEGY CALCULATORS
// =============================================================================

/**
 * Calculate floating rate (unhedged) cost per year.
 * Cost = scenario rate × notional each year.
 */
export function calculateFloatingCost(input: HedgingInput): HedgingStrategyResult {
  const annualBreakdown: HedgingAnnualEntry[] = input.rateScenario.map((rate, i) => {
    const interestCost = (rate / 100) * input.notional;
    return {
      year: i + 1,
      effectiveRate: rate,
      interestCost,
      premiumCost: 0,
      totalCost: interestCost,
    };
  });

  const totalCost = annualBreakdown.reduce((sum, e) => sum + e.totalCost, 0);

  return {
    strategy: 'floating',
    annualBreakdown,
    totalCost,
    averageAnnualCost: totalCost / input.termYears,
    effectiveAverageRate: sumRates(annualBreakdown) / input.termYears,
  };
}

/**
 * Calculate interest rate swap cost per year.
 * Cost = fixed swap rate × notional (constant every year).
 */
export function calculateSwapCost(input: HedgingInput): HedgingStrategyResult {
  const annualBreakdown: HedgingAnnualEntry[] = input.rateScenario.map((_, i) => {
    const interestCost = (input.swapRate / 100) * input.notional;
    return {
      year: i + 1,
      effectiveRate: input.swapRate,
      interestCost,
      premiumCost: 0,
      totalCost: interestCost,
    };
  });

  const totalCost = annualBreakdown.reduce((sum, e) => sum + e.totalCost, 0);

  return {
    strategy: 'swap',
    annualBreakdown,
    totalCost,
    averageAnnualCost: totalCost / input.termYears,
    effectiveAverageRate: input.swapRate,
  };
}

/**
 * Calculate interest rate cap cost per year.
 * Effective rate = min(scenario rate, cap strike).
 * Annual premium is added on top.
 */
export function calculateCapCost(input: HedgingInput): HedgingStrategyResult {
  const annualBreakdown: HedgingAnnualEntry[] = input.rateScenario.map((rate, i) => {
    const effectiveRate = Math.min(rate, input.capStrike);
    const interestCost = (effectiveRate / 100) * input.notional;
    return {
      year: i + 1,
      effectiveRate,
      interestCost,
      premiumCost: input.capPremium,
      totalCost: interestCost + input.capPremium,
    };
  });

  const totalCost = annualBreakdown.reduce((sum, e) => sum + e.totalCost, 0);

  return {
    strategy: 'cap',
    annualBreakdown,
    totalCost,
    averageAnnualCost: totalCost / input.termYears,
    effectiveAverageRate: sumRates(annualBreakdown) / input.termYears,
  };
}

/**
 * Calculate collar cost per year.
 * Effective rate = clamp(scenario rate, collar floor, collar cap).
 * Annual premium is added on top.
 */
export function calculateCollarCost(input: HedgingInput): HedgingStrategyResult {
  const annualBreakdown: HedgingAnnualEntry[] = input.rateScenario.map((rate, i) => {
    const effectiveRate = Math.max(input.collarFloor, Math.min(rate, input.collarCap));
    const interestCost = (effectiveRate / 100) * input.notional;
    return {
      year: i + 1,
      effectiveRate,
      interestCost,
      premiumCost: input.collarPremium,
      totalCost: interestCost + input.collarPremium,
    };
  });

  const totalCost = annualBreakdown.reduce((sum, e) => sum + e.totalCost, 0);

  return {
    strategy: 'collar',
    annualBreakdown,
    totalCost,
    averageAnnualCost: totalCost / input.termYears,
    effectiveAverageRate: sumRates(annualBreakdown) / input.termYears,
  };
}

// =============================================================================
// COMPARISON ORCHESTRATOR
// =============================================================================

/**
 * Compare all 4 hedging strategies and identify the cheapest.
 */
export function compareHedgingStrategies(input: HedgingInput): HedgingComparisonResult {
  const strategies: HedgingStrategyResult[] = [
    calculateFloatingCost(input),
    calculateSwapCost(input),
    calculateCapCost(input),
    calculateCollarCost(input),
  ];

  let cheapestIndex = 0;
  for (let i = 1; i < strategies.length; i++) {
    if (strategies[i].totalCost < strategies[cheapestIndex].totalCost) {
      cheapestIndex = i;
    }
  }

  const breakEvenRate = findBreakEvenRate(input);

  return {
    strategies,
    cheapestIndex,
    breakEvenRate,
    input,
  };
}

// =============================================================================
// BREAK-EVEN RATE
// =============================================================================

/**
 * Find the constant floating rate where swap and floating costs are equal.
 * Uses binary search in [0%, 20%] range.
 *
 * At break-even: fixedRate × notional × years = constantRate × notional × years
 * → break-even = swapRate (trivially). But with scenarios it's more nuanced.
 *
 * For a constant-rate scenario, break-even = swap rate exactly.
 * This function finds the flat rate where total floating cost = total swap cost.
 */
export function findBreakEvenRate(input: HedgingInput): number {
  const swapTotal = (input.swapRate / 100) * input.notional * input.termYears;

  let lo = 0;
  let hi = 20;
  const EPSILON = 0.0001;
  const MAX_ITERATIONS = 50;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const mid = (lo + hi) / 2;
    const floatingTotal = (mid / 100) * input.notional * input.termYears;

    if (Math.abs(floatingTotal - swapTotal) < EPSILON * input.notional) {
      return Math.round(mid * 10000) / 10000;
    }

    if (floatingTotal < swapTotal) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return Math.round(((lo + hi) / 2) * 10000) / 10000;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Sum effective rates from annual breakdown */
function sumRates(entries: HedgingAnnualEntry[]): number {
  return entries.reduce((sum, e) => sum + e.effectiveRate, 0);
}

// =============================================================================
// RATE SCENARIO PRESETS
// =============================================================================

/** Generate a rising rate scenario */
export function risingScenario(baseRate: number, termYears: number, annualIncreaseBps: number = 50): number[] {
  return Array.from({ length: termYears }, (_, i) => baseRate + (i * annualIncreaseBps) / 100);
}

/** Generate a flat rate scenario */
export function flatScenario(baseRate: number, termYears: number): number[] {
  return Array.from({ length: termYears }, () => baseRate);
}

/** Generate a declining rate scenario */
export function decliningScenario(baseRate: number, termYears: number, annualDecreaseBps: number = 30): number[] {
  return Array.from({ length: termYears }, (_, i) =>
    Math.max(0, baseRate - (i * annualDecreaseBps) / 100)
  );
}
