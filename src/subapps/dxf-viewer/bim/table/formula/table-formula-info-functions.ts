/**
 * ADR-739 §49 — **οι πληροφοριακές συναρτήσεις**: οι μόνες που ρωτούν «τι **είδους** τιμή
 * είναι αυτή;» αντί «πόσο κάνει;». Καθαρές συναρτήσεις, μηδέν εξάρτηση από τη βιβλιοθήκη.
 *
 * ## 🔴 Γιατί δεν ανατίθενται, ενώ η βιβλιοθήκη τις έχει όλες
 * Μετρημένο στην 4.6.1: `ISERROR(new Error('#DIV/0!'))` επιστρέφει **`false`**. Η βιβλιοθήκη
 * δεν αναγνωρίζει σφάλμα από το είδος ή το μήνυμά του — αναγνωρίζει **τα δικά της
 * αντικείμενα, κατά ταυτότητα**. Ανάθεση θα σήμαινε ότι το `=ISERROR(A1)` πάνω σε κελί με
 * `#DIV/0!` απαντά «όχι»: σιωπηλά λάθος, ακριβώς στη συνάρτηση που υπάρχει για να πιάνει τα
 * λάθη.
 *
 * Και ανεξάρτητα από αυτό: το «τι **είναι** σφάλμα» το κατέχει ήδη ο
 * {@link isFormulaError} του `table-formula-value.ts`. Δεύτερος ορισμός ταυτότητας σε ιδιωτικό
 * πίνακα ξένης βιβλιοθήκης θα ήταν το ίδιο δίδυμο που πληρώνει το N.18 — με τη διαφορά ότι
 * εδώ η απόκλιση δεν σπάει τη μεταγλώττιση, απλώς απαντά λάθος.
 *
 * ## Είναι **διαφανείς στα σφάλματα** — και γι' αυτό δεν μπορούσαν ποτέ να ζουν στη γενική οδό
 * Ο αξιολογητής διαδίδει το πρώτο σφάλμα των ορισμάτων **πριν** καλέσει τη συνάρτηση (κανόνας
 * του Excel: μια `SUM` που περιέχει `#DIV/0!` δίνει `#DIV/0!`). Αν ίσχυε και εδώ, καμία
 * `IS*` δεν θα καλούνταν ποτέ πάνω σε σφάλμα — θα επέστρεφε το ίδιο το σφάλμα αντί για
 * `TRUE`. Δες τη σημαία `errorTransparent` στο `table-formula-functions.ts`.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-info-functions
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §49
 */

import {
  cellValueToNumber,
  FORMULA_ERROR,
  isFormulaError,
  type TableFormulaArgument,
  type TableFormulaFunction,
  type TableFormulaValue,
} from './table-formula-value';

/** Οι κωδικοί του Excel για την `ERROR.TYPE`, με τη δική του αρίθμηση. */
const ERROR_TYPE_NUMBERS: Readonly<Record<string, number>> = {
  '#NULL!': 1,
  '#DIV/0!': 2,
  '#VALUE!': 3,
  '#REF!': 4,
  '#NAME?': 5,
  '#NUM!': 6,
  '#N/A': 7,
  '#CALC!': 14,
};

/**
 * Η **μία** τιμή που εξετάζεται, ή `null` όταν το όρισμα δεν είναι μεμονωμένη τιμή.
 *
 * Ένα εύρος δεν έχει «είδος»: το `=ISNUMBER(A1:A3)` ρωτά για τρία πράγματα ταυτόχρονα και
 * στο Excel γεννά πίνακα. Εμείς δεν έχουμε πίνακες — άρα `#VALUE!`, όχι αυθαίρετη πρώτη τιμή.
 */
function inspected(args: readonly TableFormulaArgument[]): TableFormulaValue | null {
  const first = args[0];
  if (args.length !== 1 || first === undefined || first.kind !== 'value') return null;
  return first.value;
}

/** Τυποποιεί το «μία τιμή μέσα, μία τιμή έξω» ώστε να μη γραφτεί δεκατρείς φορές. */
function inspecting(
  answer: (value: TableFormulaValue) => TableFormulaValue,
): TableFormulaFunction {
  return (args) => {
    const value = inspected(args);
    return value === null ? FORMULA_ERROR.value : answer(value);
  };
}

/** True όταν η τιμή είναι το **κενό** που γεννά ένα άδειο κελί. */
const isBlank = (value: TableFormulaValue): boolean =>
  typeof value === 'string' && value.trim() === '';

