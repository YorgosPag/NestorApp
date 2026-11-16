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
import { createModuleLogger } from '@/lib/telemetry';

import type { PayeeRegistration } from './payment-marketplace';
import {
  completePaymentPayee,
  findPaymentPayeeByReference,
  observePaymentPayee,
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
