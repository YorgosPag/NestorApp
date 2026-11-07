/**
 * @fileoverview Accounting Reversal Service — Journal Reversal + Credit Note
 * @description Standalone functions for invoice cancellation workflows (Phase 1a — AUDIT A-1)
 *
 * Two workflows based on Greek law:
 * - Draft invoices → void + journal reversal
 * - Issued invoices → credit note + journal reversal
 *
 * Ο αντιλογισμός της εγγραφής Ε-Ε ΔΕΝ γράφεται εδώ: περνά από τον ΕΝΑ γραφέα `repository.reverseJournalEntry`
 * (ατομικός, ιδεμπότητος — ADR-ACC-010 §2.1.1 Φ8), τον ίδιο που χρησιμοποιεί το βιβλίο.
 *
 * Pattern: Same as accounting-efka-operations.ts (standalone functions, repository as param)
 *
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-29
 * @see AUDIT-2026-03-29.md §A-1
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { IAccountingRepository } from '../types/interfaces';
import type { Invoice, CancellationReasonCode } from '../types/invoice';
import { accountingToday } from '../utils/accounting-day';
import { isoNow, getFiscalYearFromDate } from './repository/firestore-helpers';
import { InvoiceJournalReversalRefusedError } from './journal/journal-reversal-errors';

// ============================================================================
// TYPES
// ============================================================================

interface ReversalResult {
  originalEntryId: string;
  reversalEntryId: string | null;
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
 * Αντιλογιστική εγγραφή για ακυρωμένο τιμολόγιο — με σημερινή ημερομηνία (το πιστωτικό / void είναι γεγονός ΣΗΜΕΡΑ).
 *
 * Η αναζήτηση με `invoiceId` μπορεί να βρει και τον ίδιο τον αντιλογισμό (κουβαλά το ίδιο `invoiceId`): τότε ο στόχος
 * είναι η αρχική του, και ο γραφέας απαντά «ήδη αντιλογισμένη» — η επανάληψη μετά από μισή ακύρωση είναι ασφαλής.
 *
 * @returns null αν δεν βρεθεί journal entry (π.χ. draft χωρίς εγγραφή)
 * @throws JournalReversalPeriodError αν η σημερινή περίοδος δεν δέχεται εγγραφή · InvoiceJournalReversalRefusedError
 */
export async function reverseJournalEntryForCancelledInvoice(
  repository: IAccountingRepository,
  invoiceId: string,
  reasonCode: CancellationReasonCode,
  reasonNotes: string | null
): Promise<ReversalResult | null> {
  const found = await repository.getJournalEntryByInvoiceId(invoiceId);
  if (!found) return null;
  const entryId = found.isReversal && found.originalEntryId ? found.originalEntryId : found.entryId;

  const outcome = await repository.reverseJournalEntry({
    entryId,
    trigger: 'invoice_cancellation',
    datePolicy: 'today',
    reasonCode,
    reasonNotes,
    today: accountingToday(),
  });

  switch (outcome.kind) {
    case 'reversed':
    case 'already_reversed':
      return { originalEntryId: outcome.originalEntryId, reversalEntryId: outcome.reversalEntryId };
    case 'not_found':
      return null;
    case 'refused':
      throw new InvoiceJournalReversalRefusedError(invoiceId, outcome.reason);
  }
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
    propertyId: originalInvoice.propertyId,
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
