/**
 * ADR-739 §48 — **η γέφυρα**: το ένα σημείο όπου το λεξιλόγιο του πίνακα συναντά το
 * λεξιλόγιο της βιβλιοθήκης. Καθαρές συναρτήσεις· δεν διαβάζει μοντέλο και δεν γράφει.
 *
 * ## Τέσσερις μεταφράσεις, όλες μετρημένες πάνω στην 4.6.1
 * 1. **Ορίσματα**: το εύρος γίνεται επίπεδος ή 2Δ πίνακας — δες {@link FormulaLibraryShape}.
 * 2. **Σφάλματα**: η βιβλιοθήκη επιστρέφει (δεν πετά) στιγμιότυπα `Error` με το κείμενο του
 *    Excel στο `message`. Δέκα κωδικοί, μετρημένοι από το `utils.errors`.
 * 3. **Ημερομηνίες**: επιστρέφει `Date` εκεί που το Excel επιστρέφει **σειριακό αριθμό** —
 *    το παραδέχεται και η ίδια η τεκμηρίωσή της. Εδώ διορθώνεται.
 * 4. **Πίνακες**: ό,τι γυρίζει πίνακα δεν χωρά σε κελί. Οι σχετικές συναρτήσεις είναι ήδη
 *    απορριφθείσες· αυτό εδώ είναι το **δίχτυ**, όχι η πρώτη γραμμή άμυνας.
 *
 * @module subapps/dxf-viewer/bim/table/formula/library/formula-library-bridge
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §48
 */

import type { TableFormulaErrorCode } from '../../../../types/table-formula';
import {
  cellValueToNumber,
  FORMULA_ERROR,
  type TableFormulaArgument,
  type TableFormulaValue,
} from '../table-formula-value';
import type { FormulaLibraryShape } from './formula-library-taxonomy';

/**
 * Οι **δέκα** κωδικοί που μπορεί να παραγάγει η βιβλιοθήκη, χαρτογραφημένοι στους δικούς μας.
 *
 * Μετρημένοι, όχι υποτιθέμενοι: είναι ολόκληρο το `utils.errors` της 4.6.1. Οι επτά
 * αντιστοιχούν ένα προς ένα· οι τρεις τελευταίοι όχι, και ο λόγος γράφεται δίπλα τους.
 */
const LIBRARY_ERROR_CODES: Readonly<Record<string, TableFormulaErrorCode>> = {
  '#DIV/0!': FORMULA_ERROR.divideByZero,
  '#VALUE!': FORMULA_ERROR.value,
  '#REF!': FORMULA_ERROR.reference,
  '#NAME?': FORMULA_ERROR.name,
  '#NUM!': FORMULA_ERROR.number,
  '#N/A': FORMULA_ERROR.notAvailable,
  '#NULL!': FORMULA_ERROR.nullRange,
  '#CALC!': FORMULA_ERROR.calculation,
  // Μεταβατική **κατάσταση** του Excel («περιμένω δεδομένα»), όχι τιμή. Ο υπολογισμός μας
  // είναι σύγχρονος και πεπερασμένος: δεν υπάρχει τίποτα να περιμένει κανείς.
  '#GETTING_DATA': FORMULA_ERROR.value,
  // Δεν είναι κωδικός του Excel καθόλου — δικό της γενικό. Ό,τι δεν έχει όνομα στο Excel δεν
  // επιτρέπεται να γραφτεί σε παραδοτέο: γίνεται ο γενικός κωδικός που το Excel **έχει**.
  '#ERROR!': FORMULA_ERROR.value,
};

const MS_PER_DAY = 86_400_000;
const SECONDS_PER_DAY = 86_400;

