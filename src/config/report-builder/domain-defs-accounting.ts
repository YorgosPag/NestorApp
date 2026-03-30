/**
 * @module config/report-builder/domain-defs-accounting
 * @enterprise ADR-268 Phase 6e — Accounting Domain Definitions
 *
 * F1: Invoices (Τιμολόγια) — 14 computed fields (G1-G6, G19-G22, G31-G32, G37-G38)
 * F2: Journal Entries (Ημερολογιακές Εγγραφές) — 6 computed fields (G7-G9, G23-G24, G33)
 *
 * Accounting Gap Analysis (2026-03-30) — research across:
 * QuickBooks Enterprise, Xero, FreshBooks, Sage, myDATA ΑΑΔΕ
 *
 * Enterprise computed fields — Invoices:
 * - G1:  Days Past Due (QuickBooks, Xero AR Aging)
 * - G2:  Is Overdue boolean (all platforms)
 * - G3:  Payment Progress % (QuickBooks, Xero)
 * - G4:  Aging Bucket categorization (QuickBooks AR Aging Detail)
 * - G5:  Days To Payment / DSO per invoice (Xero, Sage)
 * - G6:  Outstanding Amount (all platforms)
 * - G19: myDATA Status (ΑΑΔΕ compliance)
 * - G20: Days Since Issued (all platforms)
 * - G21: Is Cancelled (QuickBooks, Sage)
 * - G22: Is Credit Note (all platforms)
 * - G31: Payment Count (QuickBooks, Xero)
 * - G32: Days Since Last Payment (QuickBooks, Xero)
 * - G37: Email Sent Count (QuickBooks, FreshBooks)
 * - G38: Was Emailed (all platforms)
 *
 * Enterprise computed fields — Journal Entries:
 * - G7:  Entry Age in days (Sage, QuickBooks)
 * - G8:  Has Invoice Link (Sage)
 * - G9:  Is Reversed (Sage, QuickBooks)
 * - G23: Fiscal Quarter label (Sage, ΑΑ��Ε)
 * - G24: VAT Amount computed (all platforms)
 * - G33: Has Contact link (QuickBooks, Xero)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT — match Firestore data & accounting types)
// ============================================================================

const INVOICE_TYPES = [
  'service_invoice', 'sales_invoice', 'retail_receipt', 'service_receipt',
  'credit_invoice', 'service_invoice_eu', 'service_invoice_3rd',
] as const;

const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const;

const PAYMENT_METHODS = [
  'cash', 'bank_transfer', 'card', 'check', 'credit', 'mixed',
] as const;

const MYDATA_STATUSES = [
  'draft', 'sent', 'accepted', 'rejected', 'cancelled',
] as const;

const INVOICE_AGING_BUCKETS = [
  'current', 'days30', 'days60', 'days90', 'over90',
] as const;

const ENTRY_TYPES = ['income', 'expense'] as const;

const JOURNAL_STATUSES = ['ACTIVE', 'REVERSED'] as const;

const FISCAL_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

// ============================================================================
// Computed Field Helpers — Invoices
// ============================================================================

/** G1: Days past due (positive = overdue, negative = not yet due) */
function computeDaysPastDue(doc: Record<string, unknown>): number | null {
  const paymentStatus = doc['paymentStatus'] as string | undefined;
  if (paymentStatus === 'paid') return 0;
  const dueDate = doc['dueDate'] as string | undefined;
  if (!dueDate) return null;
  const ms = Date.now() - new Date(dueDate).getTime();
  return Math.round(ms / 86_400_000);
}

