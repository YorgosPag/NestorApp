/**
 * Άγκυρα — Report Table Adapter (ADR-ACC-010 §2.1.1 changelog 2026-10-30)
 *
 * Φυλά τρία πράγματα που έσπαγαν σιωπηλά:
 *   1. κάθε κείμενο του πίνακα / της εξαγωγής είναι κλειδί που ΥΠΑΡΧΕΙ σε el ΚΑΙ en (ο `t` εδώ πετά σε κλειδί που
 *      λείπει — το CHECK 3.8 δεν βλέπει κλειδιά που σχηματίζονται μέσα σε template)·
 *   2. η ηλικίωση αντιστοιχεί τους κάδους ένας-προς-έναν (ως τώρα η «0-30» έδειχνε τα μη ληξιπρόθεσμα)·
 *   3. η μορφή κελιού έρχεται από τον ρόλο στήλης / τη γραμμή — όχι από τη θέση (Υπόλοιπο ≠ «%», πλήθος ≠ €).
 */

import el from '@/i18n/locales/el/accounting.json';
import en from '@/i18n/locales/en/accounting.json';

import type {
  ARAgingData,
  BankReconciliationData,
  CashFlowData,
  ComparativeColumn,
  ExpenseByCategoryData,
  IncomeByCustomerData,
  ProfitAndLossData,
  ReportDataMap,
  ReportType,
  TaxSummaryData,
  TrialBalanceData,
} from '../../../types/reports';
import type { AgingBuckets } from '../../../types/customer-balance';
import {
  cellFormatOf,
  flattenReportForExport,
  type FlatTableData,
  type ReportTranslate,
} from '../report-table-adapter';

// ============================================================================
// Αυστηρός `t` πάνω στα πραγματικά αρχεία locale
// ============================================================================

