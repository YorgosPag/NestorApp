/**
 * @fileoverview Πάροχοι πληρωμών: αναγνωριστικά + διαδρομές που τους δίνουμε — ο ΕΝΑΣ ορισμός (ADR-ACC-030 §5)
 * @description Τις δίνουμε στον πάροχο (webhook · επιστροφή browser) και τις εξαιρεί το middleware από το φίλτρο
 *   «browser-only» (ο πάροχος δεν είναι browser). Ένας ορισμός, ώστε διεύθυνση που δηλώνουμε στον πάροχο και
 *   φάκελος του route να μην αποκλίνουν σιωπηλά.
 */

import { isOneOf } from '@/lib/type-guards';

/** Τα αναγνωριστικά παρόχων — ρίζα του λεξιλογίου (διαδρομή webhook, πεδίο `provider`). */
export const PAYMENT_PROVIDER_IDS = ['everypay'] as const;

export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export function isPaymentProviderId(value: unknown): value is PaymentProviderId {
  return isOneOf(PAYMENT_PROVIDER_IDS, value);
}

/** Το πρόθεμα όλων των διαδρομών που καλεί ο πάροχος (webhooks + επιστροφή browser). */
export const PAYMENT_PROVIDER_ROUTE_PREFIX = '/api/payments';

/** Το query πεδίο της επιστροφής που κρατά τη συνεδρία. */
export const PAYMENT_RETURN_CHECKOUT_PARAM = 'checkout';

/** `POST /api/payments/webhooks/<πάροχος>` — εκεί στέλνει ο πάροχος τα συμβάντα. */
export function paymentWebhookRoute(provider: PaymentProviderId): string {
  return `${PAYMENT_PROVIDER_ROUTE_PREFIX}/webhooks/${provider}`;
}

/** `GET|POST /api/payments/return/<πάροχος>?checkout=<id>` — εκεί επιστρέφει ο browser μετά τον πάροχο. */
export function paymentReturnRoute(provider: PaymentProviderId, checkoutId: string): string {
  const query = new URLSearchParams({ [PAYMENT_RETURN_CHECKOUT_PARAM]: checkoutId });
  return `${PAYMENT_PROVIDER_ROUTE_PREFIX}/return/${provider}?${query.toString()}`;
}
