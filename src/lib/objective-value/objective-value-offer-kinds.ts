/**
 * @fileoverview **Σε ποια διάθεση έχει θέση η αντικειμενική αξία** (ADR-898 §23) — ένας ολικός πίνακας ανά είδος
 * διάθεσης, με τον λόγο γραμμένο σε κάθε κελί.
 * @related `listing-objective-value.ts` (ό,τι βλέπει ο αγοραστής) · `services/listings/public-listing-objective-value.ts`
 *   (η προβολή: τι μπαίνει στο JSON) · `components/owner-property/improve/improve-sections.ts` (ποιες ενότητες ρωτά η
 *   «Βελτίωσε την αγγελία σου») · πρότυπο `lib/legality/legality-offer-matrix.ts` (κάθε κελί απαντά ρητά)
 * @module lib/objective-value/objective-value-offer-kinds
 *
 * 🔑 **Μόνο η πώληση** (απόφαση Giorgio 2026-11-21): η αντικειμενική είναι η βάση του φόρου μεταβίβασης — ο φόρος
 *   υπολογίζεται στη μεγαλύτερη από τίμημα και αντικειμενική. Αφορά όποιον **αγοράζει**. Ο ενοικιαστής και ο φιλοξενούμενος
 *   δεν πληρώνουν τίποτα πάνω της, άρα στην αγγελία τους είναι θόρυβος. Το ίδιο κάνουν οι μεγάλοι: το idealista δεν
 *   δείχνει την κτηματολογική αξία στην αγγελία, και κανένα portal δεν τη δίνει ως επιλογή σε αγγελία μίσθωσης.
 *
 * 🔑 **Πίνακας, όχι λίστα**: σε λίστα το απόν είναι σιωπηλό. Ένα νέο είδος διάθεσης στο `OFFER_KINDS` δεν
 *   μεταγλωττίζεται μέχρι κάποιος να απαντήσει **εδώ**, με λόγο.
 *
 * ⚠️ **Ισχύει για ό,τι βλέπει το ΚΟΙΝΟ**, όχι για τα εργαλεία του κατόχου: η μηχανή, ο υπολογιστής και η καρτέλα του
 *   γραφείου δουλεύουν για κάθε ακίνητο. Ο κάτοχος μπορεί να θέλει το ποσό για δικό του λόγο (φόροι, μελλοντική πώληση).
 *
 * **Layering**: leaf — καθαροί τύποι, μηδέν I/O.
 */

import type { OfferKind } from '@/types/property-offers';

/** Η απάντηση ενός κελιού: δείχνεται ή όχι, και **γιατί**. */
export interface ObjectiveValueOfferRelevance {
  readonly shown: boolean;
  readonly reason: string;
}

/** Η μίσθωση δεν μεταβιβάζει: κανένας φόρος δεν υπολογίζεται πάνω στην αντικειμενική. */
const NO_TRANSFER: ObjectiveValueOfferRelevance = {
  shown: false,
  reason: 'η μίσθωση δεν μεταβιβάζει — ο ενοικιαστής δεν πληρώνει τίποτα πάνω στην αντικειμενική',
};

export const OBJECTIVE_VALUE_OF_OFFER_KIND: Readonly<Record<OfferKind, ObjectiveValueOfferRelevance>> = {
  sell: {
    shown: true,
    reason: 'βάση του φόρου μεταβίβασης — υπολογίζεται στη μεγαλύτερη από τίμημα και αντικειμενική',
  },
  leaseOut: NO_TRANSFER,
  leaseShort: NO_TRANSFER,
  exchange: {
    shown: false,
    reason: 'η αντιπαροχή είναι συμφωνία με κατασκευαστή, όχι αγγελία προς αγοραστή (απόφαση 2026-11-21: μόνο πώληση)',
  },
};

/** **Ο ΕΝΑΣ κριτής**: δείχνει η αγγελία αντικειμενική για αυτές τις διαθέσεις; Αρκεί μία διάθεση που τη σηκώνει. */
export function offersObjectiveValue(offerKinds: readonly OfferKind[]): boolean {
  return offerKinds.some((kind) => OBJECTIVE_VALUE_OF_OFFER_KIND[kind].shown);
}
