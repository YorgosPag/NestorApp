/**
 * @fileoverview Report Table Adapter — Shared Flatten Logic (Phase 2e)
 * @description Transforms typed report data into uniform tabular format
 *   consumed by ReportTable UI, PDF exporter, Excel exporter, and CSV exporter.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type {
  ReportType,
  ReportDataMap,
  ChangeMetric,
  ComparativeColumn,
  ProfitAndLossData,
  TrialBalanceData,
  ARAgingData,
  TaxSummaryData,
  BankReconciliationData,
  CashFlowData,
  IncomeByCustomerData,
  ExpenseByCategoryData,
} from '../../types/reports';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/** A single cell in the flat table — string or number for formatting */
export type CellValue = string | number | null;

/** Uniform tabular output consumed by table UI + exporters */
export interface FlatTableData {
  /** Column headers for the main table */
  headers: string[];
  /** Rows of data (each row matches headers length) */
  rows: CellValue[][];
  /** Summary metrics for dashboard card + top-of-report KPIs */
  summaryMetrics: Array<{ label: string; value: number; change: ChangeMetric | null }>;
}

/** Dashboard card key metric for a single report */
export interface ReportKeyMetric {
  value: number;
  label: string;
  change: ChangeMetric | null;
  /** Format hint for display */
  format: 'currency' | 'percentage' | 'number';
}

// ============================================================================
// KEY METRIC EXTRACTION (for dashboard cards)
// ============================================================================

const KEY_METRIC_MAP: Record<ReportType, {
  extract: (data: ReportDataMap[ReportType]) => { value: number; change: ChangeMetric | null };
  labelKey: string;
  format: 'currency' | 'percentage' | 'number';
}> = {
  profit_and_loss: {
    extract: (d) => {
      const data = d as ProfitAndLossData;
      return { value: data.netProfitAfterTax.current, change: data.netProfitAfterTax.changeFromPrevious };
    },
    labelKey: 'reports.metrics.netProfit',
    format: 'currency',
  },
  trial_balance: {
    extract: (d) => {
      const data = d as TrialBalanceData;
      return { value: data.netBalance.current, change: data.netBalance.changeFromPrevious };
    },
    labelKey: 'reports.metrics.netBalance',
    format: 'currency',
  },
  ar_aging: {
    extract: (d) => {
      const data = d as ARAgingData;
      return { value: data.totalOutstanding.current, change: data.totalOutstanding.changeFromPrevious };
    },
    labelKey: 'reports.metrics.totalOutstanding',
    format: 'currency',
  },
  tax_summary: {
    extract: (d) => {
      const data = d as TaxSummaryData;
      return { value: data.estimatedIncomeTax.current, change: data.estimatedIncomeTax.changeFromPrevious };
    },
    labelKey: 'reports.metrics.estimatedTax',
    format: 'currency',
  },
  bank_reconciliation: {
    extract: (d) => {
      const data = d as BankReconciliationData;
      return { value: data.matchRate.current, change: data.matchRate.changeFromPrevious };
    },
    labelKey: 'reports.metrics.matchRate',
    format: 'percentage',
  },
  cash_flow: {
    extract: (d) => {
      const data = d as CashFlowData;
      return { value: data.netCashFlow.current, change: data.netCashFlow.changeFromPrevious };
    },
    labelKey: 'reports.metrics.netCashFlow',
    format: 'currency',
  },
  income_by_customer: {
    extract: (d) => {
      const data = d as IncomeByCustomerData;
      return { value: data.totalIncome.current, change: data.totalIncome.changeFromPrevious };
    },
    labelKey: 'reports.metrics.totalIncome',
    format: 'currency',
  },
  expense_by_category: {
    extract: (d) => {
      const data = d as ExpenseByCategoryData;
      return { value: data.totalExpenses.current, change: data.totalExpenses.changeFromPrevious };
    },
    labelKey: 'reports.metrics.totalExpenses',
    format: 'currency',
  },
};

/** Extract key metric for a dashboard card */
export function extractKeyMetric(
  type: ReportType,
  data: ReportDataMap[ReportType]
): ReportKeyMetric {
  const config = KEY_METRIC_MAP[type];
  const { value, change } = config.extract(data);
  return { value, label: config.labelKey, change, format: config.format };
}

// ============================================================================
// COMPARATIVE COLUMN HELPERS
// ============================================================================

function formatChange(change: ChangeMetric | null): CellValue {
  if (!change) return null;
  return change.absolute;
}

function formatChangePercent(change: ChangeMetric | null): CellValue {
  if (!change || change.percentage === null) return null;
  return change.percentage;
}

function numericComparativeRow(
  label: string,
  col: ComparativeColumn<number>
): CellValue[] {
  return [
    label,
    col.current,
    col.previousPeriod,
    col.yearOverYear,
    formatChange(col.changeFromPrevious),
    formatChangePercent(col.changeFromPrevious),
  ];
}