/** G2: Is invoice overdue (unpaid/partial AND past due date) */
function computeInvoiceIsOverdue(doc: Record<string, unknown>): boolean {
  const paymentStatus = doc['paymentStatus'] as string | undefined;
  if (paymentStatus === 'paid') return false;
  const dueDate = doc['dueDate'] as string | undefined;
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

/** G3: Payment progress percentage (totalPaid / totalGrossAmount × 100) */
function computePaymentProgress(doc: Record<string, unknown>): number | null {
  const gross = doc['totalGrossAmount'] as number | undefined;
  const paid = doc['totalPaid'] as number | undefined;
  if (gross === undefined || gross === 0) return null;
  return Math.round(((paid ?? 0) / gross) * 100);
}

/** G4: Aging bucket (current / 1-30 / 31-60 / 61-90 / 90+) */
function computeInvoiceAgingBucket(doc: Record<string, unknown>): string {
  const paymentStatus = doc['paymentStatus'] as string | undefined;
  if (paymentStatus === 'paid') return 'current';
  const dueDate = doc['dueDate'] as string | undefined;
  if (!dueDate) return 'current';
  const days = Math.round(
    (Date.now() - new Date(dueDate).getTime()) / 86_400_000,
  );
  if (days <= 0) return 'current';
  if (days <= 30) return 'days30';
  if (days <= 60) return 'days60';
  if (days <= 90) return 'days90';
  return 'over90';
}

/** G5: Days to payment (from issue to full payment, or days since issue if unpaid) */
function computeDaysToPayment(doc: Record<string, unknown>): number | null {
  const issued = doc['issueDate'] as string | undefined;
  if (!issued) return null;
  const paymentStatus = doc['paymentStatus'] as string | undefined;
  if (paymentStatus === 'paid') {
    const payments = doc['payments'] as Array<Record<string, unknown>> | undefined;
    if (payments && payments.length > 0) {
      const lastPayment = payments[payments.length - 1];
      const paidDate = lastPayment['date'] as string | undefined;
      if (paidDate) {
        const ms = new Date(paidDate).getTime() - new Date(issued).getTime();
        return Math.max(0, Math.round(ms / 86_400_000));
      }
    }
  }
  const ms = Date.now() - new Date(issued).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G6: Outstanding amount (totalGrossAmount - totalPaid) */
function computeOutstandingAmount(doc: Record<string, unknown>): number | null {
  const gross = doc['totalGrossAmount'] as number | undefined;
  const paid = doc['totalPaid'] as number | undefined;
  if (gross === undefined) return null;
  return Math.max(0, gross - (paid ?? 0));
}

/** G19: myDATA submission status (extracted from nested mydata object) */
function computeMydataStatus(doc: Record<string, unknown>): string | null {
  const mydata = doc['mydata'] as Record<string, unknown> | undefined;
  if (!mydata) return 'draft';
  return (mydata['status'] as string | undefined) ?? 'draft';
}

/** G20: Days since invoice was issued */
function computeDaysSinceIssued(doc: Record<string, unknown>): number | null {
  const issued = doc['issueDate'] as string | undefined;
  if (!issued) return null;
  const ms = Date.now() - new Date(issued).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G21: Is invoice cancelled */
function computeIsCancelled(doc: Record<string, unknown>): boolean {
  const reason = doc['cancellationReason'] as string | undefined;
  return reason !== undefined && reason !== null;
}

/** G22: Is credit note (type = credit_invoice) */
function computeIsCreditNote(doc: Record<string, unknown>): boolean {
  const invoiceType = doc['type'] as string | undefined;
  return invoiceType === 'credit_invoice';
}

/** G31: Number of payments received */
function computePaymentCount(doc: Record<string, unknown>): number {
  const payments = doc['payments'] as Array<unknown> | undefined;
  return payments?.length ?? 0;
}

/** G32: Days since last payment */
function computeDaysSinceLastPayment(doc: Record<string, unknown>): number | null {
  const payments = doc['payments'] as Array<Record<string, unknown>> | undefined;
  if (!payments || payments.length === 0) return null;
  const lastPayment = payments[payments.length - 1];
  const paidDate = lastPayment['date'] as string | undefined;
  if (!paidDate) return null;
  const ms = Date.now() - new Date(paidDate).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G37: Number of emails sent for this invoice */
function computeEmailSentCount(doc: Record<string, unknown>): number {
  const history = doc['emailHistory'] as Array<unknown> | undefined;
  return history?.length ?? 0;
}

/** G38: Was invoice emailed at least once */
function computeWasEmailed(doc: Record<string, unknown>): boolean {
  const history = doc['emailHistory'] as Array<unknown> | undefined;
  return (history?.length ?? 0) > 0;
}

// ============================================================================
// Computed Field Helpers — Journal Entries
// ============================================================================

/** G7: Entry age in days since creation */
function computeEntryAge(doc: Record<string, unknown>): number | null {
  const created = doc['createdAt'] as string | undefined;
  if (!created) return null;
  const ms = Date.now() - new Date(created).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G8: Has linked invoice */
function computeHasInvoiceLink(doc: Record<string, unknown>): boolean {
  const invoiceId = doc['invoiceId'] as string | undefined;
  return invoiceId !== undefined && invoiceId !== null && invoiceId !== '';
}

/** G9: Is entry reversed */
function computeIsReversed(doc: Record<string, unknown>): boolean {
  const status = doc['status'] as string | undefined;
  return status === 'REVERSED';
}

/** G23: Fiscal quarter label (Q1/Q2/Q3/Q4) */
function computeFiscalQuarter(doc: Record<string, unknown>): string | null {
  const quarter = doc['quarter'] as number | undefined;
  if (quarter === undefined || quarter < 1 || quarter > 4) return null;
  return `Q${quarter}`;
}

/** G24: VAT amount (from grossAmount - netAmount if not stored) */
function computeJournalVatAmount(doc: Record<string, unknown>): number | null {
  const vatAmount = doc['vatAmount'] as number | undefined;
  if (vatAmount !== undefined) return vatAmount;
  const gross = doc['grossAmount'] as number | undefined;
  const net = doc['netAmount'] as number | undefined;
  if (gross === undefined || net === undefined) return null;
  return Math.round((gross - net) * 100) / 100;
}

/** G33: Has linked contact */
function computeHasContact(doc: Record<string, unknown>): boolean {
  const contactId = doc['contactId'] as string | undefined;
  return contactId !== undefined && contactId !== null && contactId !== '';
}

// ============================================================================
// F1: Invoices (Τιμολόγια)
// ============================================================================

export const INVOICES_DEFINITION: DomainDefinition = {
  id: 'invoices',
  collection: COLLECTIONS.ACCOUNTING_INVOICES,
  group: 'accounting',
  labelKey: 'domains.invoices.label',
  descriptionKey: 'domains.invoices.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/accounting/invoices/{id}',
  defaultSortField: 'issueDate',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'series', labelKey: 'domains.invoices.fields.series', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'number', labelKey: 'domains.invoices.fields.number', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'type', labelKey: 'domains.invoices.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: INVOICE_TYPES, enumLabelPrefix: 'domains.invoices.enums.type' },
    // Customer
    { key: 'customer.name', labelKey: 'domains.invoices.fields.customerName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'customer.vatNumber', labelKey: 'domains.invoices.fields.customerVat', type: 'text', filterable: true, sortable: false, defaultVisible: false },
    // Amounts
    { key: 'totalNetAmount', labelKey: 'domains.invoices.fields.totalNetAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'totalVatAmount', labelKey: 'domains.invoices.fields.totalVatAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'totalGrossAmount', labelKey: 'domains.invoices.fields.totalGrossAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'totalPaid', labelKey: 'domains.invoices.fields.totalPaid', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'balanceDue', labelKey: 'domains.invoices.fields.balanceDue', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    // Payment
    { key: 'paymentMethod', labelKey: 'domains.invoices.fields.paymentMethod', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: PAYMENT_METHODS, enumLabelPrefix: 'domains.invoices.enums.paymentMethod' },
    { key: 'paymentStatus', labelKey: 'domains.invoices.fields.paymentStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: PAYMENT_STATUSES, enumLabelPrefix: 'domains.invoices.enums.paymentStatus' },
    // Dates
    { key: 'issueDate', labelKey: 'domains.invoices.fields.issueDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'dueDate', labelKey: 'domains.invoices.fields.dueDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    // References
    { key: 'projectId', labelKey: 'domains.invoices.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'projects', refDisplayField: 'name' },
    // Metadata
    { key: 'fiscalYear', labelKey: 'domains.invoices.fields.fiscalYear', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'notes', labelKey: 'domains.invoices.fields.notes', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    { key: 'createdAt', labelKey: 'domains.invoices.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // --- Computed: G1 — Days Past Due (QuickBooks, Xero AR Aging) ---
    {
      key: 'daysPastDue',
      labelKey: 'domains.invoices.fields.daysPastDue',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
      computed: true,
      computeFn: computeDaysPastDue,
    },
    // --- Computed: G2 — Is Overdue (all platforms) ---
    {
      key: 'isOverdue',
      labelKey: 'domains.invoices.fields.isOverdue',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      computed: true,
      computeFn: computeInvoiceIsOverdue,
    },
    // --- Computed: G3 — Payment Progress % (QuickBooks, Xero) ---
    {
      key: 'paymentProgress',
      labelKey: 'domains.invoices.fields.paymentProgress',
      type: 'percentage',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'percentage',
      computed: true,
      computeFn: computePaymentProgress,
    },
    // --- Computed: G4 — Aging Bucket (QuickBooks AR Aging Detail) ---
    {
      key: 'agingBucket',
      labelKey: 'domains.invoices.fields.agingBucket',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      enumValues: INVOICE_AGING_BUCKETS,
      enumLabelPrefix: 'domains.invoices.enums.agingBucket',
      computed: true,
      computeFn: computeInvoiceAgingBucket,
    },
    // --- Computed: G5 — Days To Payment / DSO (Xero, Sage) ---
    {
      key: 'daysToPayment',
      labelKey: 'domains.invoices.fields.daysToPayment',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeDaysToPayment,
    },
    // --- Computed: G6 — Outstanding Amount (all platforms) ---
    {
      key: 'outstandingAmount',
      labelKey: 'domains.invoices.fields.outstandingAmount',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'currency',
      computed: true,
      computeFn: computeOutstandingAmount,
    },
    // --- Computed: G19 — myDATA Status (ΑΑΔΕ compliance) ---
    {
      key: 'mydataStatus',
      labelKey: 'domains.invoices.fields.mydataStatus',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      enumValues: MYDATA_STATUSES,
      enumLabelPrefix: 'domains.invoices.enums.mydataStatus',
      computed: true,
      computeFn: computeMydataStatus,
    },
    // --- Computed: G20 — Days Since Issued (all platforms) ---
    {
      key: 'daysSinceIssued',
      labelKey: 'domains.invoices.fields.daysSinceIssued',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeDaysSinceIssued,
    },
    // --- Computed: G21 — Is Cancelled (QuickBooks, Sage) ---
    {
      key: 'isCancelled',
      labelKey: 'domains.invoices.fields.isCancelled',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeIsCancelled,
    },
    // --- Computed: G22 — Is Credit Note (all platforms) ---
    {
      key: 'isCreditNote',
      labelKey: 'domains.invoices.fields.isCreditNote',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeIsCreditNote,
    },
    // --- Computed: G31 — Payment Count (QuickBooks, Xero) ---
    {
      key: 'paymentCount',
      labelKey: 'domains.invoices.fields.paymentCount',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computePaymentCount,
    },
    // --- Computed: G32 — Days Since Last Payment (QuickBooks, Xero) ---
    {
      key: 'daysSinceLastPayment',
      labelKey: 'domains.invoices.fields.daysSinceLastPayment',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeDaysSinceLastPayment,
    },
    // --- Computed: G37 — Email Sent Count (QuickBooks, FreshBooks) ---
    {
      key: 'emailSentCount',
      labelKey: 'domains.invoices.fields.emailSentCount',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeEmailSentCount,
    },
    // --- Computed: G38 — Was Emailed (all platforms) ---
    {
      key: 'wasEmailed',
      labelKey: 'domains.invoices.fields.wasEmailed',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeWasEmailed,
    },
  ],
};

// ============================================================================
// F2: Journal Entries (Ημερολογιακές Εγγραφές)
// ============================================================================

export const JOURNAL_ENTRIES_DEFINITION: DomainDefinition = {
  id: 'journalEntries',
  collection: COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES,
  group: 'accounting',
  labelKey: 'domains.journalEntries.label',
  descriptionKey: 'domains.journalEntries.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/accounting/journal/{id}',
  defaultSortField: 'date',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'date', labelKey: 'domains.journalEntries.fields.date', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'type', labelKey: 'domains.journalEntries.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: ENTRY_TYPES, enumLabelPrefix: 'domains.journalEntries.enums.type' },
    { key: 'category', labelKey: 'domains.journalEntries.fields.category', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'description', labelKey: 'domains.journalEntries.fields.description', type: 'text', filterable: true, sortable: false, defaultVisible: true },
    // Amounts
    { key: 'netAmount', labelKey: 'domains.journalEntries.fields.netAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'vatRate', labelKey: 'domains.journalEntries.fields.vatRate', type: 'percentage', filterable: true, sortable: true, defaultVisible: false, format: 'percentage' },
    { key: 'grossAmount', labelKey: 'domains.journalEntries.fields.grossAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'vatDeductible', labelKey: 'domains.journalEntries.fields.vatDeductible', type: 'boolean', filterable: true, sortable: true, defaultVisible: false },
    // Payment
    { key: 'paymentMethod', labelKey: 'domains.journalEntries.fields.paymentMethod', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: PAYMENT_METHODS, enumLabelPrefix: 'domains.journalEntries.enums.paymentMethod' },
    // Contact
    { key: 'contactId', labelKey: 'domains.journalEntries.fields.contact', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'individuals', refDisplayField: 'displayName' },
    { key: 'contactName', labelKey: 'domains.journalEntries.fields.contactName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    // Status
    { key: 'status', labelKey: 'domains.journalEntries.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: JOURNAL_STATUSES, enumLabelPrefix: 'domains.journalEntries.enums.status' },
    // Fiscal
    { key: 'fiscalYear', labelKey: 'domains.journalEntries.fields.fiscalYear', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'quarter', labelKey: 'domains.journalEntries.fields.quarter', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Metadata
    { key: 'notes', labelKey: 'domains.journalEntries.fields.notes', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    { key: 'createdAt', labelKey: 'domains.journalEntries.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // --- Computed: G7 — Entry Age (Sage, QuickBooks) ---
    {
      key: 'entryAge',
      labelKey: 'domains.journalEntries.fields.entryAge',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeEntryAge,
    },
    // --- Computed: G8 — Has Invoice Link (Sage) ---
    {
      key: 'hasInvoiceLink',
      labelKey: 'domains.journalEntries.fields.hasInvoiceLink',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeHasInvoiceLink,
    },
    // --- Computed: G9 — Is Reversed (Sage, QuickBooks) ---
    {
      key: 'isReversed',
      labelKey: 'domains.journalEntries.fields.isReversed',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeIsReversed,
    },
    // --- Computed: G23 — Fiscal Quarter (Sage, ΑΑΔΕ) ---
    {
      key: 'fiscalQuarter',
      labelKey: 'domains.journalEntries.fields.fiscalQuarter',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      enumValues: FISCAL_QUARTERS,
      enumLabelPrefix: 'domains.journalEntries.enums.fiscalQuarter',
      computed: true,
      computeFn: computeFiscalQuarter,
    },
    // --- Computed: G24 — VAT Amount (all platforms) ---
    {
      key: 'computedVatAmount',
      labelKey: 'domains.journalEntries.fields.computedVatAmount',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'currency',
      computed: true,
      computeFn: computeJournalVatAmount,
    },
    // --- Computed: G33 — Has Contact (QuickBooks, Xero) ---
    {
      key: 'hasContact',
      labelKey: 'domains.journalEntries.fields.hasContact',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeHasContact,
    },
  ],
};
