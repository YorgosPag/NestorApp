import 'server-only';

/**
 * @fileoverview **Η κρατημένη μεταφορά** μιας πληρωμής marketplace προς τον δικαιούχο — με **μίσθωση** στη συνεδρία
 *   (ADR-943 §5.9 · Δ-2)
 * @description Μετά την είσπραξη, τα χρήματα του μηχανικού πρέπει να περάσουν **αμέσως** σε μεταφορά προς αυτόν,
 *   **κρατημένη** (`on_hold`) ώσπου να αποδεσμευτεί στην έναρξη (Κ-4): ο πάροχος ζητά τα αμεταβίβαστα να μη μένουν «επ'
 *   αόριστον» ([EveryPay Basic Concepts](https://docs.everypay.gr/marketplace-link/basic-concepts/)).
 *
 *   🔑 **Δύο φραγμοί, ο καθένας για τον δικό του κίνδυνο**:
 *   1. **Διαδοχικές** επαναλήψεις (timeout «έγινε ή όχι;») ⇒ η πράξη του παρόχου είναι **δηλωτική**
 *      (`ensureTransfer`: «υπάρχει **η** μεταφορά» — διαβάζει πρώτα, ποτέ δεύτερη).
 *   2. **Ταυτόχρονοι** καλούντες (webhook + cron + επιστροφή browser την ίδια στιγμή) ⇒ **μίσθωση** στο έγγραφο της
 *      συνεδρίας, σε συναλλαγή: μόνο ο κάτοχος ζωντανής μίσθωσης μιλά στον πάροχο. Μίσθωση που έληξε (κατάρρευση) ⇒ την
 *      παίρνει ο επόμενος — και η δηλωτική πράξη κάνει τη δεύτερη απόπειρα ασφαλή.
 *   Το Stripe τα λύνει με `Idempotency-Key`· ο πάροχος εδώ δεν έχει κανένα — τα λύνουμε **χωρίς** αυτό.
 *
 *   🔑 **Οφειλή πριν από την πράξη**: το `transferDue` γράφεται `true` **μαζί** με την πρώτη μίσθωση· βλάβη πριν από τη
 *   μεταφορά ⇒ το cron (`listCheckoutsAwaitingTransfer`) την ξαναπιάνει. Καμία πληρωμή δεν μένει αμεταβίβαστη σιωπηλά.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { generatePaymentTransferLeaseHolderId } from '@/services/enterprise-id.service';

import { CHECKOUT_LEASE_MS, claimCheckoutLease, releaseCheckoutLease } from './payment-checkout-lease';
import { checkoutRecordOf, listCheckoutsAwaitingTransfer, type PaymentCheckoutRecord } from './payment-checkout-store';
import type { PaymentProvider } from './payment-provider';

const logger = createModuleLogger('PaymentHeldTransfer');

/** Η πολιτική — ΕΝΑ σημείο. */
export const HELD_TRANSFER_POLICY = {
  /** Προμήθεια πλατφόρμας **0** (απόφαση Giorgio 2026-11-16, ADR-943 Κ-2). */
  commissionMinor: 0,
  /** Πόσο ζει η μίσθωση — η ΜΙΑ μίσθωση χρημάτων της συνεδρίας (`payment-checkout-lease.ts`). */
  leaseMs: CHECKOUT_LEASE_MS,
} as const;

/**
 * Η αιτιολογία της μεταφοράς στον πάροχο — **μόνο** η ταυτότητα της συνεδρίας: χωρίς ονόματα, διευθύνσεις ή ακίνητα
 * (ό,τι γράφεται στον PSP είναι εκτός ελέγχου μας). Ένας ορισμός για webhook και cron.
 */
export function heldTransferDescriptionOf(checkoutId: string): string {
  return checkoutId;
}

export type HeldTransferOutcome =
  /** Η μεταφορά υπάρχει (νέα ή από πριν). */
  | { readonly kind: 'transferred'; readonly transferReference: string }
  /** Άλλος καλών κρατά ζωντανή μίσθωση — θα την ολοκληρώσει εκείνος (ή το cron μετά τη λήξη). */
  | { readonly kind: 'busy' }
  /** Η συνεδρία δεν είναι marketplace / δεν υπάρχει — τίποτα να μεταφερθεί. */
  | { readonly kind: 'not-applicable' };

function checkoutRef(db: Firestore, checkoutId: string) {
  return db.collection(COLLECTIONS.ACCOUNTING_PAYMENT_CHECKOUTS).doc(checkoutId);
}

/** Συναλλαγή: η μεταφορά υπάρχει ήδη ⇒ αυτή· ζωντανή ξένη μίσθωση ⇒ `busy`· αλλιώς μίσθωση **και** οφειλή. */
function claimLease(db: Firestore, checkoutId: string, holder: string, nowMs: number) {
  return claimCheckoutLease<HeldTransferOutcome>(db, checkoutId, holder, nowMs, (_checkout, marketplace) => (
    marketplace.transferReference !== null
      ? { proceed: false, result: { kind: 'transferred', transferReference: marketplace.transferReference } }
      : { proceed: true, patch: { 'marketplace.transferDue': true } }
  ));
}