/**
 * 🔴 Ο αριθμός πίσω από μια τιμή, ή `null` — **και γιατί δεν αρκεί το `typeof`**.
 *
 * Το κελί μας κρατά **κείμενο**: ένα κελί με `10` είναι το αλφαριθμητικό `'10'`. Ένα σκέτο
 * `typeof value === 'number'` θα έκανε το `=ISNUMBER(B1)` πάνω σε **στήλη ποσοτήτων** να
 * απαντά `FALSE` — δηλαδή η πιο προφανής χρήση της συνάρτησης θα ήταν και η πιο λάθος.
 *
 * Ρωτά τον ίδιο κριτή με όλη τη μηχανή ({@link cellValueToNumber}, ADR-576 πίσω από την πύλη
 * αυστηρότητας), οπότε το ελληνικό `2,5` μετρά ως αριθμός και το `Δοκός 12` όχι.
 *
 * ⚠️ **Μετρημένο όριο**: ένα κυριολεκτικό `=ISNUMBER("10")` απαντά κι αυτό `TRUE`, ενώ το
 * Excel λέει `FALSE`. Είναι αναπόφευκτο — τη στιγμή που φτάνει εδώ, το κυριολεκτικό κείμενο
 * `"10"` και το περιεχόμενο του κελιού `10` είναι **η ίδια ακριβώς τιμή**. Από τις δύο
 * αστοχίες επιλέγεται συνειδητά αυτή: η μία αφορά τύπο που κανείς δεν γράφει, η άλλη κάθε
 * στήλη κάθε πίνακα.
 */
function numericValue(value: TableFormulaValue): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || isFormulaError(value)) return null;
  return cellValueToNumber(value);
}

/** True όταν η τιμή είναι κείμενο — ούτε αριθμός, ούτε σφάλμα, ούτε κενό. */
const isText = (value: TableFormulaValue): boolean =>
  typeof value === 'string' &&
  !isFormulaError(value) &&
  !isBlank(value) &&
  numericValue(value) === null;

/**
 * Οι δεκατρείς πληροφοριακές, με τη σημασιολογία του Excel.
 *
 * Η `N` και η `NA` **δεν** είναι διαφανείς στα σφάλματα: στο Excel η `N(σφάλμα)` επιστρέφει
 * το σφάλμα, δηλαδή ακολουθεί τον γενικό κανόνα διάδοσης. Αυτό συμβαίνει από μόνο του — δεν
 * χρειάζεται κώδικας, χρειάζεται **να μην** μπουν στη λίστα διαφάνειας.
 */
export const TABLE_FORMULA_INFO_FUNCTIONS: Readonly<Record<string, TableFormulaFunction>> = {
  ISERROR: inspecting((value) => isFormulaError(value)),
  // Το `#N/A` δηλώνει «δεν βρέθηκε», όχι «κάτι πήγε στραβά» — γι' αυτό το Excel το εξαιρεί.
  ISERR: inspecting((value) => isFormulaError(value) && value !== FORMULA_ERROR.notAvailable),
  ISNA: inspecting((value) => value === FORMULA_ERROR.notAvailable),
  ISBLANK: inspecting(isBlank),
  ISLOGICAL: inspecting((value) => typeof value === 'boolean'),
  ISNUMBER: inspecting((value) => numericValue(value) !== null),
  ISTEXT: inspecting(isText),
  ISNONTEXT: inspecting((value) => !isText(value)),

  TYPE: inspecting((value) => {
    if (isFormulaError(value)) return 16;
    if (typeof value === 'boolean') return 4;
    return numericValue(value) === null ? 2 : 1;
  }),

  'ERROR.TYPE': inspecting((value) =>
    // Το `#CIRCULAR!` είναι δικό μας και δεν έχει αριθμό στο Excel: απαντά `#N/A`, όπως κάθε
    // τιμή που δεν είναι σφάλμα. Επινοημένος αριθμός θα ήταν αριθμός που κανείς δεν διαβάζει.
    typeof value === 'string' ? (ERROR_TYPE_NUMBERS[value] ?? FORMULA_ERROR.notAvailable)
      : FORMULA_ERROR.notAvailable,
  ),

  N: inspecting((value) => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    return numericValue(value) ?? 0;
  }),

  NA: (args) => (args.length === 0 ? FORMULA_ERROR.notAvailable : FORMULA_ERROR.value),
};

/**
 * Όσες πρέπει να **δουν** το σφάλμα αντί να τους διαδοθεί — δες την κεφαλίδα.
 *
 * Η λίστα ζει δίπλα στις υλοποιήσεις και όχι στον αξιολογητή: είναι ιδιότητα **της
 * συνάρτησης**, και σε δεύτερο αρχείο θα ήταν το πρώτο πράγμα που θα ξεχνιόταν όταν προστεθεί
 * η δέκατη τέταρτη.
 */
export const ERROR_TRANSPARENT_INFO_FUNCTIONS: readonly string[] = [
  'ISERROR', 'ISERR', 'ISNA', 'ISBLANK', 'ISLOGICAL',
  'ISNUMBER', 'ISTEXT', 'ISNONTEXT', 'TYPE', 'ERROR.TYPE',
];
