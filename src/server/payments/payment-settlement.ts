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
 *   🔑 Φ5γ (Θ-2) — **η εντολή συγκλίνει στον τομέα**: κρίση `reschedule` ⇒ η εντολή ξαναγράφεται υπό την ίδια μίσθωση και
 *      (αν οφείλεται ήδη) εκτελείται στο ίδιο κάλεσμα.
 *   🔑 Φ6α (§5.14) — **αποδέσμευση μόνο σε ταυτοποιημένο δικαιούχο** (Stripe Connect `payouts_enabled`): πριν από την
 *      αποδέσμευση ρωτιέται ο ΕΝΑΣ κριτής (`payeePayoutsOpen`). Όχι ⇒ οι **επιστροφές** της εντολής γίνονται κανονικά (ο
 *      ιδιοκτήτης δεν περιμένει ποτέ το KYC του μηχανικού), η αποδέσμευση **περιμένει**, η εντολή μένει (`awaiting-payee`).
 *      Οι πράξεις είναι δηλωτικές ⇒ στο επόμενο πέρασμα οι επιστροφές είναι ήδη στον στόχο (καμία κίνηση) και γίνεται μόνο
 *      η αποδέσμευση. Ξύπνημα: το webhook KYC `verified` (αμέσως) **και** το cron (δίχτυ).
 *   🔑 Φ5γ (Θ-6) — **επιστροφή χωρίς μεταφορά**: χρήματα που ο τομέας δεν δέχτηκε δεν απέκτησαν ποτέ μεταφορά· επιστρέφονται
 *      ολόκληρα κατευθείαν, **μόνο** αν καμία μεταφορά δεν είναι καν οφειλόμενη (`transferDue`) — αλλιώς περιμένουμε τη
 *      μεταφορά και ακολουθούμε τη σειρά αντιλογισμός → επιστροφή.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { generatePaymentTransferLeaseHolderId } from '@/services/enterprise-id.service';

import { judgePayableSettlement, recordPayableSettlement } from './payable-subject-registry';
import { claimCheckoutLease, releaseCheckoutLease } from './payment-checkout-lease';
import {
  listCheckoutsWithDueSettlement,
  type CheckoutMarketplace,
  type CheckoutSettlementOrder,
  type PaymentCheckoutRecord,
} from './payment-checkout-store';
import type { MarketplaceCapability } from './payment-marketplace';
import { payeePayoutsOpen } from './payment-payee-service';
import type { PaymentProvider } from './payment-provider';

const logger = createModuleLogger('PaymentSettlement');

export type SettlementOutcome =
  /** Τα χρήματα κινήθηκαν όπως λέει η εντολή· η εντολή έσβησε. */
  | 'settled'
  /** Ο τομέας είπε «όχι πια» (π.χ. αντίρρηση) — η εντολή έσβησε χωρίς κίνηση. */
  | 'voided'
  /** Ο τομέας δεν μπορεί να κριθεί τώρα (π.χ. η ανάθεση δεν βρέθηκε) — η εντολή μένει, θέλει άνθρωπο. */
  | 'held'
  /** Φ5γ — ο τομέας ζήτησε άλλη εντολή· γράφτηκε, και δεν οφείλεται ακόμη (ή περιμένει μεταφορά). */
  | 'rescheduled'
  /** Φ6α — οι επιστροφές έγιναν· η αποδέσμευση περιμένει την ταυτοποίηση του δικαιούχου. Η εντολή μένει. */
  | 'awaiting-payee'
  /** Δεν υπάρχει εντολή · δεν ήρθε η ώρα της · η μεταφορά δεν έγινε ακόμη · άλλος κρατά τη μίσθωση · όχι marketplace. */
  | 'nothing' | 'not-due' | 'awaiting-transfer' | 'busy' | 'not-applicable';

type Declined = 'nothing' | 'not-due' | 'awaiting-transfer';

