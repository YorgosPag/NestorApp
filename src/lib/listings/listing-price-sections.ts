/**
 * @fileoverview **ΟΙ ΚΛΑΣΕΙΣ ΣΥΓΚΡΙΣΙΜΟΤΗΤΑΣ ΤΗΣ ΤΙΜΗΣ — ό,τι είναι ΔΙΚΟ της δημόσιας αναζήτησης.**
 * @related ADR-777 §8.60.14 · §8.60.14.14 · lib/properties/price-class-sections.ts · lib/listings/listing-results-order.ts
 * @module lib/listings/listing-price-sections
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΕΜΕΙΝΕ ΕΔΩ — ΚΑΙ ΓΙΑΤΙ Η ΜΗΧΑΝΗ ΕΦΥΓΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η διαμέριση «πρώτα η μονάδα, μετά ο αριθμός» (Φάση 1) ζούσε εδώ, δεμένη στο `PublicListing`.
 * Η Φάση 4 (§8.60.14.14) τη χρειάστηκε σε **τέσσερις εσωτερικούς πίνακες** ⇒ **γενικεύτηκε** και
 * ανέβηκε στο `lib/properties/price-class-sections.ts` (`partitionByPriceClass<T>`). ⛔ Δεύτερη
 * υλοποίηση θα ήταν δεύτερη απάντηση στο ίδιο ερώτημα.
 *
 * Εδώ μένουν **μόνο** οι δύο αποφάσεις που ανήκουν στην αναζήτηση:
 *
 * 1. **Το σύνολο διαμονής** (§8.60.12 / §8.60.14.5): με ημερομηνίες, η μονάδα του τμήματος
 *    διαμονής γίνεται το **σύνολο** — όλο ή τίποτα **ανά τμήμα**.
 * 2. **Η ολική σειρά** για ισοπαλίες: τίτλος → `id`.
 *
 * ⚠️ **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΟΝ `listing-results-order.ts`** (N.7.1): εκείνο απαντά
 * *«ΠΟΙΕΣ σειρές προσφέρονται και πώς ζουν στη διεύθυνση»*· αυτό *«ΠΟΙΑ ποσά μπαίνουν στον ίδιο
 * άξονα, στην αναζήτηση»*.
 */

import { compareByNameThenId } from '@/lib/ordering/total-name-order';
import type { SortDirection } from '@/lib/array-utils';
import type { PriceClass, PriceRole } from '@/lib/properties/price-resolver';
import {
  countPriceClassSections,
  flattenPriceClassSections,
  partitionByPriceClass,
  type PriceClassSection,
  type PriceClassSections,
  type PricedEntry,
  type PriceKeyWithin,
} from '@/lib/properties/price-class-sections';
import { NO_STAY_TOTALS, type StayTotals } from '@/lib/listings/listing-stay-total';
import type { PublicListing } from '@/types/public-listing';

// ============================================================================
// ΤΑ ΤΜΗΜΑΤΑ — το γενικό σχήμα, με το όνομα της αναζήτησης
// ============================================================================

/**
 * **Η κλάση στην οποία ανήκει ένα τμήμα** — το {@link PriceClass} του `price-resolver`,
 * δηλαδή του ιδιοκτήτη του λεξιλογίου. Το ίδιο ερώτημα το ρωτά και το φίλτρο εύρους τιμής
 * (`lib/criteria`), και τα δύο δέντρα **δεν επιτρέπεται να εισάγουν το ένα το άλλο**
 * (κύκλος, CHECK 3.80). Τοπικό **ψευδώνυμο**, γιατί εδώ σημαίνει «επιγραφή τμήματος».
 */
export type ListingSectionHeading = PriceClass;

/** Ένα τμήμα της λίστας αποτελεσμάτων — το γενικό {@link PriceClassSection}, ποτέ δεύτερο σχήμα. */
export type ListingSection = PriceClassSection<PublicListing>;

/** Η λίστα ως **ακολουθία κλάσεων**. Πάντα ≥1 τμήμα όταν υπάρχει ≥1 αγγελία. */
export type ListingSections = PriceClassSections<PublicListing>;

/**
 * Ό,τι χρειάζεται η σειρά **πέρα από τις ίδιες τις αγγελίες** — σήμερα τα **σύνολα διαμονής**.
 * Αντικείμενο και όχι σκέτο όρισμα, ώστε μια δεύτερη εξάρτηση να μην αλλάξει κάθε καλούντα.
 */
