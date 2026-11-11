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
