/**
 * **Ο προορισμός της αναζήτησης τόπου** — εξήχθη από το `PlaceSearchBox` (ADR-882 §3.7) ώστε το
 * κουτί να μείνει κάτω από το όριο μεγέθους· καμία αλλαγή συμπεριφοράς.
 *
 * @related ADR-841 §7 Α4.5 · ADR-846 Φ2 · ADR-883 · `PlaceSearchBox` (ο μόνος καταναλωτής)
 */

import {
  serializeListingFilters,
  DEFAULT_SEARCH_RADIUS_KM,
} from '@/lib/listings/listing-filters';
import { searchResultsHref } from '@/lib/listings/listing-routes';
import { landingModeFilters, type LandingMode } from '@/lib/landing/landing-modes';
import { serializeShowcaseFilters } from '@/lib/agency/showcase-filter';
import { agencyDirectoryHref } from '@/components/mandate/agency-directory-route';
import type { GeoPoint, GeoRegionRef } from '@/types/geo/coordinates';

/**
 * **Πού πάει ο επισκέπτης** — και **με τι** φτάνει εκεί.
 *
 * 🔴 **Η διακλάδωση είναι ΤΥΠΟΥ, όχι συνθήκης**: το {@link landingModeFilters}
 * επιστρέφει `null` **μόνο** για τους επαγγελματίες, γιατί η **Α5** το λέει ρητά —
 * *«οι επαγγελματίες δεν είναι τύπος αγγελίας»*. Ένα `if (mode === 'pros')` εδώ θα
 * ήταν **δεύτερη διατύπωση** του ίδιου κανόνα, ελεύθερη να αποκλίνει από το SSoT.
 *
 * ⚠️ **ΔΥΟ ΚΛΑΔΟΙ ΜΕ `return`, ΠΟΤΕ ternary**: ένα ternary ανάμεσα σε δύο διευθύνσεις
 * **φαρδαίνει τον τύπο σε `string`** *(`listing-routes.ts:71`)* και τυφλώνει τον φρουρό
 * του συνόρου *(CHECK 3.61)*. Κάθε κλάδος καλεί **τον δικό του** helper.
 *
 * ✅ **Η ΕΙΔΙΚΟΤΗΤΑ ΠΛΕΟΝ ΤΑΞΙΔΕΥΕΙ (Α4.5)** — η προηγούμενη γραφή έστελνε
 * `occupation: null` **επίτηδες**, γιατί η ρίζα δεν τη ρωτούσε. Τώρα τη ρωτά, και το
 * `serializeShowcaseFilters` την υποστήριζε **ήδη**: **καμία νέα μηχανή**.
 *
 * 🔴 **ΚΑΙ ΤΟ ΚΕΝΤΡΟ ΕΙΝΑΙ ΠΛΕΟΝ `null`-άβλε (Α4.5.δ)**: *«υδραυλικός **οπουδήποτε**»*
 * είναι νόμιμη ερώτηση μόλις υπάρξει δεύτερος άξονας. Το `landingModeFilters` δέχεται
 * ήδη `null` κέντρο· το `serializeShowcaseFilters` **δεν γράφει** κενά φίλτρα *(Φ2)*.
 */
export function destinationFor(
  mode: LandingMode,
  center: GeoPoint | null,
  occupation: string | null,
  region: GeoRegionRef | null = null,
) {
  const filters = landingModeFilters(mode, center);

  if (filters === null) {
    // 🔴 ADR-846 Φ2 μετονόμασε τον άξονα `near` → `where` (κλειστή ένωση κύκλος | διοικητική
    //    περιοχή). Αυτός ο καλών έμεινε στο `near` ⇒ `filters.where === undefined` περνούσε το
    //    `!== null` του σειριοποιητή ⇒ `isAdministrativeWhere(undefined)` ⇒ TypeError στην υποβολή.
    const params = serializeShowcaseFilters({
      occupation,
      // ADR-883: η περιοχή που διαλέχτηκε από τη λίστα ταξιδεύει ως ίδια — ο κατάλογος την ξέρει ήδη (ADR-846).
      where: region ?? (center === null ? null : { circle: { center, radiusKm: DEFAULT_SEARCH_RADIUS_KM } }),
    });
    return agencyDirectoryHref(params.toString());
  }

  // ADR-883: με περιοχή, το «πού» είναι το ΟΡΙΟ της — ο κύκλος του landing δεν έχει θέση.
  return searchResultsHref(serializeListingFilters(region === null ? filters : { ...filters, near: region }).toString());
}
