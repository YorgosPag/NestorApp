/**
 * 🔴 ADR-754 **Γ1** — **ο τύπος που αντιγράφηκε αλλού ολισθαίνει τις σχετικές του αναφορές**.
 * Καθαρή συνάρτηση: μηδέν React, μηδέν DOM, μηδέν store.
 *
 * Είναι η πράξη πίσω από τη **λαβή συμπλήρωσης**: γράφεις `=B2*C2` στη γραμμή 2, σέρνεις τη
 * λαβή προς τα κάτω, και η γραμμή 3 πρέπει να πει `=B3*C3` — αλλά ένα `=$B$1` να μείνει
 * `=$B$1`, γιατί ο χρήστης το κλείδωσε.
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΟ ΥΠΑΡΧΟΝ `remapTableFormulaRefs`
 * Η παγίδα του επόμενου αναγνώστη: «το remap υπάρχει, η συμπλήρωση απλώς το καλεί». Οι δύο
 * πράξεις λέγονται στα ελληνικά και οι δύο «μετακίνηση αναφορών» και είναι **ασύμβατες** —
 * ο πίνακας ζει στο `table-formula-rewrite.ts`, όπου ζει και η κοινή τους κάθοδος. Σε μία
 * γραμμή: εκεί άλλαξε **ο κόσμος** (κάποιο κελί μετακόμισε) και οι αναφορές το ακολουθούν
 * ανεξάρτητα από το `$`· εδώ άλλαξε **η θέση του ίδιου του τύπου** και το `$` είναι ακριβώς
 * η ερώτηση «ποιες αναφορές το ακολουθούν;».
 *
 * ## 🔑 Ταυτότητες μέσα, δείκτες στη μέση — και γιατί χρειάζεται το μοντέλο
 * Η αναφορά μας είναι `rowId`/`colId`, όχι «γραμμή 3». Μια μετατόπιση όμως **ορίζεται πάνω σε
 * δείκτες**: «μία γραμμή πιο κάτω» σημαίνει «η επόμενη γραμμή του `model.rows`». Άρα η πράξη
 * είναι αναγκαστικά `ταυτότητα → δείκτης → +δ → ταυτότητα`, και το μοντέλο είναι το μόνο που
 * ξέρει τη μετάφραση. *Αυτό δεν είναι ατέλεια — είναι η ίδια η αιτία που η **εισαγωγή
 * γραμμής** δεν σπάει τύπους: οι δείκτες αλλάζουν, οι ταυτότητες όχι.*
 *
 * ## Εκτός πλέγματος ⇒ `#REF!`, όχι σιωπηλή στάθμευση στην άκρη
 * `=A1` αντιγραμμένο **μία γραμμή πάνω** δεν έχει πού να δείξει. Το Excel γράφει `#REF!` και
 * κάνει το ίδιο εδώ. Η εναλλακτική —«κόλλα το στη γραμμή 1»— θα έδινε τύπο που **μοιάζει
 * σωστός** και αθροίζει λάθος κελί: το είδος σφάλματος που ο ADR-720 ονομάζει «λάθος τιμής σε
 * παραδοτέο». Ένα ορατό `#REF!` είναι πάντα φθηνότερο από έναν αθόρυβα λάθος αριθμό.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-offset
 * @see table-formula-rewrite.ts — η κοινή κάθοδος + ο πίνακας «μετακόμιση vs αντιγραφή»
 * @see table-formula-absolute.ts — ο ένας ιδιοκτήτης του `$`
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §12
 */

import type { TableModel } from '../../../types/table';
import type {
  TableFormula,
  TableFormulaCellRef,
  TableFormulaNode,
} from '../../../types/table-formula';
import type { TableCellRef } from '../table-cell-range';
import { cellPairIndices } from '../table-cell-order';
import { indexById } from '../table-model-helpers';
import { gridOfRef, type TableFormulaWorkbook } from './table-formula-workbook';
import { rewriteTableFormulaRefs, type TableFormulaRefLeaf } from './table-formula-rewrite';