// ============================================================================
// REPORT-SPECIFIC FLATTENERS
// ============================================================================

function flattenProfitAndLoss(data: ProfitAndLossData): FlatTableData {
  const headers = ['', 'Current', 'Previous', 'YoY', 'Change', '%'];
  const rows: CellValue[][] = [];

  // Income categories
  for (const cat of data.income.current) {
    rows.push([`  ${cat.label}`, cat.netAmount, null, null, null, null]);
  }
  rows.push(numericComparativeRow('Total Income', data.totalIncome));

  // Expense categories
  for (const cat of data.expenses.current) {
    rows.push([`  ${cat.label}`, cat.netAmount, null, null, null, null]);
  }
  rows.push(numericComparativeRow('Total Expenses', data.totalExpenses));
  rows.push(numericComparativeRow('Gross Profit', data.grossProfit));
  rows.push(numericComparativeRow('EFKA Contributions', data.efkaContributions));
  rows.push(numericComparativeRow('Net Profit Before Tax', data.netProfitBeforeTax));
  rows.push(numericComparativeRow('Estimated Tax', data.estimatedTax));
  rows.push(numericComparativeRow('Net Profit After Tax', data.netProfitAfterTax));

  return {
    headers,
    rows,
    summaryMetrics: [
      { label: 'Total Income', value: data.totalIncome.current, change: data.totalIncome.changeFromPrevious },
      { label: 'Total Expenses', value: data.totalExpenses.current, change: data.totalExpenses.changeFromPrevious },
      { label: 'Net Profit', value: data.netProfitAfterTax.current, change: data.netProfitAfterTax.changeFromPrevious },
    ],
  };
}

function flattenTrialBalance(data: TrialBalanceData): FlatTableData {
  const headers = ['Category', 'Label', 'Debit', 'Credit', 'Balance'];
  const rows: CellValue[][] = data.rows.current.map((row) => [
    row.category,
    row.label,
    row.debit,
    row.credit,
    row.balance,
  ]);

  return {
    headers,
    rows,
    summaryMetrics: [
      { label: 'Total Debits', value: data.totalDebits.current, change: data.totalDebits.changeFromPrevious },
      { label: 'Total Credits', value: data.totalCredits.current, change: data.totalCredits.changeFromPrevious },
      { label: 'Net Balance', value: data.netBalance.current, change: data.netBalance.changeFromPrevious },
    ],
  };
}

function flattenARAging(data: ARAgingData): FlatTableData {
  const headers = ['Customer', '0-30', '31-60', '61-90', '90+', 'Total'];
  const rows: CellValue[][] = data.customers.current.map((c) => [
    c.customerName,
    c.aging.current,
    c.aging.thirtyDays,
    c.aging.sixtyDays,
    c.aging.ninetyPlus,
    c.totalOutstanding,
  ]);

  return {
    headers,
    rows,
    summaryMetrics: [
      { label: 'Total Outstanding', value: data.totalOutstanding.current, change: data.totalOutstanding.changeFromPrevious },
    ],
  };
}

function flattenTaxSummary(data: TaxSummaryData): FlatTableData {
  const headers = ['', 'Current', 'Previous', 'YoY', 'Change', '%'];
  const rows: CellValue[][] = [
    numericComparativeRow('Income', data.income),
    numericComparativeRow('Deductible Expenses', data.deductibleExpenses),
    numericComparativeRow('EFKA Contributions', data.efkaContributions),
    numericComparativeRow('Taxable Income', data.taxableIncome),
    numericComparativeRow('Estimated Income Tax', data.estimatedIncomeTax),
  ];

  // VAT summary row
  const vat = data.vatSummary.current;
  rows.push(['VAT Output', vat.outputVat, null, null, null, null]);
  rows.push(['VAT Input (Deductible)', vat.deductibleInputVat, null, null, null, null]);
  rows.push(['VAT Payable', vat.vatPayable, null, null, null, null]);

  return {
    headers,
    rows,
    summaryMetrics: [
      { label: 'Taxable Income', value: data.taxableIncome.current, change: data.taxableIncome.changeFromPrevious },
      { label: 'Estimated Tax', value: data.estimatedIncomeTax.current, change: data.estimatedIncomeTax.changeFromPrevious },
    ],
  };
}

function flattenBankReconciliation(data: BankReconciliationData): FlatTableData {
  const headers = ['', 'Current', 'Previous', 'YoY', 'Change', '%'];
  const rows: CellValue[][] = [
    numericComparativeRow('Total Transactions', data.totalTransactions),
    numericComparativeRow('Matched', data.matchedCount),
    numericComparativeRow('Unmatched', data.unmatchedCount),
    numericComparativeRow('Excluded', data.excludedCount),
    numericComparativeRow('Match Rate (%)', data.matchRate),
    numericComparativeRow('Total Credits', data.totalCredits),
    numericComparativeRow('Total Debits', data.totalDebits),
  ];

  return {
    headers,
    rows,
    summaryMetrics: [
      { label: 'Match Rate', value: data.matchRate.current, change: data.matchRate.changeFromPrevious },
      { label: 'Unmatched', value: data.unmatchedCount.current, change: data.unmatchedCount.changeFromPrevious },
    ],
  };
}

