/**
 * CHECK 12 / ADR-598 G13 — ΤΟ ΚΛΕΙΣΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΜΗΧΑΝΗΣ ΠΟΛΙΤΙΚΗΣ ΑΔΕΙΩΝ.
 *
 * Κάθε πακέτο παίρνει **ακριβώς μία** `PACKAGE_STATE` και κάθε απόφαση πολιτικής (εξαίρεση ή
 * επιμέλεια) **ακριβώς μία** `DECISION_STATE`. Άγνωστη κατάσταση ⇒ `throw` με όνομα (πρότυπο
 * `tallyOf` του CHECK 3.69). Κάθε κάδος τυπώνεται **και στο μηδέν**: ένα «0» που δεν τυπώνεται
 * διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
 *
 * Κατηγορίες: Google `licenseclassifier/license_type.go` + `sourceAvailable` (FSL — η γενιά
 * της BUSL, που η Google έχει forbidden· εδώ επιτρέπεται **μόνο** με εξαίρεση ανά κυκλοφορία).
 */

'use strict';

const CATEGORY = Object.freeze({
  FORBIDDEN: 'forbidden',
  RESTRICTED: 'restricted',
  SOURCE_AVAILABLE: 'sourceAvailable',
  BY_EXCEPTION_ONLY: 'byExceptionOnly',
  RECIPROCAL: 'reciprocal',
  UNKNOWN: 'unknown',
  NOTICE: 'notice',
  UNENCUMBERED: 'unencumbered',
});

/**
 * Αυστηρότητα: μεγαλύτερο = αυστηρότερο. Είναι **σημασιολογία της μηχανής**, όχι ρύθμιση:
 * με αυτήν το `OR` διαλέγει την ευνοϊκότερη και το `AND` την αυστηρότερη κατηγορία.
 * ⚠️ Το `unknown` είναι ΠΑΝΩ από το `notice`: σε `MIT AND <άγνωστο>` ισχύει και η άγνωστη
 * υποχρέωση — δεν επιτρέπεται να «αραιωθεί» από την γνωστή.
 */
const CATEGORY_RANK = Object.freeze([
  CATEGORY.UNENCUMBERED,
  CATEGORY.NOTICE,
  CATEGORY.UNKNOWN,
  CATEGORY.RECIPROCAL,
  CATEGORY.BY_EXCEPTION_ONLY,
  CATEGORY.SOURCE_AVAILABLE,
  CATEGORY.RESTRICTED,
  CATEGORY.FORBIDDEN,
]);

const rankOf = (category) => {
  const i = CATEGORY_RANK.indexOf(category);
  if (i < 0) throw new Error(`license-policy — άγνωστη κατηγορία «${category}»`);
  return i;
};

const DECISION = Object.freeze({ ALLOW: 'allow', EXCEPTION: 'exception', BLOCK: 'block' });

const PACKAGE_STATE = Object.freeze({
  ALLOWED: 'allowed',
  CURATED: 'curated',
  EXCEPTED: 'excepted',
  CONVERTED: 'converted',
  FORBIDDEN: 'forbidden',
  RESTRICTED: 'restricted',
  RECIPROCAL_UNEXCEPTED: 'reciprocal-unexcepted',
  SOURCE_AVAILABLE_UNEXCEPTED: 'source-available-unexcepted',
  BY_EXCEPTION_ONLY_UNEXCEPTED: 'by-exception-only-unexcepted',
  UNKNOWN_LICENSE: 'unknown-license',
  EXCEPTION_LICENSE_DRIFT: 'exception-license-drift',
  CURATION_LICENSE_DRIFT: 'curation-license-drift',
  EXCEPTION_EXPIRED: 'exception-expired',
  MODIFIED_COPYLEFT: 'modified-copyleft',
  FORBIDDEN_EXCEPTION_REFUSED: 'forbidden-exception-refused',
});

