/**
 * =============================================================================
 * GET + PATCH + DELETE /api/accounting/invoices/[id] — Single Invoice CRUD
 * =============================================================================
 *
 * GET:    Fetch a single invoice by ID (404 if not found)
 * PATCH:  Update invoice fields
 * DELETE: Cancel invoice (soft delete — fiscal documents must be preserved)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/invoices/[id]
 * @enterprise ADR-ACC-002 Invoicing System
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest, notFound, conflict, httpError } from '@/lib/api/define-route';
import { logAuditEvent, logFinancialTransition } from '@/lib/auth';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  reverseJournalEntryForCancelledInvoice,
  createCreditNoteForInvoice,
} from '@/subapps/accounting/services/reversal-service';
import { refreshCustomerBalance } from '@/subapps/accounting/services';
import { validatePostingAllowed } from '@/subapps/accounting/services/fiscal-period-service';
import { accountingToday } from '@/subapps/accounting/utils/accounting-day';
import { assertPostingAllowed } from '../../_shared/fiscal-period-errors';
import { withJournalReversalErrors } from '../../_shared/journal-reversal-errors';
import type { MyDataDocumentStatus, UpdateInvoiceInput, CancellationReasonCode } from '@/subapps/accounting/types';
import { safeJsonBody } from '@/lib/validation/shared-schemas';
import {
  UpdateInvoiceSchema,
  CancelInvoiceSchema,
  stripServerOwnedInvoiceFields,
  IMMUTABLE_STATUSES,
  VOIDABLE_STATUSES,
  CREDIT_NOTE_STATUSES,
} from '../invoice-schemas';
import { withCurrentPaymentAccounts, withServerPaymentAccountsOnUpdate } from '../invoice-payment-snapshot';
import { resettleInvoicePayments } from '@/subapps/accounting/services/repository/accounting-repo-invoice-payments';

// =============================================================================
// GET — Single Invoice
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to fetch invoice',
  handler: async ({ auth, params }) => {
    const { id } = params;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const invoice = await repository.getInvoice(id);

    if (!invoice) {
      notFound('Invoice not found');
    }

    // ADR-ACC-018 §15.2: πρόχειρο ⇒ οι οδηγίες πληρωμής του σημερινού μητρώου (προεπισκόπηση + PDF)· εκδομένο ⇒ το στιγμιότυπο.
    return ok(await withCurrentPaymentAccounts(repository, invoice));
  },
});

// =============================================================================
// PATCH — Update Invoice
// =============================================================================

export const PATCH = defineRoute({
  rateLimit: 'standard',
  schema: UpdateInvoiceSchema,
  fallbackError: 'Failed to update invoice',
  handler: async ({ auth, body, params }) => {
    const { id } = params;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    // ADR-ACC-003 §22: η κατάσταση myDATA έχει έναν γραφέα, τον διακομιστή — ποτέ από τον πελάτη.
    const updates = stripServerOwnedInvoiceFields(body);

    if (Object.keys(updates).length === 0) {
      badRequest('No update fields provided');
    }

    // Verify invoice exists
    const existing = await repository.getInvoice(id);
    if (!existing) {
      notFound('Invoice not found');
    }

    // 🛡️ ADR-249 P0-1: Invoice immutability guard
    const currentStatus = existing.mydata?.status as MyDataDocumentStatus | undefined;
    if (currentStatus && IMMUTABLE_STATUSES.has(currentStatus)) {
      httpError(403, `Cannot edit invoice with myDATA status '${currentStatus}'. Only draft or rejected invoices are editable.`);
    }

    // ADR-ACC-018 §15: αλλαγή τρόπου πληρωμής/εκδότη/τύπου ⇒ ο διακομιστής ξαναχτίζει τους λογαριασμούς από το μητρώο.
    const withAccounts = await withServerPaymentAccountsOnUpdate(repository, updates, existing);
    await repository.updateInvoice(id, withAccounts as UpdateInvoiceInput);

    // ADR-ACC-030: νέες γραμμές ⇒ νέο σύνολο ⇒ το υπόλοιπο ξαναβγαίνει από τον ΕΝΑ υπολογισμό, σε συναλλαγή πάνω
    // στις τρέχουσες κινήσεις (ποτέ πάνω στο αντίγραφο που διαβάστηκε πριν — μπορεί να μπήκε πληρωμή στο μεταξύ).
    if (updates.lineItems) {
      await resettleInvoicePayments({ companyId: auth.companyId }, id);
    }

    // ── Hook 3: Update balance if payments/amounts changed (Q4 — sync) ─
    const affectsBalance = !!updates.lineItems;
    const contactId = existing.customer?.contactId;
    if (affectsBalance && contactId) {
      await refreshCustomerBalance(repository, contactId);
    }

    await logAuditEvent(auth, 'data_updated', id, 'invoice', {
      metadata: { reason: 'Invoice fields updated' },
    }).catch(() => {/* non-blocking */});

    return ok({ invoiceId: id, updated: true });
  },
});

