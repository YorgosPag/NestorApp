/**
 * @fileoverview **Βαθμίδες ευρημάτων ελέγχου παραστατικού — η ρίζα** (ADR-ACC-003 §22.8).
 * @module subapps/accounting/services/invoices/review-severity
 *
 * Πρακτική μεγάλων: ο EN 16931 (Schematron, ConnectingEurope) σημαδεύει κάθε κανόνα `fatal` ή `warning`· η SAP
 * χωρίζει μηνύματα E / W. Εδώ τρεις βαθμίδες, δηλωμένες **ανά κωδικό** δίπλα σε κάθε έλεγχο (`satisfies Record`):
 * - `block` — δεν διαβιβάζεται: ο builder δεν χτίζει payload.
 * - `warn`  — διαβιβάζεται, αλλά κάτι δείχνει λάθος· κρίνει ο άνθρωπος.
 * - `info`  — η εφαρμογή **δεν ξέρει** αυτόματα (κενό γνώσης, όχι λάθος του χρήστη).
 *
 * ⚠️ Καμία βαθμίδα δεν εμποδίζει την **αποθήκευση**: το πρόχειρο αποθηκεύεται πάντα (§22.2α / §22.4α).
 */

export const INVOICE_REVIEW_SEVERITIES = ['block', 'warn', 'info'] as const;
export type InvoiceReviewSeverity = (typeof INVOICE_REVIEW_SEVERITIES)[number];

/** Σειρά προβολής: το σοβαρότερο πρώτο. */
export function severityRank(severity: InvoiceReviewSeverity): number {
  return INVOICE_REVIEW_SEVERITIES.indexOf(severity);
}
