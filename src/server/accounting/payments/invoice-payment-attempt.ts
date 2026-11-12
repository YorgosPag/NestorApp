import 'server-only';

/**
 * @fileoverview Η **έκβαση μιας απόπειρας** online πληρωμής για τη δημόσια σελίδα (ADR-ACC-030 §5.6)
 * @description Πρότυπο Stripe: η σελίδα επιστροφής ρωτά τον διακομιστή «τι έγινε με αυτή την απόπειρα;» αντί να
 *   μαντεύει από τη διεύθυνση. Η απάντηση είναι **μόνο** η έκβαση — ούτε ποσό, ούτε κωδικός παρόχου, ούτε
 *   αναγνωριστικά — και δίνεται **μόνο** για απόπειρα του **ίδιου** συνδέσμου· ξένη ή ανύπαρκτη ⇒ ίδια άρνηση.
 *
 *   Η αρνημένη απόπειρα (`lastFailure`) **δεν** είναι κατάσταση της συνεδρίας (μένει `pending`, ADR-ACC-030 §5.3)·
 *   εδώ γίνεται `failed` για τον άνθρωπο. Η κατάσταση νικά πάντα: πληρωμένη συνεδρία ⇒ `paid`, όποια άρνηση κι αν
 *   προηγήθηκε.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { readPaymentCheckout, type PaymentCheckoutRecord } from '@/server/payments/payment-checkout-store';
import type { InvoiceCheckoutAttemptResponse, PaymentAttemptOutcome } from '@/subapps/accounting/types/online-payment';

/** Συνεδρία ⇒ έκβαση για τον άνθρωπο. Καθαρό. */
export function paymentAttemptOutcomeOf(
  record: Pick<PaymentCheckoutRecord, 'status' | 'lastFailure'>,
): PaymentAttemptOutcome {
  switch (record.status) {
    case 'paid':
      return 'paid';
    case 'pending':
      return record.lastFailure === null ? 'pending' : 'failed';
    case 'failed':
    case 'expired':
    case 'canceled':
      return 'closed';
  }
}

/** Η έκβαση της απόπειρας `checkoutId` — μόνο αν ανήκει στον σύνδεσμο `shareId`. */
export async function readInvoicePaymentAttempt(
  db: Firestore, input: { readonly shareId: string; readonly checkoutId: string },
): Promise<InvoiceCheckoutAttemptResponse> {
  const record = await readPaymentCheckout(db, input.checkoutId);
  if (record === null || record.shareId !== input.shareId) return { status: 'refused', reason: 'unknown-attempt' };
  return { status: 'ok', attempt: paymentAttemptOutcomeOf(record) };
}
