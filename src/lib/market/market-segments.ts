/**
 * @fileoverview **ΤΑ ΤΜΗΜΑΤΑ ΑΓΟΡΑΣ** — η μία μονάδα στην οποία μετρώνται τιμές, και για τις αγγελίες μας
 * (ADR-890, πηγή Α) και για τα συμβόλαια του ΜΑΜΑ (ADR-889, πηγή Β).
 * @related ADR-889 §5.3 · ADR-890 §5.2 · `scripts/lib/market-transactions/mama-vocabulary.ts` (η πλευρά του ΜΑΜΑ)
 * @module lib/market/market-segments
 *
 * 🔑 **ΕΝΑ ΛΕΞΙΛΟΓΙΟ, ΔΥΟ ΠΗΓΕΣ.** Η απόσταση «ζητούν +X% από όσα υπογράφονται» (ADR-890 §3) έχει νόημα **μόνο**
 * αν οι δύο αριθμοί μετρούν το ίδιο πράγμα. Γι' αυτό το τμήμα ζει εδώ και το εισάγουν **και** ο γεννήτορας του
 * ΜΑΜΑ **και** η νυχτερινή σύνοψη των αγγελιών. Γεννήθηκε στο `scripts/` (ADR-889 Φ1) και μετακόμισε στη
 * Φ1 του ADR-890.
 *
 * 🔑 **Η σύνδεση πάει από το τμήμα προς τους τύπους.** Το ΜΑΜΑ έχει 20 κατηγορίες, αδρότερες από τους 14
 * τύπους της εφαρμογής (δεν ξεχωρίζει στούντιο από μεζονέτα). Μια αγγελία «μεζονέτα» μετρά στο `apartment`·
 * δεν επινοούμε ακρίβεια που η πηγή δεν έχει.
 *
 * ⚠️ **Φύλλο χωρίς runtime εισαγωγές από `@/`**: το διαβάζει και ο γεννήτορας (`tsx`).
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';

/** Τα τμήματα, με τη σειρά που δείχνονται. */
export const MARKET_SEGMENTS = ['apartment', 'house', 'commercial', 'land', 'storage', 'parking'] as const;

export type MarketSegment = (typeof MARKET_SEGMENTS)[number];

/** Πώς μετράται η τιμή του τμήματος: ανά τ.μ. της **σωστής** επιφάνειας, ή ανά μονάδα. */
export type SegmentMetric = 'perSqmBuilding' | 'perSqmPlot' | 'perUnit';

export const SEGMENT_METRIC: Readonly<Record<MarketSegment, SegmentMetric>> = {
  apartment: 'perSqmBuilding',
  house: 'perSqmBuilding',
  commercial: 'perSqmBuilding',
  // ⚠️ Το οικόπεδο μετριέται στο ΟΙΚΟΠΕΔΟ (ΜΑΜΑ στήλη 14)· στην αγγελία γης το `areaSqm` είναι το εμβαδόν γης.
  land: 'perSqmPlot',
  storage: 'perSqmBuilding',
  // Μια θέση στάθμευσης πουλιέται ως θέση. Το €/τ.μ. θέσης 12 τ.μ. δεν το χρησιμοποιεί κανείς στην αγορά.
  parking: 'perUnit',
};

/**
 * Τμήμα → οι τύποι της εφαρμογής που μετρούν σε αυτό.
 * Κενός πίνακας = η εφαρμογή **δεν** έχει τύπο για αυτό (θέση στάθμευσης). Ο αριθμός του ΜΑΜΑ υπάρχει, απλώς
 * δεν δένεται σε αγγελία.
 */
export const SEGMENT_PROPERTY_TYPES: Readonly<Record<MarketSegment, readonly PropertyTypeCanonical[]>> = {
  apartment: ['studio', 'apartment_1br', 'apartment', 'maisonette', 'penthouse', 'loft'],
  house: ['detached_house', 'villa'],
  commercial: ['shop', 'office', 'hall'],
  land: ['plot', 'parcel'],
  storage: ['storage'],
  parking: [],
};

const SEGMENT_OF_TYPE: ReadonlyMap<string, MarketSegment> = new Map(
  MARKET_SEGMENTS.flatMap((segment) => SEGMENT_PROPERTY_TYPES[segment].map((type) => [type, segment] as const)),
);

/** Ο τύπος ακινήτου → το τμήμα του, ή `null` για άγνωστο/κενό τύπο (δεν μαντεύουμε). */
export function marketSegmentOfType(type: string | null): MarketSegment | null {
  return type === null ? null : SEGMENT_OF_TYPE.get(type) ?? null;
}
