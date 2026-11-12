/**
 * @fileoverview Ο σύνδεσμος πληρωμής τιμολογίου — **ΠΟΤΕ** έχει νόημα και **ΤΙ** λέει στον πελάτη (ADR-ACC-018 §16)
 * @description Καθαρές κρίσεις πάνω στο `Invoice`. Τις ρωτούν ο κριτής δημιουργίας
 *   (`server/sharing/share-create-authority.ts`), η συνεδρία προβολής
 *   (`server/accounting/public-invoice/invoice-public-session.ts`) και το email (`send-email`). Η ίδια ερώτηση
 *   παίρνει την ίδια απάντηση σε όλα τα σημεία.
 *
 *   - **Σύνδεσμος γεννιέται** μόνο για απαίτηση (`isCollectibleInvoice`: όχι πιστωτικό, όχι ακυρωμένο, όχι
 *     πιστωμένο) που πληρώνεται με μεταφορά (`showsPaymentInstructions` — ο κανόνας των λογαριασμών του PDF) **ή**
 *     online με κάρτα / IRIS (ADR-ACC-030).
 *   - **Η σελίδα λέει** μία από τέσσερις καταστάσεις. Το «ακυρώθηκε» δεν κρύβεται πίσω από «δεν βρέθηκε»: ο
 *     πελάτης που κρατά τον σύνδεσμο έλαβε το παραστατικό και δικαιούται να μάθει ότι δεν οφείλει (Stripe:
 *     σελίδα «void»).
 *
 * @see ADR-ACC-018 §16 · `invoice-payment-accounts.ts` (λογαριασμοί) · `utils/invoice-open-amount.ts` (υπόλοιπο)
 */

import type { Invoice } from '../../types/invoice';
import { isOnlinePaymentMethod } from '../../types/online-payment';
import { invoiceOpenAmount, isCollectibleInvoice, isVoidedInvoice } from '../../utils/invoice-open-amount';
import { showsPaymentInstructions } from './invoice-payment-accounts';

type PaymentLinkSubject = Pick<Invoice, 'type' | 'paymentMethod' | 'mydata' | 'creditNoteInvoiceId'>;


/**
 * Μπορεί να δοθεί σύνδεσμος πληρωμής για αυτό το παραστατικό; Απαίτηση (όχι πιστωτικό/ακυρωμένο/πιστωμένο) που
 * πληρώνεται με μεταφορά (οδηγίες + QR) **ή** online (ADR-ACC-030). Οι λογαριασμοί στο PDF μένουν στον κανόνα
 * `showsPaymentInstructions` — δεν τυπώνουμε IBAN σε τιμολόγιο που δηλώνει «κάρτα».
 */
export function isPayableByLink(invoice: PaymentLinkSubject): boolean {
  return isCollectibleInvoice(invoice)
    && (showsPaymentInstructions(invoice) || isOnlinePaymentMethod(invoice.paymentMethod));
}

/** Τι βλέπει ο πελάτης στη σελίδα. Ονομασμένη κατάσταση, ποτέ boolean. */
export type InvoicePaymentStanding =
  /** Οφείλεται ποσό: οδηγίες πληρωμής + QR. */
  | 'payable'
  /** Εξοφλήθηκε: χωρίς μπλοκ πληρωμής. */
  | 'paid'
  /** Ακυρώθηκε: δεν οφείλεται τίποτα, μόνο στοιχεία επικοινωνίας. */
  | 'cancelled'
  /** Δεν πληρώνεται πια από σύνδεσμο (π.χ. ο τρόπος πληρωμής του πρόχειρου έγινε «μετρητά», ή πιστώθηκε). */
  | 'not-payable';

type StandingSubject = PaymentLinkSubject & Pick<Invoice, 'paymentStatus' | 'balanceDue' | 'totalGrossAmount'>;

/** Η κατάσταση της σελίδας. Το «ακυρώθηκε» κρίνεται πρώτο, γιατί ένα ακυρωμένο δεν «οφείλεται» ποτέ. */
export function invoicePaymentStanding(invoice: StandingSubject): InvoicePaymentStanding {
  if (isVoidedInvoice(invoice)) return 'cancelled';
  if (!isPayableByLink(invoice)) return 'not-payable';
  return invoice.paymentStatus === 'paid' ? 'paid' : 'payable';
}

/**
 * Το ποσό που **οφείλεται τώρα** (το υπόλοιπο). Αυτό κωδικοποιεί το QR της σελίδας, όπως το `amount_remaining` του
 * Stripe. Μόνο όταν η κατάσταση είναι `payable`, αλλιώς 0.
 */
export function invoiceAmountDueNow(invoice: StandingSubject): number {
  return invoicePaymentStanding(invoice) === 'payable' ? invoiceOpenAmount(invoice) : 0;
}
