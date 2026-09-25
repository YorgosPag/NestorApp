/**
 * 🧱 **Τι εμποδίζει την υποβολή της φόρμας ζήτησης** — πέρα από τα invariants της οντότητας.
 *
 * Εξήχθη από το `demand-form-values.ts` (N.7.1 — το αρχείο πέρασε τις 500 γραμμές με το ADR-888).
 */

import type { DemandFormParsed } from './demand-form-values';

/**
 * Τα εμπόδια που είναι **της φόρμας**, όχι της οντότητας. Κλειστό σύνολο.
 *
 * ⚠️ **Δεν επικαλύπτονται με τα `DEMAND_INVARIANTS`, και ο διαχωρισμός είναι
 * σημασιολογικός**: εκείνα λένε «αυτή η ζήτηση δεν είναι έγκυρη ζήτηση»· αυτά λένε
 * «αυτή η φόρμα δεν έχει ακόμη αρκετά για να **φτιάξει** ζήτηση». Ένα κείμενο
 * περιοχής που δεν έχει λυθεί σε σημείο δεν είναι **άκυρη** ζήτηση — δεν είναι
 * ζήτηση **ακόμη**.
 */
export const DEMAND_FORM_BLOCKERS = [
  /** Διάλεξε «σε αυτή την περιοχή» αλλά η περιοχή δεν έχει λυθεί σε σημείο. */
  'place-unresolved',
  /**
   * **Ζ3/Ζ5** — διάλεξε «αυτό το κτίριο» αλλά **δεν έχει δείξει** ποιο.
   *
   * ⚠️ **Ξεχωριστό εμπόδιο από το `place-unresolved`, επίτηδες.** Εκείνο σημαίνει
   * «*το κείμενό σου δεν έγινε σημείο*» και θεραπεύεται με **ξαναγράψιμο**· αυτό
   * σημαίνει «*δεν έδειξες τόπο*» και θεραπεύεται με **κλικ στον χάρτη**. Κοινός
   * κωδικός θα έστελνε τον άνθρωπο να διορθώσει πεδίο που δεν υπάρχει στην οθόνη του.
   */
  'place-not-identified',
  /** **Ζ4** — διάλεξε «αυτή την περιοχή» αλλά δεν σχεδίασε κανένα σχήμα (ADR-888: πολλά σχήματα). */
  'area-not-drawn',
  /**
   * **Ζ4 δομημένη** — διάλεξε «μέτωπο δρόμου» αλλά ο άξονας έχει λιγότερα από 2 σημεία.
   *
   * ⚠️ **Δεν είναι το `axis-degenerate` της οντότητας.** Εκείνο κρίνει *«έχουν
   * διεύθυνση αυτά τα σημεία;»* — ερώτηση που προϋποθέτει ήδη 2 σημεία (ο τύπος
   * {@link GeoPolyline} το εγγυάται). Αυτό εδώ κρίνει *«υπάρχουν καν αρκετά σημεία;»*
   * — ερώτηση της **φόρμας**, πριν φτάσει καν στην πύλη της οντότητας.
   */
  'frontage-axis-missing',
  /** Διάλεξε παράθυρο αλλά λείπει άκρο. */
  'window-incomplete',
] as const;

export type DemandFormBlocker = (typeof DEMAND_FORM_BLOCKERS)[number];

/** Τι λείπει **από τη φόρμα** για να μπορεί να συντεθεί ζήτηση. Όλα, ποτέ το πρώτο. */
export function demandFormBlockers(values: DemandFormParsed): DemandFormBlocker[] {
  const found: DemandFormBlocker[] = [];

  if (values.placeKind === 'near' && values.placeCenter === null) {
    found.push('place-unresolved');
  }
  if (values.placeKind === 'place' && values.placeRef === null) {
    found.push('place-not-identified');
  }
  if (values.placeKind === 'area' && values.placeShapes.length === 0) {
    found.push('area-not-drawn');
  }
  if (
    values.placeKind === 'frontage' &&
    (values.frontageAxis === null || values.frontageAxis.length < 2)
  ) {
    found.push('frontage-axis-missing');
  }
  if (values.timingKind === 'window' && (values.fromDate === '' || values.toDate === '')) {
    found.push('window-incomplete');
  }

  return found;
}
