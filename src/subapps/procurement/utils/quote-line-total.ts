/**
 * Καθαρή αξία γραμμής προσφοράς (ποσότητα × τιμή μονάδας) — ΕΝΑ σημείο για τον server της πύλης
 * (`parsing.ts`) και την επιβολή κλειδώματος (`applyRfqLineAuthority`, ADR-327 §8.5 Β).
 * @module subapps/procurement/utils/quote-line-total
 */
export function quoteLineTotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}
