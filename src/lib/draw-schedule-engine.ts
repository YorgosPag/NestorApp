/**
 * =============================================================================
 * Draw Schedule Engine — Construction Loan Interest & Reserve Modeling
 * =============================================================================
 *
 * Pure math functions for construction loan draw schedule analysis.
 * Calculates interest accrual, reserve depletion, and total cost of capital.
 * No side effects, no Firestore, 100% testable.
 *
 * @module lib/draw-schedule-engine
 * @enterprise ADR-242 SPEC-242B - Construction Loan Draw Schedule
 */

import type {
  DrawScheduleEntry,
  LoanTerms,
  DrawPeriodAnalysis,
  InterestReserveStatus,
  DrawScheduleResult,
} from '@/types/interest-calculator';

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Add N months to a date, returning ISO string (1st of target month).
 */
function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate total months between two dates (rounded up).
 */
function calculateTotalMonths(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  return Math.max(1, months);
}

/**
 * Calculate monthly interest on outstanding balance.
 *
 * @param balance — Outstanding principal balance (€)
 * @param annualRatePercent — Annual interest rate (%)
 * @param method — 'simple' or 'compound'
 * @param cumulativeInterest — Accumulated unpaid interest (for compound)
 * @returns Interest for this month (€)
 */
function calculateMonthlyInterest(
  balance: number,
  annualRatePercent: number,
  method: 'simple' | 'compound',
  cumulativeInterest: number
): number {
  if (balance <= 0) return 0;

  const monthlyRate = annualRatePercent / 100 / 12;

  if (method === 'compound') {
    // Interest compounds on principal + unpaid accrued interest
    return (balance + cumulativeInterest) * monthlyRate;
  }

  // Simple interest — only on principal balance
  return balance * monthlyRate;
}

// =============================================================================
// CORE ANALYSIS
// =============================================================================

/**
 * Analyze a construction loan draw schedule.
 *
 * Algorithm:
 * 1. Sort draws by date
 * 2. For each month from closing to maturity:
 *    a. Check if a draw event occurs
 *    b. Update cumulative drawn balance
 *    c. Calculate period interest (simple or compound)
 *    d. Deduct interest from reserve
 *    e. Track reserve exhaustion
 * 3. Calculate WAOB, total cost of capital
 *
 * @param draws — Array of draw schedule entries
 * @param loanTerms — Loan terms and parameters
 * @returns Full draw schedule analysis
 */
