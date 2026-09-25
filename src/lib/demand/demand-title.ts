/**
 * @fileoverview **ΤΑ ΟΡΙΑ ΚΑΙ Ο ΚΑΘΑΡΙΣΜΟΣ ΤΟΥ ΟΝΟΜΑΤΟΣ ΜΙΑΣ ΖΗΤΗΣΗΣ** — ένα σημείο, τρεις φρουροί.
 * @related ADR-886 · types/property-demand.ts (`title`, `placeLabel`, `title-too-long`) · firestore.rules
 * @module lib/demand/demand-title
 *
 * 🔑 **ΤΡΕΙΣ ΦΡΟΥΡΟΙ, ΜΙΑ ΣΤΑΘΕΡΑ.** Το όριο το επιβάλλουν η φόρμα (zod), η πύλη γραφής
 * (`demandInvariantViolations`) και οι κανόνες Firestore — οι κανόνες είναι ο **server** εδώ, γιατί η
 * ζήτηση γράφεται απευθείας από τον browser. Οι κανόνες δεν μπορούν να κάνουν `import`· ο αριθμός τους
 * φυλάσσεται από τη σουίτα `property-demands.rules.test.ts`, που τον **διαβάζει από εδώ**.
 *
 * ⚠️ **Μήκος σε μονάδες UTF-16 (`.length`), επίτηδες.** Οι κανόνες μετρούν χαρακτήρες· για κάθε
 * κείμενο το `.length` είναι **ίσο ή μεγαλύτερο** (emoji = 2) ⇒ ο πελάτης είναι πάντα **αυστηρότερος**
 * από τον server, ποτέ πιο χαλαρός. Το αντίθετο θα έδινε «πέρασε στη φόρμα, απορρίφθηκε στην αποθήκευση».
 */

/** Ανώτατο μήκος του ονόματος που δίνει ο άνθρωπος. */
export const DEMAND_TITLE_MAX_LENGTH = 80;

/** Ανώτατο μήκος της ετικέτας τόπου (ό,τι επιστρέφει ο geocoder, π.χ. «Κορδελιό, Θεσσαλονίκη 563 34»). */
export const DEMAND_PLACE_LABEL_MAX_LENGTH = 160;

/** Χαρακτήρες ελέγχου (Unicode `Cc`) — αόρατοι, σπάνε διάταξη και email, δεν έχουν θέση σε όνομα. */
const CONTROL_CHARS = /\p{Cc}/gu;
const WHITESPACE_RUNS = /\s+/g;

/**
 * **Κανονικοποίηση ελεύθερου κειμένου-ετικέτας**: χαρακτήρες ελέγχου έξω, κάθε σειρά κενών → ένα
 * κενό, `trim`. Κενό αποτέλεσμα ⇒ `null` — «δεν έδωσε όνομα» είναι **μία** τιμή, όχι `''` και `null`.
 *
 * ⚠️ **Δεν κόβει στο όριο.** Ένα όνομα που κόπηκε σιωπηλά είναι όνομα που ο άνθρωπος **δεν** έγραψε·
 * το υπερβολικό μήκος είναι παραβίαση ({@link isDemandLabelTooLong}), όχι κάτι που «διορθώνουμε».
 */
export function normalizeDemandLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(CONTROL_CHARS, ' ').replace(WHITESPACE_RUNS, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

/** `true` όταν το όνομα ή η ετικέτα τόπου ξεπερνά το όριό του. */
export function isDemandLabelTooLong(demand: {
  readonly title?: string | null;
  readonly placeLabel?: string | null;
}): boolean {
  return (
    (demand.title?.length ?? 0) > DEMAND_TITLE_MAX_LENGTH ||
    (demand.placeLabel?.length ?? 0) > DEMAND_PLACE_LABEL_MAX_LENGTH
  );
}
