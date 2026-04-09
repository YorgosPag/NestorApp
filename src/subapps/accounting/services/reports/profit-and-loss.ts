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

const REPORT_PAGE_SIZE = 10000;

/** Generate Profit & Loss statement with comparative analysis (ΕΛΠ Β.6) */
export async function generateProfitAndLoss(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<ProfitAndLossData>> {
  const [current, previous, yoy] = await Promise.all([
    fetchPnLSnapshot(deps, periods.current),
    fetchPnLSnapshot(deps, periods.previousPeriod),
    fetchPnLSnapshot(deps, periods.yearOverYear),
  ]);

  return {
    reportType: 'profit_and_loss',
    generatedAt: new Date().toISOString(),
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
  deps: ReportGeneratorDeps,
  period: { from: string; to: string }
): Promise<PnLSnapshot> {
  const fiscalYear = new Date(period.from).getFullYear();

  const [incomeResult, expenseResult, efkaPayments] = await Promise.all([
    deps.repository.listJournalEntries({ type: 'income', period }, REPORT_PAGE_SIZE),
    deps.repository.listJournalEntries({ type: 'expense', period }, REPORT_PAGE_SIZE),
    deps.repository.getEFKAPayments(fiscalYear),
  ]);

  const activeIncome = incomeResult.items.filter((e) => e.status === 'ACTIVE');
  const activeExpense = expenseResult.items.filter((e) => e.status === 'ACTIVE');

  const income = aggregateByCategory(activeIncome);
  const expenses = aggregateByCategory(activeExpense);
  const totalIncome = sumBreakdown(income);
  const totalExpenses = sumBreakdown(expenses);
  const efka = computeEfkaTotal(efkaPayments);
  const grossProfit = totalIncome - totalExpenses;
  const netBeforeTax = grossProfit - efka;
  const estimatedTax = estimateTax(deps, netBeforeTax);
  const netAfterTax = netBeforeTax - estimatedTax;

  return {
    income, totalIncome, expenses, totalExpenses,
    efka, grossProfit, netBeforeTax, estimatedTax, netAfterTax,
  };
}

// ============================================================================
// AGGREGATION HELPERS
// ============================================================================

function aggregateByCategory(entries: JournalEntry[]): CategoryBreakdown[] {
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

function computeEfkaTotal(payments: { amount: number; status: string }[]): number {
  return payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
}

function estimateTax(deps: ReportGeneratorDeps, taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  // Simplified Greek tax brackets for sole proprietor (ΕΛΠ)
  // 9% up to 10K, 22% 10K-20K, 28% 20K-30K, 36% 30K-40K, 44% 40K+
  const brackets = [
    { limit: 10000, rate: 0.09 },
    { limit: 20000, rate: 0.22 },
    { limit: 30000, rate: 0.28 },
    { limit: 40000, rate: 0.36 },
    { limit: Infinity, rate: 0.44 },
  ];
  let remaining = taxableIncome;
  let tax = 0;
  let prevLimit = 0;
  for (const { limit, rate } of brackets) {
    const taxable = Math.min(remaining, limit - prevLimit);
    tax += taxable * rate;
    remaining -= taxable;
    prevLimit = limit;
    if (remaining <= 0) break;
  }
  return Math.round(tax * 100) / 100;
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