/** Η απόφαση ανθρώπου που λείπει, ανά κατηγορία που δεν επιτρέπεται αυτόματα. */
const UNEXCEPTED_STATE = Object.freeze({
  [CATEGORY.FORBIDDEN]: PACKAGE_STATE.FORBIDDEN,
  [CATEGORY.RESTRICTED]: PACKAGE_STATE.RESTRICTED,
  [CATEGORY.SOURCE_AVAILABLE]: PACKAGE_STATE.SOURCE_AVAILABLE_UNEXCEPTED,
  [CATEGORY.BY_EXCEPTION_ONLY]: PACKAGE_STATE.BY_EXCEPTION_ONLY_UNEXCEPTED,
  [CATEGORY.RECIPROCAL]: PACKAGE_STATE.RECIPROCAL_UNEXCEPTED,
  [CATEGORY.UNKNOWN]: PACKAGE_STATE.UNKNOWN_LICENSE,
});

/** exit 1 — «μέτρησα, και η πολιτική λέει όχι». */
const BLOCKING_PACKAGE_STATES = Object.freeze([
  PACKAGE_STATE.FORBIDDEN,
  PACKAGE_STATE.RESTRICTED,
  PACKAGE_STATE.RECIPROCAL_UNEXCEPTED,
  PACKAGE_STATE.SOURCE_AVAILABLE_UNEXCEPTED,
  PACKAGE_STATE.BY_EXCEPTION_ONLY_UNEXCEPTED,
  PACKAGE_STATE.UNKNOWN_LICENSE,
  PACKAGE_STATE.EXCEPTION_LICENSE_DRIFT,
  PACKAGE_STATE.CURATION_LICENSE_DRIFT,
  PACKAGE_STATE.EXCEPTION_EXPIRED,
  PACKAGE_STATE.MODIFIED_COPYLEFT,
  PACKAGE_STATE.FORBIDDEN_EXCEPTION_REFUSED,
]);

/** Κατηγορίες όπου μια τοπική τροποποίηση (patch) ενεργοποιεί υποχρεώσεις. */
const MODIFICATION_SENSITIVE = Object.freeze([
  CATEGORY.RESTRICTED,
  CATEGORY.RECIPROCAL,
  CATEGORY.SOURCE_AVAILABLE,
  CATEGORY.BY_EXCEPTION_ONLY,
]);

/** Κατάσταση κάθε εγγραφής πολιτικής — ενημερωτικές, ΔΕΝ μπλοκάρουν. */
const DECISION_STATE = Object.freeze({
  IN_USE: 'in-use',
  CONVERSION_DUE: 'conversion-due',
  CONVERTED: 'converted-retire',
  UNNEEDED: 'unneeded-retire',
  PRUNED: 'pruned',
  /**
   * Υπάρχει στο lockfile, αλλά όχι εγκατεστημένο **σε αυτή την πλατφόρμα** (π.χ. το
   * `@img/sharp-libvips-linux-x64` σε Windows). ⚠️ Χωριστή κατάσταση επίτηδες: να το λέγαμε
   * «σε χρήση» θα ήταν ψέμα, να το λέγαμε «κλαδεμένο» θα έσπρωχνε σε διαγραφή μιας έγκρισης
   * που χρειάζεται η **παραγωγή** (Netcup = linux) — την κρίνει το CI σε ubuntu.
   */
  NOT_INSTALLED_HERE: 'not-installed-here',
  DEV_SCOPE_NOT_EVALUATED: 'dev-scope-not-evaluated',
});

/** Πόσες ημέρες πριν το `convertsOn` αρχίζει η υπενθύμιση. */
const CONVERSION_NOTICE_DAYS = 90;

/**
 * Κωδικοί εξόδου (σύμβαση Snyk CLI / Monitoring Plugins):
 *   0 — μετρήθηκε, καθαρό · 1 — μετρήθηκε, παράβαση πολιτικής · 2 — ΔΕΝ μετρήθηκε (UNKNOWN).
 */
const EXIT = Object.freeze({ OK: 0, VIOLATION: 1, UNKNOWN: 2 });

module.exports = {
  CATEGORY,
  CATEGORY_RANK,
  rankOf,
  DECISION,
  PACKAGE_STATE,
  UNEXCEPTED_STATE,
  BLOCKING_PACKAGE_STATES,
  MODIFICATION_SENSITIVE,
  DECISION_STATE,
  CONVERSION_NOTICE_DAYS,
  EXIT,
};
