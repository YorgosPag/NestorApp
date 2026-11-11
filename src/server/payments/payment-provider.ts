import 'server-only';

/**
 * @fileoverview Το συμβόλαιο παρόχου πληρωμών — **port** (ADR-ACC-030 §5)
 * @description Ό,τι ξέρει η εφαρμογή για έναν πάροχο (Everypay σήμερα, άλλος αύριο). Ο κώδικας λογιστικής, το
 *   checkout endpoint, το webhook και η συμφιλίωση μιλούν **μόνο** με αυτούς τους τύπους· όνομα, URLs, μορφή
 *   υπογραφής και σφάλματα του παρόχου ζουν στον adapter του (`providers/<πάροχος>/`).
 *
 *   🔑 Το webhook δεν είναι αλήθεια: ο adapter το **κρίνει** (υπογραφή) και το μεταφράζει σε **σήμα** («κοίτα αυτή
 *   τη συνεδρία / πληρωμή»). Την αλήθεια τη δίνει πάντα το `readSettlement`, που διαβάζει από το API του παρόχου.
 *
 * @see ADR-ACC-030 · `providers/everypay/everypay-adapter.ts`
 */

import type { PaymentProviderId } from '@/lib/payments/payment-routes';
import type { CheckoutLaunch, OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';

export { isPaymentProviderId, PAYMENT_PROVIDER_IDS } from '@/lib/payments/payment-routes';
export type { CheckoutLaunch, OnlinePaymentMethod, PaymentProviderId };

/** Η μόνη υποστηριζόμενη νομισματική μονάδα (SEPA / IRIS). */
export type CheckoutCurrency = 'EUR';

export type CheckoutLocale = 'el' | 'en';

/** Ό,τι χρειάζεται ο πάροχος για να ξεκινήσει μια συνεδρία. Το ποσό το έχει ήδη ορίσει ο διακομιστής. */
export interface CheckoutRequest {
  readonly checkoutId: string;
  readonly method: OnlinePaymentMethod;
  /** Ποσό σε λεπτά (cents). */
  readonly amountMinor: number;
  readonly currency: CheckoutCurrency;
  /** Η αιτιολογία που βλέπει ο πελάτης στον πάροχο (π.χ. «Τιμολόγιο Α-7»). */
  readonly description: string;
  readonly locale: CheckoutLocale;
  /** Πού επιστρέφει ο browser μετά τον πάροχο (δική μας διαδρομή επιστροφής). */
  readonly returnUrl: string;
  /** Πού στέλνει ο πάροχος τα συμβάντα της συνεδρίας. */
  readonly webhookUrl: string;
  /** Λήξη της συνεδρίας (ISO 8601). */
  readonly expiresAt: string;
}

export interface StartedCheckout {
  /** Το αναγνωριστικό της συνεδρίας στον πάροχο, όταν υπάρχει (π.χ. `pnt_…`). */
  readonly providerReference: string | null;
  readonly launch: CheckoutLaunch;
}

/** Η συνεδρία όπως την ξέρει η εφαρμογή — ό,τι χρειάζεται ο adapter για να ρωτήσει τον πάροχο. */
export interface CheckoutSubject {
  readonly checkoutId: string;
  readonly method: OnlinePaymentMethod;
  readonly amountMinor: number;
  readonly currency: CheckoutCurrency;
  readonly providerReference: string | null;
}

/** Μία κίνηση χρημάτων στον πάροχο: η πληρωμή ή μια επιστροφή της. */
export interface ProviderMovement {
  readonly kind: 'payment' | 'refund';
  /** Αναγνωριστικό της κίνησης στον πάροχο (μοναδικό ανά είδος). */
  readonly reference: string;
  readonly amountMinor: number;
  readonly currency: CheckoutCurrency;
  /** Πότε έγινε (ISO 8601). */
  readonly occurredAt: string;
}

/** Η αλήθεια του παρόχου για μια συνεδρία. */
export type CheckoutSettlement =
  | { readonly state: 'open' }
  | {
    readonly state: 'settled';
    /** Η πληρωμή στον πάροχο — δένει τις μελλοντικές επιστροφές με τη συνεδρία. */
    readonly paymentReference: string;
    readonly movements: readonly ProviderMovement[];
  }
  | { readonly state: 'closed'; readonly reason: 'expired' | 'canceled' | 'failed' };

/** Τι λέει ένα επαληθευμένο webhook — **σήμα**, όχι αλήθεια. */
export type WebhookSignal =
  /** Άλλαξε κάτι σε συνεδρία που ξέρουμε με το αναγνωριστικό του παρόχου (π.χ. `pnt_…` πληρώθηκε / έληξε). */
  | { readonly kind: 'checkout-reference'; readonly providerReference: string }
  /** Άλλαξε κάτι σε πληρωμή (π.χ. επιστροφή) — βρίσκεται μέσω της πληρωμής που κατέγραψε η συνεδρία. */
  | { readonly kind: 'payment-reference'; readonly paymentReference: string }
  /** Εξουσιοδοτήθηκε πηγή που πρέπει **εμείς** να χρεώσουμε (IRIS Direct) — η συνεδρία με το δικό μας id. */
  | { readonly kind: 'authorized-source'; readonly checkoutId: string; readonly sourceToken: string }
  /** Υπογεγραμμένο αλλά άσχετο / αποτυχημένο συμβάν — καμία ενέργεια. */
  | { readonly kind: 'ignored'; readonly reason: string };

export type WebhookRefusal = 'secret-missing' | 'signature-missing' | 'signature-invalid' | 'payload-malformed';

export type WebhookVerdict =
  | { readonly valid: true; readonly signal: WebhookSignal }
  | { readonly valid: false; readonly reason: WebhookRefusal };

/** Η επιστροφή του browser από τον πάροχο, αφού κριθεί. Δεν καταγράφει τίποτα — μόνο οδηγεί πίσω. */
export type ReturnVerdict =
  | { readonly valid: true; readonly signal: WebhookSignal }
  | { readonly valid: false; readonly reason: WebhookRefusal };

/** Ο πάροχος. Κάθε μέθοδος που ρωτά το δίκτυο **ρίχνει** σε σφάλμα (ο καλών αποφασίζει retry). */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Ποιοι τρόποι είναι ενεργοί για αυτόν τον λογαριασμό εμπόρου. */
  readonly methods: readonly OnlinePaymentMethod[];
  startCheckout(request: CheckoutRequest): Promise<StartedCheckout>;
  readSettlement(subject: CheckoutSubject): Promise<CheckoutSettlement>;
  /** Χρεώνει εξουσιοδοτημένη πηγή (IRIS Direct). Ιδεμποτικό: πηγή που χρεώθηκε ήδη δεν είναι σφάλμα. */
  captureAuthorizedSource(subject: CheckoutSubject, sourceToken: string): Promise<void>;
  /**
   * Ακυρώνει ανοιχτή συνεδρία στον πάροχο. `true` ⇒ ο πάροχος **εγγυάται** ότι δεν θα χρεώσει ποτέ· `false` ⇒ δεν
   * μπορεί να το εγγυηθεί (π.χ. IRIS σε εξέλιξη στην τράπεζα, ή ήδη πληρωμένη) και η συνεδρία μένει ανοιχτή για
   * συμφιλίωση. Ποτέ «ακυρώθηκε» για κάτι που μπορεί ακόμη να εισπραχθεί.
   */
  cancelCheckout(subject: CheckoutSubject): Promise<boolean>;
  /** Κρίνει ένα webhook πάνω στο **ωμό** σώμα. Καθαρό — δεν ρωτά δίκτυο. */
  judgeWebhook(rawBody: string, headers: Headers): WebhookVerdict;
  /** Κρίνει την επιστροφή του browser (πεδία φόρμας ή query). Καθαρό. */
  judgeReturn(fields: URLSearchParams): ReturnVerdict;
}
