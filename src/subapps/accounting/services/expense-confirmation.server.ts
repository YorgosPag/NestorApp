import 'server-only';

/**
 * Expense document confirmation — the ONE writer of `review → confirmed` (ADR-917 Φ4.0)
 *
 * The old flow posted the journal entry, THEN updated the document, with no state check: a double click or a
 * network retry posted TWO journal entries (two expenses in the VAT return and, from Φ4, two «invoiced» amounts
 * in the project ledger), and a rejected or foreign document could be confirmed. Here:
 *
 * - **One transaction**: read (tenant-fenced) → state check → journal entry + document update, all or nothing.
 * - **Idempotent**: the journal entry id is deterministic per document; an already-confirmed document answers
 *   `already_confirmed` with ITS entry, nothing is written.
 * - **Only `review` can be confirmed** — `processing` (AI not done) and `rejected` answer `not_reviewable`.
 * - **The allocation must fit** (ADR-917 Φ4): lines already allocated to projects may not exceed the net amount
 *   being confirmed — otherwise the ledger would carry more «invoiced» than the invoice.
 *
 * The fiscal-period gate (`validatePostingAllowed`) is the caller's job, as for every other posting writer.
 *
 * @module subapps/accounting/services/expense-confirmation.server
 * @see ADR-917 Φ4.0 · ADR-ACC-005
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicExpenseJournalEntryId } from '@/services/enterprise-id.service';
import { allocationCoverageOf } from '@/services/project-cost/expense-allocation';

import type { TenantContext } from '../types/common';
import type { DocumentProcessingStatus, ReceivedExpenseDocument } from '../types/documents';
import { buildJournalEntryRecord } from './repository/accounting-repo-financial';
import { isoNow, sanitizeForFirestore } from './repository/firestore-helpers';
import { ownedPayload, type OwnedDocAddress } from './repository/tenant-owned-doc';
import { buildExpenseJournalInput, type ExpenseConfirmation } from './expense-confirmation-input';

type ExpenseConfirmOutcome =
  | { readonly kind: 'confirmed'; readonly journalEntryId: string; readonly previousStatus: DocumentProcessingStatus }
  | { readonly kind: 'already_confirmed'; readonly journalEntryId: string | null }
  | { readonly kind: 'not_reviewable'; readonly status: DocumentProcessingStatus }
  | { readonly kind: 'allocation_exceeds_net'; readonly allocated: number }
  | { readonly kind: 'not_found' };

/** The journal entry of THIS document — the same id on every attempt */
export const expenseJournalEntryIdOf = (companyId: string, documentId: string): string =>
  generateDeterministicExpenseJournalEntryId(`${companyId}:${documentId}`);

function confirmedFields(confirmation: ExpenseConfirmation, journalEntryId: string, now: string) {
  return sanitizeForFirestore({
    status: 'confirmed',
    confirmedCategory: confirmation.category,
    confirmedNetAmount: confirmation.netAmount,
    confirmedVatAmount: confirmation.vatAmount,
    confirmedDate: confirmation.date,
    confirmedIssuerName: confirmation.issuerName,
    journalEntryId,
    notes: confirmation.notes,
    updatedAt: now,
  });
}

export async function confirmExpenseDocument(
  db: Firestore,
  tenant: TenantContext,
  documentId: string,
  confirmation: ExpenseConfirmation,
): Promise<ExpenseConfirmOutcome> {
  const address: OwnedDocAddress = {
    collection: COLLECTIONS.ACCOUNTING_EXPENSE_DOCUMENTS,
    id: documentId,
    resource: 'expense document',
  };
  const documentRef = db.collection(address.collection).doc(documentId);
  const journalEntryId = expenseJournalEntryIdOf(tenant.companyId, documentId);
  const journalRef = db.collection(COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES).doc(journalEntryId);

  return db.runTransaction(async (tx): Promise<ExpenseConfirmOutcome> => {
    const [documentSnap, journalSnap] = await Promise.all([tx.get(documentRef), tx.get(journalRef)]);
    const document = documentSnap.exists
      ? ownedPayload<ReceivedExpenseDocument>(documentSnap.data(), tenant, address)
      : null;
    if (document === null) return { kind: 'not_found' };
    if (document.status === 'confirmed') return { kind: 'already_confirmed', journalEntryId: document.journalEntryId };
    if (document.status !== 'review') return { kind: 'not_reviewable', status: document.status };
    const coverage = allocationCoverageOf(confirmation.netAmount, document.costAllocations);
    if (coverage.state === 'over') return { kind: 'allocation_exceeds_net', allocated: coverage.allocated };

    const now = isoNow();
    // Belt-and-suspenders: an entry already at the deterministic id is never posted a second time.
    if (!journalSnap.exists) {
      const entry = buildExpenseJournalInput({ ...document, documentId }, confirmation);
      tx.create(journalRef, buildJournalEntryRecord(tenant, journalEntryId, entry, now));
    }
    tx.update(documentRef, confirmedFields(confirmation, journalEntryId, now));
    return { kind: 'confirmed', journalEntryId, previousStatus: document.status };
  });
}
