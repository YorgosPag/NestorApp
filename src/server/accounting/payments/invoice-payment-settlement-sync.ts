import 'server-only';

/**
 * @fileoverview Συγχρονισμός συνεδρίας πληρωμής με την **αλήθεια του παρόχου** (ADR-ACC-030 §2.1 · §5 · ADR-943 §5.6)
 * @description Η ΜΙΑ διαδρομή από «ο πάροχος λέει» σε «το πληρωτέο αντικείμενο πληρώθηκε», για **κάθε** είδος. Την
 *   καλούν το webhook (σήμα) και η συμφιλίωση cron (δίχτυ ασφαλείας) — με το **ίδιο** αποτέλεσμα, όσες φορές κι αν τρέξει:
 *
 *   1. `provider.readSettlement` — διαβάζει από το API, **ποτέ** από το payload του webhook.
 *   2. Κάθε κίνηση (πληρωμή + επιστροφές) ⇒ ο γραφέας του είδους από το μητρώο (`recordPayableMovement`· τιμολόγιο:
 *      `recordInvoicePayment` με **ντετερμινιστικό** `paymentId` `πάροχος:είδος:αναφορά`): δεύτερη εκτέλεση =
 *      `duplicate`, καμία διπλή εγγραφή.
 *   3. Η συνεδρία σημειώνεται `paid` + `paymentReference` (δένει τις μελλοντικές επιστροφές), ή `expired` /
 *      `canceled` / `failed` όταν ο πάροχος την έκλεισε.
 *
 *   🔴 Καταγράφει **ανεξάρτητα** από την κατάσταση της συνεδρίας: πληρωμή που ήρθε σε `canceled` / `expired`
 *   συνεδρία (π.χ. IRIS που ολοκληρώθηκε στην τράπεζα αργότερα) **είναι** χρήματα που μπήκαν — καταγράφονται.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { recordPayableMovement } from '@/server/payments/payable-subject-registry';
import type { CheckoutSettlement, PaymentProvider, ProviderMovement } from '@/server/payments/payment-provider';
import {
  checkoutSubjectOf,
  updatePaymentCheckout,
  type PaymentCheckoutRecord,
} from '@/server/payments/payment-checkout-store';

const logger = createModuleLogger('InvoicePaymentSettlementSync');

export type CheckoutSyncOutcome =
  /** Νέα κίνηση καταγράφηκε. */
  | 'recorded'
  /** Όλες οι κινήσεις υπήρχαν ήδη. */
  | 'unchanged'
  /** Ο πάροχος δεν έχει εισπράξει ακόμη. */
  | 'open'
  /** Ο πάροχος έκλεισε τη συνεδρία χωρίς είσπραξη. */
  | 'closed'
  /** Χρήματα για πληρωτέο αντικείμενο που δεν βρέθηκε — χρειάζεται άνθρωπο (ο handler το καταγράφει ως σφάλμα). */
  | 'subject-absent';

/**
 * Οι κινήσεις σε **χρονολογική** σειρά (η πληρωμή πριν από τις επιστροφές της σε ισοπαλία). Ο πάροχος τις δίνει
 * νεότερες πρώτες· το ίχνος (`PAYMENT_RECORDED` / `PAYMENT_REFUNDED`) πρέπει να διαβάζεται όπως έγιναν. Στιγμή που
 * δεν διαβάζεται πάει στο τέλος, χωρίς να ανακατέψει τις υπόλοιπες.
 */
export function chronologicalMovements(movements: readonly ProviderMovement[]): ProviderMovement[] {
  const instantOf = (movement: ProviderMovement): number => {
    const ms = Date.parse(movement.occurredAt);
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
  };
  const kindRank = (movement: ProviderMovement): number => (movement.kind === 'payment' ? 0 : 1);
  return [...movements].sort((a, b) => (instantOf(a) - instantOf(b)) || (kindRank(a) - kindRank(b)));
}

/** Περνά κάθε κίνηση από τον ΕΝΑ γραφέα του είδους, χρονολογικά. Αντικείμενο που λείπει ⇒ σταματά (θέλει άνθρωπο). */
async function recordMovements(
  provider: PaymentProvider, checkout: PaymentCheckoutRecord, movements: readonly ProviderMovement[],
): Promise<CheckoutSyncOutcome> {
  let recorded = false;
  for (const movement of chronologicalMovements(movements)) {
    const outcome = await recordPayableMovement(checkout, movement, provider);
    if (outcome === 'subject-absent') return 'subject-absent';
    recorded = recorded || outcome === 'recorded';
  }
  return recorded ? 'recorded' : 'unchanged';
}

async function applySettlement(
  db: Firestore, provider: PaymentProvider, checkout: PaymentCheckoutRecord, settlement: CheckoutSettlement,
): Promise<CheckoutSyncOutcome> {
  const now = nowISO();
  if (settlement.state === 'open') return 'open';
  if (settlement.state === 'closed') {
    if (checkout.status === 'pending') await updatePaymentCheckout(db, checkout.checkoutId, { status: settlement.reason }, now);
    return 'closed';
  }
  const charged = settlement.movements.find((movement) => movement.kind === 'payment');
  if (charged && charged.amountMinor !== checkout.amountMinor) {
    // Καταγράφεται η ΑΛΗΘΕΙΑ του παρόχου (τα χρήματα που μπήκαν)· η απόκλιση θέλει μάτι ανθρώπου.
    logger.warn('Provider charged a different amount than the checkout', {
      checkoutId: checkout.checkoutId, expectedMinor: checkout.amountMinor, chargedMinor: charged.amountMinor,
    });
  }
  const outcome = await recordMovements(provider, checkout, settlement.movements);
  if (checkout.status !== 'paid' || checkout.paymentReference !== settlement.paymentReference) {
    await updatePaymentCheckout(db, checkout.checkoutId, { status: 'paid', paymentReference: settlement.paymentReference }, now);
  }
  return outcome;
}

/** Διαβάζει την αλήθεια του παρόχου για τη συνεδρία και την καταγράφει. Ιδεμποτικό. Σφάλμα δικτύου/βάσης ⇒ ρίχνει. */
export async function syncCheckoutSettlement(
  db: Firestore, provider: PaymentProvider, checkout: PaymentCheckoutRecord,
): Promise<CheckoutSyncOutcome> {
  const settlement = await provider.readSettlement(checkoutSubjectOf(checkout));
  return applySettlement(db, provider, checkout, settlement);
}
