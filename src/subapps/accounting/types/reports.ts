/**
 * @fileoverview Accounting Subapp — Report Types (Phase 2c)
 * @description Types for 8 financial reports with comparative analysis
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q6, Q7, Q9, Q10
 * @compliance ΕΛΠ Ν.4308/2014, CLAUDE.md Enterprise Standards — zero `any`
 */

import type { AccountCategory } from './common';
import type { AgingBuckets } from './customer-balance';
import type { TaxInstallment } from './tax';
import type { TransactionDirection } from './bank';
import type { IAccountingRepository } from './interfaces';
import type { IVATEngine, ITaxEngine } from './interfaces';

// ============================================================================
// REPORT TYPE ENUM
// ============================================================================

/** 8 report types (Q6 decision) */
export type ReportType =
  | 'profit_and_loss'
  | 'trial_balance'
  | 'ar_aging'
  | 'tax_summary'
  | 'bank_reconciliation'
  | 'cash_flow'
  | 'income_by_customer'
  | 'expense_by_category';

// ============================================================================
// DATE FILTERING (Q9 — Presets + Custom)
// ============================================================================

/** Date filter presets */
export type ReportDatePreset =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'ytd'
  | 'custom';

/** Date filter input from API query params */
export interface ReportDateFilter {
  preset: ReportDatePreset;
  /** Required when preset = 'custom' (ISO 8601 date) */
  customFrom?: string;
  /** Required when preset = 'custom' (ISO 8601 date) */
  customTo?: string;
}

// ============================================================================
// RESOLVED PERIODS (for comparative analysis)
// ============================================================================

/** Period range — re-using PeriodRange from common.ts */
export interface ResolvedPeriods {
  /** Current period being reported */
  current: { from: string; to: string };
  /** Previous sequential period (MoM or QoQ) */
  previousPeriod: { from: string; to: string };
  /** Same period last year (YoY) */
  yearOverYear: { from: string; to: string };
}

// ============================================================================
// COMPARATIVE DATA WRAPPER (Q7 — Full 4-column comparison)
// ============================================================================

/** Change between two periods (absolute + percentage) */
export interface ChangeMetric {
  /** Absolute difference (current - base) */
  absolute: number;
  /** Percentage change (null when base = 0, avoids division by zero) */
  percentage: number | null;
}

/**
 * 4-column comparative wrapper (Q7 decision)
 *
 * Wraps any data type with YoY + previous period comparisons.
 * Used across all 8 reports for consistent comparative layout.
 */
export interface ComparativeColumn<T> {
  /** Current period value */
  current: T;
  /** Previous sequential period (null if no data) */
  previousPeriod: T | null;
  /** Same period last year (null if no data) */
  yearOverYear: T | null;
  /** Change vs previous period */
  changeFromPrevious: ChangeMetric | null;
  /** Change vs YoY */
  changeFromYoY: ChangeMetric | null;
}

// ============================================================================
// REPORT RESULT WRAPPER
// ============================================================================

/** Generic wrapper for all report outputs */
export interface ReportResult<T> {
  reportType: ReportType;
  generatedAt: string;
  period: ResolvedPeriods;
  data: T;
}

// ============================================================================
// REPORT GENERATOR DEPS & SIGNATURE
// ============================================================================

/** Dependencies injected into report generators from factory */
export interface ReportGeneratorDeps {
  repository: IAccountingRepository;
  vatEngine?: IVATEngine;
  taxEngine?: ITaxEngine;
}

/** Common signature for all report generators */
export type ReportGenerator<T> = (
  deps: ReportGeneratorDeps,
  periods: ResolvedPeriods
) => Promise<ReportResult<T>>;

// ============================================================================
// SHARED SUB-TYPES
// ============================================================================

/** Category breakdown row (shared by P&L, Trial Balance, Expense by Category) */
export interface CategoryBreakdown {
  category: AccountCategory;
  label: string;
  netAmount: number;
  entryCount: number;
}

// ============================================================================
// 1. PROFIT & LOSS (ΕΛΠ Β.6 — Κατάσταση Αποτελεσμάτων)
// ============================================================================

export interface ProfitAndLossData {
  income: ComparativeColumn<CategoryBreakdown[]>;
  totalIncome: ComparativeColumn<number>;
  expenses: ComparativeColumn<CategoryBreakdown[]>;
  totalExpenses: ComparativeColumn<number>;
  grossProfit: ComparativeColumn<number>;
  efkaContributions: ComparativeColumn<number>;
  netProfitBeforeTax: ComparativeColumn<number>;
  estimatedTax: ComparativeColumn<number>;
  netProfitAfterTax: ComparativeColumn<number>;
}

