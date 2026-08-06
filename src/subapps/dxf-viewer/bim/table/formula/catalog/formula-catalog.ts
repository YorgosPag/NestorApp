/**
 * ADR-763 §4 — **ο κατάλογος**: τα δεδομένα του §3 δεμένα με το **πραγματικό** μητρώο κλήσεων.
 *
 * Απαντά σε τρεις ερωτήσεις, καθεμιά με έναν καταναλωτή:
 *  1. «Τι δείχνει η λίστα του διαλόγου;» → `TableInsertFunctionDialog`
 *  2. «Λείπει κάποια καλέσιμη από τον κατάλογο;» → το test πληρότητας
 *  3. «Υπάρχει στον κατάλογο όνομα που δεν καλείται;» → το ίδιο test, ανάποδα
 *
 * ## 🔴 Η ΤΟΜΗ ΕΙΝΑΙ Η ΠΡΟΔΙΑΓΡΑΦΗ — και οι δύο κατευθύνσεις είναι σφάλμα
 * Ο κατάλογος χτίζεται **μόνο** από ονόματα που το μητρώο όντως καλεί (fail-closed, ίδιο
 * σχήμα με το §49). Οι δύο αστοχίες είναι διαφορετικές και **καμία δεν είναι θεωρητική**:
 *
 *  - **Καλέσιμη χωρίς εγγραφή** ⇒ ο χρήστης δεν τη βρίσκει ποτέ στον διάλογο, ενώ δουλεύει.
 *    Αόρατη λειτουργία· ακριβώς αυτό συνέβη με τα έξι namespaces του CHECK 3.36.
 *  - **Εγγραφή χωρίς καλέσιμη** ⇒ ο διάλογος τη διαφημίζει, ο χρήστης την επιλέγει, το κελί
 *    απαντά `#NAME?`. **Χειρότερο**, γιατί το λάθος φαίνεται δικό του.
 *
 * Γι' αυτό ο runtime κατάλογος κάνει **τομή** (δεν δείχνει ό,τι δεν καλείται) και το test
 * απαιτεί **ισότητα** (τίποτα δεν λείπει, τίποτα δεν περισσεύει). Ένα από τα δύο θα ήταν
 * μισή απάντηση.
 *
 * @module subapps/dxf-viewer/bim/table/formula/catalog/formula-catalog
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §4
 */

import { TABLE_FORMULA_FUNCTIONS } from '../table-formula-functions';
import { TABLE_FORMULA_SPECIAL_FORMS } from '../table-formula-special-forms';
import { DOCUMENTED_FUNCTION_NAMES, FORMULA_CATEGORY_MEMBERS } from './formula-catalog-data';
import {
  FORMULA_CATEGORIES,
  type FormulaCatalogEntry,
  type FormulaCategory,
} from './formula-catalog-taxonomy';

/**
 * **Ό,τι μπορεί να γράψει ο χρήστης και να υπολογιστεί.**
 *
 * Οι ειδικές μορφές (`IF`, `IFERROR`…) ζουν σε ξεχωριστό μητρώο επειδή μόνο ο αξιολογητής
 * μπορεί να **μην** αξιολογήσει κλάδο — αλλά για τον χρήστη είναι συναρτήσεις όπως όλες. Δύο
 * μητρώα, μία ερώτηση: η ένωση γίνεται **εδώ**, μία φορά.
 */
const CALLABLE_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(TABLE_FORMULA_FUNCTIONS),
  ...Object.keys(TABLE_FORMULA_SPECIAL_FORMS),
]);

const DOCUMENTED: ReadonlySet<string> = new Set(DOCUMENTED_FUNCTION_NAMES);

/** Όνομα → κατηγορία, ισοπεδωμένο από τις λίστες του §3. */
function flattenMembers(): ReadonlyMap<string, FormulaCategory> {
  const byName = new Map<string, FormulaCategory>();
  for (const category of FORMULA_CATEGORIES) {
    for (const name of FORMULA_CATEGORY_MEMBERS[category]) {
      // Το **πρώτο** κερδίζει και το διπλότυπο αναφέρεται από το {@link duplicateCatalogNames}:
      // μια σιωπηλή αντικατάσταση εδώ θα μετακινούσε τη συνάρτηση σε κατηγορία που κανείς δεν
      // διάλεξε, και ο διάλογος θα φαινόταν απλώς «περίεργος».
      if (!byName.has(name)) byName.set(name, category);
    }
  }
  return byName;
}

