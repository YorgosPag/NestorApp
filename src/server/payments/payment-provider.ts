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

import { normalizeToDate } from '@/lib/date-local';
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
  /**
   * Η λήξη που **δηλώνει ο πάροχος** (ISO 8601), όταν τη δηλώνει. Νικά τη ζητούμενη `CheckoutRequest.expiresAt`:
   * ο πάροχος δεν δέχεται πάντα δική μας λήξη (IRIS: καμία παράμετρος), και η συνεδρία μας δεν πρέπει να
   * υπόσχεται ζωή που ο πάροχος δεν τηρεί (ADR-ACC-030 §5.5).
   */
  readonly providerExpiresAt: string | null;
  /** Οι χρόνοι της συνεδρίας **όπως τους έγραψε ο πάροχος** — διάγνωση (`startedCheckoutDiagnostics`), ποτέ κριτήριο. */
  readonly providerClock: ProviderClockEcho;
}

/**
 * Ωμές τιμές χρόνου του παρόχου, **πριν** από κάθε κανονικοποίηση (π.χ. `2025-10-02T16:20:32+0200`). Η κανονικοποίηση
 * κρύβει ακριβώς ό,τι χρειάζεται η διάγνωση: αν ο πάροχος έστειλε μετατόπιση ζώνης ή όχι (ADR-ACC-030 §5.8 #6).
 */
export interface ProviderClockEcho {
  readonly createdAt: string | null;
  readonly expiresAt: string | null;
}

/** Τι γράφεται στο log της έναρξης — ωμές τιμές χρόνου και ό,τι προκύπτει από αυτές. Κανένα μυστικό / token. */
export interface StartedCheckoutDiagnostics {
  readonly providerCreatedAtRaw: string | null;
  readonly providerExpiresAtRaw: string | null;
  /** Η λήξη όπως την κράτησε η εφαρμογή (ISO 8601). */
  readonly providerExpiresAt: string | null;
  /**
   * Λήξη − δημιουργία, **με το ρολόι του παρόχου**: οι δύο τιμές έχουν την ίδια μορφή, άρα λάθος ζώνης ώρας
   * αλληλοαναιρείται. Η πραγματική διάρκεια ζωής της συνεδρίας του παρόχου.
   */
  readonly providerLifetimeSeconds: number | null;
  /**
   * Δημιουργία στον πάροχο − η δική μας `createdAt`. Δευτερόλεπτα ⇒ καθυστέρηση δικτύου· ±ακέραιες ώρες ⇒ η ζώνη
   * ώρας του παρόχου διαβάζεται λάθος.
   */
  readonly providerClockSkewSeconds: number | null;
}

function secondsBetween(fromIso: string | null, toIso: string | null): number | null {
  const from = normalizeToDate(fromIso);
  const to = normalizeToDate(toIso);
  return from === null || to === null ? null : Math.round((to.getTime() - from.getTime()) / 1000);
}

