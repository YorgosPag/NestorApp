/**
 * @fileoverview Report Table Adapter — Shared Flatten Logic (Phase 2e)
 * @description Transforms typed report data into uniform tabular format
 *   consumed by ReportTable UI, PDF exporter, Excel exporter, and CSV exporter.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 *
 * 🔴 2026-10-30 (ADR-ACC-010 §2.1.1 · N.11): ως τώρα οι κεφαλίδες και οι γραμμές ήταν σκληρογραμμένα ΑΓΓΛΙΚΑ
 *   (`'Customer'`, `'Total Income'`…) σε CSV / Excel / PDF ΚΑΙ στον πίνακα της οθόνης — αόρατα στο CHECK 3.8, γιατί
 *   δεν περνούσαν από `t()`. Και ο πίνακας «μάντευε» τη μορφή από τη ΘΕΣΗ της στήλης (τελευταία = «%»,
 *   προτελευταία = «μεταβολή»): το Υπόλοιπο του ισοζυγίου και το Σύνολο της ηλικίωσης έβγαιναν ως ποσοστό, τα
 *   πλήθη (τιμολόγια, κινήσεις) ως ευρώ. Τώρα:
 *   - κάθε κείμενο είναι κλειδί i18n, μεταφρασμένο από τον `t` του ΚΑΛΟΥΝΤΟΣ (ρητή γλώσσα — όχι το καθολικό
 *     `i18next`, ADR-841 Α21.21 Φάση Β)·
 *   - κάθε στήλη δηλώνει τον ΡΟΛΟ της και κάθε γραμμή τη ΜΟΡΦΗ των αριθμών της (οι συγκριτικοί πίνακες μιξάρουν
 *     € / πλήθος / % στην ίδια στήλη — π.χ. η συμφωνία τράπεζας).
 *   - ηλικίωση: οι κάδοι ήταν μετατοπισμένοι κατά έναν (η «0-30» έδειχνε τα μη ληξιπρόθεσμα, η «31-60» τα 1-30…).
 *     Τώρα ένας-προς-έναν με το `AgingBuckets`, όπως οι Xero / QuickBooks (Current · 1-30 · … · Older).
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

/** Ο `t` του καλούντος (namespace `accounting`) — η γλώσσα της εξαγωγής είναι η δική του, ρητά. */
export type ReportTranslate = (key: string, options?: Record<string, unknown>) => string;

/** Πώς διαβάζεται ένας αριθμός: ποσό · πλήθος · ποσοστό (0-100). */
export type ReportValueFormat = 'currency' | 'count' | 'percent';

/**
 * Ο ρόλος μιας στήλης. `value` / `change`: η μορφή είναι της ΓΡΑΜΜΗΣ (συγκριτικοί πίνακες)· `label` / `text`:
 * κείμενο· οι υπόλοιποι: σταθερή μορφή για όλη τη στήλη.
 */
export type ReportColumnKind = 'label' | 'text' | 'value' | 'change' | ReportValueFormat;

export interface ReportColumn {
  /** Μεταφρασμένη κεφαλίδα (κενή για τη στήλη ετικετών των συγκριτικών πινάκων). */
  readonly header: string;
  readonly kind: ReportColumnKind;
}

export interface ReportRow {
  readonly cells: readonly CellValue[];
  /** Η μορφή των αριθμών της γραμμής στις στήλες `value` / `change`. */
  readonly format: ReportValueFormat;
  /** Επικεφαλίδα ενότητας (π.χ. «Λειτουργικές Δραστηριότητες») — μόνο η πρώτη στήλη έχει τιμή. */
  readonly section: boolean;
}

export interface ReportSummaryMetric {
  readonly label: string;
  readonly value: number;
  readonly change: ChangeMetric | null;
  readonly format: ReportValueFormat;
}

/** Uniform tabular output consumed by table UI + exporters */
export interface FlatTableData {
  readonly columns: readonly ReportColumn[];
  /** Each row's `cells` matches `columns` length */
  readonly rows: readonly ReportRow[];
  /** Summary metrics for dashboard card + top-of-report KPIs */
  readonly summaryMetrics: readonly ReportSummaryMetric[];
}

/** Dashboard card key metric for a single report */
export interface ReportKeyMetric {
  value: number;
  label: string;
  change: ChangeMetric | null;
  /** Format hint for display */
  format: ReportValueFormat;
}

