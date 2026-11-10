/**
 * @fileoverview **Ταυτότητες πεδίων της φόρμας τιμολογίου — η μία πηγή** (ADR-ACC-003 §22.8).
 * @module subapps/accounting/components/invoices/forms/invoice-field-ids
 *
 * Ο έλεγχος πριν την έκδοση λέει **ποιο πεδίο** (άγκυρα, `invoice-review.ts`)· εδώ η άγκυρα γίνεται `id` στοιχείου.
 * Τα πεδία της φόρμας παίρνουν το `id` τους **από εδώ**, ώστε το «πήγαινε στο πεδίο» να μη μπορεί να δείξει σε
 * στοιχείο που μετονομάστηκε (μοτίβο GOV.UK error summary: κάθε εύρημα συνδέεται με το πεδίο του).
 */

import type { InvoiceReviewAnchor } from '@/subapps/accounting/services/invoices/invoice-review';

/** Τα σταθερά `id` (ένα ανά σελίδα — η φόρμα τιμολογίου είναι μία). */
export const INVOICE_FORM_FIELD_IDS = {
  type: 'invoiceType',
  paymentMethod: 'invoicePaymentMethod',
  withholdingRate: 'withholdingRate',
  customerVatNumber: 'customerVat',
  customerPostalCode: 'customerPostalCode',
  customerCountry: 'customerCountry',
} as const;

/** Η κάρτα μιας γραμμής (στόχος εστίασης με `tabIndex={-1}`). */
export function invoiceLineId(prefix: string, lineNumber: number): string {
  return `${prefix}-line-${lineNumber}`;
}

/** Ο επιλογέας αιτίας εξαίρεσης μιας γραμμής. */
export function invoiceLineVatExemptionId(prefix: string, lineNumber: number): string {
  return `${prefix}-line-${lineNumber}-vat-exemption`;
}

/** Το inline μήνυμα ευρημάτων μιας γραμμής (`aria-describedby`). */
export function invoiceLineReviewId(prefix: string, lineNumber: number): string {
  return `${prefix}-line-${lineNumber}-review`;
}

/** Το κουμπί «προσθήκη γραμμής» — στόχος του «καμία γραμμή». */
export function invoiceAddLineId(prefix: string): string {
  return `${prefix}-add-line`;
}

const CUSTOMER_FIELD_IDS = {
  vatNumber: INVOICE_FORM_FIELD_IDS.customerVatNumber,
  postalCode: INVOICE_FORM_FIELD_IDS.customerPostalCode,
  country: INVOICE_FORM_FIELD_IDS.customerCountry,
} as const satisfies Record<Extract<InvoiceReviewAnchor, { kind: 'customer' }>['field'], string>;

/** Άγκυρα → `id` στοιχείου· `null` όταν το πεδίο ζει εκτός φόρμας (στοιχεία επιχείρησης). */
export function invoiceFieldIdOf(prefix: string, anchor: InvoiceReviewAnchor): string | null {
  switch (anchor.kind) {
    case 'company':
      return null;
    case 'customer':
      return CUSTOMER_FIELD_IDS[anchor.field];
    case 'line':
      return anchor.field === 'vatExemption'
        ? invoiceLineVatExemptionId(prefix, anchor.lineNumber)
        : invoiceLineId(prefix, anchor.lineNumber);
    case 'invoice':
      return anchor.field === 'lines' ? invoiceAddLineId(prefix) : INVOICE_FORM_FIELD_IDS[anchor.field];
  }
}
