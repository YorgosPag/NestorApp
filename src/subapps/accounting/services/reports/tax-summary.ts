/**
 * @fileoverview Tax Summary Report Generator (Phase 2c)
 * @description Σύνοψη Φόρων — VAT + Income Tax + EFKA combined
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6 (Report #4)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { JournalEntry } from '../../types/journal';
import type {
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  TaxSummaryData,
  VATSummaryRow,
} from '../../types/reports';
import { buildComparative, buildNumericComparative } from './comparative-engine';

const REPORT_PAGE_SIZE = 10000;

/** Generate Tax Summary report with comparative analysis */
export async function generateTaxSummary(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<TaxSummaryData>> {
  const [current, previous, yoy] = await Promise.all([
    fetchTaxSnapshot(deps, periods.current),
    fetchTaxSnapshot(deps, periods.previousPeriod),
    fetchTaxSnapshot(deps, periods.yearOverYear),
  ]);

  // Installments only for current period
  const fiscalYear = new Date(periods.current.from).getFullYear();
  const installments = await deps.repository.getTaxInstallments(fiscalYear);

  return {
    reportType: 'tax_summary',
    generatedAt: new Date().toISOString(),
    period: periods,
    data: buildTaxData(current, previous, yoy, installments),
  };
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface TaxSnapshot {
  income: number;
  deductibleExpenses: number;
  efka: number;
  taxableIncome: number;
  estimatedTax: number;
  vatSummary: VATSummaryRow;
}

// ============================================================================
// SNAPSHOT FETCHING
// ============================================================================

async function fetchTaxSnapshot(
  deps: ReportGeneratorDeps,
  period: { from: string; to: string }
): Promise<TaxSnapshot> {
  const fiscalYear = new Date(period.from).getFullYear();

  const [incomeResult, expenseResult, efkaPayments] = await Promise.all([
    deps.repository.listJournalEntries({ type: 'income', period }, REPORT_PAGE_SIZE),
    deps.repository.listJournalEntries({ type: 'expense', period }, REPORT_PAGE_SIZE),
    deps.repository.getEFKAPayments(fiscalYear),
  ]);

  const activeIncome = incomeResult.items.filter((e) => e.status === 'ACTIVE');
  const activeExpenses = expenseResult.items.filter((e) => e.status === 'ACTIVE');

  const income = sumNet(activeIncome);
  const deductibleExpenses = sumNet(activeExpenses);
  const efka = efkaPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const taxableIncome = Math.max(0, income - deductibleExpenses - efka);
  const estimatedTax = estimateIncomeTax(taxableIncome);
  const vatSummary = computeVATSummary(activeIncome, activeExpenses);

  return { income, deductibleExpenses, efka, taxableIncome, estimatedTax, vatSummary };
}

// ============================================================================
// HELPERS
// ============================================================================

function sumNet(entries: JournalEntry[]): number {
  return entries.reduce((sum, e) => sum + e.netAmount, 0);
}

function computeVATSummary(
  income: JournalEntry[],
  expenses: JournalEntry[]
): VATSummaryRow {
  const outputVat = income.reduce((sum, e) => sum + e.vatAmount, 0);
  const deductibleInputVat = expenses
    .filter((e) => e.vatDeductible)
    .reduce((sum, e) => sum + e.vatAmount, 0);
  return {
    outputVat,
    deductibleInputVat,
    vatPayable: outputVat - deductibleInputVat,
  };
}

function estimateIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
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

function buildTaxData(
  current: TaxSnapshot,
  previous: TaxSnapshot,
  yoy: TaxSnapshot,
  installments: TaxSummaryData['installments']
): TaxSummaryData {
  const vatExtractor = (v: VATSummaryRow) => v.vatPayable;
  return {
    income: buildNumericComparative(current.income, previous.income, yoy.income),
    deductibleExpenses: buildNumericComparative(
      current.deductibleExpenses, previous.deductibleExpenses, yoy.deductibleExpenses
    ),
    efkaContributions: buildNumericComparative(current.efka, previous.efka, yoy.efka),
    taxableIncome: buildNumericComparative(
      current.taxableIncome, previous.taxableIncome, yoy.taxableIncome
    ),
    estimatedIncomeTax: buildNumericComparative(
      current.estimatedTax, previous.estimatedTax, yoy.estimatedTax
    ),
    vatSummary: buildComparative(
      current.vatSummary, previous.vatSummary, yoy.vatSummary, vatExtractor
    ),
    installments,
  };
}
