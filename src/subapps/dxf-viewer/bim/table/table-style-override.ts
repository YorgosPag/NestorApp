/**
 * ADR-739 — **το σχήμα μιας παράκαμψης στυλ**, κοινό σε κάθε επίπεδο του πίνακα.
 *
 * Τρία επίπεδα γράφουν παρακάμψεις με **ταυτόσημους** κανόνες: η στήλη
 * (`TableColumn.styleOverride`), η γραμμή (`TableRow.styleOverride`) και το κελί
 * (`TableCell.styleOverride`). Οι δύο πρώτοι μοιράζονται ήδη σώμα στο
 * `table-axis-style-ops.ts`· ο τρίτος έρχεται με τη μορφοποίηση περιοχής.
 *
 * ## 🔴 Γιατί ξεχωριστό module για οκτώ γραμμές
 * Ακριβώς **επειδή** είναι οκτώ γραμμές. Το jscpd (CHECK 3.28, min-tokens 50) **δεν** πιάνει
 * αντίγραφο αυτού του μεγέθους, οπότε ένα δεύτερο σώμα δεν θα μπλόκαρε ποτέ — θα **απέκλινε
 * σιωπηλά**. Και η απόκλιση έχει ήδη γνωστό σχήμα: ο ένας γραφέας θα θυμάται να επιστρέφει
 * `undefined` όταν αδειάσει η παράκαμψη, ο άλλος θα αφήνει `{}`. Ένα `styleOverride: {}`
 * ταξιδεύει στο JSON, εμφανίζεται σε κάθε diff, και κάνει το «έχει παράκαμψη;» να απαντά
 * `true` για κάτι που δεν παρακάμπτει τίποτα — δηλαδή ανάβει το κουμπί «Επαναφορά στο στυλ»
 * πάνω σε άξονα που δεν έχει τι να επαναφέρει.
 *
 * Είναι το ίδιο μοτίβο με το `extendTableSelectionTo` (`table-cell-range.ts`): μονογραμμικός
 * κανόνας που εξήχθη **επειδή** ήταν πολύ μικρός για να τον φυλάει εργαλείο.
 *
 * @module subapps/dxf-viewer/bim/table/table-style-override
 * @see bim/table/table-axis-style-ops.ts — ο γραφέας του άξονα
 * @see bim/table/table-style.ts — `resolveCellStyle`, η σειρά προτεραιότητας (§28.4)
 */

import type { TableAxisStyleOverride } from '../../types/table';

/**
 * Η νέα παράκαμψη μετά την αλλαγή **ενός** πεδίου· `undefined` όταν δεν έμεινε τίποτα.
 *
 * Οι τρεις καταστάσεις του {@link TableAxisStyleOverride}, εκφρασμένες στην υπογραφή:
 * ```
 *   value === undefined  →  ΑΦΑΙΡΕΣΕ το πεδίο (πίσω στην κληρονομιά)
 *   value === null       →  ρητά ΚΑΝΕΝΑ (μόνο όπου ο τύπος το δέχεται: fill, fontFamily)
 *   αλλιώς               →  ρητή τιμή
 * ```
 *
 * Γενική ως προς το σχήμα της παράκαμψης, ώστε το **κελί** (`TableCellStyleOverride`, που
 * προσθέτει `overflow`) να μη χάνει τα δικά του πεδία περνώντας από εδώ: με σκέτο
 * `TableAxisStyleOverride` η επιστροφή θα ήταν στενότερη από την είσοδο, και ο καλών θα
 * χρειαζόταν cast — δηλαδή ακριβώς το σημείο όπου χάνεται σιωπηλά ένα πεδίο.
 */
export function patchStyleOverride<O extends TableAxisStyleOverride, K extends keyof O>(
  current: O | undefined,
  key: K,
  value: O[K] | undefined,
): O | undefined {
  const next: Record<string, unknown> = { ...current };
  // Η αφαίρεση είναι `delete` και όχι `= undefined`: το κλειδί πρέπει να **φύγει**, αλλιώς το
  // `Object.keys` παρακάτω θα το μετρούσε και μια άδεια παράκαμψη δεν θα εκφυλιζόταν ποτέ.
  if (value === undefined) delete next[key as string];
  else next[key as string] = value;
  return Object.keys(next).length > 0 ? (next as O) : undefined;
}
