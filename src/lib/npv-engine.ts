/**
 * =============================================================================
 * NPV Engine — Pure Math Functions for Cost-of-Money Calculator
 * =============================================================================
 *
 * Zero side effects, zero Firestore, 100% testable.
 * Runs on both client and server.
 *
 * @module lib/npv-engine
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import type {
  CashFlowEntry,
  CashFlowAnalysisEntry,
  CashFlowCertainty,
  CostCalculationInput,
  CostCalculationResult,
  ScenarioComparison,
  ScenarioResult,
} from '@/types/interest-calculator';
import { CERTAINTY_MULTIPLIERS } from '@/types/interest-calculator';
import type { Installment } from '@/types/payment-plan';

// =============================================================================
// CONSTANTS
// =============================================================================

const DAYS_PER_YEAR = 365;

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Calculate discount factor for a given annual rate and number of days.
 *
 * Formula: DF = 1 / (1 + r)^(d/365)
 *
 * @param annualRate — Annual discount rate as decimal (e.g. 0.05 for 5%)
 * @param days — Number of days from reference date
 * @returns Discount factor (0-1)
 */
export function calculateDiscountFactor(annualRate: number, days: number): number {
  if (days <= 0) return 1;
  if (annualRate <= 0) return 1;
  return 1 / Math.pow(1 + annualRate, days / DAYS_PER_YEAR);
}

/**
 * Calculate NPV of a series of cash flows.
 *
 * @param cashFlows — Array of cash flow entries
 * @param referenceDate — Reference date (ISO string)
 * @param annualRate — Annual discount rate as decimal (e.g. 0.05 for 5%)
 * @returns Net Present Value (€)
 */
export function calculateNPV(
  cashFlows: CashFlowEntry[],
  referenceDate: string,
  annualRate: number
): number {
  const refMs = new Date(referenceDate).getTime();
  let npv = 0;

  for (const cf of cashFlows) {
    const cfMs = new Date(cf.date).getTime();
    const days = Math.max(0, Math.round((cfMs - refMs) / (1000 * 60 * 60 * 24)));
    const certaintyMultiplier = CERTAINTY_MULTIPLIERS[cf.certainty] ?? 1;
    const adjustedRate = annualRate * certaintyMultiplier;
    const df = calculateDiscountFactor(adjustedRate, days);
    npv += cf.amount * df;
  }

  return Math.round(npv * 100) / 100;
}

/**
 * Generate per-installment analysis with discount factors and present values.
 */
export function calculateCashFlowAnalysis(
  input: CostCalculationInput,
  effectiveRate: number
): CashFlowAnalysisEntry[] {
  const refMs = new Date(input.referenceDate).getTime();
  const annualRate = effectiveRate / 100;

  return input.cashFlows.map((cf) => {
    const cfMs = new Date(cf.date).getTime();
    const daysDelta = Math.max(0, Math.round((cfMs - refMs) / (1000 * 60 * 60 * 24)));
    const certaintyMultiplier = CERTAINTY_MULTIPLIERS[cf.certainty] ?? 1;
    const adjustedRate = annualRate * certaintyMultiplier;
    const discountFactor = calculateDiscountFactor(adjustedRate, daysDelta);
    const presentValue = Math.round(cf.amount * discountFactor * 100) / 100;

    return {
      ...cf,
      daysDelta,
      discountFactor: Math.round(discountFactor * 10000) / 10000,
      presentValue,
    };
  });
}

/**
 * Weighted Average Collection Period (WACP).
 * Weighted average number of days until payment, weighted by amount.
 */
