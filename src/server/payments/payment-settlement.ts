import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ εκτελεστής** κάθε κίνησης κρατημένων χρημάτων marketplace — αποδέσμευση στον δικαιούχο,
 *   επιστροφή στον πληρωτή, ή διαίρεση (ADR-943 Φ5 · Ζ-6 · Ζ-7)
 * @description Κάθε κίνηση γράφεται **πρώτα** ως εντολή στη συνεδρία (`marketplace.settlement`: τελικά ποσά, λόγος, από
 *   πότε) και μετά εκτελείται — αμέσως από τον καλούντα **και** από το cron (`sweepDueSettlements`). Βλάβη ανάμεσα σε
 *   απόφαση και χρήματα ⇒ η εντολή μένει, το επόμενο πέρασμα την ολοκληρώνει. Καμία κίνηση δεν χάνεται σιωπηλά.
 *
 *   🔑 **Σειρά**: αντιλογισμός της μεταφοράς (όσα επιστρέφονται) → επιστροφή στον πληρωτή → αποδέσμευση του υπολοίπου.
 *      Η επιστροφή **δεν** αντιλογίζει μόνη της τη μεταφορά ([Stripe Connect](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes)),
 *      και ο πάροχος επιστρέφει μόνο ανεκκαθάριστη split πληρωμή (ADR-943 §8 #4).
 *   🔑 **Δηλωτικές πράξεις** (`MarketplaceCapability`): «συνολικά αντιλογισμένα Χ», «συνολικά επιστραμμένα Χ», «η μεταφορά
 *      ελεύθερη» — η επανάληψη μετά από timeout δεν κινεί χρήματα δεύτερη φορά. Ταυτόχρονοι καλούντες ⇒ η ΜΙΑ μίσθωση.
 *   🔑 **Ο τομέας ρωτιέται ξανά πριν από τα χρήματα** (`judgePayableSettlement`): μια εντολή αυτόματης αποδέσμευσης που
 *      γράφτηκε στην αυτοψία ακυρώνεται αν στο μεταξύ ήρθε αντίρρηση — η εντολή είναι πρόθεση, ο τομέας η αλήθεια.
 *   🔑 **Η αλήθεια καταγράφεται από τον πάροχο**: η αποδέσμευση με την αναφορά της μεταφοράς· η επιστροφή από τον ΙΔΙΟ
 *      συγχρονισμό που διαβάζει τις επιστροφές στο API (Κ-8).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { generatePaymentTransferLeaseHolderId } from '@/services/enterprise-id.service';

import { judgePayableSettlement, recordPayableSettlement } from './payable-subject-registry';
import { claimCheckoutLease, releaseCheckoutLease } from './payment-checkout-lease';
import {
  checkoutRecordOf,
  listCheckoutsWithDueSettlement,
  type CheckoutSettlementOrder,
  type PaymentCheckoutRecord,
} from './payment-checkout-store';
import type { MarketplaceCapability } from './payment-marketplace';
import type { PaymentProvider } from './payment-provider';

const logger = createModuleLogger('PaymentSettlement');

export type ScheduleOutcome =
  /** Η εντολή γράφτηκε (νέα ή αντικατάσταση της προηγούμενης). */
  | 'scheduled'
  /** Η ίδια εντολή υπήρχε ήδη. */
  | 'unchanged'
  /** Κίνηση σε εξέλιξη (ζωντανή μίσθωση) — ο καλών ξαναδοκιμάζει. */
  | 'busy'
  /** Δεν υπάρχει / δεν είναι marketplace / τα ποσά δεν καλύπτουν ακριβώς τη συνεδρία. */
  | 'refused';

function sameOrder(a: CheckoutSettlementOrder, b: CheckoutSettlementOrder): boolean {
  return a.refundMinor === b.refundMinor && a.releaseMinor === b.releaseMinor && a.basis === b.basis && a.dueAt === b.dueAt;
}

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
    if (marketplace.settlement !== null && sameOrder(marketplace.settlement, order)) return 'unchanged';
    if (marketplace.lease !== null && Date.parse(marketplace.lease.until) > nowMs) return 'busy';
    tx.update(ref, { 'marketplace.settlement': order, updatedAt: new Date(nowMs).toISOString() });
    return 'scheduled';
  });
}

export type SettlementOutcome =
  /** Τα χρήματα κινήθηκαν όπως λέει η εντολή· η εντολή έσβησε. */
  | 'settled'
  /** Ο τομέας είπε «όχι πια» (π.χ. αντίρρηση) — η εντολή έσβησε χωρίς κίνηση. */
  | 'voided'
  /** Ο τομέας δεν μπορεί να κριθεί τώρα (π.χ. η ανάθεση δεν βρέθηκε) — η εντολή μένει, θέλει άνθρωπο. */
  | 'held'
  /** Δεν υπάρχει εντολή · δεν ήρθε η ώρα της · η μεταφορά δεν έγινε ακόμη · άλλος κρατά τη μίσθωση · όχι marketplace. */
  | 'nothing' | 'not-due' | 'awaiting-transfer' | 'busy' | 'not-applicable';

type Declined = 'nothing' | 'not-due' | 'awaiting-transfer';

function readinessOf(checkout: PaymentCheckoutRecord, nowMs: number): Declined | null {
  const marketplace = checkout.marketplace;
  if (marketplace === null || marketplace.settlement === null) return 'nothing';
  if (Date.parse(marketplace.settlement.dueAt) > nowMs) return 'not-due';
  return marketplace.transferReference === null || checkout.paymentReference === null ? 'awaiting-transfer' : null;
}

