/**
 * @fileoverview Online πληρωμή τιμολογίου — λεξιλόγιο + συμβόλαιο σελίδας ↔ API (ADR-ACC-030)
 * @description Η **ρίζα** των τρόπων online πληρωμής (`card` · `iris`) και το συμβόλαιο του
 *   `POST /api/shares/[shareId]/invoice-payment/checkout`. Ζει στους τύπους της λογιστικής ώστε να το διαβάζουν
 *   **και** η δημόσια σελίδα (client) **και** ο διακομιστής (port παρόχου) — ένας ορισμός.
 *
 *   Τα πορτοφόλια Apple Pay / Google Pay είναι `card`: η σελίδα του παρόχου τα δείχνει όταν είναι ενεργά στον
 *   λογαριασμό εμπόρου και η συσκευή τα υποστηρίζει.
 */

import { isOneOf } from '@/lib/type-guards';

import type { InvoicePublicRefusal } from './invoice-public-view';

export const ONLINE_PAYMENT_METHODS = ['card', 'iris'] as const;

export type OnlinePaymentMethod = (typeof ONLINE_PAYMENT_METHODS)[number];

export function isOnlinePaymentMethod(value: unknown): value is OnlinePaymentMethod {
  return isOneOf(ONLINE_PAYMENT_METHODS, value);
}

/** Πώς ο browser φτάνει στον πάροχο: απλή ανακατεύθυνση ή φόρμα POST (IRIS Direct). */
export type CheckoutLaunch =
  | { readonly kind: 'redirect'; readonly url: string }
  | { readonly kind: 'form-post'; readonly url: string; readonly fields: Readonly<Record<string, string>> };

/** Το σώμα του αιτήματος: **ποτέ** ποσό — το ορίζει ο διακομιστής. */
export interface InvoiceCheckoutRequestBody {
  readonly method: OnlinePaymentMethod;
  readonly locale: 'el' | 'en';
  /** Η διαδρομή της σελίδας (`/shared/<token>`) — ελέγχεται ότι ανήκει στον ίδιο σύνδεσμο, ώστε η επιστροφή να μην είναι ανοιχτή ανακατεύθυνση. */
  readonly returnPath: string;
}

export type InvoiceCheckoutRefusal =
  | InvoicePublicRefusal
  /** Δεν οφείλεται ποσό (εξοφλήθηκε / ακυρώθηκε / δεν πληρώνεται με σύνδεσμο). */
  | 'not-payable'
  /** Ο τρόπος δεν είναι ενεργός για τον λογαριασμό εμπόρου. */
  | 'method-unavailable'
  /** Ο πάροχος δεν απάντησε — ο πελάτης μπορεί να ξαναδοκιμάσει ή να πληρώσει με μεταφορά. */
  | 'provider-unavailable';

export type InvoiceCheckoutResponse =
  | { readonly status: 'started'; readonly checkoutId: string; readonly launch: CheckoutLaunch }
  | { readonly status: 'refused'; readonly reason: InvoiceCheckoutRefusal };

/**
 * Η έκβαση μιας απόπειρας, όπως τη βλέπει η δημόσια σελίδα (`GET …/checkout?checkout=pchk_…`, ADR-ACC-030 §5.6) —
 * τίποτα πέρα από αυτό (ούτε ποσό, ούτε κωδικός παρόχου). Πρότυπο Stripe: η σελίδα επιστροφής ρωτά τον διακομιστή,
 * δεν μαντεύει από τη διεύθυνση.
 *   - `pending` — ανοιχτή, καμία γνωστή άρνηση (η σελίδα περιμένει).
 *   - `failed`  — ο πάροχος **αρνήθηκε** την απόπειρα· η συνεδρία μένει ανοιχτή στον διακομιστή, ο πελάτης ξαναδοκιμάζει.
 *   - `paid`    — εισπράχθηκε (η όψη θα πει «Εξοφλήθηκε»).
 *   - `closed`  — έληξε / ακυρώθηκε / δεν ξεκίνησε στον πάροχο.
 */
export const PAYMENT_ATTEMPT_OUTCOMES = ['pending', 'failed', 'paid', 'closed'] as const;

export type PaymentAttemptOutcome = (typeof PAYMENT_ATTEMPT_OUTCOMES)[number];

/** Το μοτίβο αναγνωριστικού απόπειρας στη διεύθυνση (`?payment=` / `?checkout=`) — ένας ορισμός client + server. */
export const PAYMENT_ATTEMPT_ID_PATTERN = /^pchk_[A-Za-z0-9-]{1,64}$/;

/** Η παράμετρος της **σελίδας** μετά την επιστροφή από τον πάροχο (`/shared/<token>?payment=pchk_…`). */
export const PAYMENT_PAGE_ATTEMPT_PARAM = 'payment';

/** Η παράμετρος του `GET …/invoice-payment/checkout?checkout=pchk_…` (έκβαση απόπειρας). */
export const INVOICE_CHECKOUT_ATTEMPT_PARAM = 'checkout';

/** Ξένη ή ανύπαρκτη απόπειρα ⇒ η **ίδια** άρνηση (`unknown-attempt`) — κανένα μαντείο ύπαρξης συνεδριών. */
export type InvoiceCheckoutAttemptResponse =
  | {
    readonly status: 'ok';
    readonly attempt: PaymentAttemptOutcome;
    /**
     * Πόσο μένει ως τη λήξη της συνεδρίας (η λήξη **του παρόχου**, §5.5), σε ms, με το ρολόι του **διακομιστή**· `0`
     * μετά τη λήξη. Σχετικό, όχι στιγμή: η σελίδα δεν συγκρίνει ποτέ με το ρολόι του browser (πρότυπο Stripe: η
     * αναμονή ακολουθεί το `expires_at` της συνεδρίας, όχι σταθερό χρονόμετρο).
     */
    readonly expiresInMs: number;
  }
  | { readonly status: 'refused'; readonly reason: 'visit-expired' | 'unknown-attempt' };
