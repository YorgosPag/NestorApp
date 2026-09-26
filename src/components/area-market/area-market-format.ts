/**
 * @fileoverview **ΤΟ ΚΕΙΜΕΝΟ ΜΙΑΣ ΤΙΜΗΣ ΜΟΝΑΔΑΣ** — «2.450 €/m²», «9 €/m²/μήνα», ή ποσό ανά θέση όπου το τμήμα
 * μετριέται ανά μονάδα (ADR-890 Φ1).
 * @related `lib/listings/listing-price-label.ts` (οι ΜΙΑ δρόμοι μορφοποίησης τιμής) · `lib/market/market-segments.ts`
 * @module components/area-market/area-market-format
 *
 * 🔑 **Κανένα νέο κλειδί μονάδας**: η σειρά «/m²/μήνα» είναι ήδη γλωσσική απόφαση του `common`
 * (`PRICE_PER_AREA_KEY` · `PRICE_AMOUNT_KEY`). Εδώ μόνο διαλέγουμε ποιο από τα δύο, από το `SEGMENT_METRIC`.
 */

import { pricePerAreaLabel, resolvedPriceLabel, type PriceLabelT } from '@/lib/listings/listing-price-label';
import { SEGMENT_METRIC, type MarketSegment } from '@/lib/market/market-segments';
import type { AskingOffer } from '@/types/area-market';

/** Τιμή μονάδας του τμήματος, με τη μονάδα του ρόλου (πώληση/ενοίκιο). */
export function unitPriceLabel(t: PriceLabelT, offer: AskingOffer, segment: MarketSegment, amount: number): string {
  const price = { role: offer, amount };
  return SEGMENT_METRIC[segment] === 'perUnit' ? resolvedPriceLabel(t, price) : pricePerAreaLabel(t, price);
}

/** Συνολική ζητούμενη τιμή (ή μηνιαίο ενοίκιο), με τη μονάδα του ρόλου. */
export function askingAmountLabel(t: PriceLabelT, offer: AskingOffer, amount: number): string {
  return resolvedPriceLabel(t, { role: offer, amount });
}
