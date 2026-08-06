/**
 * 🔴 ADR-767 §11.2 #2 / Δ4 — **ΤΙ ΣΗΜΑΔΕΥΕΤΑΙ ΣΤΗΝ ΟΘΟΝΗ**: η κρίση, χωρίς καμβά.
 *
 * ## Η αρχή: η ένδειξη είναι ανάλογη της ΠΛΗΡΟΦΟΡΙΑΣ, όχι της κατάστασης
 * Μέσα σε δεμένο πίνακα, «δεμένο» είναι ο **κανόνας** — δεν είναι είδηση. Είδηση είναι η
 * **εξαίρεση**: ότι κάποιος άνθρωπος διαφώνησε με την πηγή, και ότι η πηγή κουνήθηκε από
 * κάτω. Γι' αυτό οι δύο ερωτήσεις έχουν **διαφορετική κοκκομετρία**:
 *
 * ```
 *   «ποιες στήλες τρέφονται από την πηγή;»   →  ΑΝΑ ΣΤΗΛΗ   (boundColumnStripsMm)
 *   «πού απέκλινε κάποιος;»                  →  ΑΝΑ ΚΕΛΙ    (boundExceptionMarks)
 * ```
 *
 * ## 🔴 Γιατί ΑΝΑ ΣΤΗΛΗ και όχι ανά κελί (απόφαση Giorgio, 07/08)
 * Δεν είναι αισθητική: το **Δ8** ορίζει ρητά «**1 `sourceRef` ανά πίνακα + 1 `sourceKey` ανά
 * στήλη**· καμία έννοια δεσμού ανά κελί». Άρα η στήλη **είναι** η μονάδα του δεσμού, και ένα
 * σημάδι ανά κελί θα δήλωνε γεγονός που το σχήμα δεν έχει.
 *
 * Και έχει μετρήσιμο τίμημα: τοπογραφικό 200 κορυφών × 4 δεμένες στήλες = **800** σημάδια για
 * να ειπωθεί κάτι που ισχύει παντού. Το Δ5 ονομάζει ακριβώς αυτή την αστοχία — «η διαφορά
 * ανάμεσα σε **ένδειξη που διαβάζεται** και σε **θόρυβο που ο χρήστης μαθαίνει να αγνοεί**».
 *
 * ## 🔴 Ο ζωγράφος ΔΕΝ σαρώνει τον πίνακα (ADR-735)
 * Το {@link boundExceptionMarks} δέχεται τα **ήδη κομμένα** ορατά κελιά και δεν ξαναρωτά το
 * μοντέλο για γραμμές εκτός παραθύρου. Ένας πίνακας 500 γραμμών δεν επιτρέπεται να εξετάσει
 * 500 γραμμές ανά καρέ για να σημαδέψει τις 12 που φαίνονται — είναι το ίδιο O(zoom²) που ο
 * ADR-735 πλήρωσε σε παραγωγή.
 *
 * ## Τι ΔΕΝ ζει εδώ
 * Ούτε χρώμα, ούτε πάχος, ούτε px. Το πάχος ενός δείκτη διεπαφής είναι σταθερό σε **px**
 * (όπως κάθε άλλος δείκτης του πίνακα)· αν γεννιόταν εδώ σε mm θα χόντραινε με το zoom, και
 * για να μη χοντραίνει θα έπρεπε να μπει `pxPerMm` σε καθαρή συνάρτηση του μοντέλου —
 * δηλαδή η γεωμετρία θα μάθαινε την κλίμακα της οθόνης.
 *
 * @module subapps/dxf-viewer/bim/table/binding/table-bound-marks
 * @see rendering/entities/table/stamp-table-bound-state.ts — ο ζωγράφος
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4, Δ8
 */

import { classifyBoundCell } from './table-binding-state';
import type { TableBoundCellState } from './table-binding-state';
import type { TableCellLayout, TableColumnLayout, TableRectMm } from '../table-layout-types';
import type {
  PersistedTableModel,
  TableCell,
  TableColumnId,
  TableRowId,
} from '../../../types/table';

/**
 * Μία **δεμένη στήλη**, με το οριζόντιο εύρος της σε sheet-mm.
 *
 * Χωρίς `y`/`h`: η λωρίδα κάθεται στην πάνω ακμή του πίνακα και το πάχος της είναι απόφαση
 * του ζωγράφου (δες την κεφαλίδα).
 */
