import 'server-only';

/**
 * @fileoverview **Δικαιούχοι marketplace** — εγγραφή, αλλαγή στοιχείων, συγχρονισμός KYC, κρίσεις πληρωμών/αποδόσεων
 *   (ADR-943 §5.7 · §5.14)
 * @description
 *   - **Εγγραφή** (`registerMarketplacePayee`): κράτηση θέσης ⇒ πάροχος ⇒ ολοκλήρωση. Ιδεμποτική: υπάρχων δικαιούχος
 *     επιστρέφεται χωρίς κλήση στον πάροχο· ταυτόχρονη εγγραφή ⇒ `in-progress`, ποτέ δεύτερος πωλητής.
 *   - **Κρίσεις** (Φ6α, μοντέλο Stripe Connect): `readyPayeeOf` = **πληρωμές** (charges — τα χρήματα κρατούνται)·
 *     `payeePayoutsOpen` = **αποδόσεις** (payouts — απαιτεί ταυτοποίηση `verified`). Ο ΕΝΑΣ κριτής:
 *     `payment-payee-capabilities.ts`.
 *   - **Αλλαγή στοιχείων** (`updatePayoutAccount`): μόνο με πρόσφατη σύνδεση· νέος λογαριασμός πίστωσης ⇒ κλείδωμα
 *     αποδόσεων μέχρι νέα ταυτοποίηση + ειδοποίηση ασφαλείας.
 *   - **Συγχρονισμός** (`syncPayeeFromKycSignal`): το webhook KYC είναι **σήμα** — η εξουσιοδότηση ξαναδιαβάζεται από το
 *     API (Κ-8)· η κατάσταση KYC και τα δικαιολογητικά έρχονται **μόνο** από το σήμα (κανένα endpoint του παρόχου).
 *
 *   ⚠️ Γνωστό κενό (ADR-943 §8 #10): αν ο διακομιστής καταρρεύσει **μετά** την επιτυχή εγγραφή στον πάροχο και **πριν**
 *   γραφτεί η αναφορά, η επόμενη απόπειρα (μετά τη λήξη της κράτησης) θα δημιουργήσει δεύτερο πωλητή. Ο πάροχος έχει
 *   αναζήτηση πωλητή με ΑΦΜ (`GET /sellers?tax_number=`) — η ανάκτηση είναι πρόταση, όχι ακόμη κώδικας.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import {
  PAYOUT_REAUTHENTICATION_WINDOW_SEC,
  type PayoutAccountView,
  type PayoutRegistration,
  type PayoutUpdate,
} from '@/lib/payments/payout-account';
import { createModuleLogger } from '@/lib/telemetry';

import type { MarketplaceCapability, PayeeAccount, PayeeDetails, PayeeRegistration } from './payment-marketplace';
import { payeeCapabilitiesOf } from './payment-payee-capabilities';
import { announcePayoutDetailsChanged } from './payment-payee-notifier';
import {
  completePaymentPayee,
  findPaymentPayeeByReference,
  observePaymentPayee,
  readPaymentPayee,
  reservePaymentPayee,
  type PaymentPayeeRecord,
  type PayeeObservation,
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

type RegisteredPayee = PaymentPayeeRecord & { readonly providerReference: string };

function isRegistered(payee: PaymentPayeeRecord | null): payee is RegisteredPayee {
  return payee !== null && payee.providerReference !== null;
}

/** Η αλήθεια του API για την εξουσιοδότηση, γραμμένη στον δρόμο (Κ-8). Επιστρέφει τον δικαιούχο όπως ισχύει **τώρα**. */
async function refreshedPayee(
  db: Firestore, marketplace: MarketplaceCapability, payee: RegisteredPayee,
): Promise<{ readonly payee: PaymentPayeeRecord; readonly account: PayeeAccount }> {
  const account = await marketplace.readPayee(payee.providerReference);
  if (account.status !== payee.status) await observePaymentPayee(db, payee.payeeId, { status: account.status }, nowISO());
  return { payee: { ...payee, status: account.status }, account };
}

export type PayeeReadiness =
  | { readonly kind: 'ready'; readonly payeeReference: string }
  /** Κανένας δικαιούχος, εγγραφή σε εξέλιξη, ή ο πάροχος δεν τον έχει (ακόμη) `authorized`. */
  | { readonly kind: 'not-ready' };

