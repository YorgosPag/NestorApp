/**
 * @fileoverview Expense by Category Report Generator (Phase 2c)
 * @description Έξοδα ανά κατηγορία — breakdown with deductibility info
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q10 (Expense by Category — bonus report)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { JournalEntry } from '../../types/journal';
import type {
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  ExpenseByCategoryData,
  ExpenseCategoryRow,
} from '../../types/reports';
import { getCategoryByCode, getCategoryDisplayLabel } from '../../config/account-categories';
import { buildComparative, buildNumericComparative } from './comparative-engine';
import { nowISO } from '@/lib/date-local';
import { groupNetAmount, loadPeriodEntries, shareOf } from '../journal/journal-ledger';

/** Generate Expense by Category report with comparative analysis */
export async function generateExpenseByCategory(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<ExpenseByCategoryData>> {
  const [current, previous, yoy] = await Promise.all([
    fetchExpenseRows(deps, periods.current),
    fetchExpenseRows(deps, periods.previousPeriod),
    fetchExpenseRows(deps, periods.yearOverYear),
  ]);

  const totalExtractor = (rows: ExpenseCategoryRow[]) =>
    rows.reduce((sum, r) => sum + r.totalNetAmount, 0);

  return {
    reportType: 'expense_by_category',
    generatedAt: nowISO(),
    period: periods,
    data: {
      categories: buildComparative(current, previous, yoy, totalExtractor),
      totalExpenses: buildNumericComparative(
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

async function fetchExpenseRows(
  deps: ReportGeneratorDeps,
  period: { from: string; to: string }
): Promise<ExpenseCategoryRow[]> {
  // Storno: αρχική + αντιλογιστική μετρούν, η καθεμία στην περίοδό της (βλ. journal-ledger.ts)
  return aggregateByCategory(await loadPeriodEntries(deps.repository, period, 'expense'));
}

function aggregateByCategory(entries: JournalEntry[]): ExpenseCategoryRow[] {
  const grandTotal = entries.reduce((sum, e) => sum + e.netAmount, 0);
  const rows: ExpenseCategoryRow[] = [];

  for (const [category, { total, count }] of groupNetAmount(entries, (e) => e.category)) {
    const catCode = category as ExpenseCategoryRow['category'];
    const catDef = getCategoryByCode(catCode);
    rows.push({
      category: catCode,
      label: getCategoryDisplayLabel(catCode),
      totalNetAmount: total,
      entryCount: count,
      percentage: shareOf(total, grandTotal),
      isDeductible: catDef?.vatDeductible ?? false,
    });
  }

  return rows.sort((a, b) => b.totalNetAmount - a.totalNetAmount);
}