const CATEGORY_BY_NAME = flattenMembers();

/**
 * Ο κατάλογος: **μόνο** ονόματα που είναι και καταγεγραμμένα και καλέσιμα, αλφαβητικά.
 *
 * Η ταξινόμηση είναι `localeCompare` με ρητό `'en'`: τα ονόματα των συναρτήσεων είναι
 * **λατινικά και ίδια σε κάθε γλώσσα** (το Excel δεν τα μεταφράζει στα ελληνικά), οπότε μια
 * ταξινόμηση εξαρτημένη από τη γλώσσα του χρήστη θα άλλαζε τη σειρά της λίστας χωρίς κανείς
 * να έχει ζητήσει διαφορετική σειρά.
 */
export const FORMULA_CATALOG: readonly FormulaCatalogEntry[] = [...CATEGORY_BY_NAME]
  .filter(([name]) => CALLABLE_NAMES.has(name))
  .map(([name, category]): FormulaCatalogEntry => ({
    name,
    category,
    documented: DOCUMENTED.has(name),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

/** Ο κατάλογος με κλειδί το όνομα — για τον διάλογο, που ρωτά για ένα κάθε φορά. */
export const FORMULA_CATALOG_BY_NAME: ReadonlyMap<string, FormulaCatalogEntry> = new Map(
  FORMULA_CATALOG.map((entry) => [entry.name, entry]),
);

/**
 * **Καλέσιμες που λείπουν από τον κατάλογο** — δηλαδή λειτουργία που δουλεύει και δεν
 * ανακαλύπτεται. Κενό ή κόκκινο· δεν υπάρχει baseline (ίδιος κανόνας με το §49).
 */
export function uncataloguedFunctionNames(): readonly string[] {
  return [...CALLABLE_NAMES].filter((name) => !CATEGORY_BY_NAME.has(name)).sort();
}

/**
 * **Εγγραφές που δεν αντιστοιχούν σε καλέσιμη** — δηλαδή ο διάλογος θα διαφήμιζε `#NAME?`.
 *
 * Ο πιο πιθανός τρόπος να συμβεί δεν είναι η φαντασία: είναι **ορθογραφία της γραφής Excel**.
 * Η βιβλιοθήκη εξάγει `CEILINGMATH` και το μητρώο το καταγράφει ως `CEILING.MATH` μέσω του
 * `EXCEL_NAME_OVERRIDES` — γράψε `CEILINGMATH` εδώ και η εγγραφή δείχνει στο πουθενά.
 */
export function phantomCatalogNames(): readonly string[] {
  return [...CATEGORY_BY_NAME.keys()].filter((name) => !CALLABLE_NAMES.has(name)).sort();
}

/** Ονόματα γραμμένα σε **περισσότερες από μία** κατηγορίες — μία σημασία, μία θέση. */
export function duplicateCatalogNames(): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const category of FORMULA_CATEGORIES) {
    for (const name of FORMULA_CATEGORY_MEMBERS[category]) {
      if (seen.has(name)) duplicates.add(name);
      seen.add(name);
    }
  }
  return [...duplicates].sort();
}

/**
 * Τεκμηριωμένα ονόματα που **δεν** υπάρχουν στον κατάλογο.
 *
 * Χωρίς αυτό, ένα ορθογραφικό λάθος στη λίστα του §3 θα σήμαινε απλώς ότι η τεκμηρίωση δεν
 * εμφανίζεται πουθενά — και τα δύο κλειδιά i18n θα έμεναν ορφανά χωρίς κανένα σημάδι.
 */
export function orphanDocumentedNames(): readonly string[] {
  return DOCUMENTED_FUNCTION_NAMES.filter((name) => !FORMULA_CATALOG_BY_NAME.has(name)).sort();
}
