/**
 * =============================================================================
 * POST /api/accounting/journal/[id]/reversal — Αντιλογισμός (storno) εγγραφής Βιβλίου Ε-Ε
 * =============================================================================
 *
 * SAP FB08 · DATEV Generalumkehr: νέα εγγραφή με αντίθετα ποσά, η αρχική μένει σημαδεμένη `REVERSED`. Ημερομηνία =
 * της αρχικής αν η περίοδός της είναι ανοιχτή, αλλιώς σήμερα (ο διακομιστής αποφασίζει, η απάντηση τη λέει).
 * Ιδεμπότητη: δεύτερο αίτημα = `alreadyReversed: true` με ΤΟ ΙΔΙΟ storno (και το `Idempotency-Key` του `apiClient`).
 *
 * Auth: μόνο διοικητικός ρόλος (αλλάζει νούμερα φόρου — όπως η αναίρεση αποσβέσεων). Rate: sensitive.
 * Errors: 404 · 409 `JOURNAL_REVERSAL_<λόγος>` · 409 `PERIOD_NOT_FOUND` / `PERIOD_CLOSED` / `PERIOD_LOCKED`.
 *
 * @module api/accounting/journal/[id]/reversal
 * @enterprise ADR-ACC-010 §2.1.1 Φάση 8 · ADR-603
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, notFound } from '@/lib/api/define-route';
import { ADMINISTRATIVE_ROLES } from '@/lib/auth/roles';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { getPeriodForDate, openFiscalYearAutomaticallyFor } from '@/subapps/accounting/services/fiscal-period-service';
import { isReversalReasonComplete } from '@/subapps/accounting/services/journal/journal-reversal-policy';
import { JOURNAL_REVERSAL_REASON_CODES } from '@/subapps/accounting/types/journal-reversal';
import { accountingToday } from '@/subapps/accounting/utils/accounting-day';
import { throwJournalReversalRefused, withJournalReversalErrors } from '../../../_shared/journal-reversal-errors';

const ReverseJournalEntrySchema = z.object({
  reasonCode: z.enum(JOURNAL_REVERSAL_REASON_CODES),
  notes: z.string().max(2000).optional(),
}).strict().refine((body) => isReversalReasonComplete(body.reasonCode, body.notes), {
  message: 'notes are required for reason OTHER',
  path: ['notes'],
});

export const POST = defineRoute({
  rateLimit: 'sensitive',
  auth: { requiredGlobalRoles: ADMINISTRATIVE_ROLES },
  schema: ReverseJournalEntrySchema,
  fallbackError: 'Failed to reverse journal entry',
  handler: async ({ auth, body, params }) => {
    const { repository } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const today = accountingToday();
    // ADR-ACC-010 §2.1.1 Φ9: το «σήμερα» είναι η εφεδρική ημερομηνία του storno — η χρήση του εξασφαλίζεται ΠΡΙΝ
    // τη συναλλαγή του γραφέα (ίδιο δίχτυ με κάθε σύνορο καταχώρησης, ίδιο παράθυρο).
    if (await getPeriodForDate(repository, today) === null) await openFiscalYearAutomaticallyFor(repository, today, today);
    const outcome = await withJournalReversalErrors(() => repository.reverseJournalEntry({
      entryId: params.id,
      trigger: 'manual',
      datePolicy: 'original_period_if_open',
      reasonCode: body.reasonCode,
      reasonNotes: body.notes?.trim() || null,
      today,
    }));

    switch (outcome.kind) {
      case 'not_found':
        return notFound('Journal entry not found');
      case 'refused':
        return throwJournalReversalRefused(outcome.reason);
      case 'already_reversed':
        return ok({ ...outcome, alreadyReversed: true });
      case 'reversed':
        return ok({ ...outcome, alreadyReversed: false });
    }
  },
});
