/**
 * @module config/report-builder/domain-defs-accounting-ext
 * @enterprise ADR-268 Phase 6f — Accounting Extended Domain Definitions
 *
 * F4: Bank Transactions (Τραπεζικές Κινήσεις) — 5 computed fields (G10-G12, G25-G26)
 * F5: Expense Documents (Έξοδα) — 7 computed fields (G13-G15, G27-G28, G35-G36)
 * F6: EFKA Payments (Ασφαλιστικά) — 5 computed fields (G16-G18, G29-G30)
 *
 * Accounting Gap Analysis (2026-03-30) — research across:
 * QuickBooks Enterprise, Xero, FreshBooks, Sage, myDATA ΑΑΔΕ
 *
 * Enterprise computed fields — Bank Transactions:
 * - G10: Is Reconciled (Xero, QuickBooks bank reconciliation)
 * - G11: Days Since Transaction (all platforms)
 * - G12: Unmatched Age — days waiting for reconciliation (Xero)
 * - G25: Is Inflow — credit vs debit direction (all platforms)
 * - G26: Absolute Amount for sorting (all platforms)
 *
 * Enterprise computed fields — Expense Documents:
 * - G13: Has Document attached (FreshBooks, QuickBooks)
 * - G14: VAT Amount from confirmed data (all platforms)
 * - G15: Is Deductible expense (ΑΑΔΕ, Sage)
 * - G27: Document Age in days (FreshBooks)
 * - G28: Needs Review flag (Xero, FreshBooks AI)
 * - G35: AI Confidence score (Xero, FreshBooks AI)
 * - G36: Has Journal Entry link (Sage, QuickBooks)
 *
 * Enterprise computed fields — EFKA Payments:
 * - G16: Is Overdue payment (ΕΦΚΑ/ΚΕΑΟ pattern)
 * - G17: Days Overdue or Until Due (ΕΦΚΑ pattern)
 * - G18: KEAO Risk level (ΕΦΚΑ/ΚΕΑΟ pattern)
 * - G29: Month Label (human-readable) (all platforms)
 * - G30: Contribution Total (ΕΦΚΑ pattern)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT — match Firestore data & accounting types)
// ============================================================================

const TRANSACTION_DIRECTIONS = ['credit', 'debit'] as const;

const MATCH_STATUSES = [
  'unmatched', 'auto_matched', 'manual_matched', 'excluded',
] as const;

const DOCUMENT_TYPES = [
  'purchase_invoice', 'receipt', 'utility_bill', 'telecom_bill',
  'fuel_receipt', 'bank_statement', 'other',
] as const;

const PROCESSING_STATUSES = [
  'processing', 'review', 'confirmed', 'rejected',
] as const;

const EFKA_PAYMENT_STATUSES = [
  'upcoming', 'due', 'paid', 'overdue', 'keao',
] as const;

const KEAO_RISK_LEVELS = ['low', 'medium', 'high'] as const;

const MONTH_LABELS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;

// ============================================================================
// Computed Field Helpers — Bank Transactions
// ============================================================================

/** G10: Is transaction reconciled (matched or excluded) */
function computeIsReconciled(doc: Record<string, unknown>): string {
  const status = doc['matchStatus'] as string | undefined;
  if (status === 'auto_matched' || status === 'manual_matched') return 'matched';
  if (status === 'excluded') return 'excluded';
  return 'unmatched';
}

const RECONCILED_VALUES = ['matched', 'unmatched', 'excluded'] as const;

