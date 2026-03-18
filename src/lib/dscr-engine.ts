/**
 * =============================================================================
 * DSCR Engine — Debt Service Coverage Ratio & Stress Testing
 * =============================================================================
 *
 * Pure math functions for DSCR calculation and rate stress testing.
 * No side effects, no Firestore, 100% testable.
 *
 * @module lib/dscr-engine
 * @enterprise ADR-242 SPEC-242A - DSCR Stress Testing
 */

import type {
  DSCRInput,
  DSCRResult,
  StressTestRow,
  StressTestResult,
} from '@/types/interest-calculator';

// =============================================================================
// CORE DSCR CALCULATION
// =============================================================================

/**
 * Get DSCR status classification.
 *
 * Industry standard thresholds:
 * - ≥ 1.40: Safe — comfortable debt coverage
 * - ≥ 1.20: Adequate — meets most bank requirements
 * - ≥ 1.00: Warning — barely covers debt service
 * - < 1.00: Danger — cannot cover debt service
 */
export function getDSCRStatus(dscr: number): 'safe' | 'adequate' | 'warning' | 'danger' {
  if (dscr >= 1.40) return 'safe';
  if (dscr >= 1.20) return 'adequate';
  if (dscr >= 1.00) return 'warning';
  return 'danger';
}

/**
 * Calculate monthly mortgage payment using standard amortization formula.
 *
 * Formula: M = P × [r(1+r)^n] / [(1+r)^n - 1]
 * Where:
 *   P = loan principal
 *   r = monthly interest rate
 *   n = total number of monthly payments
 *
 * @param principal — Loan amount (€)
 * @param annualRatePercent — Annual interest rate (%, e.g. 5.0 for 5%)
 * @param termYears — Loan term in years
 * @returns Monthly payment (€)
 */
function calculateMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termYears: number
): number {
  if (principal <= 0 || termYears <= 0) return 0;
  if (annualRatePercent <= 0) return principal / (termYears * 12);

  const r = annualRatePercent / 100 / 12; // monthly rate
  const n = termYears * 12; // total payments
  const factor = Math.pow(1 + r, n);

  return principal * (r * factor) / (factor - 1);
}

/**
 * Calculate Debt Service Coverage Ratio.
 *
 * DSCR = Annual NOI / Annual Debt Service
 *
 * @param input — DSCR input parameters
 * @returns DSCRResult with ratio, debt service, and status
 */
export function calculateDSCR(input: DSCRInput): DSCRResult {
  const monthlyPayment = calculateMonthlyPayment(
    input.loanAmount,
    input.annualRate,
    input.loanTermYears
  );
  const annualDebtService = monthlyPayment * 12;
  const dscr = annualDebtService > 0
    ? Math.round((input.annualNOI / annualDebtService) * 100) / 100
    : input.annualNOI > 0 ? 99.99 : 0;

  return {
    dscr,
    annualDebtService: Math.round(annualDebtService * 100) / 100,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    status: getDSCRStatus(dscr),
  };
}

// =============================================================================
// STRESS TESTING
// =============================================================================

/**
 * Run rate stress test — calculate DSCR at progressively higher rates.
 *
 * @param input — Base DSCR input
 * @param shocks — Array of basis point shocks to apply (default: [50, 100, 150, 200])
 * @returns StressTestResult with base, rows, and max sustainable rate
 */
export function runStressTest(
  input: DSCRInput,
  shocks: number[] = [50, 100, 150, 200]
): StressTestResult {
  const baseResult = calculateDSCR(input);

  const rows: StressTestRow[] = shocks.map((shockBps) => {
    const stressedRate = input.annualRate + shockBps / 100;
    const stressedResult = calculateDSCR({
      ...input,
      annualRate: stressedRate,
    });

    return {
      shockBps,
      stressedRate: Math.round(stressedRate * 100) / 100,
      dscr: stressedResult.dscr,
      status: stressedResult.status,
    };
  });

  const maxRateForDSCR1 = findMaxRateForDSCR(input, 1.0);

  return {
    baseResult,
    rows,
    maxRateForDSCR1,
  };
}

/**
 * Find maximum interest rate that maintains DSCR ≥ target.
 * Uses binary search with 1 basis point (0.01%) precision.
 *
 * @param input — Base DSCR input
 * @param targetDSCR — Target DSCR threshold (default 1.0)
 * @returns Maximum rate (%) that still achieves the target DSCR
 */
export function findMaxRateForDSCR(
  input: DSCRInput,
  targetDSCR = 1.0
): number {
  // Edge case: if DSCR is below target even at current rate
  const currentResult = calculateDSCR(input);
  if (currentResult.dscr < targetDSCR) {
    return input.annualRate;
  }

  let low = input.annualRate;
  let high = 30; // 30% upper bound — no realistic loan goes higher
  const precision = 0.01; // 1 basis point

  while (high - low > precision) {
    const mid = (low + high) / 2;
    const result = calculateDSCR({ ...input, annualRate: mid });

    if (result.dscr >= targetDSCR) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.round(low * 100) / 100;
}
