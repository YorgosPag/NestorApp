/**
 * **«Γράψτε μας» στη σελίδα παραστατικού** — το συμβόλαιο ανάμεσα στη σελίδα και στον διακομιστή (ADR-939).
 *
 * Ο πελάτης γράφει στον εκδότη μέσα από τη σελίδα του συνδέσμου. Το μήνυμα μπαίνει στα **ενιαία εισερχόμενα CRM**
 * (κανάλι `portal`) και η απάντηση του εκδότη φαίνεται εδώ. Η όψη περιέχει **μόνο** ό,τι χρειάζεται η σελίδα:
 * ποιος έγραψε (πελάτης / εκδότης), κείμενο, ώρα. Ποτέ ονόματα υπαλλήλων, ids εγγράφων ή email.
 *
 * Καθαροί τύποι, χωρίς React και χωρίς `server-only`: τους διαβάζουν και ο διακομιστής και η σελίδα.
 *
 * @module subapps/accounting/types/invoice-portal-messages
 */

import type { InvoicePublicRefusal } from './invoice-public-view';

/** Το μέγιστο μήκος ενός μηνύματος. Το ίδιο όριο ελέγχει η φόρμα και ο διακομιστής. */
export const INVOICE_PORTAL_MESSAGE_MAX_LENGTH = 2000;

/** Πόσα μηνύματα δείχνει η σελίδα (τα πιο πρόσφατα). Ένα νήμα παραστατικού δεν είναι συνομιλία χιλιάδων μηνυμάτων. */
export const INVOICE_PORTAL_THREAD_LIMIT = 50;

/** Ποιος έγραψε, όπως το βλέπει ο πελάτης. */
export type InvoicePortalAuthor = 'customer' | 'issuer';

export interface InvoicePortalMessage {
  readonly id: string;
  readonly author: InvoicePortalAuthor;
  readonly text: string;
  /** ISO 8601. */
  readonly sentAt: string;
}

/** Γιατί δεν δέχτηκε ο διακομιστής το μήνυμα, πέρα από τις αρνήσεις της σελίδας. */
export type InvoicePortalMessageRefusal =
  | InvoicePublicRefusal
  /** Κενό ή πάνω από `INVOICE_PORTAL_MESSAGE_MAX_LENGTH` χαρακτήρες. */
  | 'invalid-text'
  /** Εξαντλήθηκε το ημερήσιο όριο μηνυμάτων του συνδέσμου (`INVOICE_PORTAL_MESSAGE_DAILY_QUOTA`). */
  | 'quota-exhausted'
  /** Η αποθήκευση απέτυχε. Ο πελάτης κρατά το κείμενό του και ξαναδοκιμάζει. */
  | 'store-failed';

export interface InvoicePortalMessageRequestBody {
  readonly text: string;
}

export type InvoicePortalThreadResponse =
  | { readonly status: 'ok'; readonly messages: readonly InvoicePortalMessage[] }
  | { readonly status: 'refused'; readonly reason: InvoicePublicRefusal };

export type InvoicePortalPostResponse =
  | { readonly status: 'sent'; readonly messages: readonly InvoicePortalMessage[] }
  | { readonly status: 'refused'; readonly reason: InvoicePortalMessageRefusal };