/**
 * Πόσο μετακινήθηκε ο τύπος, σε **δείκτες** πλέγματος. Θετικό `rows` = προς τα κάτω, θετικό
 * `columns` = προς τα δεξιά — η φορά που διαβάζει ο χρήστης, όχι κάποια εσωτερική σύμβαση.
 */
export interface TableFormulaOffset {
  readonly rows: number;
  readonly columns: number;
}

/**
 * Η μετατόπιση **ανάμεσα σε δύο κελιά** — ό,τι χρειάζεται μια συμπλήρωση από πηγή σε στόχο.
 * `null` όταν κάποιο άκρο δεν υπάρχει στο μοντέλο, με τη σύμβαση όλου του φακέλου: ο καλών
 * δεν μαντεύει.
 */
export function tableFormulaOffsetBetween(
  model: TableModel,
  from: TableCellRef,
  to: TableCellRef,
): TableFormulaOffset | null {
  const pair = cellPairIndices(model, from, to);
  if (pair === null) return null;
  // Προσημασμένη διαφορά, **χωρίς** `Math.min/max`: η φορά είναι το νόημα. Συμπλήρωση προς τα
  // πάνω δίνει `rows: -1`, και ένα κανονικοποιημένο `+1` θα αντέγραφε τους τύπους ανάποδα.
  return { rows: pair.toRow - pair.fromRow, columns: pair.toCol - pair.fromCol };
}

/**
 * Ο τύπος όπως θα διαβαζόταν αν είχε γραφτεί `offset` κελιά πιο πέρα.
 *
 * Επιστρέφει το **ίδιο** αντικείμενο by-reference όταν τίποτα δεν άλλαξε — μηδενική
 * μετατόπιση, ή τύπος του οποίου κάθε αναφορά είναι πλήρως κλειδωμένη. Δες
 * `table-formula-rewrite.ts` για το γιατί η ταυτότητα αντικειμένου δεν είναι βελτιστοποίηση.
 */
export function offsetTableFormula(
  book: TableFormulaWorkbook,
  formula: TableFormula,
  offset: TableFormulaOffset,
): TableFormula {
  const root = offsetTableFormulaRefs(book, formula.root, offset);
  return root === formula.root ? formula : { ...formula, root };
}

/** Η ίδια πράξη σε επίπεδο κόμβου — για καλούντες που κρατούν δέντρο, όχι αποθηκευμένο τύπο. */
export function offsetTableFormulaRefs(
  book: TableFormulaWorkbook,
  node: TableFormulaNode,
  offset: TableFormulaOffset,
): TableFormulaNode {
  if (offset.rows === 0 && offset.columns === 0) return node;
  const shift = createShift(book, offset);
  return rewriteTableFormulaRefs(node, (leaf) => shiftLeaf(leaf, shift));
}

/** Μια αναφορά μετατοπισμένη, ή `null` όταν πέφτει έξω από το πλέγμα. */
type ShiftRef = (cell: TableFormulaCellRef) => TableFormulaCellRef | null;

/**
 * Ο μετατοπιστής, με τα ευρετήρια δεμένα **μία φορά** αντί για κάθε φύλλο.
 *
 * Το `indexById` είναι ήδη απομνημονευμένο σε `WeakMap`, οπότε το κέρδος δεν είναι ταχύτητα:
 * είναι ότι η μετάφραση `ταυτότητα ⇄ δείκτης` γράφεται σε **ένα** σημείο, όπου φαίνεται μαζί
 * ο έλεγχος ορίων και για τους δύο άξονες.
 */