export function calculateWACP(
  cashFlows: CashFlowEntry[],
  referenceDate: string
): { days: number; months: number } {
  const refMs = new Date(referenceDate).getTime();
  let totalAmount = 0;
  let weightedDays = 0;

  for (const cf of cashFlows) {
    const cfMs = new Date(cf.date).getTime();
    const days = Math.max(0, Math.round((cfMs - refMs) / (1000 * 60 * 60 * 24)));
    weightedDays += days * cf.amount;
    totalAmount += cf.amount;
  }

  if (totalAmount === 0) return { days: 0, months: 0 };

  const avgDays = Math.round(weightedDays / totalAmount);
  return {
    days: avgDays,
    months: Math.round((avgDays / 30.44) * 10) / 10,
  };
}

/**
 * Calculate time cost: the difference between nominal price and NPV.
 */
export function calculateTimeCost(
  salePrice: number,
  npv: number
): { amount: number; percentage: number } {
  const amount = Math.round((salePrice - npv) * 100) / 100;
  const percentage = salePrice > 0
    ? Math.round((amount / salePrice) * 10000) / 100
    : 0;
  return { amount, percentage };
}

/**
 * Calculate recommended price: sale price adjusted for time cost.
 * recommendedPrice = salePrice² / NPV
 * This ensures the builder receives salePrice in present-value terms.
 */
export function calculateRecommendedPrice(
  salePrice: number,
  npv: number
): { price: number; adjustment: number; adjustmentPercentage: number } {
  if (npv <= 0 || salePrice <= 0) {
    return { price: salePrice, adjustment: 0, adjustmentPercentage: 0 };
  }

  const price = Math.round((salePrice * salePrice / npv) * 100) / 100;
  const adjustment = Math.round((price - salePrice) * 100) / 100;
  const adjustmentPercentage = Math.round((adjustment / salePrice) * 10000) / 100;

  return { price, adjustment, adjustmentPercentage };
}

/**
 * Full calculation: NPV + time cost + recommended price + analysis.
 */
export function calculateFullResult(
  input: CostCalculationInput,
  effectiveRate: number
): CostCalculationResult {
  const annualRate = effectiveRate / 100;
  const npv = calculateNPV(input.cashFlows, input.referenceDate, annualRate);
  const npvPercentage = input.salePrice > 0
    ? Math.round((npv / input.salePrice) * 10000) / 100
    : 0;
  const timeCost = calculateTimeCost(input.salePrice, npv);
  const recommended = calculateRecommendedPrice(input.salePrice, npv);
  const wacp = calculateWACP(input.cashFlows, input.referenceDate);
  const cashFlowAnalysis = calculateCashFlowAnalysis(input, effectiveRate);

  return {
    npv,
    npvPercentage,
    timeCost: timeCost.amount,
    timeCostPercentage: timeCost.percentage,
    recommendedPrice: recommended.price,
    priceAdjustment: recommended.adjustment,
    priceAdjustmentPercentage: recommended.adjustmentPercentage,
    weightedAverageDays: wacp.days,
    effectiveRate,
    cashFlowAnalysis,
  };
}

// =============================================================================
// SCENARIO BUILDER
// =============================================================================

/**
 * Build comparison scenarios for a sale.
 *
 * Generates 4 standard scenarios:
 * 1. Cash (100% upfront)
 * 2. Off-Plan Standard (10/10/30/20/30)
 * 3. Bank Loan 70% (30% now + 70% in 6 months)
 * 4. Current Plan (from actual installments)
 */
