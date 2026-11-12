import 'server-only';

/**
 * @fileoverview Συμφιλίωση online πληρωμών — το **δίχτυ ασφαλείας** κάτω από το webhook (ADR-ACC-030 §2.1 · §5)
 * @description Το webhook είναι η κύρια οδός· μπορεί όμως να χαθεί (λάθος ρύθμιση, διακοπή, 503 που ο πάροχος
 *   σταμάτησε να ξαναδοκιμάζει). Εδώ, για κάθε **ανοιχτή** συνεδρία παλαιότερη από 10′, ρωτάμε τον πάροχο και
 *   περνάμε την απάντηση από τον **ίδιο** συγχρονισμό με το webhook (`syncCheckoutSettlement`) — ιδεμποτικά.
 *
 *   Συνεδρία που μένει ανοιχτή στον πάροχο πολύ μετά τη λήξη της κλείνει ως `expired`: η κάρτα αφού ο πάροχος
 *   **εγγυηθεί** την ακύρωση· το IRIS (που δεν ακυρώνεται στον πάροχο) μετά από 24 ώρες χωρίς είσπραξη. Αν
 *   πληρωθεί αργότερα, το webhook την καταγράφει κανονικά — η καταγραφή δεν κοιτά την κατάσταση της συνεδρίας.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import {
  checkoutSubjectOf,
  listStalePendingCheckouts,
  updatePaymentCheckout,
  type PaymentCheckoutRecord,
} from '@/server/payments/payment-checkout-store';
import type { PaymentProvider } from '@/server/payments/payment-provider';
import { paymentProviderById } from '@/server/payments/payment-provider-registry';

import { syncCheckoutSettlement } from './invoice-payment-settlement-sync';

const logger = createModuleLogger('PaymentReconcile');

/** Πόσο περιμένουμε το webhook πριν ρωτήσουμε εμείς. */
const WEBHOOK_GRACE_MS = 10 * 60 * 1000;
/**
 * IRIS: πόσο μετά τη λήξη **που δήλωσε ο πάροχος** (`expiresAt`, §5.5) θεωρούμε ότι η πληρωμή εγκαταλείφθηκε.
 * Παράθυρο ανάκτησης, όχι ζωή της συνεδρίας: η Everypay εγγυάται webhook για τις επιτυχίες χωρίς δηλωμένη
 * πολιτική επαναλήψεων (§5.8 #7), και όσο η συνεδρία είναι `pending` η συμφιλίωση ρωτά τον πάροχο.
 */
const IRIS_ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;
/** Ανά πέρασμα — ό,τι μένει, το παίρνει το επόμενο. */
const RECONCILE_BATCH = 100;

export interface PaymentReconcileReport {
  readonly considered: number;
  readonly recorded: number;
  readonly expired: number;
  readonly stillOpen: number;
  readonly failed: number;
  readonly truncated: boolean;
}

type CheckoutVerdict = 'recorded' | 'expired' | 'open' | 'failed';

/** Ανοιχτή στον πάροχο πολύ μετά τη λήξη ⇒ κλείνει, μόνο αν δεν μπορεί πια να εισπραχθεί. */
async function expireIfAbandoned(
  db: Firestore, provider: PaymentProvider, checkout: PaymentCheckoutRecord, nowMs: number,
): Promise<CheckoutVerdict> {
  const expiresMs = Date.parse(checkout.expiresAt);
  const abandoned = checkout.method === 'iris'
    ? nowMs > expiresMs + IRIS_ABANDON_AFTER_MS
    : nowMs > expiresMs && await provider.cancelCheckout(checkoutSubjectOf(checkout));
  if (!abandoned) return 'open';
  await updatePaymentCheckout(db, checkout.checkoutId, { status: 'expired' }, new Date(nowMs).toISOString());
  return 'expired';
}

async function reconcileOne(db: Firestore, checkout: PaymentCheckoutRecord, nowMs: number): Promise<CheckoutVerdict> {
  const provider = paymentProviderById(checkout.provider);
  if (provider === null) return 'open';
  try {
    const outcome = await syncCheckoutSettlement(db, provider, checkout);
    if (outcome === 'recorded' || outcome === 'unchanged') return 'recorded';
    if (outcome === 'closed') return 'expired';
    if (outcome === 'invoice-absent') return 'failed';
    return expireIfAbandoned(db, provider, checkout, nowMs);
  } catch (error) {
    logger.error('Checkout reconciliation failed — next pass retries', {
      checkoutId: checkout.checkoutId, error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}

export async function reconcilePendingCheckouts(db: Firestore, nowMs: number): Promise<PaymentReconcileReport> {
  const stale = await listStalePendingCheckouts(db, new Date(nowMs - WEBHOOK_GRACE_MS).toISOString(), RECONCILE_BATCH);
  const tally: Record<CheckoutVerdict, number> = { recorded: 0, expired: 0, open: 0, failed: 0 };
  for (const checkout of stale) tally[await reconcileOne(db, checkout, nowMs)] += 1;
  return {
    considered: stale.length,
    recorded: tally.recorded,
    expired: tally.expired,
    stillOpen: tally.open,
    failed: tally.failed,
    truncated: stale.length === RECONCILE_BATCH,
  };
}
