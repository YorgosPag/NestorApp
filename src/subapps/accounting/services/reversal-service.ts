/**
 * @fileoverview Accounting Reversal Service — Journal Reversal + Credit Note
 * @description Standalone functions for invoice cancellation workflows (Phase 1a — AUDIT A-1)
 *
 * Two workflows based on Greek law:
 * - Draft invoices → void + journal reversal
 * - Issued invoices → credit note + journal reversal
 *
 * Pattern: Same as accounting-efka-operations.ts (standalone functions, repository as param)
 *
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-29
 * @see AUDIT-2026-03-29.md §A-1
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { IAccountingRepository } from '../types/interfaces';
import type { CreateJournalEntryInput } from '../types/journal';
import type { Invoice, CancellationReasonCode } from '../types/invoice';
import { isoNow, getQuarterFromDate, getFiscalYearFromDate } from './repository/firestore-helpers';

// ============================================================================
// TYPES
// ============================================================================

interface ReversalResult {
  originalEntryId: string;
  reversalEntryId: string;
}

interface CreditNoteResult {
  creditNoteId: string;
  creditNoteNumber: number;
  reversalEntryId: string | null;
}

// ============================================================================
// JOURNAL ENTRY REVERSAL
// ============================================================================

/**
 * Αντιλογιστική εγγραφή για ακυρωμένο τιμολόγιο
 *
 * 1. Βρίσκει τη journal entry που συνδέεται με το invoiceId
 * 2. Δημιουργεί νέα εγγραφή με αρνητικά ποσά (ίδιος type → netAmount σύνολο = 0)
 * 3. Ενημερώνει την αρχική ως REVERSED (immutable μετά)
 *
 * @returns null αν δεν βρεθεί journal entry (π.χ. draft χωρίς εγγραφή)
 * @throws Error αν η εγγραφή είναι ήδη REVERSED (prevent double reversal)
 */
export async function reverseJournalEntryForCancelledInvoice(
  repository: IAccountingRepository,
  invoiceId: string,
  userId: string,
  reasonCode: CancellationReasonCode,
  reasonNotes: string | null
): Promise<ReversalResult | null> {
  const original = await repository.getJournalEntryByInvoiceId(invoiceId);
  if (!original) return null;

  if (original.status === 'REVERSED') {
    throw new Error(`Journal entry ${original.entryId} is already reversed`);
  }

  const now = isoNow();

  // Reversal entry: ίδια πεδία, αντίθετα ποσά
  const reversalInput: CreateJournalEntryInput = {
    date: now.split('T')[0],
    type: original.type,
    category: original.category,
    description: `ΑΝΤΙΛΟΓΙΣΜΟΣ — ${original.description}`,
    netAmount: -original.netAmount,
    vatRate: original.vatRate,
    vatAmount: -original.vatAmount,
    grossAmount: -original.grossAmount,
    vatDeductible: original.vatDeductible,
    paymentMethod: original.paymentMethod,
    contactId: original.contactId,
    contactName: original.contactName,
    invoiceId: original.invoiceId,
    mydataCode: original.mydataCode,
    e3Code: original.e3Code,
    fiscalYear: getFiscalYearFromDate(now),
    quarter: getQuarterFromDate(now),
    notes: buildReversalNotes(reasonCode, reasonNotes),
    isReversal: true,
    originalEntryId: original.entryId,
    cancellationReasonCode: reasonCode,
    cancellationNotes: reasonNotes ?? undefined,
  };

  const { id: reversalEntryId } = await repository.createJournalEntry(reversalInput);

  // Ενημέρωση original → REVERSED (immutable μετά)
  await repository.updateJournalEntry(original.entryId, {
    status: 'REVERSED',
    reversalEntryId,
    reversedAt: now,
    reversedBy: userId,
  });

  return { originalEntryId: original.entryId, reversalEntryId };
}

// ============================================================================
// CREDIT NOTE CREATION
// ============================================================================

/**
 * Δημιουργία πιστωτικού τιμολογίου + αντιλογιστική εγγραφή
 *
 * Για εκδοθέντα τιμολόγια (sent/accepted) — ελληνικός νόμος απαγορεύει void.
 * Δημιουργεί:
 * 1. Νέο invoice type=credit_invoice, relatedInvoiceId→original
 * 2. Journal reversal linked to original invoice
 * 3. Bidirectional link original→creditNoteInvoiceId
 */
export async function createCreditNoteForInvoice(
  repository: IAccountingRepository,
  originalInvoice: Invoice,
  userId: string,
  reasonCode: CancellationReasonCode,
  reasonNotes: string | null
): Promise<CreditNoteResult> {
  const creditNoteNumber = await repository.getNextInvoiceNumber('CREDIT');

  const { id: creditNoteId } = await repository.createInvoice({
    series: 'CREDIT',
    type: 'credit_invoice',
    issueDate: isoNow().split('T')[0],
    dueDate: null,
    issuer: originalInvoice.issuer,
    customer: originalInvoice.customer,
    lineItems: originalInvoice.lineItems,
    currency: originalInvoice.currency,
    totalNetAmount: originalInvoice.totalNetAmount,
    totalVatAmount: originalInvoice.totalVatAmount,
    totalGrossAmount: originalInvoice.totalGrossAmount,
    vatBreakdown: originalInvoice.vatBreakdown,
    paymentMethod: originalInvoice.paymentMethod,
    paymentStatus: 'unpaid',
    payments: [],
    totalPaid: 0,
    balanceDue: originalInvoice.totalGrossAmount,
    mydata: {
      status: 'draft',
      mark: null,
      uid: null,
      authCode: null,
      submittedAt: null,
      respondedAt: null,
      errorMessage: null,
    },
    projectId: originalInvoice.projectId,
    unitId: originalInvoice.unitId,
    relatedInvoiceId: originalInvoice.invoiceId,
    journalEntryId: null,
    notes: buildReversalNotes(reasonCode, reasonNotes),
    fiscalYear: getFiscalYearFromDate(isoNow()),
    cancellationReason: reasonCode,
    cancellationNotes: reasonNotes ?? undefined,
  });

  // Journal reversal linked to original invoice
  const reversalResult = await reverseJournalEntryForCancelledInvoice(
    repository,
    originalInvoice.invoiceId,
    userId,
    reasonCode,
    reasonNotes
  );

  // Bidirectional link: original → credit note
  await repository.updateInvoice(originalInvoice.invoiceId, {
    creditNoteInvoiceId: creditNoteId,
    cancellationReason: reasonCode,
    cancellationNotes: reasonNotes ?? undefined,
  });

  return {
    creditNoteId,
    creditNoteNumber,
    reversalEntryId: reversalResult?.reversalEntryId ?? null,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

const REASON_LABELS: Record<CancellationReasonCode, string> = {
  BILLING_ERROR: 'Λάθος ποσό / τιμολόγηση',
  DUPLICATE: 'Διπλότυπο παραστατικό',
  ORDER_CANCELLED: 'Ακύρωση παραγγελίας',
  TERMS_CHANGED: 'Αλλαγή όρων',
  GOODS_RETURNED: 'Επιστροφή προϊόντων',
  OTHER: 'Άλλο',
};

function buildReversalNotes(
  reasonCode: CancellationReasonCode,
  reasonNotes: string | null
): string {
  const label = REASON_LABELS[reasonCode];
  if (reasonNotes) {
    return `${label} — ${reasonNotes}`;
  }
  return label;
}