/** Η μορφή ενός κελιού — `null` για κείμενο. ΕΝΑΣ κριτής για οθόνη, PDF και Excel. */
export function cellFormatOf(column: ReportColumn, row: ReportRow): ReportValueFormat | null {
  switch (column.kind) {
    case 'label':
    case 'text':
      return null;
    case 'value':
    case 'change':
      return row.format;
    default:
      return column.kind;
  }
}

// ============================================================================
// KEY METRIC EXTRACTION (for dashboard cards)
// ============================================================================

const KEY_METRIC_MAP: Record<ReportType, {
  extract: (data: ReportDataMap[ReportType]) => { value: number; change: ChangeMetric | null };
  labelKey: string;
  format: ReportValueFormat;
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
    format: 'percent',
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
// BUILDING BLOCKS
// ============================================================================

const METRIC = 'reports.metrics';
const TABLE = 'reports.table';

/** Μία στήλη ως ΔΗΛΩΣΗ: κλειδί κεφαλίδας κάτω από `reports.table` (`null` = χωρίς κεφαλίδα) · ρόλος. */
type ColumnSpec = readonly [key: string | null, kind: ReportColumnKind];

/**
 * Οι στήλες ενός πίνακα από τη δήλωσή τους — η κεφαλίδα μεταφράζεται σε ΕΝΑ σημείο. Ως 2026-10-30 κάθε πίνακας
 * ξανάγραφε `{ header: t(…), kind }` ανά στήλη (το CHECK 3.28 μέτρησε δίδυμα ισοζύγιο ↔ έξοδα ανά κατηγορία).
 */
function tableColumns(t: ReportTranslate, spec: readonly ColumnSpec[]): ReportColumn[] {
  return spec.map(([key, kind]) => ({ header: key === null ? '' : t(`${TABLE}.${key}`), kind }));
}

/** Οι στήλες κάθε συγκριτικού πίνακα: ετικέτα · τρέχουσα · προηγούμενη · πέρυσι · μεταβολή · μεταβολή %. */
function comparativeColumns(t: ReportTranslate): ReportColumn[] {
  return tableColumns(t, [
    [null, 'label'],
    ['current', 'value'],
    ['previousPeriod', 'value'],
    ['yearOverYear', 'value'],
    ['change', 'change'],
    ['changePercent', 'percent'],
  ]);
}

function row(cells: CellValue[], format: ReportValueFormat = 'currency'): ReportRow {
  return { cells, format, section: false };
}

function sectionRow(label: string, width: number): ReportRow {
  return { cells: [label, ...Array<CellValue>(width - 1).fill(null)], format: 'currency', section: true };
}

/** Γραμμή συγκριτικού πίνακα με ΜΟΝΟ τρέχουσα τιμή (χωρίς προηγούμενη/πέρυσι/μεταβολή). */
function currentOnlyRow(label: string, amount: number): ReportRow {
  return row([label, amount, null, null, null, null]);
}

/** Μία γραμμή ανάλυσης (κατηγορία, κίνηση) μέσα σε συγκριτικό πίνακα — εσοχή κάτω από το σύνολό της. */
function detailRow(label: string, amount: number): ReportRow {
  return currentOnlyRow(`  ${label}`, amount);
}

function comparativeRow(
  label: string,
  col: ComparativeColumn<number>,
  format: ReportValueFormat = 'currency'
): ReportRow {
  return row([
    label,
    col.current,
    col.previousPeriod,
    col.yearOverYear,
    col.changeFromPrevious?.absolute ?? null,
    col.changeFromPrevious?.percentage ?? null,
  ], format);
}

function metric(
  t: ReportTranslate,
  key: string,
  col: ComparativeColumn<number>,
  format: ReportValueFormat = 'currency'
): ReportSummaryMetric {
  return { label: t(`${METRIC}.${key}`), value: col.current, change: col.changeFromPrevious, format };
}

// ============================================================================
// REPORT-SPECIFIC FLATTENERS
// ============================================================================

function flattenProfitAndLoss(data: ProfitAndLossData, t: ReportTranslate): FlatTableData {
  const m = (key: string) => t(`${METRIC}.${key}`);
  const rows: ReportRow[] = [
    ...data.income.current.map((cat) => detailRow(cat.label, cat.netAmount)),
    comparativeRow(m('totalIncome'), data.totalIncome),
    ...data.expenses.current.map((cat) => detailRow(cat.label, cat.netAmount)),
    comparativeRow(m('totalExpenses'), data.totalExpenses),
    comparativeRow(m('grossProfit'), data.grossProfit),
    comparativeRow(m('efkaContributions'), data.efkaContributions),
    comparativeRow(m('netProfitBeforeTax'), data.netProfitBeforeTax),
    comparativeRow(m('estimatedTax'), data.estimatedTax),
    comparativeRow(m('netProfitAfterTax'), data.netProfitAfterTax),
  ];

  return {
    columns: comparativeColumns(t),
    rows,
    summaryMetrics: [
      metric(t, 'totalIncome', data.totalIncome),
      metric(t, 'totalExpenses', data.totalExpenses),
      metric(t, 'netProfit', data.netProfitAfterTax),
    ],
  };
}

function flattenTrialBalance(data: TrialBalanceData, t: ReportTranslate): FlatTableData {
  return {
    columns: tableColumns(t, [
      ['category', 'text'],
      ['label', 'label'],
      ['debit', 'currency'],
      ['credit', 'currency'],
      ['balance', 'currency'],
    ]),
    rows: data.rows.current.map((r) => row([r.category, r.label, r.debit, r.credit, r.balance])),
    summaryMetrics: [
      metric(t, 'totalDebits', data.totalDebits),
      metric(t, 'totalCredits', data.totalCredits),
      metric(t, 'netBalance', data.netBalance),
    ],
  };
}

/** Οι κάδοι ηλικίωσης, με τη σειρά του `AgingBuckets` — ένας προς έναν, κανένας συγχωνευμένος. */
const AGING_BUCKETS = ['current', 'days1_30', 'days31_60', 'days61_90', 'days91_120', 'days120plus'] as const;

function flattenARAging(data: ARAgingData, t: ReportTranslate): FlatTableData {
  return {
    columns: tableColumns(t, [
      ['customer', 'label'],
      ...AGING_BUCKETS.map((bucket): ColumnSpec => [`aging.${bucket}`, 'currency']),
      ['total', 'currency'],
    ]),
    rows: data.customers.current.map((c) => row([
      c.customerName,
      ...AGING_BUCKETS.map((bucket) => c.aging[bucket]),
      c.totalOutstanding,
    ])),
    summaryMetrics: [metric(t, 'totalOutstanding', data.totalOutstanding)],
  };
}

function flattenTaxSummary(data: TaxSummaryData, t: ReportTranslate): FlatTableData {
  const m = (key: string) => t(`${METRIC}.${key}`);
  const vat = data.vatSummary.current;
  return {
    columns: comparativeColumns(t),
    rows: [
      comparativeRow(m('income'), data.income),
      comparativeRow(m('deductibleExpenses'), data.deductibleExpenses),
      comparativeRow(m('efkaContributions'), data.efkaContributions),
      comparativeRow(m('taxableIncome'), data.taxableIncome),
      comparativeRow(m('estimatedIncomeTax'), data.estimatedIncomeTax),
      currentOnlyRow(m('vatOutput'), vat.outputVat),
      currentOnlyRow(m('vatInputDeductible'), vat.deductibleInputVat),
      currentOnlyRow(m('vatPayable'), vat.vatPayable),
    ],
    summaryMetrics: [
      metric(t, 'taxableIncome', data.taxableIncome),
      metric(t, 'estimatedTax', data.estimatedIncomeTax),
    ],
  };
}

function flattenBankReconciliation(data: BankReconciliationData, t: ReportTranslate): FlatTableData {
  const m = (key: string) => t(`${METRIC}.${key}`);
  return {
    columns: comparativeColumns(t),
    rows: [
      comparativeRow(m('totalTransactions'), data.totalTransactions, 'count'),
      comparativeRow(m('matched'), data.matchedCount, 'count'),
      comparativeRow(m('unmatched'), data.unmatchedCount, 'count'),
      comparativeRow(m('excluded'), data.excludedCount, 'count'),
      comparativeRow(m('matchRate'), data.matchRate, 'percent'),
      comparativeRow(m('totalCredits'), data.totalCredits),
      comparativeRow(m('totalDebits'), data.totalDebits),
    ],
    summaryMetrics: [
      metric(t, 'matchRate', data.matchRate, 'percent'),
      metric(t, 'unmatched', data.unmatchedCount, 'count'),
    ],
  };
}

type CashFlowColumn = CashFlowData['operating'];

/** Μία ενότητα ταμειακών ροών: επικεφαλίδα · κινήσεις · καθαρό σύνολο (συγκριτικό). */
function cashFlowSection(section: CashFlowColumn, titleKey: string, netKey: string, t: ReportTranslate): ReportRow[] {
  return [
    sectionRow(t(`${METRIC}.${titleKey}`), 6),
    ...section.current.items.map((item) => detailRow(item.label, item.amount)),
    comparativeRow(t(`${METRIC}.${netKey}`), {
      current: section.current.net,
      previousPeriod: section.previousPeriod?.net ?? null,
      yearOverYear: section.yearOverYear?.net ?? null,
      changeFromPrevious: section.changeFromPrevious,
      changeFromYoY: section.changeFromYoY,
    }),
  ];
}

function flattenCashFlow(data: CashFlowData, t: ReportTranslate): FlatTableData {
  return {
    columns: comparativeColumns(t),
    rows: [
      ...cashFlowSection(data.operating, 'operatingActivities', 'netOperating', t),
      ...cashFlowSection(data.investing, 'investingActivities', 'netInvesting', t),
      ...cashFlowSection(data.financing, 'financingActivities', 'netFinancing', t),
      comparativeRow(t(`${METRIC}.netCashFlow`), data.netCashFlow),
    ],
    summaryMetrics: [metric(t, 'netCashFlow', data.netCashFlow)],
  };
}

function flattenIncomeByCustomer(data: IncomeByCustomerData, t: ReportTranslate): FlatTableData {
  return {
    columns: tableColumns(t, [
      ['customer', 'label'],
      ['amount', 'currency'],
      ['invoiceCount', 'count'],
      ['shareOfTotal', 'percent'],
    ]),
    rows: data.customers.current.map((c) => row([
      c.customerName ?? t('reports.noCustomer'),
      c.totalNetAmount,
      c.invoiceCount,
      c.percentage,
    ])),
    summaryMetrics: [metric(t, 'totalIncome', data.totalIncome)],
  };
}

function flattenExpenseByCategory(data: ExpenseByCategoryData, t: ReportTranslate): FlatTableData {
  return {
    columns: tableColumns(t, [
      ['category', 'text'],
      ['label', 'label'],
      ['amount', 'currency'],
      ['entryCount', 'count'],
      ['shareOfTotal', 'percent'],
      ['deductible', 'text'],
    ]),
    rows: data.categories.current.map((c) => row([
      c.category,
      c.label,
      c.totalNetAmount,
      c.entryCount,
      c.percentage,
      t(c.isDeductible ? `${TABLE}.yes` : `${TABLE}.no`),
    ])),
    summaryMetrics: [metric(t, 'totalExpenses', data.totalExpenses)],
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

const FLATTENER_REGISTRY: Record<
  ReportType,
  (data: ReportDataMap[ReportType], t: ReportTranslate) => FlatTableData
> = {
  profit_and_loss: (d, t) => flattenProfitAndLoss(d as ProfitAndLossData, t),
  trial_balance: (d, t) => flattenTrialBalance(d as TrialBalanceData, t),
  ar_aging: (d, t) => flattenARAging(d as ARAgingData, t),
  tax_summary: (d, t) => flattenTaxSummary(d as TaxSummaryData, t),
  bank_reconciliation: (d, t) => flattenBankReconciliation(d as BankReconciliationData, t),
  cash_flow: (d, t) => flattenCashFlow(d as CashFlowData, t),
  income_by_customer: (d, t) => flattenIncomeByCustomer(d as IncomeByCustomerData, t),
  expense_by_category: (d, t) => flattenExpenseByCategory(d as ExpenseByCategoryData, t),
};

/**
 * Flatten any report type into a uniform tabular structure, in the language of `t`.
 * Used by ReportTable UI, CSV/Excel/PDF exporters.
 */
export function flattenReportForExport(
  reportType: ReportType,
  data: ReportDataMap[ReportType],
  t: ReportTranslate
): FlatTableData {
  const flattener = FLATTENER_REGISTRY[reportType];
  return flattener(data, t);
}
