/**
 * Οι αρνήσεις του ΕΝΟΣ γραφέα αντιλογισμού (ADR-ACC-010 §2.1.1 Φ8) ⇒ HTTP με `errorCode` (ADR-284).
 *
 * - Περίοδος που δεν δέχεται εγγραφή ⇒ ΙΔΙΑ απάντηση με κάθε καταχώρηση (`assertPostingAllowed`, Φ7): 409 + κωδικός
 *   από τα `POSTING_PERIOD_DENIALS` + δομημένα στοιχεία — ο πελάτης γράφει «η περίοδος Χ είναι κλειστή».
 * - Άρνηση της πολιτικής ⇒ 409 `JOURNAL_REVERSAL_<λόγος>` (κατάσταση της εγγραφής, όχι κακό αίτημα).
 *
 * @module api/accounting/_shared/journal-reversal-errors
 */

import 'server-only';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import {
  InvoiceJournalReversalRefusedError,
  JournalReversalPeriodError,
} from '@/subapps/accounting/services/journal/journal-reversal-errors';
import { journalReversalRefusalCode } from '@/subapps/accounting/services/journal/journal-reversal-policy';
import type { JournalReversalRefusal } from '@/subapps/accounting/types/journal-reversal';
import { assertPostingAllowed } from './fiscal-period-errors';

export function throwJournalReversalRefused(reason: JournalReversalRefusal): never {
  throw new ApiError(409, `Journal reversal refused: ${reason}`, journalReversalRefusalCode(reason));
}

export async function withJournalReversalErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof JournalReversalPeriodError) {
      assertPostingAllowed({
        allowed: false,
        denial: error.code,
        postingDate: error.postingDate,
        periodId: error.period?.periodId ?? null,
        periodStatus: error.period?.status ?? null,
        fiscalYear: error.period?.fiscalYear ?? null,
        periodNumber: error.period?.periodNumber ?? null,
      });
    }
    if (error instanceof InvoiceJournalReversalRefusedError) {
      throw new ApiError(409, error.message, journalReversalRefusalCode(error.reason));
    }
    throw error;
  }
}