export interface ListingOrderContext {
  readonly stayTotals: StayTotals;
}

/** Καμία ερώτηση ημερομηνιών. Ένα κοινό αντικείμενο, όχι νέο ανά απόδοση. */
export const NO_ORDER_CONTEXT: ListingOrderContext = Object.freeze({
  stayTotals: NO_STAY_TOTALS,
});

// ============================================================================
// ΟΙ ΔΥΟ ΑΠΟΦΑΣΕΙΣ ΤΗΣ ΑΝΑΖΗΤΗΣΗΣ
// ============================================================================

/** Ολική σειρά για ισοπαλίες και για την απουσία τιμής: τίτλος → `id`. */
function byTitleThenId(a: PublicListing, b: PublicListing): number {
  return compareByNameThenId(a.title, a.id, b.title, b.id);
}

/**
 * **Η μονάδα ενός τμήματος** — ποσό, ή σύνολο διαμονής.
 *
 * 🔴 **ΤΟ ΣΥΝΟΛΟ ΔΙΑΜΟΝΗΣ ΑΛΛΑΖΕΙ ΤΗ ΜΟΝΑΔΑ ΤΟΥ ΤΜΗΜΑΤΟΣ, ΚΑΙ ΕΙΝΑΙ ΟΛΟ Ή ΤΙΠΟΤΑ.** Αν το
 * τμήμα ταξινομούνταν με **σύνολο** για όσα το έχουν και **τιμή νύχτας** για τα υπόλοιπα, θα
 * είχαμε την ίδια αμαρτία ένα επίπεδο πιο κάτω: «250 € σύνολο» δίπλα σε «50 €/νύχτα». Μόλις
 * **έστω μία** αγγελία του τμήματος έχει σύνολο, η μονάδα **είναι** το σύνολο· όσες δεν το
 * έχουν **δεν είναι απάντηση** και πάνε στο τέλος, **και στις δύο** κατευθύνσεις.
 *
 * ⚠️ Το σύνολο είναι σε **λεπτά** και η τιμή σε **ακέραιες μονάδες** — δεν αναμειγνύονται
 * ποτέ, ακριβώς επειδή η επιλογή είναι όλο-ή-τίποτα **ανά τμήμα**. Επιστρέφει `undefined`
 * (⇒ το ποσό, η προεπιλογή της μηχανής) όταν το τμήμα δεν ρωτά σύνολο.
 */
function stayTotalKey(context: ListingOrderContext) {
  return (
    role: PriceRole,
    group: readonly PricedEntry<PublicListing>[],
  ): PriceKeyWithin<PublicListing> | undefined => {
    if (role !== 'nightly') return undefined;
    if (!group.some((entry) => context.stayTotals[entry.item.id] !== undefined)) return undefined;
    return (entry) => context.stayTotals[entry.item.id]?.totalMinor ?? null;
  };
}

/**
 * **Οι αγγελίες σε ΚΛΑΣΕΙΣ, ταξινομημένες μέσα σε καθεμία** — η γενική μηχανή, με τις δύο
 * αποφάσεις της αναζήτησης. Μία κλάση ⇒ καμία επιγραφή.
 */
export function partitionListingsByPriceClass(
  listings: readonly PublicListing[],
  direction: SortDirection,
  context: ListingOrderContext,
): ListingSections {
  return partitionByPriceClass(listings, {
    direction,
    tieBreak: byTitleThenId,
    keyWithin: stayTotalKey(context),
  });
}

// ============================================================================
// ΠΡΟΒΟΛΕΣ — τα ονόματα που ήδη διαβάζει η οθόνη, πάνω στη ΜΙΑ υλοποίηση
// ============================================================================

/**
 * Τα τμήματα ως **ένας** πίνακας. ⚠️ Ο **μόνος** νόμιμος καταναλωτής είναι η συμπτυγμένη
 * γραμμή των αγγελιών χωρίς θέση (`UnmappedListingsRow`), που δείχνει **μόνο τίτλους**.
 */
export const flattenListingSections: (sections: ListingSections) => readonly PublicListing[] =
  flattenPriceClassSections;

/** Πόσες αγγελίες περιέχουν συνολικά τα τμήματα — **η λογιστική του §8.62 κλείνει εδώ**. */
export const countListingSections: (sections: ListingSections) => number =
  countPriceClassSections;