/** Ο ΕΝΑΣ ορισμός της διάγνωσης μιας έναρξης στον πάροχο. `ourCreatedAt` = η `createdAt` της συνεδρίας μας. */
export function startedCheckoutDiagnostics(started: StartedCheckout, ourCreatedAt: string): StartedCheckoutDiagnostics {
  const { createdAt, expiresAt } = started.providerClock;
  return {
    providerCreatedAtRaw: createdAt,
    providerExpiresAtRaw: expiresAt,
    providerExpiresAt: started.providerExpiresAt,
    providerLifetimeSeconds: secondsBetween(createdAt, expiresAt),
    providerClockSkewSeconds: secondsBetween(ourCreatedAt, createdAt),
  };
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
  /**
   * Ο πάροχος **αρνήθηκε** την εξουσιοδότηση μιας απόπειρας (π.χ. IRIS «Αποτυχία Ταυτοποίησης») — ADR-ACC-030 §5.3.
   * Δεν είναι χρήματα και **δεν** κλείνει τη συνεδρία (πρότυπο Stripe `last_payment_error`): σημειώνεται μόνο η
   * έκβαση ώστε η σελίδα να πει «δεν ολοκληρώθηκε». `checkoutId` **μόνο** από το υπογεγραμμένο περιεχόμενο· `null`
   * όταν ο πάροχος δεν το υπέγραψε. `signedFields` = τα **ονόματα** των υπογεγραμμένων πεδίων (διάγνωση, ποτέ τιμές).
   */
  | {
    readonly kind: 'authorization-failed';
    readonly checkoutId: string | null;
    readonly providerCode: string | null;
    readonly signedFields: readonly string[];
  }
  /** Υπογεγραμμένο αλλά άσχετο / ελλιπές συμβάν — καμία ενέργεια. */
  | { readonly kind: 'ignored'; readonly reason: string };

/** Τι γράφεται για ένα σήμα σε logs / ίχνος παραλαβής — **ποτέ** τιμές του payload πέρα από κωδικό παρόχου. */
export interface WebhookSignalDiagnostics {
  readonly signal: WebhookSignal['kind'];
  /** Ο λόγος (`ignored`) ή ο κωδικός άρνησης του παρόχου (`authorization-failed`)· `null` αλλιώς. */
  readonly reason: string | null;
  /** Τα **ονόματα** των υπογεγραμμένων πεδίων όταν η αποτυχία δεν φέρει υπογεγραμμένη συνεδρία — η διάγνωση του §5.8. */
  readonly signedFields: string | null;
  /** Ποια μορφή υπογραφής ταίριαξε (π.χ. `iris-hash-hex`) — κλείνει το §5.8 #1 από το πρώτο ζωντανό συμβάν. */
  readonly signatureScheme: string;
}

/** Ο ΕΝΑΣ ορισμός της διάγνωσης ενός σήματος (webhook route · return route · ίχνος παραλαβής). */
export function webhookSignalDiagnostics(verdict: AcceptedVerdict): WebhookSignalDiagnostics {
  const { signal, signatureScheme } = verdict;
  if (signal.kind === 'ignored') return { signal: signal.kind, reason: signal.reason, signedFields: null, signatureScheme };
  if (signal.kind !== 'authorization-failed') return { signal: signal.kind, reason: null, signedFields: null, signatureScheme };
  return {
    signal: signal.kind,
    reason: signal.providerCode === null ? 'provider-code-absent' : `provider-code:${signal.providerCode}`,
    signedFields: signal.checkoutId === null ? signal.signedFields.join(',') : null,
    signatureScheme,
  };
}

export type WebhookRefusal = 'secret-missing' | 'signature-missing' | 'signature-invalid' | 'payload-malformed';

/**
 * Επαληθευμένο συμβάν: το σήμα **και** ποια μορφή υπογραφής το απέδειξε (`signatureScheme`, όνομα του adapter) —
 * διάγνωση για logs / ίχνος παραλαβής, ποτέ κριτήριο.
 */
export interface AcceptedVerdict {
  readonly valid: true;
  readonly signal: WebhookSignal;
  readonly signatureScheme: string;
}

export type WebhookVerdict =
  | AcceptedVerdict
  | { readonly valid: false; readonly reason: WebhookRefusal };

/** Η επιστροφή του browser από τον πάροχο, αφού κριθεί. Δεν καταγράφει τίποτα — μόνο οδηγεί πίσω. */
export type ReturnVerdict =
  | AcceptedVerdict
  | { readonly valid: false; readonly reason: WebhookRefusal };

/** Ο πάροχος. Κάθε μέθοδος που ρωτά το δίκτυο **ρίχνει** σε σφάλμα (ο καλών αποφασίζει retry). */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Ποιοι τρόποι είναι ενεργοί για αυτόν τον λογαριασμό εμπόρου. */
  readonly methods: readonly OnlinePaymentMethod[];
  startCheckout(request: CheckoutRequest): Promise<StartedCheckout>;
  readSettlement(subject: CheckoutSubject): Promise<CheckoutSettlement>;
  /**
   * Οι πληρωμές του παρόχου (`paymentReference`) που απέκτησαν **επιστροφή** από το `sinceIso` και μετά — το δίχτυ
   * ασφαλείας για επιστροφή με χαμένο webhook (ADR-ACC-030 §5.5): η συνεδρία της είναι ήδη `paid`, άρα το πέρασμα
   * των ανοιχτών συνεδριών δεν τη βλέπει ποτέ. Μπορεί να φέρει και λίγο παλαιότερες (ο πάροχος φιλτράρει ανά
   * ημέρα)· ο καλών συγχρονίζει ιδεμποτικά.
   */
  listRecentlyRefundedPayments(sinceIso: string): Promise<readonly string[]>;
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
