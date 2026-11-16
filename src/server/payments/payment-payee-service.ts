import 'server-only';

/**
 * @fileoverview **Δικαιούχοι marketplace** — εγγραφή στον πάροχο και συγχρονισμός KYC (ADR-943 §5.7)
 * @description
 *   - **Εγγραφή** (`registerMarketplacePayee`): κράτηση θέσης ⇒ πάροχος ⇒ ολοκλήρωση. Ιδεμποτική: υπάρχων δικαιούχος
 *     επιστρέφεται χωρίς κλήση στον πάροχο· ταυτόχρονη εγγραφή ⇒ `in-progress`, ποτέ δεύτερος πωλητής.
 *   - **Συγχρονισμός** (`syncPayeeFromKycSignal`): το webhook KYC είναι **σήμα** — η εξουσιοδότηση ξαναδιαβάζεται από το
 *     API (Κ-8). Η κατάσταση KYC και η σελίδα KYC του σήματος είναι πληροφορία για τον άνθρωπο.
 *
 *   ⚠️ Γνωστό κενό (ADR-943 §8): αν ο διακομιστής καταρρεύσει **μετά** την επιτυχή εγγραφή στον πάροχο και **πριν**
 *   γραφτεί η αναφορά, η επόμενη απόπειρα (μετά τη λήξη της κράτησης) θα δημιουργήσει δεύτερο πωλητή. Ο πάροχος δεν
 *   τεκμηριώνει αναζήτηση πωλητή με ΑΦΜ ούτε κλειδί ιδεμποτίας· ο ορφανός πωλητής εντοπίζεται στο dashboard του παρόχου.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import type { PayoutAccountView, PayoutRegistration } from '@/lib/payments/payout-account';
import { createModuleLogger } from '@/lib/telemetry';

import type { PayeeRegistration } from './payment-marketplace';
import {
  completePaymentPayee,
  findPaymentPayeeByReference,
  observePaymentPayee,
  readPaymentPayee,
  reservePaymentPayee,
  type PaymentPayeeRecord,
  type PayeeObservationOutcome,
} from './payment-payee-store';
import type { PaymentProvider, WebhookSignal } from './payment-provider';

const logger = createModuleLogger('PaymentPayeeService');

export type PayeeRegistrationOutcome =
  | { readonly kind: 'registered' | 'existing'; readonly payee: PaymentPayeeRecord }
  | { readonly kind: 'in-progress' }
  /** Ο λογαριασμός εμπόρου δεν έχει ενεργό Marketplace. */
  | { readonly kind: 'marketplace-unavailable' };

/** Εγγράφει τον χρήστη ως δικαιούχο στον πάροχο. Σφάλμα παρόχου ⇒ ρίχνει (η κράτηση λήγει και επιτρέπει νέα απόπειρα). */
export async function registerMarketplacePayee(
  db: Firestore, provider: PaymentProvider, userId: string, registration: PayeeRegistration,
): Promise<PayeeRegistrationOutcome> {
  const marketplace = provider.marketplace;
  if (marketplace === null) return { kind: 'marketplace-unavailable' };
  const reservation = await reservePaymentPayee(db, provider.id, userId, nowISO());
  if (reservation.kind === 'existing') return { kind: 'existing', payee: reservation.record };
  if (reservation.kind === 'in-progress') return { kind: 'in-progress' };
  const account = await marketplace.registerPayee(registration);
  const payee = await completePaymentPayee(db, provider.id, userId, account, nowISO());
  logger.info('Marketplace payee registered', { provider: provider.id, payeeId: payee.payeeId, status: payee.status });
  return { kind: 'registered', payee };
}

export type PayeeReadiness =
  | { readonly kind: 'ready'; readonly payeeReference: string }
  /** Κανένας δικαιούχος, εγγραφή σε εξέλιξη, ή ο πάροχος δεν τον έχει (ακόμη) `authorized`. */
  | { readonly kind: 'not-ready' };

