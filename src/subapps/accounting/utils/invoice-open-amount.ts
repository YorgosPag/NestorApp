/**
 * @fileoverview Ανοιχτό ποσό τιμολογίου — SSoT
 * @description «Πόσα περιμένουμε να πληρωθούν σε αυτό το τιμολόγιο;» Το ρωτούν ΔΥΟ σημεία που ΠΡΕΠΕΙ να
 *   συμφωνούν: η βαθμολόγηση αντιστοίχισης (`matching-adapters`) και η ανάκτηση υποψηφίων κατά ποσό
 *   (`accounting-repo-match-candidates`). Αν διαφωνούσαν, το στένεμα θα έκρυβε το σωστό τιμολόγιο.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 2 — στένεμα υποψηφίων)
 */

import type { Invoice } from '../types/invoice';

/** Το πεδίο του εγγράφου που φέρει το ανοιχτό ποσό — ένα ερώτημα εύρους ανά πεδίο. */
export type InvoiceOpenAmountField = 'balanceDue' | 'totalGrossAmount';

/** Θετικό υπόλοιπο ⇒ το υπόλοιπο· αλλιώς (παλιά / ελλιπή δεδομένα) το συνολικό ποσό. */
export function invoiceOpenAmountField(invoice: Pick<Invoice, 'balanceDue'>): InvoiceOpenAmountField {
  return invoice.balanceDue > 0 ? 'balanceDue' : 'totalGrossAmount';
}

export function invoiceOpenAmount(invoice: Pick<Invoice, 'balanceDue' | 'totalGrossAmount'>): number {
  return invoice[invoiceOpenAmountField(invoice)];
}
