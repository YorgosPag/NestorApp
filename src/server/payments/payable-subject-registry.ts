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
import { recordIssuanceAdvanceMovement } from '@/services/document-registry/issuance-advance-payment.server';
import { judgeIssuanceAdvanceSettlement, recordIssuanceAdvanceSettlement } from '@/services/document-registry/issuance-advance-settlement.server';

import type { PayableSubject } from './payable-subject';
import type { CheckoutSettlementOrder, PaymentCheckoutRecord } from './payment-checkout-store';
import type { PaymentProvider, ProviderMovement } from './payment-provider';

/** Τι έγινε με μία κίνηση στον γραφέα του είδους. */
export type PayableMovementOutcome =
  /** Νέα κίνηση γράφτηκε. */
  | 'recorded'
  /** Η κίνηση υπήρχε ήδη (ίδια αναφορά παρόχου) — καμία εγγραφή. */
  | 'duplicate'
  /** Χρήματα για αντικείμενο που δεν βρέθηκε — χρειάζεται άνθρωπο (ο handler το καταγράφει ως σφάλμα). */
  | 'subject-absent'
  /**
   * ADR-943 §5.9 — ο γραφέας **αρνήθηκε** τα χρήματα (π.χ. προκαταβολή για ανάθεση που ακυρώθηκε στο μεταξύ, ή άλλο ποσό
   * από το εγκεκριμένο). Τα χρήματα μπήκαν· χρειάζεται άνθρωπο (ή την επιστροφή της Φ5) — ο handler το καταγράφει ως σφάλμα.
   */
  | 'subject-refused';

/** Η είσοδος ενός handler: η συνεδρία, το αντικείμενό της (ήδη στενεμένο στο είδος), η κίνηση και ο πάροχος. */
export interface PayableMovementInput<S extends PayableSubject = PayableSubject> {
  readonly checkout: PaymentCheckoutRecord;
  readonly subject: S;
  readonly movement: ProviderMovement;
  readonly provider: PaymentProvider;
  /**
   * ADR-943 Φ5γ (Θ-7) — πόσα έχει επιστρέψει **συνολικά** ο πάροχος για αυτή τη συνεδρία (από την ίδια ανάγνωση). Ένας
   * handler που αρνείται πληρωμή ξέρει έτσι αν τα χρήματα **έχουν ήδη γυρίσει** — καμία νέα εντολή επιστροφής, κανένας βρόχος.
   */
  readonly refundedTotalMinor: number;
}

/** Καταγράφει **μία** κίνηση του παρόχου στον γραφέα του είδους της συνεδρίας. Σφάλμα βάσης ⇒ ρίχνει. */
export function recordPayableMovement(
  checkout: PaymentCheckoutRecord, movement: ProviderMovement, provider: PaymentProvider, refundedTotalMinor: number,
): Promise<PayableMovementOutcome> {
  const { subject } = checkout;
  switch (subject.kind) {
    case 'invoice':
      return recordInvoiceMovement({ checkout, subject, movement, provider, refundedTotalMinor });
    case 'issuance-advance':
      return recordIssuanceAdvanceMovement({ checkout, subject, movement, provider, refundedTotalMinor });
  }
}

/**
 * ADR-943 Φ5 — **η κρίση του είδους** πριν κινηθούν κρατημένα χρήματα: `proceed` · `void` (η εντολή δεν ισχύει πια — σβήνει
 * χωρίς κίνηση) · `hold` (δεν κρίνεται τώρα — μένει, θέλει άνθρωπο). Σφάλμα ανάγνωσης ⇒ ρίχνει (ξαναδοκιμάζεται).
 */
export type SettlementJudgement =
  | 'proceed' | 'void' | 'hold'
  /**
   * ADR-943 Φ5γ (Θ-2) — η εντολή δεν μοιάζει πια με ό,τι λέει ο τομέας (π.χ. αυτόματη αποδέσμευση που πρόλαβε ακύρωση):
   * ο εκτελεστής την **ξαναγράφει** με αυτήν — η εντολή συγκλίνει στον τομέα, καμία δεν ξεχνιέται.
   */
  | { readonly reschedule: CheckoutSettlementOrder };

export function judgePayableSettlement(
  checkout: PaymentCheckoutRecord, order: CheckoutSettlementOrder, now: Date,
): Promise<SettlementJudgement> {
  const { subject } = checkout;
  switch (subject.kind) {
    // Το τιμολόγιο πληρώνεται στον έμπορο (`marketplace: null`) — δεν έχει ποτέ κρατημένα χρήματα να κινηθούν.
    case 'invoice':
      return Promise.resolve('void');
    case 'issuance-advance':
      return judgeIssuanceAdvanceSettlement(checkout, subject, order, now);
  }
}

/** ADR-943 Φ5 — **η καταγραφή** μιας ολοκληρωμένης κίνησης στον γραφέα του είδους. Ιδεμποτικό. Σφάλμα ⇒ ρίχνει. */
export function recordPayableSettlement(
  checkout: PaymentCheckoutRecord, order: CheckoutSettlementOrder, provider: PaymentProvider, transferReference: string | null,
): Promise<void> {
  const { subject } = checkout;
  switch (subject.kind) {
    case 'invoice':
      return Promise.resolve();
    case 'issuance-advance':
      return recordIssuanceAdvanceSettlement({ checkout, subject, order, provider, transferReference });
  }
}