/** Θ-6 — επιστροφή χωρίς μεταφορά: τίποτα δεν αποδεσμεύεται και καμία μεταφορά δεν δημιουργήθηκε ούτε οφείλεται. */
function isRefundWithoutTransfer(marketplace: CheckoutMarketplace, order: CheckoutSettlementOrder): boolean {
  return marketplace.transferReference === null && !marketplace.transferDue && order.releaseMinor === 0;
}

function readinessOf(checkout: PaymentCheckoutRecord, nowMs: number): Declined | null {
  const marketplace = checkout.marketplace;
  if (marketplace === null || marketplace.settlement === null) return 'nothing';
  if (Date.parse(marketplace.settlement.dueAt) > nowMs) return 'not-due';
  if (checkout.paymentReference === null) return 'awaiting-transfer';
  const ready = marketplace.transferReference !== null || isRefundWithoutTransfer(marketplace, marketplace.settlement);
  return ready ? null : 'awaiting-transfer';
}

/** Οι κινήσεις στον πάροχο — δηλωτικές, με τη σειρά της κεφαλίδας. Σφάλμα ⇒ ρίχνει (η εντολή μένει). */
async function moveMoney(
  marketplace: MarketplaceCapability, checkout: PaymentCheckoutRecord, order: CheckoutSettlementOrder,
  transferReference: string | null, paymentReference: string, releaseAllowed: boolean,
): Promise<void> {
  if (transferReference === null) {
    // Θ-6 — καμία μεταφορά δεν υπάρχει ούτε οφείλεται: η πληρωμή είναι ανεκκαθάριστη, επιστρέφεται κατευθείαν.
    await marketplace.reconcilePaymentRefund({ paymentReference, refundedTotalMinor: order.refundMinor });
    return;
  }
  const transfer = await marketplace.readTransfer(transferReference);
  if (transfer.amountMinor !== checkout.amountMinor) throw new Error('Transfer amount differs from the checkout — needs a human');
  if (order.refundMinor > 0) {
    if (transfer.paidOut && transfer.reversedMinor < order.refundMinor) throw new Error('Transfer already paid out — reversal needs a human');
    await marketplace.reconcileTransferReversal({ transferReference, reversedTotalMinor: order.refundMinor, description: checkout.checkoutId });
    await marketplace.reconcilePaymentRefund({ paymentReference, refundedTotalMinor: order.refundMinor });
  }
  if (order.releaseMinor > 0 && releaseAllowed) await marketplace.releaseTransfer(transferReference);
}

/** Φ6α — επιτρέπεται η αποδέσμευση της εντολής; Χωρίς αποδέσμευση ⇒ ναι (καμία ερώτηση στον πάροχο). */
async function releaseAllowedFor(db: Firestore, provider: PaymentProvider, checkout: PaymentCheckoutRecord, order: CheckoutSettlementOrder): Promise<boolean> {
  const payeeReference = checkout.marketplace?.payeeReference ?? null;
  if (order.releaseMinor === 0) return true;
  return payeeReference !== null && payeePayoutsOpen(db, provider, payeeReference);
}

/** Η εκτέλεση μίας εντολής κάτω από τη μίσθωση: ο τομέας κρίνει, τα χρήματα κινούνται, η αλήθεια γράφεται, η εντολή σβήνει. */
async function settleUnderLease(db: Firestore, provider: PaymentProvider, marketplace: MarketplaceCapability, checkout: PaymentCheckoutRecord, holder: string, nowMs: number): Promise<SettlementOutcome> {
  const order = checkout.marketplace?.settlement ?? null;
  const transferReference = checkout.marketplace?.transferReference ?? null;
  if (order === null || checkout.paymentReference === null) throw new Error('claimed settlement without order');
  const judgement = await judgePayableSettlement(checkout, order, new Date(nowMs));
  if (judgement === 'hold') {
    await releaseCheckoutLease(db, checkout.checkoutId, holder, nowISO());
    return 'held';
  }
  if (typeof judgement === 'object') return rescheduleUnderLease(db, checkout, holder, judgement.reschedule);
  if (judgement === 'proceed') {
    const releaseAllowed = await releaseAllowedFor(db, provider, checkout, order);
    await moveMoney(marketplace, checkout, order, transferReference, checkout.paymentReference, releaseAllowed);
    if (!releaseAllowed) {
      await releaseCheckoutLease(db, checkout.checkoutId, holder, nowISO());
      logger.info('Release awaits payee verification', { checkoutId: checkout.checkoutId, basis: order.basis });
      return 'awaiting-payee';
    }
    await recordPayableSettlement(checkout, order, provider, transferReference);
  }
  await releaseCheckoutLease(db, checkout.checkoutId, holder, nowISO(), { 'marketplace.settlement': null });
  logger.info('Settlement finished', { checkoutId: checkout.checkoutId, basis: order.basis, judgement });
  return judgement === 'proceed' ? 'settled' : 'voided';
}

