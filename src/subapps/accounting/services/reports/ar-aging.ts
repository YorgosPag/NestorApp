/**
 * @fileoverview AR Aging Report Generator (Phase 2c)
 * @description Ηλικίωση Απαιτήσεων — leverages Phase 1b CustomerBalance aging buckets
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6 (Report #3)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { CustomerBalance, AgingBuckets } from '../../types/customer-balance';
import type {
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  ARAgingData,
  ARAgingCustomerRow,
} from '../../types/reports';
import { buildComparative, buildNumericComparative } from './comparative-engine';

/** Generate AR Aging report with comparative analysis */
export async function generateARAgingReport(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<ARAgingData>> {
  const currentYear = extractFiscalYear(periods.current.from);
  const previousYear = extractFiscalYear(periods.previousPeriod.from);
  const yoyYear = extractFiscalYear(periods.yearOverYear.from);

  const [currentBalances, previousBalances, yoyBalances] = await Promise.all([
    deps.repository.listCustomerBalances(currentYear),
    deps.repository.listCustomerBalances(previousYear),
    deps.repository.listCustomerBalances(yoyYear),
  ]);

  const current = mapToAgingRows(currentBalances);
  const previous = mapToAgingRows(previousBalances);
  const yoy = mapToAgingRows(yoyBalances);

  const sumOutstanding = (rows: ARAgingCustomerRow[]) =>
    rows.reduce((sum, r) => sum + r.totalOutstanding, 0);

  return {
    reportType: 'ar_aging',
    generatedAt: new Date().toISOString(),
    period: periods,
    data: {
      customers: buildComparative(current, previous, yoy, sumOutstanding),
      totals: buildComparative(
        sumAgingBuckets(currentBalances),
        sumAgingBuckets(previousBalances),
        sumAgingBuckets(yoyBalances),
        totalFromBuckets
      ),
      totalOutstanding: buildNumericComparative(
        sumOutstanding(current),
        sumOutstanding(previous),
        sumOutstanding(yoy)
      ),
    },
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function mapToAgingRows(balances: CustomerBalance[]): ARAgingCustomerRow[] {
  return balances
    .filter((b) => b.netBalance > 0)
    .map((b) => ({
      customerId: b.customerId,
      customerName: b.customerName,
      aging: b.aging,
      totalOutstanding: b.netBalance,
      invoiceCount: b.invoiceCount,
    }))
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

function sumAgingBuckets(balances: CustomerBalance[]): AgingBuckets {
  const totals: AgingBuckets = {
    current: 0, days1_30: 0, days31_60: 0,
    days61_90: 0, days91_120: 0, days120plus: 0,
  };
  for (const b of balances) {
    totals.current += b.aging.current;
    totals.days1_30 += b.aging.days1_30;
    totals.days31_60 += b.aging.days31_60;
    totals.days61_90 += b.aging.days61_90;
    totals.days91_120 += b.aging.days91_120;
    totals.days120plus += b.aging.days120plus;
  }
  return totals;
}

function totalFromBuckets(buckets: AgingBuckets): number {
  return buckets.current + buckets.days1_30 + buckets.days31_60
    + buckets.days61_90 + buckets.days91_120 + buckets.days120plus;
}

function extractFiscalYear(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}