/** G11: Days since transaction date */
function computeDaysSinceTransaction(doc: Record<string, unknown>): number | null {
  const txDate = doc['transactionDate'] as string | undefined
    ?? doc['valueDate'] as string | undefined;
  if (!txDate) return null;
  const ms = Date.now() - new Date(txDate).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G12: Days unmatched (0 if already matched) */
function computeUnmatchedAge(doc: Record<string, unknown>): number | null {
  const status = doc['matchStatus'] as string | undefined;
  if (status === 'auto_matched' || status === 'manual_matched' || status === 'excluded') {
    return 0;
  }
  const txDate = doc['transactionDate'] as string | undefined
    ?? doc['valueDate'] as string | undefined;
  if (!txDate) return null;
  const ms = Date.now() - new Date(txDate).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G25: Is inflow (credit = money in) */
function computeIsInflow(doc: Record<string, unknown>): boolean {
  const direction = doc['direction'] as string | undefined;
  return direction === 'credit';
}

/** G26: Absolute amount (always positive for sorting) */
function computeAbsoluteAmount(doc: Record<string, unknown>): number | null {
  const amount = doc['amount'] as number | undefined;
  if (amount === undefined) return null;
  return Math.abs(amount);
}

// ============================================================================
// Computed Field Helpers — Expense Documents
// ============================================================================

/** G13: Has attached document file */
function computeHasDocument(doc: Record<string, unknown>): boolean {
  const fileUrl = doc['fileUrl'] as string | undefined;
  return fileUrl !== undefined && fileUrl !== null && fileUrl !== '';
}

/** G14: VAT amount (from confirmed or extracted data) */
function computeExpenseVatAmount(doc: Record<string, unknown>): number | null {
  const confirmed = doc['confirmedVatAmount'] as number | undefined;
  if (confirmed !== undefined && confirmed !== null) return confirmed;
  const extracted = doc['extractedData'] as Record<string, unknown> | undefined;
  if (!extracted) return null;
  return (extracted['vatAmount'] as number | undefined) ?? null;
}

/** G15: Is expense deductible (based on confirmed category) */
function computeIsDeductible(doc: Record<string, unknown>): boolean | null {
  const category = doc['confirmedCategory'] as string | undefined;
  if (!category) return null;
  const nonDeductible = new Set([
    'professional_tax', 'bank_fees',
  ]);
  return !nonDeductible.has(category);
}

/** G27: Document age in days since upload */
function computeDocumentAge(doc: Record<string, unknown>): number | null {
  const created = doc['createdAt'] as string | undefined;
  if (!created) return null;
  const ms = Date.now() - new Date(created).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G28: Needs user review (status = 'review') */
function computeNeedsReview(doc: Record<string, unknown>): boolean {
  const status = doc['status'] as string | undefined;
  return status === 'review';
}

/** G35: AI confidence score (from extracted data) */
function computeAiConfidence(doc: Record<string, unknown>): number | null {
  const extracted = doc['extractedData'] as Record<string, unknown> | undefined;
  if (!extracted) return null;
  return (extracted['overallConfidence'] as number | undefined) ?? null;
}

/** G36: Has linked journal entry */
function computeHasJournalEntry(doc: Record<string, unknown>): boolean {
  const entryId = doc['journalEntryId'] as string | undefined;
  return entryId !== undefined && entryId !== null && entryId !== '';
}

// ============================================================================
// Computed Field Helpers — EFKA Payments
// ============================================================================

/** G16: Is EFKA payment overdue */
function computeEfkaIsOverdue(doc: Record<string, unknown>): boolean {
  const status = doc['status'] as string | undefined;
  return status === 'overdue' || status === 'keao';
}

/** G17: Days overdue (positive) or days until due (negative) */
function computeDaysOverdueOrUntilDue(doc: Record<string, unknown>): number | null {
  const status = doc['status'] as string | undefined;
  if (status === 'paid') return 0;
  const dueDate = doc['dueDate'] as string | undefined;
  if (!dueDate) return null;
  const ms = Date.now() - new Date(dueDate).getTime();
  return Math.round(ms / 86_400_000);
}

/** G18: KEAO risk level based on overdue days */
function computeKeaoRisk(doc: Record<string, unknown>): string {
  const status = doc['status'] as string | undefined;
  if (status === 'paid' || status === 'upcoming') return 'low';
  if (status === 'keao') return 'high';
  const dueDate = doc['dueDate'] as string | undefined;
  if (!dueDate) return 'low';
  const days = Math.round(
    (Date.now() - new Date(dueDate).getTime()) / 86_400_000,
  );
  if (days <= 0) return 'low';
  if (days <= 60) return 'medium';
  return 'high';
}

/** G29: Month label (e.g., "jan", "feb") */
function computeMonthLabel(doc: Record<string, unknown>): string | null {
  const month = doc['month'] as number | undefined;
  if (month === undefined || month < 1 || month > 12) return null;
  const labels = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return labels[month - 1];
}

/** G30: Total contribution amount (sum of all branches if available) */
function computeContributionTotal(doc: Record<string, unknown>): number | null {
  const amount = doc['amount'] as number | undefined;
  return amount ?? null;
}

// ============================================================================
// F4: Bank Transactions (Τραπεζικές Κινήσεις)
// ============================================================================

export const BANK_TRANSACTIONS_DEFINITION: DomainDefinition = {
  id: 'bankTransactions',
  collection: COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS,
  group: 'accounting',
  labelKey: 'domains.bankTransactions.label',
  descriptionKey: 'domains.bankTransactions.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/accounting/bank/{id}',
  defaultSortField: 'transactionDate',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'transactionDate', labelKey: 'domains.bankTransactions.fields.transactionDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'valueDate', labelKey: 'domains.bankTransactions.fields.valueDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'direction', labelKey: 'domains.bankTransactions.fields.direction', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: TRANSACTION_DIRECTIONS, enumLabelPrefix: 'domains.bankTransactions.enums.direction' },
    // Amounts
    { key: 'amount', labelKey: 'domains.bankTransactions.fields.amount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'balanceAfter', labelKey: 'domains.bankTransactions.fields.balanceAfter', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    // Description
    { key: 'bankDescription', labelKey: 'domains.bankTransactions.fields.bankDescription', type: 'text', filterable: true, sortable: false, defaultVisible: true },
    { key: 'counterparty', labelKey: 'domains.bankTransactions.fields.counterparty', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'paymentReference', labelKey: 'domains.bankTransactions.fields.paymentReference', type: 'text', filterable: true, sortable: false, defaultVisible: false },
    // Matching
    { key: 'matchStatus', labelKey: 'domains.bankTransactions.fields.matchStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: MATCH_STATUSES, enumLabelPrefix: 'domains.bankTransactions.enums.matchStatus' },
    // Metadata
    { key: 'notes', labelKey: 'domains.bankTransactions.fields.notes', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    { key: 'createdAt', labelKey: 'domains.bankTransactions.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // --- Computed: G10 — Is Reconciled (Xero, QuickBooks) ---
    {
      key: 'isReconciled',
      labelKey: 'domains.bankTransactions.fields.isReconciled',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      enumValues: RECONCILED_VALUES,
      enumLabelPrefix: 'domains.bankTransactions.enums.isReconciled',
      computed: true,
      computeFn: computeIsReconciled,
    },
    // --- Computed: G11 — Days Since Transaction (all platforms) ---
    {
      key: 'daysSinceTransaction',
      labelKey: 'domains.bankTransactions.fields.daysSinceTransaction',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeDaysSinceTransaction,
    },
    // --- Computed: G12 — Unmatched Age (Xero) ---
    {
      key: 'unmatchedAge',
      labelKey: 'domains.bankTransactions.fields.unmatchedAge',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeUnmatchedAge,
    },
    // --- Computed: G25 — Is Inflow (all platforms) ---
    {
      key: 'isInflow',
      labelKey: 'domains.bankTransactions.fields.isInflow',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeIsInflow,
    },
    // --- Computed: G26 — Absolute Amount (all platforms) ---
    {
      key: 'absoluteAmount',
      labelKey: 'domains.bankTransactions.fields.absoluteAmount',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'currency',
      computed: true,
      computeFn: computeAbsoluteAmount,
    },
  ],
};

// ============================================================================
// F5: Expense Documents (Έξοδα)
// ============================================================================

export const EXPENSE_DOCUMENTS_DEFINITION: DomainDefinition = {
  id: 'expenseDocuments',
  collection: COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS,
  group: 'accounting',
  labelKey: 'domains.expenseDocuments.label',
  descriptionKey: 'domains.expenseDocuments.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/accounting/expenses/{id}',
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'type', labelKey: 'domains.expenseDocuments.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: DOCUMENT_TYPES, enumLabelPrefix: 'domains.expenseDocuments.enums.type' },
    { key: 'status', labelKey: 'domains.expenseDocuments.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: PROCESSING_STATUSES, enumLabelPrefix: 'domains.expenseDocuments.enums.status' },
    { key: 'fileName', labelKey: 'domains.expenseDocuments.fields.fileName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    // Confirmed values
    { key: 'confirmedCategory', labelKey: 'domains.expenseDocuments.fields.confirmedCategory', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'confirmedNetAmount', labelKey: 'domains.expenseDocuments.fields.confirmedNetAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'confirmedVatAmount', labelKey: 'domains.expenseDocuments.fields.confirmedVatAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'confirmedDate', labelKey: 'domains.expenseDocuments.fields.confirmedDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'confirmedIssuerName', labelKey: 'domains.expenseDocuments.fields.confirmedIssuerName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    // Metadata
    { key: 'fiscalYear', labelKey: 'domains.expenseDocuments.fields.fiscalYear', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'notes', labelKey: 'domains.expenseDocuments.fields.notes', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    { key: 'createdAt', labelKey: 'domains.expenseDocuments.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // --- Computed: G13 — Has Document (FreshBooks, QuickBooks) ---
    {
      key: 'hasDocument',
      labelKey: 'domains.expenseDocuments.fields.hasDocument',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeHasDocument,
    },
    // --- Computed: G14 — VAT Amount (all platforms) ---
    {
      key: 'computedVatAmount',
      labelKey: 'domains.expenseDocuments.fields.computedVatAmount',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'currency',
      computed: true,
      computeFn: computeExpenseVatAmount,
    },
    // --- Computed: G15 — Is Deductible (ΑΑΔΕ, Sage) ---
    {
      key: 'isDeductible',
      labelKey: 'domains.expenseDocuments.fields.isDeductible',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeIsDeductible,
    },
    // --- Computed: G27 — Document Age (FreshBooks) ---
    {
      key: 'documentAge',
      labelKey: 'domains.expenseDocuments.fields.documentAge',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeDocumentAge,
    },
    // --- Computed: G28 — Needs Review (Xero, FreshBooks AI) ---
    {
      key: 'needsReview',
      labelKey: 'domains.expenseDocuments.fields.needsReview',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      computed: true,
      computeFn: computeNeedsReview,
    },
    // --- Computed: G35 — AI Confidence (Xero, FreshBooks AI) ---
    {
      key: 'aiConfidence',
      labelKey: 'domains.expenseDocuments.fields.aiConfidence',
      type: 'percentage',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'percentage',
      computed: true,
      computeFn: computeAiConfidence,
    },
    // --- Computed: G36 — Has Journal Entry (Sage, QuickBooks) ---
    {
      key: 'hasJournalEntry',
      labelKey: 'domains.expenseDocuments.fields.hasJournalEntry',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeHasJournalEntry,
    },
  ],
};

// ============================================================================
// F6: EFKA Payments (Ασφαλιστικές Εισφορές)
// ============================================================================

export const EFKA_PAYMENTS_DEFINITION: DomainDefinition = {
  id: 'efkaPayments',
  collection: COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS,
  group: 'accounting',
  labelKey: 'domains.efkaPayments.label',
  descriptionKey: 'domains.efkaPayments.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/accounting/efka/{id}',
  defaultSortField: 'dueDate',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'year', labelKey: 'domains.efkaPayments.fields.year', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'month', labelKey: 'domains.efkaPayments.fields.month', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    // Amount
    { key: 'amount', labelKey: 'domains.efkaPayments.fields.amount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    // Dates
    { key: 'dueDate', labelKey: 'domains.efkaPayments.fields.dueDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'paidDate', labelKey: 'domains.efkaPayments.fields.paidDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // Status
    { key: 'status', labelKey: 'domains.efkaPayments.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: EFKA_PAYMENT_STATUSES, enumLabelPrefix: 'domains.efkaPayments.enums.status' },
    // Metadata
    { key: 'notes', labelKey: 'domains.efkaPayments.fields.notes', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // --- Computed: G16 — Is Overdue (ΕΦΚΑ/ΚΕΑΟ) ---
    {
      key: 'isOverdue',
      labelKey: 'domains.efkaPayments.fields.isOverdue',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      computed: true,
      computeFn: computeEfkaIsOverdue,
    },
    // --- Computed: G17 ��� Days Overdue or Until Due (ΕΦΚΑ) ---
    {
      key: 'daysOverdueOrUntilDue',
      labelKey: 'domains.efkaPayments.fields.daysOverdueOrUntilDue',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
      computed: true,
      computeFn: computeDaysOverdueOrUntilDue,
    },
    // --- Computed: G18 — KEAO Risk (ΕΦΚΑ/ΚΕΑΟ) ---
    {
      key: 'keaoRisk',
      labelKey: 'domains.efkaPayments.fields.keaoRisk',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: KEAO_RISK_LEVELS,
      enumLabelPrefix: 'domains.efkaPayments.enums.keaoRisk',
      computed: true,
      computeFn: computeKeaoRisk,
    },
    // --- Computed: G29 — Month Label (human-readable) ---
    {
      key: 'monthLabel',
      labelKey: 'domains.efkaPayments.fields.monthLabel',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      enumValues: MONTH_LABELS,
      enumLabelPrefix: 'domains.efkaPayments.enums.monthLabel',
      computed: true,
      computeFn: computeMonthLabel,
    },
    // --- Computed: G30 — Contribution Total ---
    {
      key: 'contributionTotal',
      labelKey: 'domains.efkaPayments.fields.contributionTotal',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'currency',
      computed: true,
      computeFn: computeContributionTotal,
    },
  ],
};
