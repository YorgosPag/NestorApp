/**
 * ADR-739 Φ.Ζ — **το μητρώο συναρτήσεων**: η πρίζα της μηχανής.
 *
 * ## Γιατί αυτό το αρχείο είναι η απάντηση στο «και αν αύριο θέλουμε 280 συναρτήσεις;»
 * Η μηχανή χωρίζεται σε δύο πράγματα που κατά λάθος θεωρούνται ένα: τον **αναλυτή** (πώς
 * διαβάζεται ένας τύπος, πώς δένονται οι αναφορές, πώς υπολογίζεται ποιος εξαρτάται από
 * ποιον) και τη **βιβλιοθήκη συναρτήσεων** (τι κάνει η `SUM`). Το πρώτο **οφείλει** να είναι
 * δικό μας — καμία βιβλιοθήκη δεν ξέρει από `TableRowId` ούτε διαχειρίζεται φύλλο (ADR-739
 * §9.2, λόγοι 2 και 3). Το δεύτερο είναι ένας πίνακας από καθαρές συναρτήσεις.
 *
 * Άρα «περισσότερες συναρτήσεις» **δεν** σημαίνει ποτέ δεύτερη μηχανή: σημαίνει
 * περισσότερες εγγραφές εδώ, ή σύνδεση μιας MIT βιβλιοθήκης συναρτήσεων (π.χ.
 * `@formulajs/formulajs`) **μέσα** σε αυτόν τον πίνακα. Ένας αναλυτής, μία διαδρομή
 * αξιολόγησης, ένα σημείο αλλαγής.
 *
 * ## Το εύρος του v1 — η επιφάνεια του AutoCAD, όχι του Excel
 * Το ίδιο το AutoCAD δίνει στα κελιά πίνακα **αριθμητική + `Sum` / `Average` / `Count`**.
 * Αυτές, συν τέσσερις προφανείς (`MIN` `MAX` `ROUND` `ABS`), είναι το v1. Η `IF` **δεν** ζει
 * εδώ — δες `table-formula-eval.ts`, είναι ειδική μορφή.
 *
 * ## Δύο αυστηρότητες, όπως στο Excel — και δεν είναι ασυνέπεια
 * - Όρισμα **τιμή** που δεν είναι αριθμός ⇒ `#VALUE!` (`=SUM("άλφα")`). Ο χρήστης το έγραψε
 *   ρητά· η σιωπή θα ήταν απόκρυψη λάθους.
 * - Κελί **μέσα σε εύρος** που δεν είναι αριθμός ⇒ **αγνοείται** (`=SUM(A1:A9)` πάνω σε
 *   στήλη με κεφαλίδα). Το λέει ρητά και η τεκμηρίωση του AutoCAD: «οι `sum`/`average`/
 *   `count` αγνοούν τα κενά και όσα δεν είναι αριθμοί».
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-functions
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9
 */

import {
  FORMULA_ERROR,
  valueToNumber,
  type TableFormulaArgument,
  type TableFormulaValue,
} from './table-formula-value';

/** Μια συνάρτηση τύπου: καθαρή, από ορίσματα σε τιμή. Καμία πρόσβαση στο μοντέλο. */
export type TableFormulaFunction = (args: readonly TableFormulaArgument[]) => TableFormulaValue;

/**
 * Το αποτέλεσμα της συλλογής: αριθμοί ή σφάλμα. Διακριτή ένωση και όχι `number[] | string`,
 * ώστε ο έλεγχος να είναι **στένωση τύπου** — ένα `Array.isArray` με μετατροπή θα ήταν το
 * μοναδικό σημείο του module που παρακάμπτει τον μεταγλωττιστή.
 */
type GatheredNumbers =
  | { readonly kind: 'numbers'; readonly numbers: readonly number[] }
  | { readonly kind: 'error'; readonly error: TableFormulaValue };

/**
 * Οι αριθμοί που «μετράνε» μέσα σε ορίσματα, με τις δύο αυστηρότητες της κεφαλίδας.
 * Επιστρέφει σφάλμα όταν ένα **ρητό** όρισμα δεν είναι αριθμός.
 */
