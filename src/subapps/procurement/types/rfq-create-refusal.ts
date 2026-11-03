/**
 * **Οι αρνήσεις της δημιουργίας RFQ** (ADR-923 §5.13 Ε6, Τ4) — κλειστό λεξιλόγιο, σταθεροί κωδικοί στο σύρμα.
 *
 * Ο server στέλνει `errorCode` και το μήνυμά του μένει για το log. Η φόρμα (Τ6) τον μεταφράζει με το κοινό
 * `explainProcurementError`, όπως τους κωδικούς των υλικών και των συμβάσεων πλαισίου (§5.11 «3γ» Βήμα 2).
 *
 * 🔑 Όλες κρίνονται **πριν** γραφτεί οτιδήποτε: το RFQ γεννιέται ατομικά, όλο ή τίποτα (πρότυπο Ariba/Coupa).
 * 🔒 Το `catalogSkuUnavailable` είναι **ένα** για ανύπαρκτο, κρυφό, ανακλημένο, ξένο και δικό σου SKU: ο επιλογέας
 *    δεν απαριθμεί καταλόγους (§5.13 Ε6α).
 *
 * @module subapps/procurement/types/rfq-create-refusal
 */

export const RFQ_CREATE_REFUSALS = [
  'catalogSkuUnavailable',
  'supplierNotAcceptingQuotes',
  'supplierContactUnavailable',
  'rfqTooLarge',
] as const;

export type RfqCreateRefusalCode = (typeof RFQ_CREATE_REFUSALS)[number];

/** Ο κωδικός HTTP κάθε άρνησης: η κατάσταση του προμηθευτή είναι σύγκρουση, τα υπόλοιπα άκυρο αίτημα. */
const REFUSAL_STATUS: Readonly<Record<RfqCreateRefusalCode, number>> = {
  catalogSkuUnavailable: 422,
  supplierNotAcceptingQuotes: 409,
  supplierContactUnavailable: 409,
  rfqTooLarge: 422,
};

export class RfqCreateRefusal extends Error {
  readonly errorCode: RfqCreateRefusalCode;
  readonly status: number;
  constructor(errorCode: RfqCreateRefusalCode, detail: string) {
    super(`RFQ create refused (${errorCode}): ${detail}`);
    this.name = 'RfqCreateRefusal';
    this.errorCode = errorCode;
    this.status = REFUSAL_STATUS[errorCode];
  }
}
