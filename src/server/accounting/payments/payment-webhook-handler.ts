import 'server-only';

/**
 * @fileoverview Από **επαληθευμένο σήμα** webhook σε καταγεγραμμένη πληρωμή (ADR-ACC-030 §5)
 * @description Το σήμα λέει μόνο «κοίτα αυτή τη συνεδρία». Βρίσκουμε τη συνεδρία με αναγνωριστικό που ορίσαμε
 *   **εμείς** (ή που μας έδωσε ο πάροχος όταν τη δημιουργήσαμε) και τρέχουμε τον ίδιο συγχρονισμό με τη
 *   συμφιλίωση. IRIS Direct: πρώτα **εμείς** χρεώνουμε την εξουσιοδοτημένη πηγή (μία φορά — ιδεμποτικό στον
 *   πάροχο), μετά συγχρονίζουμε.
 *
 *   Άγνωστη συνεδρία ⇒ `unknown` (απάντηση 200: τίποτα να ξαναδοκιμάσει ο πάροχος· η συμφιλίωση καλύπτει το
 *   παράθυρο όπου το webhook προλαβαίνει την εγγραφή του αναγνωριστικού).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import type { PaymentProvider, WebhookSignal } from '@/server/payments/payment-provider';
import {
  checkoutSubjectOf,
  findPaymentCheckoutBy,
  readPaymentCheckout,
  type PaymentCheckoutRecord,
} from '@/server/payments/payment-checkout-store';

import { syncCheckoutSettlement, type CheckoutSyncOutcome } from './invoice-payment-settlement-sync';

const logger = createModuleLogger('PaymentWebhookHandler');

export type PaymentSignalOutcome = CheckoutSyncOutcome | 'ignored' | 'unknown';

async function checkoutOfSignal(
  db: Firestore, provider: PaymentProvider, signal: Exclude<WebhookSignal, { kind: 'ignored' }>,
): Promise<PaymentCheckoutRecord | null> {
  switch (signal.kind) {
    case 'checkout-reference':
      return findPaymentCheckoutBy(db, provider.id, 'providerReference', signal.providerReference);
    case 'payment-reference':
      return findPaymentCheckoutBy(db, provider.id, 'paymentReference', signal.paymentReference);
    case 'authorized-source': {
      const checkout = await readPaymentCheckout(db, signal.checkoutId);
      return checkout?.provider === provider.id ? checkout : null;
    }
  }
}

/** Εκτελεί ένα επαληθευμένο σήμα. Ιδεμποτικό. Σφάλμα παρόχου/βάσης ⇒ ρίχνει (ο πάροχος ξαναδοκιμάζει). */
export async function handlePaymentSignal(
  db: Firestore, provider: PaymentProvider, signal: WebhookSignal,
): Promise<PaymentSignalOutcome> {
  if (signal.kind === 'ignored') return 'ignored';
  const checkout = await checkoutOfSignal(db, provider, signal);
  if (checkout === null) {
    logger.warn('Signed provider event for an unknown checkout', { provider: provider.id, signal: signal.kind });
    return 'unknown';
  }
  if (signal.kind === 'authorized-source') {
    await provider.captureAuthorizedSource(checkoutSubjectOf(checkout), signal.sourceToken);
  }
  return syncCheckoutSettlement(db, provider, checkout);
}