export interface BoundColumnStrip {
  readonly colId: TableColumnId;
  /** Αριστερή ακμή της στήλης (sheet-mm από την αρχή του πίνακα). */
  readonly xMm: number;
  readonly widthMm: number;
}

/** Οι δύο **εξαιρέσεις** που αξίζουν σημάδι κελιού — ποτέ το «δεμένο» και ποτέ το «ελεύθερο». */
export type TableBoundExceptionState = Extract<TableBoundCellState, 'overridden' | 'conflict'>;

/** Ένα κελί που αποκλίνει από την πηγή του, με το ορθογώνιό του **όπως ήδη το υπολόγισε η διάταξη**. */
export interface BoundExceptionMark {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  readonly state: TableBoundExceptionState;
  readonly rect: TableRectMm;
}

/**
 * Οι στήλες που τρέφονται από την πηγή, με τη σειρά της **διάταξης**.
 *
 * Στήλη του μοντέλου που δεν υπάρχει στη διάταξη **αγνοείται** αντί να μαντευτεί: η διάταξη
 * είναι η αλήθεια για το «πού κάθεται», και μια στήλη χωρίς θέση δεν έχει πού να ζωγραφιστεί.
 * Η αντίστροφη σειρά ανάγνωσης (διάταξη → μοντέλο) το κάνει **μη εκφράσιμο** αντί να το
 * φυλάει με έλεγχο.
 */
export function boundColumnStripsMm(
  model: PersistedTableModel,
  columns: readonly TableColumnLayout[],
): readonly BoundColumnStrip[] {
  const bound = new Set<TableColumnId>();
  for (const column of model.columns) {
    if (column.sourceKey !== undefined) bound.add(column.id);
  }
  if (bound.size === 0) return [];

  const strips: BoundColumnStrip[] = [];
  for (const column of columns) {
    if (!bound.has(column.id)) continue;
    strips.push({ colId: column.id, xMm: column.xMm, widthMm: column.widthMm });
  }
  return strips;
}

/**
 * Τα **ορατά** κελιά που αποκλίνουν από την πηγή τους, με τη σειρά που τα ζωγραφίζει ο καλών.
 *
 * ⚠️ Η κρίση **δεν ξαναγράφεται εδώ**: καλείται το {@link classifyBoundCell}, ο ίδιος κριτής
 * που ήδη απαντά στον επεξεργαστή κελιού και στον φραγμό. Μια δεύτερη ανάγνωση του
 * `cell.bound` σε αυτό το αρχείο θα ήταν η τέταρτη ερμηνεία των ίδιων δύο σημαιών — και θα
 * αποκλίνει σιωπηλά την πρώτη φορά που προστεθεί πέμπτη κατάσταση.
 */
export function boundExceptionMarks(
  model: PersistedTableModel,
  visibleCells: readonly TableCellLayout[],
): readonly BoundExceptionMark[] {
  const marks: BoundExceptionMark[] = [];
  if (visibleCells.length === 0) return marks;

  const byKey = cellIndex(model);
  for (const cell of visibleCells) {
    const state = classifyBoundCell(byKey.get(cellKey(cell.rowId, cell.colId)));
    if (state !== 'overridden' && state !== 'conflict') continue;
    marks.push({ rowId: cell.rowId, colId: cell.colId, state, rect: cell.rect });
  }
  return marks;
}

/**
 * Ο αραιός χάρτης των γεμάτων κελιών — **μία** διάσχιση του μοντέλου ανά κλήση.
 *
 * Γραμμική αναζήτηση ανά ορατό κελί θα ήταν O(ορατά × κελιά): σε πίνακα 500 γραμμών με 30
 * ορατές, δηλαδή 60.000 συγκρίσεις ανά καρέ — το ίδιο σχήμα που ο ADR-735 πλήρωσε.
 */
function cellIndex(model: PersistedTableModel): ReadonlyMap<string, TableCell> {
  const index = new Map<string, TableCell>();
  for (const [rowId, colId, cell] of model.cells) index.set(cellKey(rowId, colId), cell);
  return index;
}

function cellKey(rowId: TableRowId, colId: TableColumnId): string {
  return `${rowId} ${colId}`;
}
