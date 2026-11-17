import 'server-only';

/**
 * @fileoverview **Η μίσθωση χρημάτων** μιας συνεδρίας marketplace — το ΕΝΑ κλείδωμα για κάθε κίνηση προς τον πάροχο
 *   (κρατημένη μεταφορά ADR-943 §5.9 · διακανονισμός Φ5 Ζ-6)
 * @description Οι πράξεις του παρόχου είναι **δηλωτικές** (ιδεμποτικές **διαδοχικά**), όχι ασφαλείς σε **ταυτόχρονους**
 *   καλούντες (webhook + cron + επιστροφή browser + πράξη ανθρώπου την ίδια στιγμή). Μόνο ο κάτοχος ζωντανής μίσθωσης
 *   μιλά στον πάροχο για τη συνεδρία· μίσθωση που έληξε (κατάρρευση) την παίρνει ο επόμενος, και η δηλωτική πράξη κάνει
 *   τη δεύτερη απόπειρα ασφαλή. **Ένα** πεδίο μίσθωσης ανά συνεδρία: μεταφορά και διακανονισμός δεν τρέχουν ποτέ μαζί.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';

import { checkoutRecordOf, type CheckoutMarketplace, type PaymentCheckoutRecord } from './payment-checkout-store';

/** Πόσο ζει η μίσθωση: πολύ πάνω από λίγες κλήσεις στον πάροχο, αρκετά λίγο ώστε η κατάρρευση να ξεπερνιέται γρήγορα. */
export const CHECKOUT_LEASE_MS = 2 * 60 * 1000;

function checkoutRef(db: Firestore, checkoutId: string) {
  return db.collection(COLLECTIONS.ACCOUNTING_PAYMENT_CHECKOUTS).doc(checkoutId);
}

/** Η κρίση του καλούντος **μέσα** στη συναλλαγή: προχώρα (με επιπλέον πεδία στην ίδια γραφή) ή σταμάτα με αποτέλεσμα. */
export type LeaseDecision<R> =
  | { readonly proceed: true; readonly patch: Readonly<Record<string, unknown>> }
  | { readonly proceed: false; readonly result: R };

export type LeaseClaim<R> =
  | { readonly kind: 'claimed'; readonly checkout: PaymentCheckoutRecord; readonly marketplace: CheckoutMarketplace }
  | { readonly kind: 'declined'; readonly result: R }
  /** Άλλος καλών κρατά ζωντανή μίσθωση — θα ολοκληρώσει εκείνος (ή ο επόμενος μετά τη λήξη). */
  | { readonly kind: 'busy' }
  /** Η συνεδρία δεν υπάρχει / δεν είναι marketplace. */
  | { readonly kind: 'not-applicable' };

/**
 * Συναλλαγή: ανύπαρκτη / όχι marketplace ⇒ `not-applicable`· η κρίση του καλούντος λέει «σταμάτα» ⇒ `declined`· ζωντανή
 * ξένη μίσθωση ⇒ `busy`· αλλιώς μίσθωση **και** τα πεδία του καλούντος στην **ίδια** γραφή (π.χ. η οφειλή).
 */
export function claimCheckoutLease<R>(
  db: Firestore, checkoutId: string, holder: string, nowMs: number,
  decide: (checkout: PaymentCheckoutRecord, marketplace: CheckoutMarketplace) => LeaseDecision<R>,
): Promise<LeaseClaim<R>> {
  const ref = checkoutRef(db, checkoutId);
  return db.runTransaction(async (tx): Promise<LeaseClaim<R>> => {
    const snap = await tx.get(ref);
    const checkout = snap.exists ? checkoutRecordOf(snap.id, snap.data()) : null;
    const marketplace = checkout?.marketplace ?? null;
    if (checkout === null || marketplace === null) return { kind: 'not-applicable' };
    const decision = decide(checkout, marketplace);
    if (!decision.proceed) return { kind: 'declined', result: decision.result };
    if (marketplace.lease !== null && Date.parse(marketplace.lease.until) > nowMs) return { kind: 'busy' };
    const lease = { holder, until: new Date(nowMs + CHECKOUT_LEASE_MS).toISOString() };
    tx.update(ref, { ...decision.patch, 'marketplace.lease': lease, updatedAt: new Date(nowMs).toISOString() });
    return { kind: 'claimed', checkout, marketplace: { ...marketplace, lease } };
  });
}

/**
 * Συναλλαγή: η μίσθωση φεύγει **μόνο** αν είναι ακόμη δική μας — μαζί με τα πεδία ολοκλήρωσης του καλούντος (`patch`,
 * κενό μετά από βλάβη: η οφειλή μένει για το cron). Επιστρέφει αν έγραψε.
 */
export function releaseCheckoutLease(
  db: Firestore, checkoutId: string, holder: string, nowIso: string, patch: Readonly<Record<string, unknown>> = {},
): Promise<boolean> {
  const ref = checkoutRef(db, checkoutId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const lease = snap.exists ? checkoutRecordOf(snap.id, snap.data())?.marketplace?.lease ?? null : null;
    if (lease?.holder !== holder) return false;
    tx.update(ref, { ...patch, 'marketplace.lease': null, updatedAt: nowIso });
    return true;
  });
}
