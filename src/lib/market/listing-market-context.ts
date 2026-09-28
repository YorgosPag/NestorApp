/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ «ΤΙΜΕΣ ΣΥΜΒΟΛΑΙΩΝ ΣΤΗΝ ΠΕΡΙΟΧΗ» ΤΗΣ ΣΕΛΙΔΑΣ ΑΓΓΕΛΙΑΣ** — ό,τι απαντά ο server και
 * διαβάζει ο client (ADR-889 Φ2 · ADR-890 Φ2).
 * @related `services/market/listing-market-context.service.ts` (ο συνθέτης) ·
 *   `app/api/market/listing-context/[listingId]/route.ts` (η διαδρομή) · `components/listing-detail/ListingMarketContext.tsx`
 * @module lib/market/listing-market-context
 *
 * 🔑 **Ο BROWSER ΔΕΝ ΚΑΤΕΒΑΖΕΙ ΓΡΑΜΜΕΣ.** Οι συγκρίσιμες υπολογίζονται στον server πάνω στο `rows/<id>.json`
 * (Αθήνα: 2,2 MB)· στον browser φτάνουν **οκτώ** γραμμές και δύο κελιά.
 *
 * 🔑 **Η ΠΕΡΙΟΧΗ ΕΙΝΑΙ Η ΛΕΠΤΟΤΕΡΗ ΠΟΥ ΑΡΚΕΙ.** Δ.Ε. πρώτα· αν δεν έχει αρκετά συμβόλαια του τμήματος, ο Δήμος —
 * **με το όνομά του**, ποτέ ντυμένος ως η Δ.Ε. (ίδια αναγωγή με τη σελίδα περιοχής).
 */

import type { ComparableSalesResult } from './comparable-sales';
import type { MarketSegment } from './market-segments';
import type { StatCell } from './market-statistics';

export interface ListingMarketArea {
  readonly id: string;
  readonly name: string;
}

export type ListingMarketContext =
  /** Η αγγελία δεν έχει διοικητική περιοχή (χωρίς θέση) ⇒ δεν συγκρίνεται. */
  | { readonly kind: 'no-area' }
  /** Είδος ακινήτου χωρίς τμήμα αγοράς ⇒ δεν υπάρχουν συγκρίσιμα συμβόλαια. */
  | { readonly kind: 'no-segment' }
  | {
      readonly kind: 'ready';
      readonly area: ListingMarketArea;
      readonly segment: MarketSegment;
      /** Η τελευταία ημερομηνία της πηγής (`YYYY-MM-DD`). */
      readonly asOf: string;
      readonly window: { readonly from: number; readonly to: number };
      /** Διάμεσος 12μήνου του τμήματος στην περιοχή. */
      readonly last12: StatCell;
      /** Τιμή ζώνης (πηγή Γ), ή `null` όπου δεν έχει νόημα. */
      readonly zone: StatCell | null;
      /** Η ζητούμενη τιμή της αγγελίας στη μονάδα του τμήματος, ή `null` (χωρίς τιμή / μη αληθοφανής). */
      readonly askingUnitPrice: number | null;
      /** Ό,τι δήλωσε η αγγελία — για τις διαφορές κάθε συγκρίσιμης. */
      readonly target: { readonly size: number | null; readonly yearBuilt: number | null; readonly floor: number | null };
      readonly comparables: ComparableSalesResult;
    };

/** Η δημόσια διαδρομή — ΜΙΑ δήλωση για client και tests. */
export function listingMarketContextPath(listingId: string): string {
  return `/api/market/listing-context/${encodeURIComponent(listingId)}`;
}
