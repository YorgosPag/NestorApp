import 'server-only';

/**
 * **Το δίχτυ της παράδοσης προσκλήσεων** (ADR-923 §5.13 Τ5): ό,τι δεν πρόλαβε ή δεν πέτυχε η πρώτη απόπειρα στο `after()`.
 *
 * Ένα ερώτημα, ένας δείκτης (`delivery.state` + `delivery.dueAt`):
 * - `pending` που ωρίμασε ⇒ νέα απόπειρα με **νέο** σύνδεσμο (`deliverRfqInvite`, `link: null`).
 * - `sending` με ληγμένη κράτηση ⇒ `unknown`, **χωρίς** αποστολή: η διεργασία πέθανε ανάμεσα στον πάροχο και στην
 *   καταγραφή, και ένα δεύτερο email είναι χειρότερο από μια «Επαναποστολή» που αποφασίζει άνθρωπος.
 *
 * @module subapps/procurement/services/rfq-invite-delivery-sweep
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '@/config/firestore-collections';

import type { VendorInvite } from '../types/vendor-invite';
import {
  INVITE_DELIVERY_POLICY,
  OPEN_INVITE_DELIVERY_STATES,
  unknownInviteDelivery,
} from '../types/vendor-invite-delivery';
import { deliverRfqInvite, type InviteDeliveryOutcome } from './rfq-invite-delivery';

type Db = admin.firestore.Firestore;

export interface RfqInviteDeliverySweepReport {
  scanned: number;
  delivered: number;
  retryLater: number;
  failed: number;
  undeliverable: number;
  unknown: number;
  skipped: number;
}

/** Οι ώριμες ανοιχτές προσκλήσεις, οι παλαιότερες πρώτα. */
function dueInvitesQuery(db: Db, nowMs: number, limit: number) {
  // tenant-scope-exempt: εργάτης ουράς (cron) — σαρώνει το outbox παράδοσης ΟΛΩΝ των μισθωτών εκ σχεδιασμού· κάθε
  // πρόσκληση κρίνεται μετά μόνο με τον δικό της `companyId` (RFQ με φράχτη tenant, επαφή του ίδιου αγοραστή).
  return db.collection(COLLECTIONS.VENDOR_INVITES)
    .where('delivery.state', 'in', [...OPEN_INVITE_DELIVERY_STATES])
    .where('delivery.dueAt', '<=', new Date(nowMs).toISOString())
    .orderBy('delivery.dueAt', 'asc')
    .limit(limit);
}

/** Ληγμένη κράτηση ⇒ `unknown`, μόνο αν τίποτα δεν άλλαξε στο μεταξύ (CAS στις απόπειρες). */
async function expireLease(db: Db, inviteId: string, nowMs: number): Promise<boolean> {
  const ref = db.collection(COLLECTIONS.VENDOR_INVITES).doc(inviteId);
  return db.runTransaction(async (tx) => {
    const delivery = ((await tx.get(ref)).data() as VendorInvite | undefined)?.delivery;
    if (delivery?.state !== 'sending' || delivery.dueAt === null || Date.parse(delivery.dueAt) > nowMs) return false;
    tx.update(ref, { delivery: unknownInviteDelivery(delivery, nowMs), updatedAt: admin.firestore.Timestamp.fromMillis(nowMs) });
    return true;
  });
}

function tally(report: RfqInviteDeliverySweepReport, outcome: InviteDeliveryOutcome): void {
  if (outcome === 'delivered') report.delivered += 1;
  else if (outcome === 'pending') report.retryLater += 1;
  else if (outcome === 'failed') report.failed += 1;
  else if (outcome === 'undeliverable') report.undeliverable += 1;
  else if (outcome === 'unknown') report.unknown += 1;
  else report.skipped += 1;
}

/** Μία εκτέλεση της σάρωσης. Σειριακά, για να μη χτυπά τον πάροχο σε ριπή. */
export async function runRfqInviteDeliverySweep(db: Db, nowMs: number = Date.now()): Promise<RfqInviteDeliverySweepReport> {
  const report: RfqInviteDeliverySweepReport = { scanned: 0, delivered: 0, retryLater: 0, failed: 0, undeliverable: 0, unknown: 0, skipped: 0 };
  const snap = await dueInvitesQuery(db, nowMs, INVITE_DELIVERY_POLICY.sweepLimit).get();
  for (const doc of snap.docs) {
    report.scanned += 1;
    const state = (doc.data() as VendorInvite).delivery?.state;
    if (state === 'sending') tally(report, (await expireLease(db, doc.id, nowMs)) ? 'unknown' : 'skipped');
    else tally(report, await deliverRfqInvite({ inviteId: doc.id, link: null }, nowMs));
  }
  return report;
}