/** Συναλλαγή: η αναφορά γράφεται, η οφειλή σβήνει, η μίσθωση φεύγει. Ίδια αναφορά ήδη γραμμένη ⇒ καμία αλλαγή. */
function completeTransfer(db: Firestore, checkoutId: string, transferReference: string, nowIso: string): Promise<void> {
  const ref = checkoutRef(db, checkoutId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const known = snap.exists ? checkoutRecordOf(snap.id, snap.data())?.marketplace ?? null : null;
    if (known === null) return;
    if (known.transferReference !== null && known.transferReference !== transferReference) {
      // Δηλωτική πράξη ⇒ ο πάροχος δίνει ΠΑΝΤΑ την ίδια μεταφορά για (πληρωμή, δικαιούχο)· διαφορά = σφάλμα προς άνθρωπο.
      logger.error('Two different transfers for one checkout — needs a human', { checkoutId });
      return;
    }
    tx.update(ref, {
      'marketplace.transferReference': transferReference, 'marketplace.transferDue': false, 'marketplace.lease': null,
      updatedAt: nowIso,
    });
  });
}

export interface HeldTransferInput {
  readonly checkoutId: string;
  /** Η πληρωμή στον πάροχο (`pmt_…`) — από την κίνηση που μόλις καταγράφηκε ή από τη συνεδρία (cron). */
  readonly paymentReference: string;
  /** Η αιτιολογία στον πάροχο — χωρίς προσωπικά δεδομένα. */
  readonly description: string;
  readonly nowMs: number;
}

/**
 * **Εξασφαλίζει την κρατημένη μεταφορά** της πληρωμής προς τον δικαιούχο της συνεδρίας. Ιδεμποτικό και ασφαλές σε
 * ταυτόχρονους καλούντες. Σφάλμα παρόχου/βάσης ⇒ ρίχνει (η οφειλή μένει γραμμένη· ο καλών ή το cron ξαναδοκιμάζει).
 */
export async function ensureHeldTransfer(db: Firestore, provider: PaymentProvider, input: HeldTransferInput): Promise<HeldTransferOutcome> {
  const marketplaceCapability = provider.marketplace;
  if (marketplaceCapability === null) return { kind: 'not-applicable' };
  const holder = generatePaymentTransferLeaseHolderId();
  const claim = await claimLease(db, input.checkoutId, holder, input.nowMs);
  if (claim.kind === 'declined') return claim.result;
  if (claim.kind !== 'claimed') return claim;
  try {
    const transfer = await marketplaceCapability.ensureTransfer({
      paymentReference: input.paymentReference,
      payeeReference: claim.marketplace.payeeReference,
      amountMinor: claim.checkout.amountMinor,
      commissionMinor: HELD_TRANSFER_POLICY.commissionMinor,
      description: input.description,
      hold: true,
    });
    await completeTransfer(db, input.checkoutId, transfer.reference, nowISO());
    logger.info('Held transfer ensured', { checkoutId: input.checkoutId, provider: provider.id, held: transfer.held });
    return { kind: 'transferred', transferReference: transfer.reference };
  } catch (error) {
    // Η μίσθωση φεύγει μόνο αν είναι ακόμη δική μας· η οφειλή μένει για το cron.
    await releaseCheckoutLease(db, input.checkoutId, holder, nowISO()).catch(() => undefined);
    throw error;
  }
}

/** Ανά πέρασμα — ό,τι μένει, το παίρνει το επόμενο. */
const TRANSFER_SWEEP_BATCH = 50;

export interface HeldTransferSweepReport {
  readonly considered: number;
  readonly transferred: number;
  readonly busy: number;
  readonly failed: number;
  readonly truncated: boolean;
}

type SweepVerdict = 'transferred' | 'busy' | 'failed';
type ProviderLookup = (id: PaymentCheckoutRecord['provider']) => PaymentProvider | null;

async function sweepOne(db: Firestore, checkout: PaymentCheckoutRecord, providerOf: ProviderLookup, nowMs: number): Promise<SweepVerdict> {
  const provider = providerOf(checkout.provider);
  if (provider === null || checkout.paymentReference === null) return 'failed';
  try {
    const outcome = await ensureHeldTransfer(db, provider, {
      checkoutId: checkout.checkoutId, paymentReference: checkout.paymentReference,
      description: heldTransferDescriptionOf(checkout.checkoutId), nowMs,
    });
    return outcome.kind === 'busy' ? 'busy' : outcome.kind === 'transferred' ? 'transferred' : 'failed';
  } catch (error) {
    logger.error('Held transfer sweep failed — next pass retries', {
      checkoutId: checkout.checkoutId, error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}

/**
 * **Το δίχτυ ασφαλείας** (cron): κάθε πληρωμή marketplace που εισπράχθηκε αλλά δεν έγινε ακόμη μεταφορά (webhook που
 * κατέρρευσε μετά την καταγραφή, πάροχος που αρνήθηκε προσωρινά) ⇒ ο ίδιος δρόμος, με μίσθωση.
 */
export async function sweepHeldTransfers(db: Firestore, providerOf: ProviderLookup, nowMs: number): Promise<HeldTransferSweepReport> {
  const due = await listCheckoutsAwaitingTransfer(db, TRANSFER_SWEEP_BATCH);
  const tally: Record<SweepVerdict, number> = { transferred: 0, busy: 0, failed: 0 };
  for (const checkout of due) tally[await sweepOne(db, checkout, providerOf, nowMs)] += 1;
  return { considered: due.length, ...tally, truncated: due.length === TRANSFER_SWEEP_BATCH };
}