function flattenCashFlow(data: CashFlowData): FlatTableData {
  const headers = ['', 'Current', 'Previous', 'YoY', 'Change', '%'];
  const rows: CellValue[][] = [];

  // Operating section
  rows.push(['Operating Activities', null, null, null, null, null]);
  for (const item of data.operating.current.items) {
    rows.push([`  ${item.label}`, item.amount, null, null, null, null]);
  }
  rows.push(numericComparativeRow('Net Operating', {
    current: data.operating.current.net,
    previousPeriod: data.operating.previousPeriod?.net ?? null,
    yearOverYear: data.operating.yearOverYear?.net ?? null,
    changeFromPrevious: data.operating.changeFromPrevious,
    changeFromYoY: data.operating.changeFromYoY,
  }));

  // Investing section
  rows.push(['Investing Activities', null, null, null, null, null]);
  for (const item of data.investing.current.items) {
    rows.push([`  ${item.label}`, item.amount, null, null, null, null]);
  }
  rows.push(numericComparativeRow('Net Investing', {
    current: data.investing.current.net,
    previousPeriod: data.investing.previousPeriod?.net ?? null,
    yearOverYear: data.investing.yearOverYear?.net ?? null,
    changeFromPrevious: data.investing.changeFromPrevious,
    changeFromYoY: data.investing.changeFromYoY,
  }));

  // Financing section
  rows.push(['Financing Activities', null, null, null, null, null]);
  for (const item of data.financing.current.items) {
    rows.push([`  ${item.label}`, item.amount, null, null, null, null]);
  }
  rows.push(numericComparativeRow('Net Financing', {
    current: data.financing.current.net,
    previousPeriod: data.financing.previousPeriod?.net ?? null,
    yearOverYear: data.financing.yearOverYear?.net ?? null,
    changeFromPrevious: data.financing.changeFromPrevious,
    changeFromYoY: data.financing.changeFromYoY,
  }));

  rows.push(numericComparativeRow('Net Cash Flow', data.netCashFlow));

  return {
    headers,
    rows,
    summaryMetrics: [
      { label: 'Net Cash Flow', value: data.netCashFlow.current, change: data.netCashFlow.changeFromPrevious },
    ],
  };
}

function flattenIncomeByCustomer(data: IncomeByCustomerData): FlatTableData {
  const headers = ['Customer', 'Amount', 'Invoices', '% of Total'];
  const rows: CellValue[][] = data.customers.current.map((c) => [
    c.customerName,
    c.totalNetAmount,
    c.invoiceCount,
    c.percentage,
  ]);

  return {
    headers,
    rows,
    summaryMetrics: [
      { label: 'Total Income', value: data.totalIncome.current, change: data.totalIncome.changeFromPrevious },
    ],
  };
}

function flattenExpenseByCategory(data: ExpenseByCategoryData): FlatTableData {
  const headers = ['Category', 'Label', 'Amount', 'Count', '%', 'Deductible'];
  const rows: CellValue[][] = data.categories.current.map((c) => [
    c.category,
    c.label,
    c.totalNetAmount,
    c.entryCount,
    c.percentage,
    c.isDeductible ? 'Yes' : 'No',
  ]);

  return {
    headers,
    rows,
    summaryMetrics: [
      { label: 'Total Expenses', value: data.totalExpenses.current, change: data.totalExpenses.changeFromPrevious },
    ],
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

const FLATTENER_REGISTRY: Record<
  ReportType,
  (data: ReportDataMap[ReportType]) => FlatTableData
> = {
  profit_and_loss: (d) => flattenProfitAndLoss(d as ProfitAndLossData),
  trial_balance: (d) => flattenTrialBalance(d as TrialBalanceData),
  ar_aging: (d) => flattenARAging(d as ARAgingData),
  tax_summary: (d) => flattenTaxSummary(d as TaxSummaryData),
  bank_reconciliation: (d) => flattenBankReconciliation(d as BankReconciliationData),
  cash_flow: (d) => flattenCashFlow(d as CashFlowData),
  income_by_customer: (d) => flattenIncomeByCustomer(d as IncomeByCustomerData),
  expense_by_category: (d) => flattenExpenseByCategory(d as ExpenseByCategoryData),
};

/**
 * Flatten any report type into a uniform tabular structure.
 * Used by ReportTable UI, CSV/Excel/PDF exporters.
 */
export function flattenReportForExport(
  reportType: ReportType,
  data: ReportDataMap[ReportType]
): FlatTableData {
  const flattener = FLATTENER_REGISTRY[reportType];
  return flattener(data);
}
