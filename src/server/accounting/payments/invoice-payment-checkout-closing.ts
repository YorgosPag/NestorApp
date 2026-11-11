import 'server-only';

/**
 * @fileoverview Κλείσιμο ανοιχτών συνεδριών πληρωμής ενός συνδέσμου (ADR-ACC-030 §5)
 * @description Όταν ο πελάτης ξεκινά **νέα** πληρωμή, οι προηγούμενες ανοιχτές του ίδιου συνδέσμου ακυρώνονται στον
 *   πάροχο και σημειώνονται `canceled`. Αλλιώς μια ξεχασμένη καρτέλα κάρτας θα μπορούσε να πληρωθεί **αφού** ο
 *   πελάτης πλήρωσε ήδη με IRIS — διπλή είσπραξη (Stripe: ένα ενεργό Checkout Session ανά απόπειρα).
 *
 *   Αν ο πάροχος δεν μπορεί να εγγυηθεί την ακύρωση (IRIS σε εξέλιξη, ήδη πληρωμένη) ή αποτύχει, η συνεδρία **μένει** ανοιχτή: αν πληρωθεί, το webhook / η συμφιλίωση την
 *   καταγράφουν κανονικά (υπερπληρωμή ⇒ «εξοφλημένο», το πλεόνασμα επιστρέφεται από τον άνθρωπο). Ποτέ δεν
 *   σημειώνουμε «ακυρώθηκε» κάτι που ο πάροχος μπορεί ακόμη να χρεώσει.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import type { PaymentProvider } from '@/server/payments/payment-provider';
import {
  checkoutSubjectOf,
  listPendingCheckoutsOfShare,
  updatePaymentCheckout,
} from '@/server/payments/payment-checkout-store';

const logger = createModuleLogger('InvoicePaymentCheckoutClosing');

export async function closePendingCheckoutsOfShare(db: Firestore, provider: PaymentProvider, shareId: string): Promise<void> {
  const pending = await listPendingCheckoutsOfShare(db, shareId);
  for (const checkout of pending.filter((record) => record.provider === provider.id)) {
    try {
      if (await provider.cancelCheckout(checkoutSubjectOf(checkout))) {
        await updatePaymentCheckout(db, checkout.checkoutId, { status: 'canceled' }, nowISO());
      }
    } catch (error) {
      logger.warn('Previous checkout could not be cancelled at the provider — left open for reconciliation', {
        checkoutId: checkout.checkoutId, error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
