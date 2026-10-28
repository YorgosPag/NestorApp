/**
 * Καθαρή αξία γραμμής προσφοράς (ποσότητα × τιμή μονάδας) — ΕΝΑ σημείο για τον server της πύλης
 * (`parsing.ts`), την επιβολή κλειδώματος (`applyRfqLineAuthority`, ADR-327 §8.5 Β) **και** το σύνολο
 * γραμμής που βλέπει ο προμηθευτής στη φόρμα (`vendor-quote-draft.draftLineTotal`).
 * Στρογγυλεμένη στο λεπτό (`roundMajor`): `1.333 × 47.5` αποθηκεύεται `63.32`, όχι `63.3175`.
 * @module subapps/procurement/utils/quote-line-total
 */
import { roundMajor } from '@/lib/money/money';

export function quoteLineTotal(quantity: number, unitPrice: number): number {
  return roundMajor(quantity * unitPrice);
}
