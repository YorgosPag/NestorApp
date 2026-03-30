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

const REPORT_PAGE_SIZE = 10000;

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
    generatedAt: new Date().toISOString(),
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
  const result = await deps.repository.listJournalEntries(
    { type: 'income', period },
    REPORT_PAGE_SIZE
  );
  const active = result.items.filter((e) => e.status === 'ACTIVE');
  return aggregateByCustomer(active);
}

function aggregateByCustomer(entries: JournalEntry[]): CustomerIncomeRow[] {
  const map = new Map<string, { name: string; total: number; count: number }>();

  for (const entry of entries) {
    const key = entry.contactId ?? '__no_customer__';
    const existing = map.get(key) ?? {
      name: entry.contactName ?? 'Χωρίς Πελάτη',
      total: 0,
      count: 0,
    };
    existing.total += entry.netAmount;
    existing.count += 1;
    map.set(key, existing);
  }

  const grandTotal = entries.reduce((sum, e) => sum + e.netAmount, 0);
  const rows: CustomerIncomeRow[] = [];

  for (const [customerId, { name, total, count }] of map) {
    rows.push({
      customerId: customerId === '__no_customer__' ? null : customerId,
      customerName: name,
      totalNetAmount: total,
      invoiceCount: count,
      percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    });
  }

  return rows.sort((a, b) => b.totalNetAmount - a.totalNetAmount);
}