/** Θ-2 — η εντολή ξαναγράφεται με ό,τι λέει ο τομέας (πάντα να καλύπτει ακριβώς τη συνεδρία), και η μίσθωση φεύγει. */
async function rescheduleUnderLease(db: Firestore, checkout: PaymentCheckoutRecord, holder: string, next: CheckoutSettlementOrder): Promise<SettlementOutcome> {
  if (next.refundMinor + next.releaseMinor !== checkout.amountMinor) {
    logger.error('Domain asked for a settlement that does not cover the checkout — needs a human', { checkoutId: checkout.checkoutId, basis: next.basis });
    await releaseCheckoutLease(db, checkout.checkoutId, holder, nowISO());
    return 'held';
  }
  await releaseCheckoutLease(db, checkout.checkoutId, holder, nowISO(), { 'marketplace.settlement': next });
  logger.info('Settlement rescheduled by the domain', { checkoutId: checkout.checkoutId, basis: next.basis, dueAt: next.dueAt });
  return 'rescheduled';
}

/**
 * **Εκτελεί την εντολή** διακανονισμού της συνεδρίας, αν οφείλεται. Ιδεμποτικό, ασφαλές σε ταυτόχρονους καλούντες.
 * Σφάλμα παρόχου/βάσης ⇒ ρίχνει· η εντολή μένει γραμμένη και το cron ξαναδοκιμάζει. Εντολή που ο τομέας ξαναέγραψε (Θ-2)
 * εκτελείται στο ίδιο κάλεσμα αν οφείλεται ήδη — **μία** φορά (καμία ανακύκλωση).
 */
export async function executeSettlement(db: Firestore, provider: PaymentProvider, checkoutId: string, nowMs: number): Promise<SettlementOutcome> {
  const outcome = await executeSettlementOnce(db, provider, checkoutId, nowMs);
  if (outcome !== 'rescheduled') return outcome;
  const again = await executeSettlementOnce(db, provider, checkoutId, nowMs);
  return again === 'not-due' || again === 'awaiting-transfer' ? 'rescheduled' : again;
}

async function executeSettlementOnce(db: Firestore, provider: PaymentProvider, checkoutId: string, nowMs: number): Promise<SettlementOutcome> {
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

/**
 * Φ6α (§5.14) — **ταυτοποιήθηκε δικαιούχος** ⇒ οι αποδεσμεύσεις που περίμεναν (`awaiting-payee`) εκτελούνται **τώρα**,
 * όχι στον επόμενο κύκλο του cron. Δεν μπλοκάρει την απάντηση του webhook (ο πάροχος θέλει γρήγορο 200)· σφάλμα ⇒
 * καταγραφή, και το cron (δίχτυ ασφαλείας) τις παίρνει στο επόμενο πέρασμα. Ιδεμποτικό όπως κάθε εκτέλεση εντολής.
 */
export function wakeSettlementsAfterPayeeVerified(db: Firestore, provider: PaymentProvider, nowMs: number): void {
  const providerOf: ProviderLookup = (id) => (id === provider.id ? provider : null);
  void sweepDueSettlements(db, providerOf, nowMs).catch((error: unknown) => {
    logger.error('Settlement wake-up after payee verification failed — cron retries', {
      provider: provider.id, error: error instanceof Error ? error.message : String(error),
    });
  });
}