// ============================================================================
// 2. TRIAL BALANCE (Ισοζύγιο)
// ============================================================================

export interface TrialBalanceRow {
  category: AccountCategory;
  label: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceData {
  rows: ComparativeColumn<TrialBalanceRow[]>;
  totalDebits: ComparativeColumn<number>;
  totalCredits: ComparativeColumn<number>;
  netBalance: ComparativeColumn<number>;
}

// ============================================================================
// 3. AR AGING (Ηλικίωση Απαιτήσεων)
// ============================================================================

export interface ARAgingCustomerRow {
  customerId: string;
  customerName: string;
  aging: AgingBuckets;
  totalOutstanding: number;
  invoiceCount: number;
}

export interface ARAgingData {
  customers: ComparativeColumn<ARAgingCustomerRow[]>;
  totals: ComparativeColumn<AgingBuckets>;
  totalOutstanding: ComparativeColumn<number>;
}

// ============================================================================
// 4. TAX SUMMARY (Σύνοψη Φόρων)
// ============================================================================

export interface VATSummaryRow {
  outputVat: number;
  deductibleInputVat: number;
  vatPayable: number;
}

export interface TaxSummaryData {
  income: ComparativeColumn<number>;
  deductibleExpenses: ComparativeColumn<number>;
  efkaContributions: ComparativeColumn<number>;
  taxableIncome: ComparativeColumn<number>;
  estimatedIncomeTax: ComparativeColumn<number>;
  vatSummary: ComparativeColumn<VATSummaryRow>;
  /** Current period only (no comparative for installments) */
  installments: TaxInstallment[];
}

// ============================================================================
// 5. BANK RECONCILIATION STATEMENT
// ============================================================================

export interface BankReconciliationItem {
  transactionId: string;
  date: string;
  description: string;
  amount: number;
  direction: TransactionDirection;
}

export interface BankReconciliationData {
  totalTransactions: ComparativeColumn<number>;
  matchedCount: ComparativeColumn<number>;
  unmatchedCount: ComparativeColumn<number>;
  excludedCount: ComparativeColumn<number>;
  matchRate: ComparativeColumn<number>;
  totalCredits: ComparativeColumn<number>;
  totalDebits: ComparativeColumn<number>;
  /** Current period unmatched items (detail, no comparative) */
  unmatchedItems: BankReconciliationItem[];
}

// ============================================================================
// 6. CASH FLOW STATEMENT (Ταμειακές Ροές)
// ============================================================================

export interface CashFlowItem {
  label: string;
  amount: number;
}

export interface CashFlowSection {
  inflows: number;
  outflows: number;
  net: number;
  items: CashFlowItem[];
}

export interface CashFlowData {
  operating: ComparativeColumn<CashFlowSection>;
  investing: ComparativeColumn<CashFlowSection>;
  financing: ComparativeColumn<CashFlowSection>;
  netCashFlow: ComparativeColumn<number>;
}

// ============================================================================
// 7. INCOME BY CUSTOMER (Έσοδα ανά Πελάτη)
// ============================================================================

export interface CustomerIncomeRow {
  customerId: string | null;
  customerName: string;
  totalNetAmount: number;
  invoiceCount: number;
  /** Percentage of total income */
  percentage: number;
}

export interface IncomeByCustomerData {
  customers: ComparativeColumn<CustomerIncomeRow[]>;
  totalIncome: ComparativeColumn<number>;
}

// ============================================================================
// 8. EXPENSE BY CATEGORY (Έξοδα ανά Κατηγορία)
// ============================================================================

export interface ExpenseCategoryRow {
  category: AccountCategory;
  label: string;
  totalNetAmount: number;
  entryCount: number;
  /** Percentage of total expenses */
  percentage: number;
  /** Is the expense VAT-deductible? */
  isDeductible: boolean;
}

export interface ExpenseByCategoryData {
  categories: ComparativeColumn<ExpenseCategoryRow[]>;
  totalExpenses: ComparativeColumn<number>;
}

// ============================================================================
// UNION TYPE — All report data types
// ============================================================================

export type ReportDataMap = {
  profit_and_loss: ProfitAndLossData;
  trial_balance: TrialBalanceData;
  ar_aging: ARAgingData;
  tax_summary: TaxSummaryData;
  bank_reconciliation: BankReconciliationData;
  cash_flow: CashFlowData;
  income_by_customer: IncomeByCustomerData;
  expense_by_category: ExpenseByCategoryData;
};
