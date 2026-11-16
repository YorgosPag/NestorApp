import 'server-only';

/**
 * @fileoverview Το **μητρώο των πληρωτέων αντικειμένων** — ποιος γραφέας καταγράφει τα χρήματα κάθε είδους
 *   (ADR-943 §5.6 · ADR-ACC-030 §2.3)
 * @description Ο συγχρονισμός με τον πάροχο (`syncCheckoutSettlement`) είναι **ένας** για κάθε είδος: διαβάζει την αλήθεια
 *   του παρόχου, βάζει τις κινήσεις σε χρονολογική σειρά, κλείνει τη συνεδρία. Το **μόνο** που διαφέρει ανά είδος είναι
 *   *πού* γράφεται μια κίνηση — εδώ αποφασίζεται, σε **ένα** σημείο. Κάθε handler είναι ο ΕΝΑΣ γραφέας του είδους του,
 *   ιδεμποτικός με ντετερμινιστική ταυτότητα από την αναφορά του παρόχου.
 *
 *   Το `switch` είναι εξαντλητικό πάνω στο `PayableSubject`: νέο είδος στο `PAYABLE_SUBJECT_KINDS` χωρίς handler **δεν
 *   μεταγλωττίζεται**. Στατικό μητρώο, όχι εγγραφή-στη-φόρτωση: ένα είδος που «ξέχασε» να εγγραφεί θα έχανε χρήματα σιωπηλά.
 */

import { recordInvoiceMovement } from '@/server/accounting/payments/invoice-payable-subject';

import type { PayableSubject } from './payable-subject';
import type { PaymentCheckoutRecord } from './payment-checkout-store';
import type { PaymentProvider, ProviderMovement } from './payment-provider';

/** Τι έγινε με μία κίνηση στον γραφέα του είδους. */
export type PayableMovementOutcome =
  /** Νέα κίνηση γράφτηκε. */
  | 'recorded'
  /** Η κίνηση υπήρχε ήδη (ίδια αναφορά παρόχου) — καμία εγγραφή. */
  | 'duplicate'
  /** Χρήματα για αντικείμενο που δεν βρέθηκε — χρειάζεται άνθρωπο (ο handler το καταγράφει ως σφάλμα). */
  | 'subject-absent';

/** Η είσοδος ενός handler: η συνεδρία, το αντικείμενό της (ήδη στενεμένο στο είδος), η κίνηση και ο πάροχος. */
export interface PayableMovementInput<S extends PayableSubject = PayableSubject> {
  readonly checkout: PaymentCheckoutRecord;
  readonly subject: S;
  readonly movement: ProviderMovement;
  readonly provider: PaymentProvider;
}

/** Καταγράφει **μία** κίνηση του παρόχου στον γραφέα του είδους της συνεδρίας. Σφάλμα βάσης ⇒ ρίχνει. */
export function recordPayableMovement(
  checkout: PaymentCheckoutRecord, movement: ProviderMovement, provider: PaymentProvider,
): Promise<PayableMovementOutcome> {
  const { subject } = checkout;
  switch (subject.kind) {
    case 'invoice':
      return recordInvoiceMovement({ checkout, subject, movement, provider });
  }
}
