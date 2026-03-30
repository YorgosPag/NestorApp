/**
 * @fileoverview Reports Engine — Registry & Barrel Export (Phase 2c)
 * @description Maps ReportType to generator functions, provides generateReport()
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6 (8 reports)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type {
  ReportType,
  ReportGeneratorDeps,
  ResolvedPeriods,
  ReportResult,
  ReportDataMap,
} from '../../types/reports';
import { generateProfitAndLoss } from './profit-and-loss';
import { generateTrialBalance } from './trial-balance';
import { generateARAgingReport } from './ar-aging';
import { generateTaxSummary } from './tax-summary';
import { generateBankReconciliation } from './bank-reconciliation';
import { generateCashFlow } from './cash-flow';
import { generateIncomeByCustomer } from './income-by-customer';
import { generateExpenseByCategory } from './expense-by-category';

// ============================================================================
// REGISTRY
// ============================================================================

type GeneratorFn = (
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
) => Promise<ReportResult<ReportDataMap[ReportType]>>;

const REPORT_REGISTRY: Record<ReportType, GeneratorFn> = {
  profit_and_loss: generateProfitAndLoss,
  trial_balance: generateTrialBalance,
  ar_aging: generateARAgingReport,
  tax_summary: generateTaxSummary,
  bank_reconciliation: generateBankReconciliation,
  cash_flow: generateCashFlow,
  income_by_customer: generateIncomeByCustomer,
  expense_by_category: generateExpenseByCategory,
};

/** All valid report types (for API validation) */
export const VALID_REPORT_TYPES: readonly ReportType[] = Object.keys(REPORT_REGISTRY) as ReportType[];

/** Generate any report by type */
export async function generateReport<K extends ReportType>(
  type: K,
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
): Promise<ReportResult<ReportDataMap[K]>> {
  const generator = REPORT_REGISTRY[type];
  return generator(deps, periods) as Promise<ReportResult<ReportDataMap[K]>>;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { generateProfitAndLoss } from './profit-and-loss';
export { generateTrialBalance } from './trial-balance';
export { generateARAgingReport } from './ar-aging';
export { generateTaxSummary } from './tax-summary';
export { generateBankReconciliation } from './bank-reconciliation';
export { generateCashFlow } from './cash-flow';
export { generateIncomeByCustomer } from './income-by-customer';
export { generateExpenseByCategory } from './expense-by-category';
export { resolveReportPeriods, validateDateFilter } from './report-date-utils';
export { computeChange, buildNumericComparative, buildComparative } from './comparative-engine';
