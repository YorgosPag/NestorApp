/**
 * @fileoverview **ΤΙ ΔΙΑΒΑΖΕΙ Η ΑΓΓΕΛΙΑ ΑΠΟ ΤΟ ΚΤΙΡΙΟ — και άλλαξε;** Μία συνάρτηση απαντά και στα δύο.
 * @related ADR-919 §9 (βήμα 5) · ADR-777 §8.99.4 #5 · §14.5 · ADR-890 Φ0 · ADR-749
 * @module services/listings/building-listing-facts
 *
 * 🔑 **Ο ΑΝΙΧΝΕΥΤΗΣ ΑΛΛΑΓΗΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ Ο ΑΝΑΓΝΩΣΤΗΣ.** Το `readBuildingDoc` (`publish-public-listing.ts`)
 * χτίζει τα γεγονότα με το {@link buildingChainFactsOf}, και ο `PATCH /api/buildings` ρωτά «άλλαξαν;» με την
 * **ίδια** συνάρτηση. Έτσι πεδίο κτιρίου που διαβάζει η προβολή χωρίς να ξαναπροβάλλεται όταν αλλάζει είναι
 * **δομικά αδύνατο**: για να το διαβάσει η προβολή, πρέπει να μπει εδώ, και τότε το βλέπει και ο ανιχνευτής.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: ο handler απαριθμούσε με το χέρι `placeRef || projectId || constructionYearChanged`, δηλαδή
 * **δεύτερη λίστα** των πεδίων του αναγνώστη. Όταν το βήμα 3 (ADR-919 §7) πρόσθεσε `status` και
 * `completionDeclaration` στον αναγνώστη, η λίστα **δεν** τα ακολούθησε: ένα κτίριο που παραδιδόταν άφηνε τις
 * αγγελίες του να λένε «Γ' τρίμηνο 2027».
 *
 * ⚠️ **Ωμή σύγκριση, όχι σημασιολογική**: δεν ρωτάμε «άλλαξε το αποτέλεσμα του επιλυτή;» (π.χ. planning →
 * construction δεν αλλάζει τίποτα). Θα ήταν δεύτερο σημείο κρίσης του `resolveListingAvailability`. Η
 * επαναπροβολή είναι idempotent και η αλλαγή κατάστασης σπάνια ανθρώπινη πράξη.
 */

import { canonicalJson } from '@/lib/legal/canonical-json';
import type { BuildingAvailabilityFacts } from '@/lib/listings/listing-availability';
import type { PlaceRef } from '@/types/geo/public-place';

/** Ό,τι χρειάζεται η αλυσίδα από το κτίριο — **πέντε** πεδία, όχι ολόκληρο το έγγραφο. */
export interface BuildingChainFacts {
  readonly projectId: string | null;
  readonly placeRef: PlaceRef | null;
  /** Ωμή δήλωση έτους κατασκευής (ADR-890 Φ0) — την κρίνει η προβολή, όχι ο αναγνώστης. */
  readonly constructionYear: unknown;
  /** Κατάσταση + δημόσια υπόσχεση παράδοσης (ADR-919 §7) — ωμά· τα κρίνει ο `resolveListingAvailability`. */
  readonly availability: BuildingAvailabilityFacts;
}

type BuildingData = Readonly<Record<string, unknown>>;

/** Τα γεγονότα της αγγελίας από ωμό έγγραφο κτιρίου. Το απόν και το `null` είναι το ίδιο. */
export function buildingChainFactsOf(data: BuildingData): BuildingChainFacts {
  return {
    projectId: (data.projectId as string | undefined) ?? null,
    placeRef: (data.placeRef as PlaceRef | undefined) ?? null,
    constructionYear: data.constructionYear ?? null,
    availability: { status: data.status ?? null, completionDeclaration: data.completionDeclaration ?? null },
  };
}

/**
 * **Άλλαξε κάτι που διαβάζει η αγγελία;** — `stored` το αποθηκευμένο έγγραφο, `written` ό,τι γράφεται τώρα.
 *
 * ⚠️ Μόνο όταν **άλλαξε**: η αυτόματη αποθήκευση ξαναστέλνει όλα τα πεδία σε κάθε κύκλο, και ένα σκέτο `in`
 * θα ξαναπρόβαλλε όλο το έργο σε κάθε πληκτρολόγηση. Τα αντικείμενα (`placeRef`, `completionDeclaration`)
 * συγκρίνονται κανονικά (`canonicalJson`: ταξινομημένα κλειδιά), ποτέ με `!==`.
 */
export function buildingListingFactsChanged(stored: BuildingData, written: BuildingData): boolean {
  const before = canonicalJson(buildingChainFactsOf(stored));
  const after = canonicalJson(buildingChainFactsOf({ ...stored, ...written }));
  return before !== after;
}
