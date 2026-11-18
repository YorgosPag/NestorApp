import 'server-only';

/**
 * @fileoverview **Η εκκίνηση μιας συνεδρίας στον πάροχο** — ο ΕΝΑΣ δρόμος για κάθε πληρωτέο αντικείμενο (ADR-ACC-030 §5 ·
 *   ADR-943 §5.9)
 * @description Η συνεδρία έχει **ήδη** γραφτεί (κάθε webhook βρίσκει πάντα συνεδρία να ταιριάξει). Εδώ: ο πάροχος ⇒
 *   αναγνωριστικό + τρόπος εκκίνησης· η δηλωμένη λήξη του παρόχου **νικά** τη ζητούμενη (§5.5). Αποτυχία ⇒ η συνεδρία
 *   `failed` και ονομασμένη άρνηση, ποτέ 500 στον πελάτη. Μεταφέρθηκε αυτούσιο από το `invoice-payment-checkout.ts` όταν
 *   απέκτησε δεύτερο καλούντα (προκαταβολή ανάθεσης).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import { joinOrigin } from '@/lib/http/public-origin';
import { paymentReturnRoute, paymentWebhookRoute } from '@/lib/payments/payment-routes';
import { createModuleLogger } from '@/lib/telemetry';
import type { CheckoutLaunch } from '@/subapps/accounting/types/online-payment';

import { updatePaymentCheckout, type PaymentCheckoutPatch, type PaymentCheckoutRecord } from './payment-checkout-store';
import {
  startedCheckoutDiagnostics,
  type CheckoutLocale,
  type CheckoutPayer,
  type PaymentProvider,
  type StartedCheckout,
} from './payment-provider';

const logger = createModuleLogger('PaymentCheckoutLaunch');

/**
 * Η λήξη που **ζητάμε**. Η Everypay ζητά ≥ 5′· 30′ αρκούν για τράπεζα + 3-D Secure. Όταν ο πάροχος δηλώσει δική
 * του λήξη (IRIS), αυτή αντικαθιστά τη ζητούμενη (`startedCheckoutPatch`).
 */
export const CHECKOUT_LIFETIME_MS = 30 * 60 * 1000;

/**
 * Ό,τι έμαθε η συνεδρία από τον πάροχο. Η δηλωμένη λήξη του **νικά** τη ζητούμενη: η συμφιλίωση (§5.5) και η
 * σελίδα μετρούν από τη λήξη που ο πάροχος πράγματι τηρεί (IRIS: δεν δέχεται δική μας).
 */
function startedCheckoutPatch(started: StartedCheckout): PaymentCheckoutPatch {
  return started.providerExpiresAt === null
    ? { providerReference: started.providerReference }
    : { providerReference: started.providerReference, expiresAt: started.providerExpiresAt };
}

export interface CheckoutLaunchInput {
  /** Η αιτιολογία που βλέπει ο πελάτης στον πάροχο. */
  readonly description: string;
  readonly locale: CheckoutLocale;
  /** Η δημόσια αρχή της εφαρμογής (`publicOrigin()`), για τις διευθύνσεις επιστροφής / webhook. */
  readonly origin: string;
  /** Ό,τι ξέρει ο καλών για τον πληρωτή — περνά αυτούσιο στον πάροχο (ADR-ACC-030 §5.11). */
  readonly payer: CheckoutPayer;
}

export type CheckoutLaunchOutcome =
  | { readonly status: 'started'; readonly checkoutId: string; readonly launch: CheckoutLaunch }
  | { readonly status: 'refused'; readonly reason: 'provider-unavailable' };

/** Ξεκινά τη **γραμμένη** συνεδρία στον πάροχο. `split` = η συνεδρία είναι marketplace (ADR-943). */
export async function launchCheckoutAtProvider(
  db: Firestore, provider: PaymentProvider, record: PaymentCheckoutRecord, input: CheckoutLaunchInput,
): Promise<CheckoutLaunchOutcome> {
  try {
    const started = await provider.startCheckout({
      checkoutId: record.checkoutId, method: record.method, amountMinor: record.amountMinor, currency: 'EUR',
      description: input.description, locale: input.locale, expiresAt: record.expiresAt,
      returnUrl: joinOrigin(input.origin, paymentReturnRoute(provider.id, record.checkoutId)),
      webhookUrl: joinOrigin(input.origin, paymentWebhookRoute(provider.id)),
      split: record.marketplace !== null,
      payer: input.payer,
    });
    await updatePaymentCheckout(db, record.checkoutId, startedCheckoutPatch(started), nowISO());
    logger.info('Checkout started at provider', {
      checkoutId: record.checkoutId, provider: provider.id, method: record.method, split: record.marketplace !== null,
      // Μόνο αν υπήρχε — ποτέ η διεύθυνση (προσωπικό δεδομένο).
      payerEmail: input.payer.email !== null,
      ...startedCheckoutDiagnostics(started, record.createdAt),
    });
    return { status: 'started', checkoutId: record.checkoutId, launch: started.launch };
  } catch (error) {
    logger.error('Provider refused to start a checkout', {
      checkoutId: record.checkoutId, provider: provider.id, error: error instanceof Error ? error.message : String(error),
    });
    await updatePaymentCheckout(db, record.checkoutId, { status: 'failed' }, nowISO());
    return { status: 'refused', reason: 'provider-unavailable' };
  }
}
