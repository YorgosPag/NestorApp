/**
 * **Η απόπειρα στην οποία επέστρεψε ο browser από τον πάροχο** (`?payment=pchk_…`) — ένας ορισμός για κάθε σελίδα πληρωμής
 * (ADR-ACC-030 §5 · ADR-943 §5.9). Μεταφέρθηκε από τη σελίδα του τιμολογίου όταν απέκτησε δεύτερο καλούντα.
 *
 * @module components/shared/payments/returned-attempt
 */

import { currentSearchParams, replaceUrlSearchParams } from '@/lib/url-query-state';
import { PAYMENT_ATTEMPT_ID_PATTERN, PAYMENT_PAGE_ATTEMPT_PARAM } from '@/subapps/accounting/types/online-payment';

/** Η απόπειρα της διεύθυνσης, ή `null` όταν λείπει / δεν έχει τη μορφή αναγνωριστικού απόπειρας. */
export function returnedAttemptId(): string | null {
  const id = currentSearchParams().get(PAYMENT_PAGE_ATTEMPT_PARAM) ?? '';
  return PAYMENT_ATTEMPT_ID_PATTERN.test(id) ? id : null;
}

/**
 * Τέλος αναμονής ⇒ σβήνει το `?payment=` χωρίς πλοήγηση, ώστε η ανανέωση να μην ξαναρχίσει κλειστή αναμονή. Μέσω
 * του ΕΝΟΣ γραφέα query state (κρατά hash, άσχετα κλειδιά και το `history.state` του App Router).
 */
export function forgetReturnedAttempt(): void {
  if (!currentSearchParams().has(PAYMENT_PAGE_ATTEMPT_PARAM)) return;
  replaceUrlSearchParams((params) => params.delete(PAYMENT_PAGE_ATTEMPT_PARAM));
}
