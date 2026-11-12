/**
 * @fileoverview Εξόφληση τιμολογίου — **η ΜΙΑ** καθαρή συνάρτηση που παράγει `totalPaid` / `balanceDue` /
 *   `paymentStatus` από τις κινήσεις `payments[]` (ADR-ACC-030 §4).
 * @description Τα τρία πεδία είναι **παράγωγα**: δεν γράφονται ποτέ μόνα τους, μόνο ως αποτέλεσμα αυτής της
 *   συνάρτησης. Την καλούν: η δημιουργία τιμολογίου (αρχική κατάσταση), ο ΕΝΑΣ γραφέας πληρωμής
 *   (`server/accounting/payments/invoice-payment-ledger.ts`) και η αλλαγή γραμμών πρόχειρου (νέο σύνολο ⇒ νέο
 *   υπόλοιπο). Ίδια ερώτηση ⇒ ίδια απάντηση παντού.
 *
 *   - Η επιστροφή (`kind: 'refund'`) **δεν ξανανοίγει** την οφειλή (ADR-ACC-030 §5.10, 2026-11-13 — πρότυπο Stripe:
 *     μετά από refund το τιμολόγιο μένει `paid` με `amount_remaining = 0`· Xero / Zoho: η επιστροφή πάει σε
 *     πιστωτικό ή υπερπληρωμή). Την οφειλή τη μειώνει **μόνο** το πιστωτικό (`relatedInvoiceId`, καθολικό
 *     απαιτήσεων). Η επιστροφή μετριέται χωριστά (`totalRefunded`)· η πληρωμή δεν σβήνεται ποτέ.
 *     🔴 Πριν: η επιστροφή αφαιρούνταν από το εισπραγμένο ⇒ μετά από πλήρη επιστροφή το τιμολόγιο γινόταν
 *     «απλήρωτο» και η δημόσια σελίδα ξαναζητούσε πληρωμή από τον πελάτη που μόλις αποζημιώθηκε.
 *   - Το υπόλοιπο δεν πέφτει κάτω από 0: υπερπληρωμή = «εξοφλημένο» (το πλεόνασμα είναι θέμα πίστωσης πελάτη,
 *     όχι αρνητικό υπόλοιπο τιμολογίου — Xero «overpayment»).
 *   - Η παρακράτηση δεν αφαιρείται εδώ: ακολουθεί τη σημερινή σημασία του `balanceDue` (ADR-ACC-018 §16, εκτός
 *     εμβέλειας).
 *
 * @see ADR-ACC-030 · `utils/invoice-open-amount.ts` (ανοιχτό ποσό) · `invoice-payment-link.ts` (κατάσταση σελίδας)
 */

import type { Invoice, InvoicePayment, InvoicePaymentStatus } from '../../types/invoice';
import { roundToTwo } from '../../utils/math';

/** Τα πεδία πληρωμής του τιμολογίου — τα γράφει ΜΟΝΟ ο διακομιστής (`SERVER_OWNED_INVOICE_FIELDS`). */
export interface InvoicePaymentState {
  readonly payments: InvoicePayment[];
  /** Ό,τι **πληρώθηκε** (μόνο πληρωμές — Stripe `amount_paid`). */
  readonly totalPaid: number;
  /** Ό,τι **επιστράφηκε** στον πελάτη (μόνο επιστροφές). Δεν αλλάζει την οφειλή. */
  readonly totalRefunded: number;
  readonly balanceDue: number;
  readonly paymentStatus: InvoicePaymentStatus;
}

/** Επιστροφή χρημάτων; (`kind` απόν σε παλιές κινήσεις = πληρωμή) */
export function isRefundMovement(payment: Pick<InvoicePayment, 'kind'>): boolean {
  return payment.kind === 'refund';
}

function sumOf(payments: readonly InvoicePayment[], refunds: boolean): number {
  return roundToTwo(payments.reduce((sum, payment) => (isRefundMovement(payment) === refunds ? sum + payment.amount : sum), 0));
}

function statusOf(totalPaid: number, totalGrossAmount: number): InvoicePaymentStatus {
  if (totalPaid <= 0) return 'unpaid';
  return totalPaid >= totalGrossAmount ? 'paid' : 'partial';
}

/** Η κατάσταση πληρωμής που προκύπτει από το σύνολο και τις κινήσεις. */
export function settleInvoicePayments(
  totalGrossAmount: number,
  payments: readonly InvoicePayment[],
): InvoicePaymentState {
  const totalPaid = sumOf(payments, false);
  return {
    payments: [...payments],
    totalPaid,
    totalRefunded: sumOf(payments, true),
    balanceDue: roundToTwo(Math.max(0, totalGrossAmount - totalPaid)),
    paymentStatus: statusOf(totalPaid, totalGrossAmount),
  };
}

/** Η αρχική κατάσταση νέου παραστατικού: καμία κίνηση, οφείλεται όλο το ποσό. */
export function initialInvoicePaymentState(totalGrossAmount: number): InvoicePaymentState {
  return settleInvoicePayments(totalGrossAmount, []);
}

/** Έχει ήδη καταγραφεί αυτή η κίνηση; (ιδεμποτία του γραφέα — ίδιο `paymentId` ⇒ ίδια κίνηση) */
export function hasInvoicePayment(invoice: Pick<Invoice, 'payments'>, paymentId: string): boolean {
  return (invoice.payments ?? []).some((payment) => payment.paymentId === paymentId);
}
