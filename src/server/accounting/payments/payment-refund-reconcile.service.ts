import 'server-only';

/**
 * @fileoverview Συμφιλίωση **επιστροφών** — το δίχτυ για επιστροφή με χαμένο webhook (ADR-ACC-030 §5.5)
 * @description Το πέρασμα των ανοιχτών συνεδριών (`reconcilePendingCheckouts`) δεν βλέπει ποτέ επιστροφή: η
 *   συνεδρία της είναι ήδη `paid`. Εδώ ρωτάμε τον πάροχο «ποιες πληρωμές απέκτησαν επιστροφή πρόσφατα;» (πρότυπο
 *   Stripe / Adyen: συμφιλίωση από τη λίστα κινήσεων του παρόχου, όχι από τη δική μας κατάσταση) και κάθε μία που
 *   ανήκει σε δική μας συνεδρία περνά από τον **ίδιο** `syncCheckoutSettlement` με το webhook — ιδεμποτικά: ήδη
 *   καταγραμμένη επιστροφή = `unchanged`.
 *
 *   Πληρωμή χωρίς δική μας συνεδρία (π.χ. από άλλο κανάλι του ίδιου λογαριασμού εμπόρου) μετριέται ως
 *   `unmatched` και **δεν** αγγίζεται.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import { PAYMENT_PROVIDER_IDS } from '@/lib/payments/payment-routes';
import { findPaymentCheckoutBy } from '@/server/payments/payment-checkout-store';
import type { PaymentProvider } from '@/server/payments/payment-provider';
import { paymentProviderById } from '@/server/payments/payment-provider-registry';

import { syncCheckoutSettlement } from './invoice-payment-settlement-sync';

const logger = createModuleLogger('PaymentRefundReconcile');

/**
 * Πόσο πίσω κοιτά το πέρασμα. Το cron τρέχει τρεις φορές την ώρα· 3 μέρες καλύπτουν διακοπή του cron (ή του
 * webhook) ενός σαββατοκύριακου, και τη διαφορά ζώνης ώρας του φίλτρου ημέρας του παρόχου.
 */
export const REFUND_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
/** Πληρωμές ανά πάροχο ανά πέρασμα — ό,τι μένει, το παίρνει το επόμενο (σημαία `truncated`). */
export const REFUND_RECONCILE_BATCH = 100;

export interface RefundReconcileReport {
  /** Πληρωμές με πρόσφατη επιστροφή που εξετάστηκαν. */
  readonly checked: number;
  /** Νέα κίνηση καταγράφηκε (η επιστροφή είχε χαθεί). */
  readonly recorded: number;
  /** Πληρωμή χωρίς δική μας συνεδρία. */
  readonly unmatched: number;
  /** Σφάλμα (λίστα του παρόχου ή συγχρονισμός πληρωμής) — το επόμενο πέρασμα ξαναδοκιμάζει. */
  readonly failed: number;
  readonly truncated: boolean;
}

type RefundVerdict = 'recorded' | 'unchanged' | 'unmatched' | 'failed';

async function reconcileRefundedPayment(
  db: Firestore, provider: PaymentProvider, paymentReference: string,
): Promise<RefundVerdict> {
  try {
    const checkout = await findPaymentCheckoutBy(db, provider.id, 'paymentReference', paymentReference);
    if (checkout === null) return 'unmatched';
    const outcome = await syncCheckoutSettlement(db, provider, checkout);
    if (outcome === 'recorded') return 'recorded';
    return outcome === 'invoice-absent' ? 'failed' : 'unchanged';
  } catch (error) {
    logger.error('Refund reconciliation failed — next pass retries', {
      provider: provider.id, paymentReference, error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}

async function recentlyRefundedOf(provider: PaymentProvider, sinceIso: string): Promise<readonly string[] | null> {
  try {
    return await provider.listRecentlyRefundedPayments(sinceIso);
  } catch (error) {
    logger.error('Listing recent refunds failed — next pass retries', {
      provider: provider.id, error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function reconcileRecentRefunds(db: Firestore, nowMs: number): Promise<RefundReconcileReport> {
  const tally: Record<RefundVerdict, number> = { recorded: 0, unchanged: 0, unmatched: 0, failed: 0 };
  let truncated = false;
  let listFailures = 0;
  const sinceIso = new Date(nowMs - REFUND_LOOKBACK_MS).toISOString();
  for (const id of PAYMENT_PROVIDER_IDS) {
    const provider = paymentProviderById(id);
    if (provider === null) continue;
    const references = await recentlyRefundedOf(provider, sinceIso);
    if (references === null) {
      listFailures += 1;
      continue;
    }
    truncated = truncated || references.length > REFUND_RECONCILE_BATCH;
    for (const reference of references.slice(0, REFUND_RECONCILE_BATCH)) {
      tally[await reconcileRefundedPayment(db, provider, reference)] += 1;
    }
  }
  return {
    checked: tally.recorded + tally.unchanged + tally.unmatched + tally.failed,
    recorded: tally.recorded,
    unmatched: tally.unmatched,
    failed: tally.failed + listFailures,
    truncated,
  };
}
