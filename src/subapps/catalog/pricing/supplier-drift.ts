/**
 * **Η απόκλιση μιας γραμμής BOQ από την τιμή του προμηθευτή** (ADR-923 §5.12 Δ9 · Σ7): καθαρή κρίση, κοινή σε διακομιστή και οθόνη.
 *
 * Το αντίστοιχο του `judgeCostDrift`, για ξένη τιμή: εδώ δεν υπάρχει βιβλίο, αλλά μία νέα απάντηση του ίδιου επιλυτή.
 *
 * | Νέα απάντηση | Κρίση |
 * |---|---|
 * | `unavailable` | `unavailable`, χωρίς λόγο: το στιγμιότυπο μένει όπως είναι |
 * | `requestQuote` | `requestQuote`: το προϊόν φαίνεται, ποσό δεν υπάρχει |
 * | άλλη μονάδα | `unitChanged`: ποτέ σιωπηλή μετατροπή |
 * | ίδια τιμή ανά μονάδα | `current` |
 * | άλλη τιμή ανά μονάδα | `changed`, με Δ% και φράχτη |
 *
 * 🔑 Μόνο **κρίνει**. Η ανανέωση είναι ρητή πράξη (απόφαση #3).
 * 🔑 Ο φράχτης είναι ο **κοινός** της πλατφόρμας, ποτέ η παράκαμψη της λίστας: εκείνη ανήκει στον προμηθευτή και προστατεύει τη δική
 *    του δημοσίευση. Εδώ προστατεύεται ο αγοραστής, και η ρύθμιση του άλλου χώρου δεν θα έπρεπε ούτε να διαρρέει ούτε να τον δένει.
 * ⚠️ Η σύγκριση γίνεται ανά μονάδα, με στρογγύλευση σε μονάδες βάσης: το ποσό της κλίμακας για άλλη ποσότητα έχει στρογγύλευση
 *    λεπτού, που δεν είναι αλλαγή τιμής.
 *
 * @module subapps/catalog/pricing/supplier-drift
 */

import type { BasisPoints } from '@/lib/pricing/discount-rule';
import { ORDER_QUANTITY_DECIMALS, effectiveFenceBp } from '../vocabulary/pricing';
import { unitPriceChangeBp } from './diff-price-versions';
import type { ForeignPrice, ForeignQuote } from './foreign-quote';

/** Ό,τι κρατά η γραμμή BOQ και χρειάζεται η σύγκριση, χωρίς εξάρτηση από τους τύπους BOQ. */
export interface SupplierSnapshot {
  readonly unit: string;
  readonly priceQuantity: number;
  readonly breakdown: { readonly material: number };
}

export type SupplierDrift =
  | { readonly kind: 'current' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'requestQuote' }
  | { readonly kind: 'unitChanged' }
  | { readonly kind: 'changed'; readonly price: ForeignPrice; readonly changeBp: BasisPoints | null; readonly exceedsFence: boolean };

/** Γραμμές ανά κλήση ελέγχου: ο πελάτης κόβει σε δέσμες, ώστε ένα μεγάλο κτίριο να μην κρατά ένα αίτημα ανοιχτό. */
export const SUPPLIER_DRIFT_BATCH = 100;

/** Το `unitPriceChangeBp` μετρά με `BigInt`, ενώ η ποσότητα BOQ είναι δεκαδική (12,5 τ.μ.): σε ακέραιες χιλιοστές, όσα δέχεται ο επιλυτής. */
const wholeQuantity = (quantity: number): number => Math.round(quantity * 10 ** ORDER_QUANTITY_DECIMALS);

export function judgeSupplierDrift(snapshot: SupplierSnapshot, quote: ForeignQuote): SupplierDrift {
  if (quote.kind !== 'priced') return { kind: quote.kind };
  const { price } = quote;
  if (price.unitCode !== snapshot.unit) return { kind: 'unitChanged' };
  const changeBp = unitPriceChangeBp(
    { netPrice: snapshot.breakdown.material, priceQuantity: wholeQuantity(snapshot.priceQuantity) },
    { netPrice: price.netAmount, priceQuantity: wholeQuantity(price.quantity) },
  );
  if (changeBp === 0) return { kind: 'current' };
  return { kind: 'changed', price, changeBp, exceedsFence: changeBp === null || Math.abs(changeBp) > effectiveFenceBp(null) };
}
