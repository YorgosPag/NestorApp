/**
 * Η ταυτότητα του υποκειμένου μιας γραμμής τιμοκαταλόγου (ADR-923 §5.11): **μία** γραμμή ανά
 * υποκείμενο ανά έκδοση. Το ίδιο κλειδί ταιριάζει γραμμές ανάμεσα σε εκδόσεις (διαφορά) και
 * φτιάχνει το ντετερμινιστικό id της γραμμής (3β).
 *
 * @module subapps/catalog/pricing/price-line-subject
 */

import type { PriceLineSubject } from '../types/price-list';

/** Περιοχή «όλες» για εργασία χωρίς περιοχή. */
const ANY_REGION = '*';

export function priceLineSubjectKey(subject: PriceLineSubject): string {
  switch (subject.kind) {
    case 'variant':
      return `variant:${subject.variantId}`;
    case 'costItem':
      return `costItem:${subject.atoeCode}:${subject.region ?? ANY_REGION}`;
  }
}
