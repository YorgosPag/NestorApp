/**
 * =============================================================================
 * GET + POST /api/accounting/invoices — List & Create Invoices
 * =============================================================================
 *
 * GET:  List invoices with optional filters (type, paymentStatus, fiscalYear, customerId, projectId)
 * POST: Create a new invoice + auto-generate journal entry
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/invoices
 * @enterprise ADR-ACC-002 Invoicing System
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, created } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import {
  validatePostingAllowed,
  checkCreditLimit,
  computeCustomerBalance,
  hasActiveCreditLimit,
  refreshCustomerBalance,
} from '@/subapps/accounting/services';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { assertPostingAllowed } from '../_shared/fiscal-period-errors';
import { POLICY_ERROR_CODES } from '@/lib/policy/policy-error-codes';
import { INVOICE_TYPES } from '@/subapps/accounting/types';
import type { CreateInvoiceInput, CreditCheckResult, InvoiceCreatedResponse } from '@/subapps/accounting/types';
import { readListContext, readPageRequest, respondWithPage } from '../_shared/list-request-context';
import { createDraftMyDataMeta } from '@/subapps/accounting/services/mydata/mydata-status-transitions';
import { invoiceSharedFields, refineInvoiceAmounts, stripServerOwnedInvoiceFields } from './invoice-schemas';
import { invoiceAmountsOf } from '@/subapps/accounting/utils/invoice-amounts';
import { initialInvoicePaymentState } from '@/subapps/accounting/services/payments/invoice-payment-settlement';
import { invoiceFiltersOf } from '../_shared/list-filters';

const CreateInvoiceSchema = z.object({
  series: z.string().min(1).max(20),
  type: z.enum(INVOICE_TYPES),
  issueDate: z.string().min(10).max(30),
  ...invoiceSharedFields,
}).passthrough().superRefine(refineInvoiceAmounts);

// =============================================================================
// GET — List Invoices
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to list invoices',
  handler: async ({ req, auth }) => {
    const { repository, searchParams } = readListContext(req, auth);

    const filters = invoiceFiltersOf(searchParams);

    return respondWithPage(() => repository.listInvoices(filters, readPageRequest(searchParams)));
  },
});

// =============================================================================
// POST — Create Invoice
// =============================================================================

export const POST = defineRoute({
  rateLimit: 'standard',
  schema: CreateInvoiceSchema,
  fallbackError: 'Failed to create invoice',
  handler: async ({ auth, body }) => {
    const { service, repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });

    // ── Hook 1a: Validate posting allowed (Q4 — fiscal period check) ──
    assertPostingAllowed(await validatePostingAllowed(repository, body.issueDate));

    // ── Hook 1b: Credit limit check (Q4 — SAP KNKK pattern) ──────────
    const contactId = body.contactId;
    // Το ποσό που κρίνεται το υπολογίζει ο διακομιστής από τις επικυρωμένες γραμμές — ποτέ δηλωμένο ποσό του
    // πελάτη (ADR-ACC-003 §22.2).
    const grossAmount = invoiceAmountsOf(body.lineItems ?? []).totalGrossAmount;
    let creditWarning: CreditCheckResult | null = null;
    if (contactId) {
      // Η αποθηκευμένη εγγραφή δίνει ΜΟΝΟ τις ρυθμίσεις πίστωσης· η έκθεση υπολογίζεται ΖΩΝΤΑΝΑ από τα
      // παραστατικά όλων των χρήσεων (SAP credit exposure) — ποτέ από μια προβολή που μπορεί να έχει μείνει πίσω.
      const settings = await repository.getCustomerBalance(contactId);
      if (hasActiveCreditLimit(settings)) {
        const creditCheck = checkCreditLimit(await computeCustomerBalance(repository, contactId), grossAmount);
        if (!creditCheck.allowed) {
          throw new ApiError(422, 'Credit limit exceeded', POLICY_ERROR_CODES.CREDIT_LIMIT_EXCEEDED, {
            creditCheck,
            creditLimit: settings.creditLimit,
          });
        }
        creditWarning = creditCheck.exceedsLimit ? creditCheck : null;
      }
    }

    // Create the invoice
    // ADR-ACC-003 §22: η αρχική κατάσταση myDATA τη γράφει ο διακομιστής — ό,τι έστειλε ο πελάτης αγνοείται.
    const { id, number } = await repository.createInvoice({
      ...stripServerOwnedInvoiceFields(body),
      mydata: createDraftMyDataMeta(),
      // ADR-ACC-030: τα πεδία πληρωμής τα γράφει ΜΟΝΟ ο διακομιστής — νέο παραστατικό = καμία κίνηση.
      ...initialInvoicePaymentState(grossAmount),
    } as unknown as CreateInvoiceInput);

    // Auto-generate journal entry from the new invoice
    const journalEntry = await service.createJournalEntryFromInvoice(id);

    // ── Hook 1c: Update customer balance (Q4 — synchronous, Q6) ───────
    // Το τιμολόγιο ΥΠΑΡΧΕΙ ήδη: η ανανέωση της προβολής δεν ρίχνει το αίτημα (αλλιώς επανάληψη = διπλό τιμολόγιο).
    if (contactId) {
      await refreshCustomerBalance(repository, contactId);
    }

    // ADR-ACC-003 §22.10: το ΕΝΑ συμβόλαιο που διαβάζει και η φόρμα (`InvoiceCreatedResponse`).
    return created<InvoiceCreatedResponse>({
      invoiceId: id,
      number,
      journalEntryId: journalEntry?.entryId ?? null,
      creditWarning,
    });
  },
});
