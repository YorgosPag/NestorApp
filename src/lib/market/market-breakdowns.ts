/**
 * @fileoverview **ΟΙ ΚΑΔΟΙ ΑΝΑΛΥΣΗΣ** — εμβαδόν, υπνοδωμάτια, όροφος: ποιος κάδος, ποια όρια, ποιο τμήμα
 * αναλύεται σε ποιον άξονα (ADR-890 §5.2).
 * @related ADR-890 · `types/area-market.ts` · `market-segments.ts`
 * @module lib/market/market-breakdowns
 *
 * 🔑 **Δηλωτικός πίνακας, όχι `if` σκορπισμένα.** Η σύνοψη, η σελίδα και οι ετικέτες i18n διαβάζουν τα ίδια
 * κλειδιά κάδων από εδώ. Νέος κάδος = μία γραμμή.
 *
 * 🔑 **Το οικόπεδο έχει ΑΛΛΗ κλίμακα εμβαδού.** Ένας κάδος «200+ τ.μ.» θα έβαζε σχεδόν κάθε οικόπεδο στον ίδιο
 * κάδο. Γι' αυτό η κλίμακα εξαρτάται από το `SEGMENT_METRIC` (επιφάνεια κτιρίου ή γης).
 *
 * ⚠️ Τα όρια είναι **[κάτω, άνω)**: το 80 ανήκει στο `80-119`, όχι στο `50-79`.
 */

import type { AreaBreakdownAxis } from '@/types/area-market';
import { SEGMENT_METRIC, type MarketSegment } from './market-segments';

/** Ένας κάδος: κλειδί (σταθερό, μπαίνει στο έγγραφο και στο i18n) και ημιανοιχτό διάστημα. */
export interface MarketBucket {
  readonly key: string;
  readonly min: number;
  /** `null` = χωρίς άνω όριο. */
  readonly max: number | null;
}

/** Εμβαδόν κτιρίου (τ.μ.). */
export const BUILDING_SIZE_BUCKETS: readonly MarketBucket[] = [
  { key: 'lt50', min: 0, max: 50 },
  { key: '50-79', min: 50, max: 80 },
  { key: '80-119', min: 80, max: 120 },
  { key: '120-199', min: 120, max: 200 },
  { key: 'gte200', min: 200, max: null },
];

/** Εμβαδόν γης (τ.μ.): αστικό οικόπεδο → αγροτεμάχιο (1 στρέμμα = 1.000 τ.μ.). */
export const LAND_SIZE_BUCKETS: readonly MarketBucket[] = [
  { key: 'lt500', min: 0, max: 500 },
  { key: '500-999', min: 500, max: 1000 },
  { key: '1000-3999', min: 1000, max: 4000 },
  { key: 'gte4000', min: 4000, max: null },
];

/** Υπνοδωμάτια (0 = στούντιο). */
export const BEDROOM_BUCKETS: readonly MarketBucket[] = [
  { key: '0', min: 0, max: 1 },
  { key: '1', min: 1, max: 2 },
  { key: '2', min: 2, max: 3 },
  { key: '3', min: 3, max: 4 },
  { key: 'gte4', min: 4, max: null },
];

/** Όροφος (αρνητικός = υπόγειο, 0 = ισόγειο). */
export const FLOOR_BUCKETS: readonly MarketBucket[] = [
  { key: 'basement', min: Number.NEGATIVE_INFINITY, max: 0 },
  { key: 'ground', min: 0, max: 1 },
  { key: '1-2', min: 1, max: 3 },
  { key: '3-4', min: 3, max: 5 },
  { key: 'gte5', min: 5, max: null },
];

/** Ποιοι άξονες έχουν νόημα για κάθε τμήμα. Το υπνοδωμάτιο δεν λέει τίποτα για κατάστημα ή οικόπεδο. */
export const SEGMENT_BREAKDOWN_AXES: Readonly<Record<MarketSegment, readonly AreaBreakdownAxis[]>> = {
  apartment: ['size', 'bedrooms', 'floor'],
  house: ['size', 'bedrooms'],
  commercial: ['size', 'floor'],
  land: ['size'],
  storage: ['size'],
  parking: [],
};

/** Οι κάδοι ενός άξονα για ένα τμήμα. */
export function bucketsFor(axis: AreaBreakdownAxis, segment: MarketSegment): readonly MarketBucket[] {
  switch (axis) {
    case 'size':
      return SEGMENT_METRIC[segment] === 'perSqmPlot' ? LAND_SIZE_BUCKETS : BUILDING_SIZE_BUCKETS;
    case 'bedrooms':
      return BEDROOM_BUCKETS;
    case 'floor':
      return FLOOR_BUCKETS;
  }
}

/** Ο κάδος μιας τιμής, ή `null` όταν η τιμή δεν ανήκει σε κανέναν (π.χ. αρνητικό εμβαδόν). */
export function bucketOf(buckets: readonly MarketBucket[], value: number): MarketBucket | null {
  return buckets.find((bucket) => value >= bucket.min && (bucket.max === null || value < bucket.max)) ?? null;
}
