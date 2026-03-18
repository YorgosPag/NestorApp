/**
 * =============================================================================
 * Counterproposal Engine — Discount-for-Speed Analysis
 * =============================================================================
 *
 * Pure math functions for calculating counterproposal scenarios.
 * Helps the builder decide: "How much discount can I offer for faster payment
 * and still come out ahead vs. the current installment plan?"
 *
 * Zero side effects, zero Firestore, 100% testable.
 * Imports ONLY from npv-engine — zero duplicated NPV logic.
 *
 * @module lib/counterproposal-engine
 * @enterprise ADR-234 — Counterproposal Tab (SPEC-234F)
 */

import { calculateFullResult } from '@/lib/npv-engine';
import type {
  CashFlowEntry,
  CashFlowCertainty,
  CostCalculationInput,
  CostCalculationResult,
} from '@/types/interest-calculator';
import type {
  CounterproposalScenario,
  CounterproposalResult,
  CounterproposalSliderInput,
} from '@/types/interest-calculator';

// =============================================================================
// HELPERS
// =============================================================================

/** Add months to a date, return ISO string (YYYY-MM-DD) */
function addMonths(date: Date, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

/** Assign certainty based on month offset */
function monthCertainty(month: number): CashFlowCertainty {
  if (month <= 3) return 'certain';
  if (month <= 9) return 'probable';
  return 'uncertain';
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Build cash flows for a counterproposal scenario.
 *
 * @param salePrice     — Nominal sale price (€)
 * @param referenceDate — ISO date string (reference for NPV)
 * @param upfrontPercent — % paid upfront (0-100)
 * @param remainingMonths — Months for remaining balance (0 = lump sum)
 * @returns CashFlowEntry[] ready for calculateFullResult()
 */
export function buildCounterproposalCashFlows(
  salePrice: number,
  referenceDate: string,
  upfrontPercent: number,
  remainingMonths: number
): CashFlowEntry[] {
  const flows: CashFlowEntry[] = [];
  const upfrontAmount = salePrice * (upfrontPercent / 100);
  const remaining = salePrice - upfrontAmount;
  const refDate = new Date(referenceDate);

  // Upfront payment (day 0, always certain)
  if (upfrontAmount > 0) {
    flows.push({
      label: 'counterproposal.flow.upfront',
      amount: Math.round(upfrontAmount * 100) / 100,
      date: referenceDate,
      certainty: 'certain',
    });
  }

  // Equal monthly installments for remaining balance
  if (remainingMonths > 0 && remaining > 0) {
    const monthlyAmount = Math.round((remaining / remainingMonths) * 100) / 100;
    let distributed = 0;

    for (let m = 1; m <= remainingMonths; m++) {
      const isLast = m === remainingMonths;
      const amount = isLast ? Math.round((remaining - distributed) * 100) / 100 : monthlyAmount;
      distributed += amount;

      flows.push({
        label: `counterproposal.flow.installment`,
        amount,
        date: addMonths(refDate, m),
        certainty: monthCertainty(m),
      });
    }
  }

  return flows;
}

/**
 * Calculate a single counterproposal scenario.
 *
 * @param salePrice         — Nominal sale price (€)
 * @param referenceDate     — ISO date string
 * @param effectiveRate     — Effective annual discount rate (%)
 * @param upfrontPercent    — % paid upfront
 * @param remainingMonths   — Months for remaining balance
 * @param baselineTimeCost  — Time cost of the baseline scenario (€)
 * @param builderRetainRatio — Fraction of savings builder keeps (0-1)
 * @param nameKey           — i18n key for scenario name
 * @param descriptionKey    — i18n key for description
 */
export function calculateCounterproposalScenario(
  salePrice: number,
  referenceDate: string,
  effectiveRate: number,
  upfrontPercent: number,
  remainingMonths: number,
  baselineTimeCost: number,
  builderRetainRatio: number,
  nameKey: string,
  descriptionKey: string
): CounterproposalScenario {
  const cashFlows = buildCounterproposalCashFlows(
    salePrice,
    referenceDate,
    upfrontPercent,
    remainingMonths
  );

  const input: CostCalculationInput = {
    salePrice,
    referenceDate,
    cashFlows,
    discountRateSource: 'manual',
    bankSpread: 0,
  };

  const fullResult: CostCalculationResult = calculateFullResult(input, effectiveRate);

  const timeCost = fullResult.timeCost;
  const timeCostSaved = Math.max(0, baselineTimeCost - timeCost);
  const maxDiscount = timeCostSaved;
  const maxDiscountPercent = salePrice > 0
    ? Math.round((maxDiscount / salePrice) * 10000) / 100
    : 0;
  const suggestedDiscount = Math.round(maxDiscount * (1 - builderRetainRatio) * 100) / 100;
  const suggestedDiscountPercent = salePrice > 0
    ? Math.round((suggestedDiscount / salePrice) * 10000) / 100
    : 0;
  const finalPrice = Math.round((salePrice - suggestedDiscount) * 100) / 100;
  const builderNetGain = Math.round((timeCostSaved - suggestedDiscount) * 100) / 100;
  const builderNetGainPercent = salePrice > 0
    ? Math.round((builderNetGain / salePrice) * 10000) / 100
    : 0;

  return {
    nameKey,
    descriptionKey,
    upfrontPercent,
    remainingMonths,
    npv: fullResult.npv,
    timeCost,
    timeCostSaved,
    maxDiscount,
    maxDiscountPercent,
    suggestedDiscount,
    suggestedDiscountPercent,
    finalPrice,
    builderNetGain,
    builderNetGainPercent,
    weightedAvgDays: fullResult.weightedAverageDays,
  };
}

/**
 * Run full counterproposal analysis: baseline + 3 alternatives + sweet spot.
 *
 * @param input              — Current CostCalculationInput (from existing installments)
 * @param effectiveRate      — Effective discount rate (%)
 * @param builderRetainRatio — Fraction of savings the builder keeps (default 0.35)
 */
export function runCounterproposalAnalysis(
  input: CostCalculationInput,
  effectiveRate: number,
  builderRetainRatio: number = 0.35
): CounterproposalResult {
  const { salePrice, referenceDate } = input;

  // --- Baseline: current installment plan ---
  const baselineResult = calculateFullResult(input, effectiveRate);
  const baselineTimeCost = baselineResult.timeCost;

  // Estimate current upfront % from first cash flow (day 0)
  const firstFlow = input.cashFlows[0];
  const baselineUpfrontPercent = firstFlow
    ? Math.round((firstFlow.amount / salePrice) * 100)
    : 0;

  // Estimate current duration in months
  const lastFlow = input.cashFlows[input.cashFlows.length - 1];
  const refMs = new Date(referenceDate).getTime();
  const lastMs = lastFlow ? new Date(lastFlow.date).getTime() : refMs;
  const baselineMonths = Math.max(0, Math.round((lastMs - refMs) / (1000 * 60 * 60 * 24 * 30.44)));

  const baseline: CounterproposalScenario = {
    nameKey: 'costCalculator.counterproposal.scenarios.baseline',
    descriptionKey: 'costCalculator.counterproposal.scenarios.baselineDesc',
    upfrontPercent: baselineUpfrontPercent,
    remainingMonths: baselineMonths,
    npv: baselineResult.npv,
    timeCost: baselineTimeCost,
    timeCostSaved: 0,
    maxDiscount: 0,
    maxDiscountPercent: 0,
    suggestedDiscount: 0,
    suggestedDiscountPercent: 0,
    finalPrice: salePrice,
    builderNetGain: 0,
    builderNetGainPercent: 0,
    weightedAvgDays: baselineResult.weightedAverageDays,
  };

  // --- Alternative 1: 50% upfront, same months ---
  const alt1 = calculateCounterproposalScenario(
    salePrice, referenceDate, effectiveRate,
    50, baselineMonths, baselineTimeCost, builderRetainRatio,
    'costCalculator.counterproposal.scenarios.fiftyUpfront',
    'costCalculator.counterproposal.scenarios.fiftyUpfrontDesc'
  );

  // --- Alternative 2: 80% upfront, 3 months ---
  const alt2 = calculateCounterproposalScenario(
    salePrice, referenceDate, effectiveRate,
    80, 3, baselineTimeCost, builderRetainRatio,
    'costCalculator.counterproposal.scenarios.eightyUpfront',
    'costCalculator.counterproposal.scenarios.eightyUpfrontDesc'
  );

  // --- Alternative 3: 100% lump sum ---
  const alt3 = calculateCounterproposalScenario(
    salePrice, referenceDate, effectiveRate,
    100, 0, baselineTimeCost, builderRetainRatio,
    'costCalculator.counterproposal.scenarios.lumpSum',
    'costCalculator.counterproposal.scenarios.lumpSumDesc'
  );

  const alternatives = [alt1, alt2, alt3];

  // Sweet spot = highest builderNetGain where suggestedDiscountPercent ≤ 5%
  let sweetSpotIndex = 0;
  let bestGain = -Infinity;
  alternatives.forEach((alt, i) => {
    if (alt.suggestedDiscountPercent <= 5 && alt.builderNetGain > bestGain) {
      bestGain = alt.builderNetGain;
      sweetSpotIndex = i;
    }
  });

  // If none qualifies under 5%, pick the one with highest net gain overall
  if (bestGain === -Infinity) {
    alternatives.forEach((alt, i) => {
      if (alt.builderNetGain > bestGain) {
        bestGain = alt.builderNetGain;
        sweetSpotIndex = i;
      }
    });
  }

  return {
    baseline,
    alternatives,
    sweetSpotIndex,
    builderRetainRatio,
  };
}

/**
 * Calculate a single slider-driven scenario (for real-time interactive mode).
 *
 * @param salePrice          — Nominal sale price (€)
 * @param referenceDate      — ISO date string
 * @param effectiveRate      — Effective discount rate (%)
 * @param sliderInput        — { upfrontPercent, remainingMonths }
 * @param baselineTimeCost   — Time cost of baseline scenario (€)
 * @param builderRetainRatio — Fraction the builder keeps (0-1)
 */
export function calculateSliderScenario(
  salePrice: number,
  referenceDate: string,
  effectiveRate: number,
  sliderInput: CounterproposalSliderInput,
  baselineTimeCost: number,
  builderRetainRatio: number
): CounterproposalScenario {
  return calculateCounterproposalScenario(
    salePrice,
    referenceDate,
    effectiveRate,
    sliderInput.upfrontPercent,
    sliderInput.remainingMonths,
    baselineTimeCost,
    builderRetainRatio,
    'costCalculator.counterproposal.scenarios.custom',
    'costCalculator.counterproposal.scenarios.customDesc'
  );
}