/**
 * **Δέχεται πληρωμή ο ιδιοκτήτης τώρα;** — η κρίση **charges** πριν από κάθε πληρωμή marketplace (ADR-943 §5.9 · §5.14).
 * Τα χρήματα κρατούνται (`on_hold`)· την **απόδοση** την κρίνει χωριστά το `payeePayoutsOpen`. Σφάλμα παρόχου ⇒ ρίχνει.
 */
export async function readyPayeeOf(db: Firestore, provider: PaymentProvider, userId: string): Promise<PayeeReadiness> {
  const marketplace = provider.marketplace;
  const payee = marketplace === null ? null : await readPaymentPayee(db, provider.id, userId);
  if (marketplace === null || !isRegistered(payee)) return { kind: 'not-ready' };
  const { payee: current, account } = await refreshedPayee(db, marketplace, payee);
  return payeeCapabilitiesOf(current).charges ? { kind: 'ready', payeeReference: account.reference } : { kind: 'not-ready' };
}

/**
 * **Αποδίδονται χρήματα σε αυτόν τον δικαιούχο τώρα;** — η κρίση **payouts** πριν από κάθε αποδέσμευση (ADR-943 §5.14):
 * εξουσιοδότηση από το API **και** ταυτοποίηση `verified` από το σήμα. Άγνωστος / διπλός δικαιούχος ⇒ `false` (ποτέ
 * αποδέσμευση από μαντεψιά). Σφάλμα παρόχου ⇒ ρίχνει (η εντολή μένει, το cron ξαναδοκιμάζει).
 */
export async function payeePayoutsOpen(db: Firestore, provider: PaymentProvider, payeeReference: string): Promise<boolean> {
  const marketplace = provider.marketplace;
  const payee = marketplace === null ? null : await findPaymentPayeeByReference(db, provider.id, payeeReference);
  if (marketplace === null || !isRegistered(payee)) return false;
  return payeeCapabilitiesOf((await refreshedPayee(db, marketplace, payee)).payee).payouts;
}

const UNAVAILABLE: PayoutAccountView = {
  state: 'unavailable', charges: false, payouts: false, dueRequirements: [], kycProcessUrl: null, details: null,
};

const REGISTERING: PayoutAccountView = { ...UNAVAILABLE, state: 'registering' };

/** Ο δικαιούχος ⇒ ό,τι βλέπει ο άνθρωπος. Ο σύνδεσμος ταυτοποίησης μένει ορατός όσο οι αποδόσεις δεν επιτρέπονται. */
export function payoutAccountViewOf(payee: PaymentPayeeRecord | null, details: PayeeDetails | null = null): PayoutAccountView {
  const capabilities = payeeCapabilitiesOf(payee);
  const kycOpen = payee !== null && !capabilities.payouts && capabilities.state !== 'blocked';
  return {
    state: capabilities.state,
    charges: capabilities.charges,
    payouts: capabilities.payouts,
    dueRequirements: capabilities.due,
    kycProcessUrl: kycOpen ? payee.kycProcessUrl : null,
    details,
  };
}

/** «Λήψη πληρωμών» του χρήστη. Με δικαιούχο: η εξουσιοδότηση και τα στοιχεία **από τον πάροχο** (δεν τα κρατάμε). */
export async function readPayoutAccount(db: Firestore, provider: PaymentProvider | null, userId: string): Promise<PayoutAccountView> {
  const marketplace = provider?.marketplace ?? null;
  if (provider === null || marketplace === null) return UNAVAILABLE;
  const payee = await readPaymentPayee(db, provider.id, userId);
  if (!isRegistered(payee)) return payoutAccountViewOf(payee);
  try {
    const { payee: current, account } = await refreshedPayee(db, marketplace, payee);
    return payoutAccountViewOf(current, account.details);
  } catch (error) {
    // Ο πάροχος δεν απάντησε: η κάρτα δείχνει ό,τι ξέρουμε, χωρίς στοιχεία — ποτέ σφάλμα για ανάγνωση.
    logger.warn('Payee details unavailable from provider', {
      provider: provider.id, error: error instanceof Error ? error.message : String(error),
    });
    return payoutAccountViewOf(payee);
  }
}

