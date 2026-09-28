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
import type { ValueZoneVerdict } from './value-zone-at-point';

export interface ListingMarketArea {
  readonly id: string;
  readonly name: string;
}

/**
 * **Ο κάδος έτους κατασκευής της αγγελίας στην περιοχή** (ADR-890 §13.Α): ζητούμενη **και** συμβόλαιο του **ίδιου**
 * κάδου (`YEAR_BUILT_BUCKETS`), στην **ίδια** περιοχή με τα υπόλοιπα συμβόλαια. «Κτίρια 1960–1984: ζητούν Χ ·
 * συμβόλαια Υ» — σύγκριση εποχής με εποχή, όχι νεόδμητου με πολυκατοικία του '70.
 */
export interface ListingYearBuiltContext {
  /** Κλειδί κάδου του `YEAR_BUILT_BUCKETS`. */
  readonly bucket: string;
  /** Διάμεσος ζητούμενων του κάδου (τελευταία νύχτα) — `null` = δεν μετρήθηκε / δεν διαβάστηκε (ποτέ «καμία»). */
  readonly asking: StatCell | null;
  /** Διάμεσος συμβολαίων 12μήνου του κάδου — `null` = η περιοχή δεν έχει συμβόλαια σε αυτόν τον κάδο. */
  readonly contract: StatCell | null;
  /** (ζητούμενη ÷ συμβολαίου − 1) %, μόνο όταν και τα δύο περνούν το κατώφλι (`medianGapPct`). */
  readonly gapPct: number | null;
}

/** Τα συμβόλαια της περιοχής — εξαρτώνται από περιοχή **και** τμήμα αγοράς. */
export type ListingContractsContext =
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
      /** Διάμεσος «τίμημα ÷ (εμβαδόν × τιμή ζώνης)» των συμβολαίων της περιοχής, σε % — ή `null` όπως το `zone`. */
      readonly priceToZonePct: StatCell | null;
      /** Η ζητούμενη τιμή της αγγελίας στη μονάδα του τμήματος, ή `null` (χωρίς τιμή / μη αληθοφανής). */
      readonly askingUnitPrice: number | null;
      /** Ό,τι δήλωσε η αγγελία — για τις διαφορές κάθε συγκρίσιμης. */
      readonly target: { readonly size: number | null; readonly yearBuilt: number | null; readonly floor: number | null };
      readonly comparables: ComparableSalesResult;
      /** `null` = η αγγελία δεν δηλώνει έτος, ή το τμήμα δεν έχει κτίσμα (γη, θέσεις). */
      readonly yearBuilt: ListingYearBuiltContext | null;
    };

/**
 * **Η απάντηση της διαδρομής**: τα συμβόλαια **και** η ζώνη αντικειμενικής αξίας στη θέση της αγγελίας (ADR-889 Φ5).
 *
 * 🔑 Η ζώνη είναι **σε κάθε** παραλλαγή: δεν εξαρτάται ούτε από διοικητική περιοχή ούτε από τμήμα αγοράς — μόνο από
 * το αν η θέση είναι η ίδια η διεύθυνση. Ένα οικόπεδο χωρίς συγκρίσιμα συμβόλαια έχει κι αυτό τιμή ζώνης.
 */
export type ListingMarketContext = ListingContractsContext & { readonly valueZone: ValueZoneVerdict };

/**
 * **Η ζητούμενη τιμή ως % της τιμής ζώνης** — στο ίδιο μέτρο με το `priceToZonePct` των συμβολαίων, ώστε τα δύο να
 * συγκρίνονται απευθείας («ζητά 140% της ζώνης · τα συμβόλαια της περιοχής κλείνουν στο 101%»). **Δεν** είναι εκτίμηση
 * αξίας (ADR-889 §7): δύο λόγοι προς τον ίδιο δημόσιο παρονομαστή. `null` όταν λείπει κάποιο σκέλος.
 */
export function askingPctOfZone(context: ListingMarketContext): number | null {
  if (context.kind !== 'ready' || context.valueZone.kind !== 'ready' || context.askingUnitPrice === null) return null;
  // `priceToZonePct` null ⇒ τμήμα χωρίς κτίσμα (γη, θέσεις): η τιμή ζώνης δεν είναι εκεί μέτρο της ζητούμενης.
  if (context.priceToZonePct === null) return null;
  return Math.round((context.askingUnitPrice / context.valueZone.zone.price) * 100);
}

/** Η δημόσια διαδρομή — ΜΙΑ δήλωση για client και tests. */
export function listingMarketContextPath(listingId: string): string {
  return `/api/market/listing-context/${encodeURIComponent(listingId)}`;
}