// =============================================================================
// DELETE — Cancel Invoice (Void or Credit Note)
// =============================================================================

/**
 * Fiscal documents (invoices) must NEVER be hard-deleted per Greek tax law.
 *
 * Phase 1a routing (AUDIT A-1, ελληνική νομοθεσία):
 * - Draft/Rejected → VOID: soft-delete + journal reversal
 * - Sent/Accepted  → CREDIT NOTE: new credit_invoice + journal reversal
 * - Cancelled       → 409 Conflict
 */

export const DELETE = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to cancel invoice',
  handler: async ({ req, auth, params }) => {
    const { id } = params;
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // Parse cancellation reason from body
    const parsed = await safeJsonBody(CancelInvoiceSchema, req);
    if (parsed.error) return parsed.error;
    const { reasonCode, notes } = parsed.data;

    const existing = await repository.getInvoice(id);
    if (!existing) {
      notFound('Invoice not found');
    }

    if (existing.mydata?.status === 'cancelled') {
      conflict('Invoice is already cancelled');
    }

    const currentStatus = existing.mydata?.status ?? 'draft';
    const reasonNotes = notes.trim() || null;

    // ADR-ACC-010 §2.1.1 Φ8: ο αντιλογισμός της εγγραφής Ε-Ε έχει ΣΗΜΕΡΙΝΗ ημερομηνία — η περίοδός της ελέγχεται
    // ΠΡΙΝ αλλάξει οτιδήποτε στο τιμολόγιο (αλλιώς: ακυρωμένο τιμολόγιο, εγγραφή χωρίς storno).
    if (await repository.getJournalEntryByInvoiceId(id)) {
      assertPostingAllowed(await validatePostingAllowed(repository, accountingToday()));
    }

    // ── Path A: Draft/Rejected → VOID ─────────────────────────────
    if (VOIDABLE_STATUSES.has(currentStatus)) {
      await repository.updateInvoice(id, {
        mydata: { ...existing.mydata, status: 'cancelled' },
        cancellationReason: reasonCode as CancellationReasonCode,
        cancellationNotes: reasonNotes ?? undefined,
      });

      const reversal = await withJournalReversalErrors(() => reverseJournalEntryForCancelledInvoice(
        repository, id, reasonCode as CancellationReasonCode, reasonNotes
      ));

      // ── Hook 2: Update balance after void (Q4 — synchronous) ────────
      const voidContactId = existing.customer?.contactId;
      if (voidContactId) {
        await refreshCustomerBalance(repository, voidContactId);
      }

      await logFinancialTransition(auth, 'invoice', id, currentStatus, 'cancelled').catch(() => {/* non-blocking */});

      return ok({
        invoiceId: id,
        action: 'voided',
        cancelled: true,
        reversalEntryId: reversal?.reversalEntryId ?? null,
      });
    }

    // ── Path B: Sent/Accepted → CREDIT NOTE ──────────────────────
    if (CREDIT_NOTE_STATUSES.has(currentStatus)) {
      const result = await withJournalReversalErrors(() => createCreditNoteForInvoice(
        repository, existing, reasonCode as CancellationReasonCode, reasonNotes
      ));

      // ── Hook 2: Update balance after credit note (Q4 — synchronous) ─
      const cnContactId = existing.customer?.contactId;
      if (cnContactId) {
        await refreshCustomerBalance(repository, cnContactId);
      }

      await logFinancialTransition(auth, 'invoice', id, currentStatus, 'credit_note_issued').catch(() => {/* non-blocking */});

      return ok({
        invoiceId: id,
        action: 'credit_note_issued',
        creditNoteId: result.creditNoteId,
        creditNoteNumber: result.creditNoteNumber,
        reversalEntryId: result.reversalEntryId,
      });
    }

    // ── Unknown status → reject ──────────────────────────────────
    badRequest(`Cannot cancel invoice with status '${currentStatus}'`);
  },
});