/** Εγγραφή από τον ίδιο τον χρήστη: το email από τον λογαριασμό, τα υπόλοιπα από τη φόρμα. Ιδεμποτική. */
export async function registerPayoutAccount(
  db: Firestore, provider: PaymentProvider | null, identity: { readonly userId: string; readonly email: string }, form: PayoutRegistration,
): Promise<PayoutAccountView> {
  if (provider === null) return UNAVAILABLE;
  const outcome = await registerMarketplacePayee(db, provider, identity.userId, { ...form, email: identity.email });
  switch (outcome.kind) {
    case 'registered': case 'existing': return payoutAccountViewOf(outcome.payee);
    case 'in-progress': return REGISTERING;
    case 'marketplace-unavailable': return UNAVAILABLE;
  }
}

export type PayoutUpdateOutcome =
  | { readonly kind: 'updated'; readonly view: PayoutAccountView }
  /** Η σύνδεση δεν είναι αρκετά πρόσφατη — ο άνθρωπος επιβεβαιώνει ταυτότητα και ξαναστέλνει. */
  | { readonly kind: 'reauthentication-required' }
  /** Δεν υπάρχει (ολοκληρωμένος) δικαιούχος, ή η πλατφόρμα δεν έχει marketplace. */
  | { readonly kind: 'not-registered' };

/** «Sudo mode» (GitHub · Stripe): αλλαγή στοιχείων πίστωσης μόνο με σύνδεση των τελευταίων λεπτών. */
function isRecentSignIn(authTimeSec: number | undefined, nowMs: number): boolean {
  return authTimeSec !== undefined && nowMs / 1000 - authTimeSec <= PAYOUT_REAUTHENTICATION_WINDOW_SEC;
}

/**
 * **Αλλαγή στοιχείων** από τον ίδιο τον δικαιούχο (ADR-943 §5.14). Σειρά: πρόσφατη σύνδεση ⇒ πάροχος (`PUT`) ⇒ αν άλλαξε
 * ο λογαριασμός πίστωσης, **κλείδωμα αποδόσεων** (KYC ⇒ `pending`) ώσπου ο πάροχος να ξαναταυτοποιήσει με νέο σήμα ⇒
 * ειδοποίηση ασφαλείας. Ο πάροχος ούτως ή άλλως δεν εφαρμόζει νέο IBAN πριν το KYC· το τοπικό κλείδωμα κλείνει και το
 * δικό μας παράθυρο (αποδέσμευση στο ενδιάμεσο). Σφάλμα παρόχου ⇒ ρίχνει, τίποτα δεν γράφεται.
 */
export async function updatePayoutAccount(
  db: Firestore, provider: PaymentProvider | null,
  identity: { readonly userId: string; readonly authTimeSec: number | undefined }, update: PayoutUpdate, nowMs: number,
): Promise<PayoutUpdateOutcome> {
  if (!isRecentSignIn(identity.authTimeSec, nowMs)) return { kind: 'reauthentication-required' };
  const marketplace = provider?.marketplace ?? null;
  const payee = provider === null || marketplace === null ? null : await readPaymentPayee(db, provider.id, identity.userId);
  if (provider === null || marketplace === null || !isRegistered(payee)) return { kind: 'not-registered' };
  const account = await marketplace.updatePayee(payee.providerReference, update);
  const bankChanged = update.bankAccount !== undefined;
  const observation: PayeeObservation = bankChanged ? { status: account.status, kycStatus: 'pending' } : { status: account.status };
  await observePaymentPayee(db, payee.payeeId, observation, nowISO());
  logger.info('Marketplace payee updated', { provider: provider.id, payeeId: payee.payeeId, bankChanged });
  if (bankChanged) await announcePayoutDetailsChanged(identity.userId, new Date(nowMs));
  return { kind: 'updated', view: payoutAccountViewOf({ ...payee, ...observation }, account.details) };
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
    // Ο σύνδεσμος έρχεται σε ορισμένα σήματα μόνο· σήμα χωρίς σύνδεσμο δεν σβήνει τον γνωστό.
    kycProcessUrl: signal.kycProcessUrl ?? payee.kycProcessUrl,
    kycRequirements: signal.kycRequirements,
  }, nowISO());
}
