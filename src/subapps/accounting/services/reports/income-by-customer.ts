/**
 * @fileoverview Income by Customer Report Generator (Phase 2c)
 * @description Έσοδα ανά πελάτη — breakdown by contactId/contactName
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6 (Report #7)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { JournalEntry } from '../../types/journal';
import type {
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  IncomeByCustomerData,
  CustomerIncomeRow,
} from '../../types/reports';
import { buildComparative, buildNumericComparative } from './comparative-engine';
import { nowISO } from '@/lib/date-local';
import { groupNetAmount, loadPeriodEntries, shareOf } from '../journal/journal-ledger';

/** Generate Income by Customer report with comparative analysis */
export async function generateIncomeByCustomer(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<IncomeByCustomerData>> {
  const [current, previous, yoy] = await Promise.all([
    fetchCustomerRows(deps, periods.current),
    fetchCustomerRows(deps, periods.previousPeriod),
    fetchCustomerRows(deps, periods.yearOverYear),
  ]);

  const totalExtractor = (rows: CustomerIncomeRow[]) =>
    rows.reduce((sum, r) => sum + r.totalNetAmount, 0);

  return {
    reportType: 'income_by_customer',
    generatedAt: nowISO(),
    period: periods,
    data: {
      customers: buildComparative(current, previous, yoy, totalExtractor),
      totalIncome: buildNumericComparative(
        totalExtractor(current),
        totalExtractor(previous),
        totalExtractor(yoy)
      ),
    },
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function fetchCustomerRows(
  deps: ReportGeneratorDeps,
  period: { from: string; to: string }
): Promise<CustomerIncomeRow[]> {
  // Storno: αρχική + αντιλογιστική μετρούν, η καθεμία στην περίοδό της (βλ. journal-ledger.ts)
  return aggregateByCustomer(await loadPeriodEntries(deps.repository, period, 'income'));
}

function aggregateByCustomer(entries: JournalEntry[]): CustomerIncomeRow[] {
  const grandTotal = entries.reduce((sum, e) => sum + e.netAmount, 0);
  const rows: CustomerIncomeRow[] = [];

  for (const [customerId, { first, total, count }] of groupNetAmount(entries, (e) => e.contactId ?? null)) {
    rows.push({
      customerId,
      customerName: first.contactName ?? 'Χωρίς Πελάτη',
      totalNetAmount: total,
      invoiceCount: count,
      percentage: shareOf(total, grandTotal),
    });
  }

  return rows.sort((a, b) => b.totalNetAmount - a.totalNetAmount);
}
