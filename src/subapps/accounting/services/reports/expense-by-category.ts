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
import { getCategoryByCode } from '../../config/account-categories';
import { buildComparative, buildNumericComparative } from './comparative-engine';

const REPORT_PAGE_SIZE = 10000;

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
    generatedAt: new Date().toISOString(),
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
  const result = await deps.repository.listJournalEntries(
    { type: 'expense', period },
    REPORT_PAGE_SIZE
  );
  const active = result.items.filter((e) => e.status === 'ACTIVE');
  return aggregateByCategory(active);
}

function aggregateByCategory(entries: JournalEntry[]): ExpenseCategoryRow[] {
  const map = new Map<string, { total: number; count: number }>();

  for (const entry of entries) {
    const key = entry.category;
    const existing = map.get(key) ?? { total: 0, count: 0 };
    existing.total += entry.netAmount;
    existing.count += 1;
    map.set(key, existing);
  }

  const grandTotal = entries.reduce((sum, e) => sum + e.netAmount, 0);
  const rows: ExpenseCategoryRow[] = [];

  for (const [category, { total, count }] of map) {
    const catDef = getCategoryByCode(category as ExpenseCategoryRow['category']);
    rows.push({
      category: category as ExpenseCategoryRow['category'],
      label: catDef?.label ?? category,
      totalNetAmount: total,
      entryCount: count,
      percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
      isDeductible: catDef?.vatDeductible ?? false,
    });
  }

  return rows.sort((a, b) => b.totalNetAmount - a.totalNetAmount);
}