/**
 * **Δέχεται πληρωμές αυτός ο χρήστης τώρα;** — η ΜΙΑ κρίση πριν από κάθε πληρωμή marketplace (ADR-943 §5.9). Η αλήθεια
 * από το **API** (`readPayee`, Κ-8)· η εγγραφή ενημερώνεται στον δρόμο. Ο πάροχος: «can receive transfers — `true` only
 * if the status is `Authorized`» (EveryPay API reference). Σφάλμα παρόχου ⇒ ρίχνει (ποτέ «έτοιμος» από μαντεψιά).
 */
export async function readyPayeeOf(db: Firestore, provider: PaymentProvider, userId: string): Promise<PayeeReadiness> {
  const marketplace = provider.marketplace;
  const payee = marketplace === null ? null : await readPaymentPayee(db, provider.id, userId);
  if (marketplace === null || payee === null || payee.providerReference === null) return { kind: 'not-ready' };
  const account = await marketplace.readPayee(payee.providerReference);
  if (account.status !== payee.status) {
    await observePaymentPayee(db, payee.payeeId, { status: account.status }, nowISO());
  }
  return account.status === 'authorized' ? { kind: 'ready', payeeReference: account.reference } : { kind: 'not-ready' };
}

/** Ο δικαιούχος ⇒ ό,τι βλέπει ο άνθρωπος. Η εξουσιοδότηση (API) νικά την πορεία KYC (σήμα) — Κ-8. */
export function payoutAccountViewOf(payee: PaymentPayeeRecord | null): PayoutAccountView {
  if (payee === null) return { state: 'none', kycProcessUrl: null };
  if (payee.providerReference === null) return { state: 'registering', kycProcessUrl: null };
  if (payee.status === 'authorized') return { state: 'ready', kycProcessUrl: null };
  if (payee.status === 'suspended' || payee.status === 'closed') return { state: 'blocked', kycProcessUrl: null };
  return { state: payee.kycStatus === 'rejected' ? 'rejected' : 'verifying', kycProcessUrl: payee.kycProcessUrl };
}

/** «Λήψη πληρωμών» του χρήστη — από την εγγραφή, χωρίς κλήση στον πάροχο. */
export async function readPayoutAccount(db: Firestore, provider: PaymentProvider | null, userId: string): Promise<PayoutAccountView> {
  if (provider === null || provider.marketplace === null) return { state: 'unavailable', kycProcessUrl: null };
  return payoutAccountViewOf(await readPaymentPayee(db, provider.id, userId));
}

/** Εγγραφή από τον ίδιο τον χρήστη: το email από τον λογαριασμό, τα υπόλοιπα από τη φόρμα. Ιδεμποτική. */
export async function registerPayoutAccount(
  db: Firestore, provider: PaymentProvider | null, identity: { readonly userId: string; readonly email: string }, form: PayoutRegistration,
): Promise<PayoutAccountView> {
  if (provider === null) return { state: 'unavailable', kycProcessUrl: null };
  const outcome = await registerMarketplacePayee(db, provider, identity.userId, { ...form, email: identity.email });
  switch (outcome.kind) {
    case 'registered': case 'existing': return payoutAccountViewOf(outcome.payee);
    case 'in-progress': return { state: 'registering', kycProcessUrl: null };
    case 'marketplace-unavailable': return { state: 'unavailable', kycProcessUrl: null };
  }
}

type PayeeKycSignal = Extract<WebhookSignal, { kind: 'payee-kyc' }>;

/** Σήμα KYC ⇒ η αλήθεια από το API ⇒ ο δικαιούχος. Ιδεμποτικό. Άγνωστος πωλητής ⇒ `unknown` (200 στον πάροχο). */
export async function syncPayeeFromKycSignal(
  db: Firestore, provider: PaymentProvider, signal: PayeeKycSignal,
): Promise<PayeeObservationOutcome> {
  const marketplace = provider.marketplace;
  const payee = await findPaymentPayeeByReference(db, provider.id, signal.payeeReference);
  if (marketplace === null || payee === null) {
    logger.warn('KYC signal for an unknown payee', { provider: provider.id, marketplace: marketplace !== null });
    return 'unknown';
  }
  const account = await marketplace.readPayee(signal.payeeReference);
  return observePaymentPayee(db, payee.payeeId, {
    status: account.status,
    kycStatus: signal.kycStatus,
    kycProcessUrl: signal.kycProcessUrl ?? account.kycProcessUrl,
  }, nowISO());
}