/**
 * Η εποχή των σειριακών αριθμών του Excel: **30 Δεκεμβρίου 1899**, σε UTC.
 *
 * Η μετατόπιση κατά μία μέρα από την «1η Ιανουαρίου 1900» δεν είναι λάθος — απορροφά το
 * ιστορικό σφάλμα του Excel που θεωρεί το 1900 δίσεκτο. Επαληθεύτηκε ότι η βιβλιοθήκη μετρά
 * με την **ίδια** εποχή: `YEAR(46239)`/`MONTH`/`DAY` δίνουν 2026 / 8 / 5.
 *
 * ⚠️ Ημερομηνίες πριν την 1η Μαρτίου 1900 αποκλίνουν κατά μία μέρα, όπως **και στο Excel**.
 * Καταγράφεται ρητά· δεν αφορά κανέναν πίνακα ποσοτήτων.
 */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/**
 * `Date` → σειριακός αριθμός Excel.
 *
 * 🔴 Ο υπολογισμός γίνεται από τα **ημερολογιακά μέρη** και όχι με αφαίρεση χιλιοστών του
 * δευτερολέπτου. Η διαφορά φαίνεται μόνο δύο φορές τον χρόνο και είναι καταστροφική: μια
 * τοπική «μεσάνυχτα» εκατέρωθεν της αλλαγής θερινής ώρας απέχει 23 ή 25 ώρες, οπότε η ωμή
 * αφαίρεση θα έδινε `46238,958` — δηλαδή **προηγούμενη μέρα** μετά τη στρογγυλοποίηση.
 */
export function excelSerialFromDate(date: Date): number {
  const midnightUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = (midnightUtc - EXCEL_EPOCH_UTC) / MS_PER_DAY;
  const seconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  return days + seconds / SECONDS_PER_DAY;
}

/**
 * 🔴 **Η πύλη locale** — μία τιμή κελιού όπως πρέπει να τη δει η βιβλιοθήκη.
 *
 * Το κελί μας κρατά **κείμενο**: ένα ελληνικό `2,5` είναι το αλφαριθμητικό `'2,5'`. Η
 * βιβλιοθήκη διαβάζει με αγγλοσαξονική σύμβαση — μετρημένο ότι `SUM('2,5', 1)` δίνει **3**,
 * δηλαδή διάβασε `2`. Αν περνούσαν ωμά, μια στήλη ποσοτήτων γραμμένη από Έλληνα μηχανικό θα
 * έχανε **σιωπηλά** τα δεκαδικά της μέσα σε κάθε συνάρτηση της βιβλιοθήκης — ενώ οι δικές μας
 * επτά θα την υπολόγιζαν σωστά. Δύο απαντήσεις για τον ίδιο αριθμό, στον ίδιο πίνακα.
 *
 * Η μετατροπή δεν είναι δεύτερος αναγνώστης δεκαδικού: ρωτά τον **έναν** ({@link
 * cellValueToNumber}, ADR-576 πίσω από την πύλη αυστηρότητας). Ό,τι δεν είναι **εξ ολοκλήρου**
 * αριθμός μένει κείμενο — και πρέπει: το `'Δοκός 12'` είναι περιγραφή, και το `'>15'` είναι
 * **κριτήριο** της `SUMIF`, όχι αριθμός.
 */
function toNativeValue(value: TableFormulaValue): TableFormulaValue {
  if (typeof value !== 'string') return value;
  return cellValueToNumber(value) ?? value;
}

/** Το ορθογώνιο ξανά σε γραμμές — η **μόνη** αναδίπλωση σε 2Δ ολόκληρης της μηχανής. */
function toGrid(
  values: readonly TableFormulaValue[],
  rows: number,
  cols: number,
): readonly (readonly TableFormulaValue[])[] {
  // Ασυμφωνία σχήματος σημαίνει ότι κάποιος έφτιαξε λίστα χωρίς να περάσει από την επέκταση
  // εύρους. Μία γραμμή είναι η τίμια απάντηση: δεν επινοεί ορθογώνιο που κανείς δεν ζήτησε.
  const native = values.map(toNativeValue);
  if (rows * cols !== native.length || rows <= 0 || cols <= 0) return [native];

  const grid: TableFormulaValue[][] = [];
  for (let r = 0; r < rows; r += 1) grid.push(native.slice(r * cols, (r + 1) * cols));
  return grid;
}

