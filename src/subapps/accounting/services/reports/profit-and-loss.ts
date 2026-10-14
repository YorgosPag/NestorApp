/**
 * @fileoverview Profit & Loss Report Generator (Phase 2c)
 * @description Κατάσταση Αποτελεσμάτων — ΕΛΠ Β.6 compliant format
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6 (Report #1 — mandatory per ΕΛΠ Ν.4308/2014)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { JournalEntry } from '../../types/journal';
import type {
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  ProfitAndLossData,
  CategoryBreakdown,
} from '../../types/reports';
import { getCategoryDisplayLabel } from '../../config/account-categories';
import { buildComparative, buildNumericComparative } from './comparative-engine';
import { nowISO } from '@/lib/date-local';
import { roundToTwo } from '../../utils/math';
import { createPeriodTaxBasisLoader, type PeriodTaxBasisLoader } from './report-tax-basis';

/** Generate Profit & Loss statement with comparative analysis (ΕΛΠ Β.6) */
export async function generateProfitAndLoss(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<ProfitAndLossData>> {
  // Ένας φορτωτής για τις τρεις περιόδους: ο ετήσιος συντελεστής (IAS 34) κάθε έτους υπολογίζεται μία φορά.
  const loadBasis = createPeriodTaxBasisLoader(deps);
  const [current, previous, yoy] = await Promise.all([
    fetchPnLSnapshot(loadBasis, periods.current),
    fetchPnLSnapshot(loadBasis, periods.previousPeriod),
    fetchPnLSnapshot(loadBasis, periods.yearOverYear),
  ]);

  return {
    reportType: 'profit_and_loss',
    generatedAt: nowISO(),
    period: periods,
    data: buildPnLData(current, previous, yoy),
  };
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface PnLSnapshot {
  income: CategoryBreakdown[];
  totalIncome: number;
  expenses: CategoryBreakdown[];
  totalExpenses: number;
  efka: number;
  grossProfit: number;
  netBeforeTax: number;
  estimatedTax: number;
  netAfterTax: number;
}

// ============================================================================
// SNAPSHOT FETCHING
// ============================================================================

async function fetchPnLSnapshot(
  loadBasis: PeriodTaxBasisLoader,
  period: { from: string; to: string }
): Promise<PnLSnapshot> {
  const { ledger, efkaPaid: efka, estimatedIncomeTax: estimatedTax } = await loadBasis(period);

  const income = aggregateByCategory(ledger.income);
  const expenses = aggregateByCategory(ledger.expense);
  const totalIncome = sumBreakdown(income);
  const totalExpenses = sumBreakdown(expenses);
  const grossProfit = roundToTwo(totalIncome - totalExpenses);
  const netBeforeTax = roundToTwo(grossProfit - efka);
  const netAfterTax = roundToTwo(netBeforeTax - estimatedTax);

  return {
    income, totalIncome, expenses, totalExpenses,
    efka, grossProfit, netBeforeTax, estimatedTax, netAfterTax,
  };
}

// ============================================================================
// AGGREGATION HELPERS
// ============================================================================

function aggregateByCategory(entries: readonly JournalEntry[]): CategoryBreakdown[] {
  const map = new Map<string, { total: number; count: number }>();

  for (const entry of entries) {
    const existing = map.get(entry.category) ?? { total: 0, count: 0 };
    existing.total += entry.netAmount;
    existing.count += 1;
    map.set(entry.category, existing);
  }

  const rows: CategoryBreakdown[] = [];
  for (const [category, { total, count }] of map) {
    rows.push({
      category: category as CategoryBreakdown['category'],
      label: getCategoryDisplayLabel(category as CategoryBreakdown['category']),
      netAmount: total,
      entryCount: count,
    });
  }

  return rows.sort((a, b) => b.netAmount - a.netAmount);
}

function sumBreakdown(items: CategoryBreakdown[]): number {
  return items.reduce((sum, i) => sum + i.netAmount, 0);
}

// ============================================================================
// COMPARATIVE DATA BUILDER
// ============================================================================

function buildPnLData(
  current: PnLSnapshot,
  previous: PnLSnapshot,
  yoy: PnLSnapshot
): ProfitAndLossData {
  const sumBd = (rows: CategoryBreakdown[]) => sumBreakdown(rows);
  return {
    income: buildComparative(current.income, previous.income, yoy.income, sumBd),
    totalIncome: buildNumericComparative(current.totalIncome, previous.totalIncome, yoy.totalIncome),
    expenses: buildComparative(current.expenses, previous.expenses, yoy.expenses, sumBd),
    totalExpenses: buildNumericComparative(current.totalExpenses, previous.totalExpenses, yoy.totalExpenses),
    grossProfit: buildNumericComparative(current.grossProfit, previous.grossProfit, yoy.grossProfit),
    efkaContributions: buildNumericComparative(current.efka, previous.efka, yoy.efka),
    netProfitBeforeTax: buildNumericComparative(current.netBeforeTax, previous.netBeforeTax, yoy.netBeforeTax),
    estimatedTax: buildNumericComparative(current.estimatedTax, previous.estimatedTax, yoy.estimatedTax),
    netProfitAfterTax: buildNumericComparative(current.netAfterTax, previous.netAfterTax, yoy.netAfterTax),
  };
}
