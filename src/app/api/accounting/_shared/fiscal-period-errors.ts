/**
 * Οι αρνήσεις του γραφέα περιόδων (ADR-ACC-010 §2.1.1 Φάση 6) ⇒ HTTP με `errorCode` (ADR-284):
 * ανύπαρκτη ή ξένη περίοδος ⇒ 404 (ίδια απάντηση — καμία διαρροή ύπαρξης) · άκυρη μετάβαση / υπάρχουσα χρήση ⇒ 409
 * (κατάσταση, όχι κακό αίτημα). Οτιδήποτε άλλο ανεβαίνει αμετάβλητο (500 από το `defineRoute`).
 * Άρνηση ΚΑΤΑΧΩΡΗΣΗΣ σε περίοδο ⇒ `assertPostingAllowed` (Φάση 7): ίδιο 409, κωδικός από `POSTING_PERIOD_DENIALS`.
 *
 * @module api/accounting/_shared/fiscal-period-errors
 */

import 'server-only';

import { ApiError } from '@/lib/api/ApiErrorHandler';
import {
  FiscalPeriodNotFoundError,
  FiscalPeriodTransitionError,
  FiscalYearExistsError,
} from '@/subapps/accounting/services/repository/accounting-repo-fiscal-periods';
import type { PostingValidationResult } from '@/subapps/accounting/types/fiscal-period';

export async function withFiscalPeriodErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof FiscalPeriodNotFoundError) throw new ApiError(404, error.message, error.code);
    if (error instanceof FiscalPeriodTransitionError || error instanceof FiscalYearExistsError) {
      throw new ApiError(409, error.message, error.code);
    }
    throw error;
  }
}

type DeniedPosting = Extract<PostingValidationResult, { allowed: false }>;

/** Τα δομημένα στοιχεία μιας άρνησης — ό,τι χρειάζεται ο πελάτης για να γράψει «η περίοδος Χ είναι κλεισμένη». */
export function postingDenialDetailsOf(check: DeniedPosting): Record<string, string | number | null> {
  return {
    postingDate: check.postingDate,
    periodId: check.periodId,
    periodStatus: check.periodStatus,
    fiscalYear: check.fiscalYear,
    periodNumber: check.periodNumber,
  };
}

/**
 * Άρνηση καταχώρησης ⇒ 409 με `errorCode` ∈ `POSTING_PERIOD_DENIALS` (ADR-ACC-010 §2.1.1 Φ7). 409 και όχι 422: το
 * αίτημα είναι σωστό, η ΚΑΤΑΣΤΑΣΗ της περιόδου το αρνείται — ίδια σύμβαση με τις μεταβάσεις και τις αποσβέσεις.
 * Το `message` είναι τεχνικό (logs)· ο χρήστης βλέπει το κείμενο του πελάτη.
 */
export function assertPostingAllowed(check: PostingValidationResult): void {
  if (check.allowed) return;
  throw new ApiError(409, `Posting refused: ${check.denial} (${check.periodId ?? check.postingDate})`, check.denial, postingDenialDetailsOf(check));
}