/**
 * Τα ορίσματά μας στη μορφή που περιμένει η βιβλιοθήκη.
 *
 * Τα σφάλματα **δεν** φτάνουν ποτέ εδώ: ο αξιολογητής τα διαδίδει πριν την κλήση, και οι
 * λίγες συναρτήσεις που πρέπει να τα *δουν* (`ISERROR`, `IFERROR`, …) είναι δικές μας —
 * μετρημένο ότι η βιβλιοθήκη δεν τα αναγνωρίζει όταν της δοθούν από έξω.
 *
 * ## 🔴 Ο πίνακας **αντιγράφεται**, και αυτό δεν είναι υπερβολική προφύλαξη
 * Μετρημένο στην 4.6.1: οι μεταβλητού πλήθους συναρτήσεις **μεταλλάσσουν επί τόπου** το πρώτο
 * τους όρισμα, προσαρτώντας πάνω του τα υπόλοιπα. Δύο κλήσεις `PRODUCT([1,2,3,4], 2)` με τον
 * **ίδιο** πίνακα δίνουν `48` και μετά `96`, γιατί ο πίνακας έγινε `[1,2,3,4,2]` και μετά
 * `[1,2,3,4,2,2]`. Δεκαέξι συναρτήσεις συμπεριφέρονται έτσι.
 *
 * Σήμερα δεν φαίνεται, **κατά τύχη**: ο αξιολογητής φτιάχνει καινούριο πίνακα σε κάθε
 * αξιολόγηση. Αλλά «κατά τύχη» δεν είναι εγγύηση — απομνημόνευση, ζωντανή προεπισκόπηση δίπλα
 * σε commit, ή επανάληψη αναίρεσης θα έδιναν **άλλον αριθμό τη δεύτερη φορά**, σε παραδοτέο.
 * Η μετατροπή locale παράγει ούτως ή άλλως **νέο** πίνακα (`map`), οπότε η κλάση κλείνει
 * χωρίς επιπλέον κόστος — αλλά είναι απαίτηση, όχι παρενέργεια: αν κάποτε η μετατροπή γίνει
 * τεμπέλικη, το αντίγραφο πρέπει να μείνει. Το αποδεικνύει η δοκιμή ντετερμινισμού που το βρήκε.
 */
export function toNativeArguments(
  args: readonly TableFormulaArgument[],
  shape: FormulaLibraryShape,
): readonly unknown[] {
  return args.map((arg) => {
    if (arg.kind === 'value') return toNativeValue(arg.value);
    return shape === 'grid' ? toGrid(arg.values, arg.rows, arg.cols) : arg.values.map(toNativeValue);
  });
}

/**
 * Ό,τι επέστρεψε η βιβλιοθήκη, ως τιμή που χωρά σε κελί.
 *
 * Η σειρά των ελέγχων **είναι** σημασία: το `Error` πρώτο (αλλιώς θα περνούσε ως αντικείμενο),
 * η `Date` πριν τον γενικό έλεγχο αντικειμένου, ο πίνακας πριν από αυτόν.
 */
export function fromNativeResult(result: unknown): TableFormulaValue {
  if (result instanceof Error) {
    return LIBRARY_ERROR_CODES[result.message] ?? FORMULA_ERROR.value;
  }
  if (result instanceof Date) {
    return Number.isNaN(result.getTime()) ? FORMULA_ERROR.value : excelSerialFromDate(result);
  }
  if (Array.isArray(result)) return FORMULA_ERROR.value;
  if (typeof result === 'number') {
    return Number.isFinite(result) ? result : FORMULA_ERROR.number;
  }
  if (typeof result === 'string' || typeof result === 'boolean') return result;
  // `undefined`/`null`/αντικείμενο: η συνάρτηση δεν παρήγαγε τιμή. Ένα κενό εδώ θα έμοιαζε με
  // «υπολογίστηκε και βγήκε τίποτα» — που είναι ακριβώς αυτό που δεν συνέβη.
  return FORMULA_ERROR.value;
}