export function buildComparisonScenarios(
  salePrice: number,
  referenceDate: string,
  discountRate: number,
  installments?: Installment[]
): ScenarioComparison {
  const scenarios: ScenarioResult[] = [];
  const refDate = new Date(referenceDate);

  // --- Scenario 1: Cash ---
  const cashInput: CostCalculationInput = {
    salePrice,
    referenceDate,
    cashFlows: [
      { label: 'costCalculator.scenarios.flowLabels.cash', amount: salePrice, date: referenceDate, certainty: 'certain' },
    ],
    discountRateSource: 'manual',
    bankSpread: 0,
  };
  scenarios.push({
    name: 'costCalculator.scenarios.cashName',
    description: 'costCalculator.scenarios.cashDesc',
    result: calculateFullResult(cashInput, discountRate),
  });

  // --- Scenario 2: Off-Plan Standard ---
  const offPlanFlows: CashFlowEntry[] = [
    { label: 'costCalculator.scenarios.flowLabels.reservation', amount: salePrice * 0.10, date: referenceDate, certainty: 'certain' },
    { label: 'costCalculator.scenarios.flowLabels.downPayment', amount: salePrice * 0.10, date: addMonths(refDate, 1), certainty: 'certain' },
    { label: 'costCalculator.scenarios.flowLabels.frame', amount: salePrice * 0.30, date: addMonths(refDate, 6), certainty: 'probable' },
    { label: 'costCalculator.scenarios.flowLabels.completion', amount: salePrice * 0.20, date: addMonths(refDate, 12), certainty: 'probable' },
    { label: 'costCalculator.scenarios.flowLabels.final', amount: salePrice * 0.30, date: addMonths(refDate, 18), certainty: 'uncertain' },
  ];
  const offPlanInput: CostCalculationInput = {
    salePrice,
    referenceDate,
    cashFlows: offPlanFlows,
    discountRateSource: 'manual',
    bankSpread: 0,
  };
  scenarios.push({
    name: 'costCalculator.scenarios.offPlanName',
    description: 'costCalculator.scenarios.offPlanDesc',
    result: calculateFullResult(offPlanInput, discountRate),
  });

  // --- Scenario 3: Bank Loan 70% ---
  const loanFlows: CashFlowEntry[] = [
    { label: 'costCalculator.scenarios.flowLabels.ownFunds', amount: salePrice * 0.30, date: referenceDate, certainty: 'certain' },
    { label: 'costCalculator.scenarios.flowLabels.loanDisburse', amount: salePrice * 0.70, date: addMonths(refDate, 6), certainty: 'probable' },
  ];
  const loanInput: CostCalculationInput = {
    salePrice,
    referenceDate,
    cashFlows: loanFlows,
    discountRateSource: 'manual',
    bankSpread: 0,
  };
  scenarios.push({
    name: 'costCalculator.scenarios.loanName',
    description: 'costCalculator.scenarios.loanDesc',
    result: calculateFullResult(loanInput, discountRate),
  });

  // --- Scenario 4: Current Plan (if installments provided) ---
  if (installments && installments.length > 0) {
    const planFlows: CashFlowEntry[] = installments.map((inst) => ({
      label: inst.label,
      amount: inst.amount,
      date: inst.dueDate,
      certainty: installmentCertainty(inst.status),
    }));
    const planInput: CostCalculationInput = {
      salePrice,
      referenceDate,
      cashFlows: planFlows,
      discountRateSource: 'manual',
      bankSpread: 0,
    };
    scenarios.push({
      name: 'costCalculator.scenarios.currentPlanName',
      description: 'costCalculator.scenarios.currentPlanDesc',
      descriptionParams: { count: String(installments.length) },
      result: calculateFullResult(planInput, discountRate),
    });
  }

  // Find best scenario (highest NPV = lowest cost for builder)
  let bestIdx = 0;
  let bestNpv = -Infinity;
  scenarios.forEach((s, i) => {
    if (s.result.npv > bestNpv) {
      bestNpv = s.result.npv;
      bestIdx = i;
    }
  });

  return {
    discountRate,
    referenceDate,
    scenarios,
    bestScenarioIndex: bestIdx,
  };
}

// =============================================================================
// HELPERS (pure, no side effects)
// =============================================================================

/** Add months to a date, return ISO string */
function addMonths(date: Date, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

/** Map installment status to cash flow certainty */
function installmentCertainty(status: string): CashFlowCertainty {
  switch (status) {
    case 'paid':
      return 'certain';
    case 'partial':
    case 'due':
      return 'probable';
    default:
      return 'uncertain';
  }
}