function strictTranslate(resources: unknown, language: string): ReportTranslate {
  return (key, options) => {
    const value = key.split('.').reduce<unknown>(
      (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
      resources,
    );
    if (typeof value !== 'string') throw new Error(`[${language}] missing i18n key: accounting:${key}`);
    return value.replace(/\{(\w+)\}/g, (_, name: string) => String(options?.[name] ?? `{${name}}`));
  };
}

const tEl = strictTranslate(el, 'el');
const tEn = strictTranslate(en, 'en');

// ============================================================================
// Fixtures
// ============================================================================

function col(current: number, previous: number | null = null): ComparativeColumn<number> {
  return {
    current,
    previousPeriod: previous,
    yearOverYear: null,
    changeFromPrevious: previous === null ? null : { absolute: current - previous, percentage: null },
    changeFromYoY: null,
  };
}

function only<T>(current: T): ComparativeColumn<T> {
  return { current, previousPeriod: null, yearOverYear: null, changeFromPrevious: null, changeFromYoY: null };
}

const BUCKETS: AgingBuckets = { current: 1, days1_30: 2, days31_60: 3, days61_90: 4, days91_120: 5, days120plus: 6 };

const profitAndLoss: ProfitAndLossData = {
  income: only([{ category: 'custom_rent', label: 'Ενοίκια', netAmount: 100, entryCount: 1 }]),
  totalIncome: col(100, 80),
  expenses: only([{ category: 'custom_fuel', label: 'Καύσιμα', netAmount: 40, entryCount: 2 }]),
  totalExpenses: col(40),
  grossProfit: col(60),
  efkaContributions: col(10),
  netProfitBeforeTax: col(50),
  estimatedTax: col(11),
  netProfitAfterTax: col(39),
};

const trialBalance: TrialBalanceData = {
  rows: only([{ category: 'custom_rent', label: 'Ενοίκια', debit: 0, credit: 100, balance: -100 }]),
  totalDebits: col(0),
  totalCredits: col(100),
  netBalance: col(-100),
};

const arAging: ARAgingData = {
  customers: only([{ customerId: 'c1', customerName: 'Πελάτης Α', aging: BUCKETS, totalOutstanding: 21, invoiceCount: 3 }]),
  totals: only(BUCKETS),
  totalOutstanding: col(21),
};

const taxSummary: TaxSummaryData = {
  income: col(100),
  deductibleExpenses: col(40),
  efkaContributions: col(10),
  taxableIncome: col(50),
  estimatedIncomeTax: col(11),
  vatSummary: only({ outputVat: 24, deductibleInputVat: 9.6, vatPayable: 14.4 }),
  installments: [],
};

const bankReconciliation: BankReconciliationData = {
  totalTransactions: col(10, 8),
  matchedCount: col(7),
  unmatchedCount: col(3),
  excludedCount: col(0),
  matchRate: col(70, 50),
  totalCredits: col(1000),
  totalDebits: col(400),
  unmatchedItems: [],
};

const section = { inflows: 10, outflows: 4, net: 6, items: [{ label: 'Εισπράξεις', amount: 10 }] };
const cashFlow: CashFlowData = {
  operating: only(section),
  investing: only(section),
  financing: only(section),
  netCashFlow: col(18),
};

const incomeByCustomer: IncomeByCustomerData = {
  customers: only([
    { customerId: 'c1', customerName: 'Πελάτης Α', totalNetAmount: 75, invoiceCount: 3, percentage: 75 },
    { customerId: null, customerName: null, totalNetAmount: 25, invoiceCount: 1, percentage: 25 },
  ]),
  totalIncome: col(100),
};

const expenseByCategory: ExpenseByCategoryData = {
  categories: only([
    { category: 'custom_fuel', label: 'Καύσιμα', totalNetAmount: 40, entryCount: 2, percentage: 100, isDeductible: true },
  ]),
  totalExpenses: col(40),
};

const FIXTURES: { [K in ReportType]: ReportDataMap[K] } = {
  profit_and_loss: profitAndLoss,
  trial_balance: trialBalance,
  ar_aging: arAging,
  tax_summary: taxSummary,
  bank_reconciliation: bankReconciliation,
  cash_flow: cashFlow,
  income_by_customer: incomeByCustomer,
  expense_by_category: expenseByCategory,
};

const REPORT_TYPES = Object.keys(FIXTURES) as ReportType[];

function flatten(type: ReportType, t: ReportTranslate = tEl): FlatTableData {
  return flattenReportForExport(type, FIXTURES[type], t);
}

/** Η μορφή του κελιού κάτω από την κεφαλίδα `header`, στη γραμμή που αρχίζει με `label`. */
function formatAt(table: FlatTableData, rowLabel: string, header: string) {
  const index = table.columns.findIndex((c) => c.header === header);
  const row = table.rows.find((r) => r.cells[0] === rowLabel || r.cells[1] === rowLabel);
  if (index < 0 || !row) throw new Error(`no cell ${rowLabel} × ${header}`);
  return cellFormatOf(table.columns[index], row);
}

// ============================================================================
// 1. Κλειδιά i18n — el ΚΑΙ en, κάθε αναφορά
// ============================================================================

describe('report-table-adapter — i18n', () => {
  it.each(REPORT_TYPES)('%s: every text resolves in el and en, and every row has one cell per column', (type) => {
    for (const t of [tEl, tEn]) {
      const table = flatten(type, t);
      expect(table.columns.length).toBeGreaterThan(0);
      for (const row of table.rows) expect(row.cells).toHaveLength(table.columns.length);
    }
  });

  it('speaks the language of the given `t` — no hard-coded English', () => {
    const elTable = flatten('profit_and_loss', tEl);
    const enTable = flatten('profit_and_loss', tEn);
    expect(elTable.rows.map((r) => r.cells[0])).toContain('Σύνολο Εσόδων');
    expect(enTable.rows.map((r) => r.cells[0])).toContain('Total Income');
    expect(elTable.columns.map((c) => c.header)).toContain('Τρέχουσα');
    expect(elTable.summaryMetrics.map((m) => m.label)).toEqual(['Σύνολο Εσόδων', 'Σύνολο Εξόδων', 'Καθαρό Κέρδος']);
  });

  it('labels the customer-less row and the deductible flag through i18n', () => {
    expect(flatten('income_by_customer').rows[1].cells[0]).toBe('Χωρίς Πελάτη');
    expect(flatten('expense_by_category', tEn).rows[0].cells[5]).toBe('Yes');
  });
});

// ============================================================================
// 2. Ηλικίωση — κάδοι ένας-προς-έναν
// ============================================================================

describe('report-table-adapter — AR aging', () => {
  it('maps every AgingBuckets field to its own column, in order, then the total', () => {
    const table = flatten('ar_aging');
    expect(table.columns.map((c) => c.header)).toEqual([
      'Πελάτης', 'Εντός προθεσμίας', '1–30 ημ.', '31–60 ημ.', '61–90 ημ.', '91–120 ημ.', '120+ ημ.', 'Σύνολο',
    ]);
    expect(table.rows[0].cells).toEqual(['Πελάτης Α', 1, 2, 3, 4, 5, 6, 21]);
  });
});

// ============================================================================
// 3. Μορφή κελιού από ρόλο/γραμμή — όχι από θέση
// ============================================================================

describe('report-table-adapter — cell format', () => {
  it('trial balance: the last column (Balance) is an amount, not a percentage', () => {
    expect(formatAt(flatten('trial_balance'), 'Ενοίκια', 'Υπόλοιπο')).toBe('currency');
  });

  it('AR aging: the total is an amount', () => {
    expect(formatAt(flatten('ar_aging'), 'Πελάτης Α', 'Σύνολο')).toBe('currency');
  });

  it('bank reconciliation: counts are counts, the match rate is a percentage, amounts are amounts', () => {
    const table = flatten('bank_reconciliation');
    expect(formatAt(table, 'Σύνολο Κινήσεων', 'Τρέχουσα')).toBe('count');
    expect(formatAt(table, 'Σύνολο Κινήσεων', 'Μεταβολή')).toBe('count');
    expect(formatAt(table, 'Ποσοστό Αντιστοίχισης', 'Τρέχουσα')).toBe('percent');
    expect(formatAt(table, 'Σύνολο Πιστώσεων', 'Τρέχουσα')).toBe('currency');
    expect(formatAt(table, 'Σύνολο Κινήσεων', 'Μεταβολή %')).toBe('percent');
    expect(table.summaryMetrics.map((m) => m.format)).toEqual(['percent', 'count']);
  });

  it('income by customer: invoice count is a count, share is a percentage', () => {
    const table = flatten('income_by_customer');
    expect(formatAt(table, 'Πελάτης Α', 'Τιμολόγια')).toBe('count');
    expect(formatAt(table, 'Πελάτης Α', '% του Συνόλου')).toBe('percent');
    expect(formatAt(table, 'Πελάτης Α', 'Πελάτης')).toBeNull();
  });

  it('expense by category: entry count is a count, the deductible flag is text', () => {
    const table = flatten('expense_by_category');
    expect(formatAt(table, 'Καύσιμα', 'Εγγραφές')).toBe('count');
    expect(formatAt(table, 'Καύσιμα', 'Εκπίπτει')).toBeNull();
  });

  it('cash flow: section headers are flagged — not guessed from empty cells', () => {
    const sections = flatten('cash_flow').rows.filter((r) => r.section).map((r) => r.cells[0]);
    expect(sections).toEqual([
      'Λειτουργικές Δραστηριότητες', 'Επενδυτικές Δραστηριότητες', 'Χρηματοδοτικές Δραστηριότητες',
    ]);
  });
});
