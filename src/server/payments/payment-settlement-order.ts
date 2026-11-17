import 'server-only';

/**
 * @fileoverview ADR-943 Φ5 (Ζ-6) — **η εγγραφή της εντολής** διακανονισμού στη συνεδρία, πριν από κάθε κίνηση χρημάτων.
 * @description Εξήχθη από τον εκτελεστή (`payment-settlement.ts`) στη Φ5γ: την καλούν και οι handlers του μητρώου (άρνηση
 *   είσπραξης, Θ-6), που ο εκτελεστής ήδη εισάγει — χωριστό αρχείο ⇒ κανένας κύκλος εισαγωγών. Δεν εισάγει **τίποτα** από
 *   το μητρώο ή τον εκτελεστή.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';

import { checkoutRecordOf, sameSettlementOrder, type CheckoutSettlementOrder } from './payment-checkout-store';

export type ScheduleOutcome =
  /** Η εντολή γράφτηκε (νέα ή αντικατάσταση της προηγούμενης). */
  | 'scheduled'
  /** Η ίδια εντολή υπήρχε ήδη. */
  | 'unchanged'
  /** Κίνηση σε εξέλιξη (ζωντανή μίσθωση) — ο καλών ξαναδοκιμάζει. */
  | 'busy'
  /** Δεν υπάρχει / δεν είναι marketplace / τα ποσά δεν καλύπτουν ακριβώς τη συνεδρία. */
  | 'refused';

/**
 * **Γράφει την εντολή** διακανονισμού, πριν από κάθε κίνηση. Ιδεμποτικό. Τα ποσά πρέπει να καλύπτουν **ακριβώς** τη
 * συνεδρία (ό,τι δεν επιστρέφεται, αποδεσμεύεται — κανένα χρήμα «στη μέση»).
 */
export function scheduleSettlement(
  db: Firestore, checkoutId: string, order: CheckoutSettlementOrder, nowMs: number,
): Promise<ScheduleOutcome> {
  const ref = db.collection(COLLECTIONS.ACCOUNTING_PAYMENT_CHECKOUTS).doc(checkoutId);
  return db.runTransaction(async (tx): Promise<ScheduleOutcome> => {
    const snap = await tx.get(ref);
    const checkout = snap.exists ? checkoutRecordOf(snap.id, snap.data()) : null;
    const marketplace = checkout?.marketplace ?? null;
    if (checkout === null || marketplace === null) return 'refused';
    if (order.refundMinor + order.releaseMinor !== checkout.amountMinor) return 'refused';
    if (marketplace.settlement !== null && sameSettlementOrder(marketplace.settlement, order)) return 'unchanged';
    if (marketplace.lease !== null && Date.parse(marketplace.lease.until) > nowMs) return 'busy';
    tx.update(ref, { 'marketplace.settlement': order, updatedAt: new Date(nowMs).toISOString() });
    return 'scheduled';
  });
}