export function analyzeDrawSchedule(
  draws: DrawScheduleEntry[],
  loanTerms: LoanTerms
): DrawScheduleResult {
  const totalMonths = calculateTotalMonths(
    loanTerms.closingDate,
    loanTerms.maturityDate
  );

  // Sort draws chronologically
  const sortedDraws = [...draws].sort(
    (a, b) => new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime()
  );

  const periods: DrawPeriodAnalysis[] = [];
  let cumulativeDrawn = 0;
  let cumulativeInterest = 0;
  let reserveBalance = loanTerms.interestReserve;
  let exhaustionMonth: number | null = null;
  let exhaustionDate: string | null = null;
  let balanceDaysSum = 0; // For WAOB calculation

  for (let month = 0; month < totalMonths; month++) {
    const periodDate = addMonths(loanTerms.closingDate, month);
    const periodStart = new Date(periodDate);
    const periodEnd = new Date(addMonths(loanTerms.closingDate, month + 1));

    // Check for draw events in this period
    let drawEvent: DrawScheduleEntry | null = null;
    for (const draw of sortedDraws) {
      const drawDate = new Date(draw.drawDate);
      if (drawDate >= periodStart && drawDate < periodEnd) {
        drawEvent = draw;
        cumulativeDrawn += draw.drawAmount;
        break; // One draw per period for simplicity
      }
    }

    // Calculate interest on current outstanding balance
    const periodInterest = calculateMonthlyInterest(
      cumulativeDrawn,
      loanTerms.annualRate,
      loanTerms.interestAccrual,
      loanTerms.interestAccrual === 'compound' ? cumulativeInterest : 0
    );

    cumulativeInterest += periodInterest;

    // Deduct interest from reserve
    reserveBalance -= periodInterest;

    // Track exhaustion (first time reserve goes negative)
    if (reserveBalance < 0 && exhaustionMonth === null) {
      exhaustionMonth = month;
      exhaustionDate = periodDate;
    }

    // WAOB: accumulate balance × days (approximate: 30 days per month)
    balanceDaysSum += cumulativeDrawn * 30;

    periods.push({
      month,
      date: periodDate,
      cumulativeDrawn,
      periodInterest,
      cumulativeInterest,
      reserveBalance,
      drawEvent,
    });
  }

  // Calculate origination fee
  const originationFeeAmount =
    loanTerms.totalCommitment * (loanTerms.originationFee / 100);

  // Total cost of capital
  const totalCostOfCapital = cumulativeInterest + originationFeeAmount;

  // Cost of capital as percentage
  const costOfCapitalPercent =
    loanTerms.totalCommitment > 0
      ? (totalCostOfCapital / loanTerms.totalCommitment) * 100
      : 0;

  // Weighted average outstanding balance
  const totalDays = totalMonths * 30;
  const weightedAverageBalance =
    totalDays > 0 ? balanceDaysSum / totalDays : 0;

  // Reserve status
  const reserveStatus: InterestReserveStatus = {
    initialReserve: loanTerms.interestReserve,
    finalBalance: reserveBalance,
    sufficient: reserveBalance >= 0,
    exhaustionMonth,
    exhaustionDate,
    cashShortfall: reserveBalance < 0 ? Math.abs(reserveBalance) : 0,
  };

  return {
    periods,
    totalInterest: cumulativeInterest,
    totalDrawn: cumulativeDrawn,
    reserveStatus,
    totalCostOfCapital,
    costOfCapitalPercent,
    originationFeeAmount,
    weightedAverageBalance,
  };
}

// =============================================================================
// GREEK CONSTRUCTION TEMPLATE
// =============================================================================

/**
 * Generate a typical Greek construction draw schedule template.
 *
 * Standard 6-phase breakdown based on Greek construction practices:
 * - Land Acquisition: 25% at Month 1
 * - Foundation: 15% at Month 4
 * - Structure: 20% at Month 8
 * - Masonry: 15% at Month 12
 * - Mechanical + Finishes: 20% at Month 16
 * - Landscaping: 5% at Month 20
 *
 * @param totalCommitment — Total loan amount (€)
 * @param closingDate — Loan closing date (ISO string)
 * @returns Array of 6 draw schedule entries
 */
export function getGreekConstructionTemplate(
  totalCommitment: number,
  closingDate: string
): DrawScheduleEntry[] {
  const phases: Array<{
    phase: DrawScheduleEntry['phase'];
    label: string;
    percent: number;
    monthOffset: number;
    completionPercent: number;
  }> = [
    { phase: 'land_acquisition', label: 'Land Acquisition', percent: 25, monthOffset: 1, completionPercent: 10 },
    { phase: 'foundation', label: 'Foundation', percent: 15, monthOffset: 4, completionPercent: 25 },
    { phase: 'structure', label: 'Structure', percent: 20, monthOffset: 8, completionPercent: 50 },
    { phase: 'masonry', label: 'Masonry', percent: 15, monthOffset: 12, completionPercent: 70 },
    { phase: 'mechanical', label: 'Mechanical + Finishes', percent: 20, monthOffset: 16, completionPercent: 90 },
    { phase: 'landscaping', label: 'Landscaping', percent: 5, monthOffset: 20, completionPercent: 100 },
  ];

  return phases.map(({ phase, label, percent, monthOffset, completionPercent }) => ({
    phase,
    label,
    drawAmount: Math.round(totalCommitment * (percent / 100)),
    drawDate: addMonths(closingDate, monthOffset),
    completionPercent,
  }));
}
