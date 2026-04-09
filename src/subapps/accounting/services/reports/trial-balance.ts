/**
 * @fileoverview Trial Balance Report Generator (Phase 2c)
 * @description Ισοζύγιο — debit/credit aggregation by category
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6 (Report #2)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { JournalEntry } from '../../types/journal';
import type {
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  TrialBalanceData,
  TrialBalanceRow,
} from '../../types/reports';
import { getCategoryDisplayLabel } from '../../config/account-categories';
import { buildComparative, buildNumericComparative } from './comparative-engine';

const REPORT_PAGE_SIZE = 10000;

/** Generate Trial Balance report with comparative analysis */
export async function generateTrialBalance(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<TrialBalanceData>> {
  const [current, previous, yoy] = await Promise.all([
    fetchTrialRows(deps, periods.current),
    fetchTrialRows(deps, periods.previousPeriod),
    fetchTrialRows(deps, periods.yearOverYear),
  ]);

  const sumDebits = (rows: TrialBalanceRow[]) =>
    rows.reduce((sum, r) => sum + r.debit, 0);
  const sumCredits = (rows: TrialBalanceRow[]) =>
    rows.reduce((sum, r) => sum + r.credit, 0);

  return {
    reportType: 'trial_balance',
    generatedAt: new Date().toISOString(),
    period: periods,
    data: {
      rows: buildComparative(current, previous, yoy, (r) =>
        sumCredits(r) - sumDebits(r)
      ),
      totalDebits: buildNumericComparative(
        sumDebits(current), sumDebits(previous), sumDebits(yoy)
      ),
      totalCredits: buildNumericComparative(
        sumCredits(current), sumCredits(previous), sumCredits(yoy)
      ),
      netBalance: buildNumericComparative(
        sumCredits(current) - sumDebits(current),
        sumCredits(previous) - sumDebits(previous),
        sumCredits(yoy) - sumDebits(yoy)
      ),
    },
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function fetchTrialRows(
  deps: ReportGeneratorDeps,
  period: { from: string; to: string }
): Promise<TrialBalanceRow[]> {
  const result = await deps.repository.listJournalEntries(
    { period },
    REPORT_PAGE_SIZE
  );
  const active = result.items.filter((e) => e.status === 'ACTIVE');
  return aggregateTrialBalance(active);
}

function aggregateTrialBalance(entries: JournalEntry[]): TrialBalanceRow[] {
  const map = new Map<string, { debit: number; credit: number }>();

  for (const entry of entries) {
    const key = entry.category;
    const existing = map.get(key) ?? { debit: 0, credit: 0 };

    if (entry.type === 'expense') {
      existing.debit += entry.netAmount;
    } else {
      existing.credit += entry.netAmount;
    }

    map.set(key, existing);
  }

  const rows: TrialBalanceRow[] = [];
  for (const [category, { debit, credit }] of map) {
    rows.push({
      category: category as TrialBalanceRow['category'],
      label: getCategoryDisplayLabel(category as TrialBalanceRow['category']),
      debit,
      credit,
      balance: credit - debit,
    });
  }

  return rows.sort((a, b) => {
    // Income categories first, then expenses
    const aType = a.credit > 0 ? 0 : 1;
    const bType = b.credit > 0 ? 0 : 1;
    return aType - bType || Math.abs(b.balance) - Math.abs(a.balance);
  });
}
