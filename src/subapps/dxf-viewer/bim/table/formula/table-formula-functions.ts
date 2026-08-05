/**
 * ADR-739 Φ.Ζ / §49 — **το μητρώο συναρτήσεων**: η πρίζα της μηχανής.
 *
 * ## Γιατί αυτό το αρχείο ήταν η απάντηση στο «και αν αύριο θέλουμε 280 συναρτήσεις;»
 * Η μηχανή χωρίζεται σε δύο πράγματα που κατά λάθος θεωρούνται ένα: τον **αναλυτή** (πώς
 * διαβάζεται ένας τύπος, πώς δένονται οι αναφορές, πώς υπολογίζεται ποιος εξαρτάται από
 * ποιον) και τη **βιβλιοθήκη συναρτήσεων** (τι κάνει η `SUM`). Το πρώτο **οφείλει** να είναι
 * δικό μας — καμία βιβλιοθήκη δεν ξέρει από `TableRowId` ούτε διαχειρίζεται φύλλο (ADR-739
 * §9.2, λόγοι 2 και 3). Το δεύτερο είναι ένας πίνακας από καθαρές συναρτήσεις.
 *
 * Το §49 το εξαργύρωσε **ακριβώς όπως ήταν γραμμένο**: συνδέθηκε η `@formulajs/formulajs`
 * (MIT) **μέσα** σε αυτόν τον πίνακα. Ένας αναλυτής, μία διαδρομή αξιολόγησης, ένα σημείο
 * αλλαγής. Κανένας δεύτερος αναλυτής δεν γράφτηκε και καμία γραμμή του αξιολογητή δεν
 * μετακόμισε.
 *
 * ## Τρεις πηγές, μία σειρά προτεραιότητας — και η σειρά **είναι** απόφαση
 * 1. **Βιβλιοθήκη** (340 διαδρομές + 10 παλαιά ψευδώνυμα), πίσω από ρητή διαμέριση.
 * 2. **Πληροφοριακές** (`ISERROR`, `TYPE`, …) — δικές μας, γιατί η βιβλιοθήκη δεν αναγνωρίζει
 *    τα σφάλματά μας (μετρημένο· δες `table-formula-info-functions.ts`).
 * 3. **Αριθμητικές** — δικές μας, γιατί η δική μας σημασιολογία είναι **πιο σωστή**:
 *    μετρημένο ότι `SUM("άλφα")` δίνει `0` στη βιβλιοθήκη ενώ εμείς —και το Excel— λέμε
 *    `#VALUE!`. Μπαίνουν τελευταίες ώστε να μην μπορεί ποτέ να τις σκεπάσει αναβάθμιση.
 *
 * ## Δύο αυστηρότητες, όπως στο Excel — και δεν είναι ασυνέπεια
 * - Όρισμα **τιμή** που δεν είναι αριθμός ⇒ `#VALUE!` (`=SUM("άλφα")`). Ο χρήστης το έγραψε
 *   ρητά· η σιωπή θα ήταν απόκρυψη λάθους.
 * - Κελί **μέσα σε εύρος** που δεν είναι αριθμός ⇒ **αγνοείται** (`=SUM(A1:A9)` πάνω σε
 *   στήλη με κεφαλίδα). Το λέει ρητά και η τεκμηρίωση του AutoCAD: «οι `sum`/`average`/
 *   `count` αγνοούν τα κενά και όσα δεν είναι αριθμοί».
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-functions
 * @see bim/table/formula/library/formula-library-manifest.ts — η διαμέριση της βιβλιοθήκης
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9, §49
 */

import { FORMULA_LIBRARY_FUNCTIONS } from './library/formula-library-registry';
import {
  ERROR_TRANSPARENT_INFO_FUNCTIONS,
  TABLE_FORMULA_INFO_FUNCTIONS,
} from './table-formula-info-functions';
import {
  FORMULA_ERROR,
  valueToNumber,
  type TableFormulaArgument,
  type TableFormulaFunction,
  type TableFormulaValue,
} from './table-formula-value';

export type { TableFormulaFunction } from './table-formula-value';

/**
 * Μια εγγραφή του μητρώου.
 *
 * Είναι περιγραφέας και όχι σκέτη συνάρτηση εξαιτίας **μίας** ιδιότητας που δεν εκφράζεται
 * στην υπογραφή: υπάρχουν συναρτήσεις που πρέπει να **δουν** το σφάλμα ενός ορίσματος αντί
 * να τους διαδοθεί. Χωρίς τη σημαία, η `ISERROR` δεν θα καλούνταν ποτέ πάνω σε σφάλμα — θα
 * επέστρεφε το ίδιο το σφάλμα, δηλαδή θα ήταν διακοσμητική.
 */
export interface TableFormulaEntry {
  readonly call: TableFormulaFunction;
  /** Τα σφάλματα ορισμάτων **δεν** διαδίδονται αυτόματα· τα βλέπει η ίδια. */
  readonly errorTransparent?: boolean;
}

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
 * Οι επτά αριθμητικές που κρατάμε δικές μας. Τα ονόματα είναι **κεφαλαία**: ο αναλυτής
 * κανονικοποιεί, ώστε να μην μπορεί ποτέ να υπάρξουν δύο εγγραφές για την ίδια συνάρτηση.
 */
const NATIVE_ARITHMETIC: Readonly<Record<string, TableFormulaFunction>> = {
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

const ERROR_TRANSPARENT: ReadonlySet<string> = new Set(ERROR_TRANSPARENT_INFO_FUNCTIONS);

/** Τυλίγει έναν πίνακα καθαρών συναρτήσεων σε εγγραφές, με τη σημαία όπου χρειάζεται. */
function toEntries(
  functions: Readonly<Record<string, TableFormulaFunction>>,
): Record<string, TableFormulaEntry> {
  return Object.fromEntries(
    Object.entries(functions).map(([name, call]) => [
      name,
      ERROR_TRANSPARENT.has(name) ? { call, errorTransparent: true } : { call },
    ]),
  );
}

/**
 * **Το μητρώο.** Η σειρά συγχώνευσης είναι η σειρά προτεραιότητας της κεφαλίδας: οι δικές μας
 * γράφονται τελευταίες και δεν μπορεί να τις σκεπάσει καμία αναβάθμιση της βιβλιοθήκης.
 *
 * *(Η `IF` και οι υπόλοιπες ειδικές μορφές **δεν** ζουν εδώ — δες
 * `table-formula-special-forms.ts`: μόνο ο αξιολογητής μπορεί να μην αξιολογήσει έναν κλάδο.)*
 */
export const TABLE_FORMULA_FUNCTIONS: Readonly<Record<string, TableFormulaEntry>> = {
  ...toEntries(FORMULA_LIBRARY_FUNCTIONS),
  ...toEntries(TABLE_FORMULA_INFO_FUNCTIONS),
  ...toEntries(NATIVE_ARITHMETIC),
};