function createShift(book: TableFormulaWorkbook, offset: TableFormulaOffset): ShiftRef {
  return (cell) => {
    // 🔴 ADR-833 Φάση 7 — **το πλέγμα είναι της αναφοράς, όχι του τύπου.** Ένα `=Φύλλο2!A1`
    // που αντιγράφεται μια γραμμή κάτω γίνεται `=Φύλλο2!A2`, και το «μια γραμμή κάτω»
    // μετριέται πάνω στις γραμμές **του Φύλλου2** — που μπορεί να έχει εντελώς άλλο πλήθος.
    // Δεμένα ευρετήρια «μία φορά» εδώ θα ήταν λάθος πλέγμα· το `indexById` είναι ήδη
    // απομνημονευμένο σε `WeakMap` ανά πίνακα, άρα η ανά αναφορά ερώτηση δεν κοστίζει.
    const model = gridOfRef(book, cell);
    if (model === null) return null;
    const rowIndex = indexById(model.rows);
    const colIndex = indexById(model.columns);

    const fromRow = rowIndex.get(cell.rowId);
    const fromCol = colIndex.get(cell.colId);
    const row = shiftAxis(fromRow, cell.absoluteRow, offset.rows, model.rows.length);
    const col = shiftAxis(fromCol, cell.absoluteCol, offset.columns, model.columns.length);
    if (row === null || col === null) return null;
    // Πλήρως κλειδωμένη αναφορά (`$B$1`) ⇒ **το ίδιο αντικείμενο**. Χωρίς αυτό, κάθε συμπλήρωση
    // θα γεννούσε νέο δέντρο ακόμη κι όταν τίποτα δεν μετακινήθηκε — δηλαδή ακυρωμένη μνήμη
    // και βήμα undo που δεν αναιρεί τίποτα (δες `table-formula-rewrite.ts`).
    if (row === fromRow && col === fromCol) return cell;
    // Οι σημαίες **επιβιώνουν** της αντιγραφής: το `B$1` που αντιγράφηκε δεξιά είναι `C$1`.
    // Το Excel κάνει το ίδιο — το κλείδωμα είναι ιδιότητα του τύπου, όχι της θέσης του.
    return { ...cell, rowId: model.rows[row].id, colId: model.columns[col].id };
  };
}

/**
 * Ένας άξονας: κλειδωμένος ⇒ ακίνητος· αλλιώς `δείκτης + δ`, με `null` έξω από το πλέγμα.
 *
 * `null` και για **άγνωστη** ταυτότητα (`index === undefined`): μια αναφορά που έδειχνε ήδη σε
 * διαγραμμένη γραμμή δεν γίνεται έγκυρη επειδή αντιγράφτηκε. Ήταν `#REF!` πριν, μένει `#REF!`.
 */
function shiftAxis(
  index: number | undefined,
  absolute: boolean | undefined,
  delta: number,
  length: number,
): number | null {
  if (index === undefined) return null;
  if (absolute === true) return index;
  const next = index + delta;
  return next >= 0 && next < length ? next : null;
}

/**
 * Το φύλλο μετατοπισμένο. Ένα **εύρος** χάνεται ολόκληρο αν χαθεί οποιοδήποτε άκρο — ίδια
 * στάση με τον εκτυπωτή (`table-formula-print.ts`): ένα εύρος με άγνωστο άκρο δεν είναι «μισό
 * εύρος», είναι άγνωστο εύρος.
 *
 * ⚠️ Τα δύο άκρα μετατοπίζονται **ανεξάρτητα**, καθένα με τις **δικές του** σημαίες. Το
 * `=SUM(B$1:B5)` που κατεβαίνει μία γραμμή γίνεται `=SUM(B$1:B6)`: η αρχή είναι καρφωμένη, το
 * τέλος ακολουθεί. Αυτό **είναι** το κλασικό «τρέχον άθροισμα» του Excel, και είναι ο λόγος
 * που οι σημαίες ζουν στο **άκρο** και όχι στο εύρος.
 */
function shiftLeaf(leaf: TableFormulaRefLeaf, shift: ShiftRef): TableFormulaNode {
  if (leaf.kind === 'ref') {
    const cell = shift(leaf.cell);
    if (cell === null) return { kind: 'error', code: '#REF!' };
    return cell === leaf.cell ? leaf : { kind: 'ref', cell };
  }

  const from = shift(leaf.from);
  const to = shift(leaf.to);
  if (from === null || to === null) return { kind: 'error', code: '#REF!' };
  return from === leaf.from && to === leaf.to ? leaf : { kind: 'range', from, to };
}