/** Οι κινήσεις στον πάροχο — δηλωτικές, με τη σειρά της κεφαλίδας. Σφάλμα ⇒ ρίχνει (η εντολή μένει). */
async function moveMoney(
  marketplace: MarketplaceCapability, checkout: PaymentCheckoutRecord, order: CheckoutSettlementOrder,
  transferReference: string, paymentReference: string,
): Promise<void> {
  const transfer = await marketplace.readTransfer(transferReference);
  if (transfer.amountMinor !== checkout.amountMinor) throw new Error('Transfer amount differs from the checkout — needs a human');
  if (order.refundMinor > 0) {
    if (transfer.paidOut && transfer.reversedMinor < order.refundMinor) throw new Error('Transfer already paid out — reversal needs a human');
    await marketplace.reconcileTransferReversal({ transferReference, reversedTotalMinor: order.refundMinor, description: checkout.checkoutId });
    await marketplace.reconcilePaymentRefund({ paymentReference, refundedTotalMinor: order.refundMinor });
  }
  if (order.releaseMinor > 0) await marketplace.releaseTransfer(transferReference);
}

/** Η εκτέλεση μίας εντολής κάτω από τη μίσθωση: ο τομέας κρίνει, τα χρήματα κινούνται, η αλήθεια γράφεται, η εντολή σβήνει. */
async function settleUnderLease(db: Firestore, provider: PaymentProvider, marketplace: MarketplaceCapability, checkout: PaymentCheckoutRecord, holder: string, nowMs: number): Promise<SettlementOutcome> {
  const order = checkout.marketplace?.settlement ?? null;
  const transferReference = checkout.marketplace?.transferReference ?? null;
  if (order === null || transferReference === null || checkout.paymentReference === null) throw new Error('claimed settlement without order');
  const judgement = await judgePayableSettlement(checkout, order, new Date(nowMs));
  if (judgement === 'hold') {
    await releaseCheckoutLease(db, checkout.checkoutId, holder, nowISO());
    return 'held';
  }
  if (judgement === 'proceed') {
    await moveMoney(marketplace, checkout, order, transferReference, checkout.paymentReference);
    await recordPayableSettlement(checkout, order, provider, transferReference);
  }
  await releaseCheckoutLease(db, checkout.checkoutId, holder, nowISO(), { 'marketplace.settlement': null });
  logger.info('Settlement finished', { checkoutId: checkout.checkoutId, basis: order.basis, judgement });
  return judgement === 'proceed' ? 'settled' : 'voided';
}

/**
 * **Εκτελεί την εντολή** διακανονισμού της συνεδρίας, αν οφείλεται. Ιδεμποτικό, ασφαλές σε ταυτόχρονους καλούντες.
 * Σφάλμα παρόχου/βάσης ⇒ ρίχνει· η εντολή μένει γραμμένη και το cron ξαναδοκιμάζει.
 */
export async function executeSettlement(db: Firestore, provider: PaymentProvider, checkoutId: string, nowMs: number): Promise<SettlementOutcome> {
  const marketplace = provider.marketplace;
  if (marketplace === null) return 'not-applicable';
  const holder = generatePaymentTransferLeaseHolderId();
  const claim = await claimCheckoutLease<Declined>(db, checkoutId, holder, nowMs, (checkout) => {
    const declined = readinessOf(checkout, nowMs);
    return declined === null ? { proceed: true, patch: {} } : { proceed: false, result: declined };
  });
  if (claim.kind === 'declined') return claim.result;
  if (claim.kind !== 'claimed') return claim.kind;
  try {
    return await settleUnderLease(db, provider, marketplace, claim.checkout, holder, nowMs);
  } catch (error) {
    await releaseCheckoutLease(db, checkoutId, holder, nowISO()).catch(() => undefined);
    throw error;
  }
}

/** Ανά πέρασμα — ό,τι μένει, το παίρνει το επόμενο. */
const SETTLEMENT_SWEEP_BATCH = 50;

export interface SettlementSweepReport {
  readonly considered: number;
  readonly settled: number;
  readonly voided: number;
  /** Περιμένουν άνθρωπο, μεταφορά, ή άλλον κάτοχο μίσθωσης. */
  readonly waiting: number;
  readonly failed: number;
  readonly truncated: boolean;
}

type ProviderLookup = (id: PaymentCheckoutRecord['provider']) => PaymentProvider | null;
type SweepVerdict = 'settled' | 'voided' | 'waiting' | 'failed';

async function sweepOne(db: Firestore, checkout: PaymentCheckoutRecord, providerOf: ProviderLookup, nowMs: number): Promise<SweepVerdict> {
  const provider = providerOf(checkout.provider);
  if (provider === null) return 'failed';
  try {
    const outcome = await executeSettlement(db, provider, checkout.checkoutId, nowMs);
    return outcome === 'settled' || outcome === 'voided' ? outcome : outcome === 'not-applicable' ? 'failed' : 'waiting';
  } catch (error) {
    logger.error('Settlement sweep failed — next pass retries', {
      checkoutId: checkout.checkoutId, error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}

/** **Το cron** — κάθε εντολή που οφείλεται τώρα (αυτόματη αποδέσμευση στο τέλος του παραθύρου · εντολή που διακόπηκε). */
export async function sweepDueSettlements(db: Firestore, providerOf: ProviderLookup, nowMs: number): Promise<SettlementSweepReport> {
  const due = await listCheckoutsWithDueSettlement(db, new Date(nowMs).toISOString(), SETTLEMENT_SWEEP_BATCH);
  const tally: Record<SweepVerdict, number> = { settled: 0, voided: 0, waiting: 0, failed: 0 };
  for (const checkout of due) tally[await sweepOne(db, checkout, providerOf, nowMs)] += 1;
  return { considered: due.length, ...tally, truncated: due.length === SETTLEMENT_SWEEP_BATCH };
}