function gatherNumbers(args: readonly TableFormulaArgument[]): GatheredNumbers {
  const numbers: number[] = [];

  for (const arg of args) {
    if (arg.kind === 'value') {
      const single = valueToNumber(arg.value);
      if (single === null) return { kind: 'error', error: FORMULA_ERROR.value };
      numbers.push(single);
      continue;
    }
    for (const value of arg.values) {
      // Το κενό κελί **δεν** είναι μηδέν μέσα σε εύρος: είναι απόν. Αλλιώς η `AVERAGE` μιας
      // μισοσυμπληρωμένης στήλης θα διαιρούσε με τον αριθμό των **θέσεων**, όχι των τιμών.
      if (typeof value === 'string' && value.trim() === '') continue;
      const numeric = valueToNumber(value);
      if (numeric !== null) numbers.push(numeric);
    }
  }

  return { kind: 'numbers', numbers };
}

/** Ο τυποποιημένος πρόλογος κάθε αριθμητικής συνάρτησης. */
function withNumbers(
  args: readonly TableFormulaArgument[],
  compute: (numbers: readonly number[]) => TableFormulaValue,
): TableFormulaValue {
  const gathered = gatherNumbers(args);
  return gathered.kind === 'error' ? gathered.error : compute(gathered.numbers);
}

/** Το **ένα** αριθμητικό όρισμα μιας μονοθέσιας συνάρτησης, ή `null` αν δεν υπάρχει/δεν είναι. */
function singleNumber(arg: TableFormulaArgument | undefined): number | null {
  if (arg === undefined || arg.kind !== 'value') return null;
  return valueToNumber(arg.value);
}

/** `ROUND(αριθμός[, ψηφία])` — τα ψηφία παραλείπονται ⇒ ακέραιος, όπως `ROUND(x,0)`. */
function roundFunction(args: readonly TableFormulaArgument[]): TableFormulaValue {
  const value = singleNumber(args[0]);
  const digits = args.length > 1 ? singleNumber(args[1]) : 0;
  if (value === null || digits === null || args.length > 2) return FORMULA_ERROR.value;

  const factor = 10 ** Math.trunc(digits);
  const rounded = Math.round(value * factor) / factor;
  return Number.isFinite(rounded) ? rounded : FORMULA_ERROR.number;
}

/**
 * Το μητρώο. Τα ονόματα είναι **κεφαλαία**: ο αναλυτής κανονικοποιεί, ώστε να μην μπορεί
 * ποτέ να υπάρξουν δύο εγγραφές για την ίδια συνάρτηση.
 */
export const TABLE_FORMULA_FUNCTIONS: Readonly<Record<string, TableFormulaFunction>> = {
  SUM: (args) => withNumbers(args, (numbers) => numbers.reduce((total, n) => total + n, 0)),

  AVERAGE: (args) =>
    withNumbers(args, (numbers) =>
      // Κανένας αριθμός ⇒ διαίρεση με το μηδέν. Είναι **ακριβώς** αυτό που συμβαίνει, και το
      // Excel το λέει με το ίδιο όνομα· ένα `0` εδώ θα ήταν κατασκευασμένη μέτρηση.
      numbers.length === 0
        ? FORMULA_ERROR.divideByZero
        : numbers.reduce((total, n) => total + n, 0) / numbers.length,
    ),

  COUNT: (args) => withNumbers(args, (numbers) => numbers.length),

  // `reduce` και όχι `Math.min(...numbers)`: ένα εύρος 500 γραμμών γίνεται 500 ορίσματα
  // κλήσης, και το spread σε μεγάλο πλέγμα είναι υπερχείλιση στοίβας — όχι θεωρητική.
  MIN: (args) =>
    withNumbers(args, (numbers) =>
      numbers.length === 0 ? 0 : numbers.reduce((best, n) => (n < best ? n : best)),
    ),

  MAX: (args) =>
    withNumbers(args, (numbers) =>
      numbers.length === 0 ? 0 : numbers.reduce((best, n) => (n > best ? n : best)),
    ),

  ABS: (args) => {
    const value = args.length === 1 ? singleNumber(args[0]) : null;
    return value === null ? FORMULA_ERROR.value : Math.abs(value);
  },

  ROUND: roundFunction,
};
