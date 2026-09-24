/**
 * **Έχει νόημα η ερώτηση «πότε και πόσοι;» σε αυτή την αναζήτηση;** — μία απόφαση, με άγκυρα.
 *
 * @related ADR-777 §8.80 · ADR-835 · StayFilterChip · lib/listings/listing-filters
 * @module components/search-results/filters/stay-search-relevance
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ (στιγμιότυπο του Giorgio, 2026-09-24)**: σε αναζήτηση **«Πώληση»** η οθόνη έδειχνε
 * άφιξη, αναχώρηση, άτομα, κατοικίδια και δύο παραγράφους για σκύλους βοήθειας. Ερωτήσεις που δεν
 * έχουν νόημα για ένα διαμέρισμα προς πώληση — Airbnb τις ρωτά επειδή **είναι** διαμονή, η Zillow
 * δεν τις ρωτά ποτέ.
 *
 * Κανόνας, με σειρά προτεραιότητας:
 *   1. **Υπάρχει ήδη ενεργή ερώτηση διαμονής ⇒ ΠΑΝΤΑ ορατή.** Ενεργό φίλτρο δεν κρύβεται ποτέ —
 *      αλλιώς ο άνθρωπος θα έβλεπε λιγότερα αποτελέσματα χωρίς να βρίσκει το χειριστήριο που τα
 *      έκοψε (το «αδιέξοδο» που ο «Καθαρισμός» υπάρχει για να αποκλείσει).
 *   2. **Καμία διάθεση επιλεγμένη ⇒ ορατή**: η αναζήτηση περιέχει και βραχυχρόνιες.
 *   3. **Επιλεγμένες διαθέσεις ⇒ ορατή μόνο αν κάποια είναι βραχυχρόνια.**
 */
import { valuesOf } from '@/lib/criteria/listing-criteria';
import type { ListingFilters } from '@/lib/listings/listing-filters';
import type { OfferKind } from '@/types/property-offers';

const STAY_OFFER_KIND: OfferKind = 'leaseShort';

/** Πόσες ερωτήσεις διαμονής είναι ενεργές (παράθυρο · άτομα · κατοικίδια). */
export function askedStayCount(filters: Pick<ListingFilters, 'stayWindow' | 'guests' | 'pets'>): number {
  return [filters.stayWindow, filters.guests, filters.pets].filter((value) => value !== null).length;
}

export function staySearchRelevant(filters: ListingFilters): boolean {
  if (askedStayCount(filters) > 0) return true;
  const offerKinds = valuesOf(filters.criteria, 'offerKind') ?? [];
  return offerKinds.length === 0 || offerKinds.includes(STAY_OFFER_KIND);
}
