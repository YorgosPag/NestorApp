import 'server-only';

/**
 * @fileoverview Κλείσιμο ανοιχτών συνεδριών πληρωμής της ίδιας εμβέλειας απόπειρας (ADR-ACC-030 §5 · ADR-943 §5.6)
 * @description Όταν ο πελάτης ξεκινά **νέα** πληρωμή, οι προηγούμενες ανοιχτές της ίδιας εμβέλειας (τιμολόγιο: ίδιος
 *   σύνδεσμος — `sameAttemptScope`) ακυρώνονται στον
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

import type { PayableSubject } from './payable-subject';
import { checkoutSubjectOf, listPendingCheckoutsOf, updatePaymentCheckout } from './payment-checkout-store';
import type { PaymentProvider } from './payment-provider';

const logger = createModuleLogger('PaymentCheckoutClosing');

export async function closePendingCheckoutsOf(db: Firestore, provider: PaymentProvider, subject: PayableSubject): Promise<void> {
  const pending = await listPendingCheckoutsOf(db, subject);
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
