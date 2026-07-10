/**
 * Stair headroom thresholds — SSoT: ελάχιστο ελεύθερο ύψος (mm) πάνω από τη
 * nosing line, ανά building-code profile.
 *
 * Μετριέται κατακόρυφα από τη γραμμή που ενώνει τις μύτες των σκαλοπατιών
 * (nosing line) προς την κάτω παρειά του υπερκείμενου δομικού στοιχείου
 * (πλάκα / δοκάρι / οροφή), συνεχώς πάνω από όλη τη σκάλα.
 *
 * Πηγές:
 *   - NOK / Ελλάδα → Κτιριοδομικός Κανονισμός, Άρθρο 13 (Κλίμακες): 2200 mm.
 *   - IBC 2018 §1011.3: 2032 mm (80"). ADA / ICC A117.1: 2032 mm.
 *   - Λοιπά (Eurocode / NBC / NFPA / AS1657 / DIN): 2030 mm industry baseline.
 *
 * SSoT — καταναλώνεται ΚΑΙ από τον cheap 2D headroom proxy του
 * `stair-validator.ts` ΚΑΙ από τον `StairwellOpeningEngine` (auto-άνοιγμα
 * κλιμακοστασίου πάνω από σκάλα, ADR-632). ΕΝΑΣ πίνακας — καμία διπλή τιμή.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §9.2 Q29
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md
 */

import type { StairCodeProfile } from '../types/stair-types';

export const MIN_HEADROOM_MM: Readonly<Record<StairCodeProfile, number>> = {
  nok: 2200,       // Κτιριοδομικός Άρθρο 13 (ήταν 2030 — διόρθωση ADR-632)
  ibc: 2030,
  eurocode: 2030,
  ada: 2032,
  nbc: 2030,
  nfpa: 2030,
  as1657: 2030,
  din: 2030,
  none: 0,
};

/** Default (NOK — ελληνική νομοθεσία) όταν το profile είναι `'none'` / free-form. */
export const DEFAULT_MIN_HEADROOM_MM = MIN_HEADROOM_MM.nok;

/**
 * Ελάχιστο headroom (mm) για ένα code profile. Το `'none'` (free-form CAD)
 * γυρίζει 0 — ο caller αποφασίζει αν θα κάνει skip ή θα πέσει σε
 * `DEFAULT_MIN_HEADROOM_MM` (ο engine κρατά την τρύπα ακόμη και σε 'none',
 * γιατί η φυσική ανάγκη διέλευσης υπάρχει ανεξάρτητα από επιλογή κανονισμού).
 */
export function resolveMinHeadroomMm(profile: StairCodeProfile): number {
  return MIN_HEADROOM_MM[profile];
}
