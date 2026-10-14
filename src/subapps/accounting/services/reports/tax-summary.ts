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
import { nowISO } from '@/lib/date-local';
import { createPeriodTaxBasisLoader, type PeriodTaxBasisLoader } from './report-tax-basis';

/** Generate Tax Summary report with comparative analysis */
export async function generateTaxSummary(
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<TaxSummaryData>> {
  // Ένας φορτωτής για τις τρεις περιόδους: ο ετήσιος συντελεστής (IAS 34) κάθε έτους υπολογίζεται μία φορά.
  const loadBasis = createPeriodTaxBasisLoader(deps);
  const [current, previous, yoy] = await Promise.all([
    fetchTaxSnapshot(loadBasis, periods.current),
    fetchTaxSnapshot(loadBasis, periods.previousPeriod),
    fetchTaxSnapshot(loadBasis, periods.yearOverYear),
  ]);

  // Installments only for current period
  const fiscalYear = new Date(periods.current.from).getFullYear();
  const installments = await deps.repository.getTaxInstallments(fiscalYear);

  return {
    reportType: 'tax_summary',
    generatedAt: nowISO(),
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
  loadBasis: PeriodTaxBasisLoader,
  period: { from: string; to: string }
): Promise<TaxSnapshot> {
  const { ledger, efkaPaid: efka, estimatedIncomeTax: estimatedTax } = await loadBasis(period);

  const income = ledger.totalIncomeNet;
  const deductibleExpenses = ledger.totalExpenseNet;
  const taxableIncome = Math.max(0, income - deductibleExpenses - efka);
  const vatSummary = computeVATSummary(ledger.income, ledger.expense);

  return { income, deductibleExpenses, efka, taxableIncome, estimatedTax, vatSummary };
}

// ============================================================================
// HELPERS
// ============================================================================

function computeVATSummary(
  income: readonly JournalEntry[],
  expenses: readonly JournalEntry[]
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
