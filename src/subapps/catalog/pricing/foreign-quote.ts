/**
 * **Τι βλέπει ο αγοραστής από την τιμή ενός ξένου καταλόγου** (ADR-923 §5.12 Δ4 · Δ8 · Σ7): καθαρή προβολή της ΜΙΑΣ κρίσης.
 *
 * Ο επιλυτής απαντά πλούσια, με ίχνος, καταρράκτη και ποσό καταλόγου, γιατί μιλά στον ιδιοκτήτη του. Προς ξένο χώρο φεύγει
 * **μόνο** αυτό το κλειστό σχήμα, χτισμένο πεδίο προς πεδίο: ό,τι δεν γράφεται εδώ δεν ταξιδεύει, ποτέ `...result`.
 *
 * | Κρίση | Τιμή | Απάντηση |
 * |---|---|---|
 * | `hidden` · ανύπαρκτο · διαγραμμένο · χωρίς σχέση | οποιαδήποτε | `unavailable`, **ίδια** για όλα (Σ7) |
 * | `visibleNoPrice` | οποιαδήποτε | `requestQuote`, χωρίς ποσό |
 * | `visible` | δεν βγήκε τιμή | `requestQuote`: το προϊόν φαίνεται, η τιμή του όχι |
 * | `visible` | `priced` | `priced` |
 *
 * @module subapps/catalog/pricing/foreign-quote
 */

import type { PriceQuoteResult } from '../types/price-list-requests';
import type { PriceAudience } from '../types/price-list';

/** Ό,τι χρειάζεται το στιγμιότυπο της γραμμής BOQ (Δ8): δείχνει σε αμετάβλητη έκδοση, άρα εξηγείται χρόνια μετά. */
export interface ForeignPrice {
  readonly priceListId: string;
  readonly priceListVersionId: string;
  readonly lineId: string;
  readonly subjectKey: string;
  readonly unitCode: string;
  readonly quantity: number;
  /** Το τελικό ποσό για αυτή την ποσότητα, σε λεπτά. */
  readonly netAmount: number;
  readonly discountSteps: readonly number[];
  readonly audience: PriceAudience | null;
}

export type ForeignQuote =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'requestQuote' }
  | { readonly kind: 'priced'; readonly price: ForeignPrice };

export const FOREIGN_UNAVAILABLE: ForeignQuote = { kind: 'unavailable' };
const REQUEST_QUOTE: ForeignQuote = { kind: 'requestQuote' };

export function foreignOutcomeOf(result: PriceQuoteResult): ForeignQuote {
  const visibility = result.visibility?.visibility ?? 'hidden';
  if (visibility === 'hidden') return FOREIGN_UNAVAILABLE;
  if (visibility === 'visibleNoPrice' || result.kind !== 'priced') return REQUEST_QUOTE;
  const { quote, priceListAudience } = result;
  return {
    kind: 'priced',
    price: {
      priceListId: quote.priceListId,
      priceListVersionId: quote.priceListVersionId,
      lineId: quote.lineId,
      subjectKey: quote.subjectKey,
      unitCode: quote.unitCode,
      quantity: quote.quantity,
      netAmount: quote.netAmount,
      discountSteps: quote.discountSteps,
      audience: priceListAudience,
    },
  };
}
