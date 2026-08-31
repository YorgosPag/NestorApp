/**
 * 🔴 ADR-828 Φ4β — **Η ΤΑΞΙΝΟΜΗΣΗ ΩΣ ΜΕΤΑΘΕΣΗ**, εκφρασμένη με το λεξιλόγιο που ήδη ξέρει να
 * μετακινεί κελιά.
 *
 * ## 🔑 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΜΗΧΑΝΗ ΤΑΞΙΝΟΜΗΣΗΣ ΕΔΩ — και δεν πρέπει να υπάρξει
 * Η ταξινόμηση γραμμών **είναι** μετακίνηση κελιών: κάθε κελί παίρνει το περιεχόμενο άλλου.
 * Η δύσκολη δουλειά — να ταξιδέψουν μαζί τα `runs` (ADR-753), να ξαναγραφτούν οι **αναφορές
 * τύπων** ώστε να δείχνουν εκεί που κατέληξαν τα κελιά τους, να μετακομίσουν οι ακμές
 * (ADR-750), να ξαναϋπολογιστεί ο γράφος — υπάρχει ολόκληρη στο
 * {@link applyTableRangeTransfer} (ADR-739 §36) και είναι ήδη δοκιμασμένη από τη μετακίνηση
 * περιοχής. Μια δεύτερη υλοποίηση θα ήταν η «τέταρτη μηχανή πίνακα» με άλλο όνομα, και θα
 * έχανε δεδομένα **σιωπηλά** την ημέρα που η μία θυμόταν τα `runs` και η άλλη όχι.
 *
 * 🔴 Η ιδιότητα που το κάνει εφικτό είναι **γραμμένη** στο `transferContent`: *«οι πηγές
 * διαβάζονται πάντα από το αρχικό μοντέλο»*. Μια μετάθεση είναι το ακραίο επικαλυπτόμενο
 * σύρσιμο — κάθε πηγή είναι και στόχος — και ακριβώς αυτός ο κανόνας την κάνει ανεξάρτητη
 * από τη σειρά εφαρμογής.
 *
 * 🔴 Το ίδιο ισχύει για τους **τύπους**: το `relocationOf` χτίζει χάρτη **ανά κελί**
 * (`from → at`), όχι ενιαία μετατόπιση. Άρα μια αναφορά `=B5` που δείχνει σε γραμμή την οποία
 * η ταξινόμηση έστειλε στη θέση 12 γίνεται `=B12` — η συμπεριφορά του Excel, δωρεάν.
 *
 * ## Τι ΔΕΝ κάνει, και γιατί αυτό είναι απόφαση
 * - **Οι ακμές δεν αναδιατάσσονται.** Το `source` και το `destination` του σχεδίου είναι η
 *   **ίδια** περιοχή, οπότε η μετακόμιση ακμών του §36 γίνεται ταυτοτική. Είναι σκόπιμο: το
 *   πλέγμα εδώ δεν είναι ιδιότητα του κελιού (ADR-750, χωριστό μοντέλο ακμών) αλλά **του
 *   πίνακα**. Ένα διπλό περίγραμμα κάτω από τη γραμμή συνόλων υπάρχει επειδή εκεί τελειώνει
 *   ο πίνακας, όχι επειδή εκεί κάθεται εκείνη η γραμμή — η ταξινόμηση δεν πρέπει να το σύρει
 *   στη μέση. Ιδια επιλογή με το Google Sheets.
 * - **Οι συγχωνεύσεις αρνούνται.** Δες `TableSortRefusal`.
 *
 * @module subapps/dxf-viewer/bim/table/table-sort-plan
 * @see bim/table/table-range-transfer.ts — ο ΕΝΑΣ εφαρμοστής
 * @see bim/table/table-sort-order.ts — ποια γραμμή πάει πριν από ποια
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §8
 */

import type { PersistedTableModel, TableModel } from '../../types/table';
import type { TableCellFill, TableRangeTransferPlan } from './table-range-transfer-types';
import type { TableCellRangeBounds, TableCellRef } from './table-cell-range';
import type { TableSortOutcome, TableSortRequest } from './table-sort-types';
import { compareBySortCriteria, type TableSortKey } from './table-sort-order';
import type { TableFormulaWorkbook } from './formula/table-formula-workbook';
import { applyTableRangeTransfer } from './table-range-transfer';
import { buildMergeIndex, cellKey, getCell, resolveTableModel } from './table-model-helpers';
import { cellText } from './table-cell-content';
import { cellValueToNumber } from './formula/table-formula-value';

/**
 * Το σχέδιο ταξινόμησης — **ένα** σχέδιο μεταφοράς, συν η μετάθεση για όποιον θέλει να τη δει.
 *
 * Η μετάθεση εκτίθεται για τα tests και για μια μελλοντική προεπισκόπηση. Ο εφαρμοστής δεν τη
 * χρειάζεται: όλα όσα του λέει είναι ήδη μέσα στα `fills`.
 */
export interface TableSortPlan {
  readonly transfer: TableRangeTransferPlan;
  /** `order[i]` = ο **αρχικός** δείκτης γραμμής που καταλήγει στη θέση `i` της περιοχής. */
  readonly order: readonly number[];
}

/**
 * «Μπορεί να ταξινομηθεί, και πώς;» — καθαρή πράξη, μηδέν εγγραφή.
 *
 * ⚠️ Η **κεφαλίδα** αφαιρείται πριν από κάθε τι άλλο: έτσι είναι αδύνατο ένα κριτήριο να τη
 * «δει» ως δεδομένο, όσο και να αλλάξει η σύγκριση από κάτω.
 */
export function planTableSort(
  model: TableModel,
  request: TableSortRequest,
): TableSortOutcome<TableSortPlan> {
  const { range, criteria, hasHeader } = request;
  if (criteria.length === 0) return { ok: false, reason: 'no-criteria' };
  if (!isWithinModel(model, range)) return { ok: false, reason: 'stale-range' };
  if (criteria.some((c) => c.columnIndex < range.firstCol || c.columnIndex > range.lastCol)) {
    return { ok: false, reason: 'no-criteria' };
  }
  if (hasMergeInside(model, range)) return { ok: false, reason: 'merged-range' };

  const movable: number[] = [];
  for (let i = range.firstRow + (hasHeader ? 1 : 0); i <= range.lastRow; i += 1) movable.push(i);

  const keysByRow = new Map<number, readonly TableSortKey[]>(
    movable.map((i) => [i, criteria.map((c) => keyAt(model, i, c.columnIndex))]),
  );
  // ⚠️ Η `Array.prototype.sort` είναι **σταθερή** από την ES2019 σε κάθε μηχανή: οι ισόβαθμες
  // γραμμές μένουν όπως ήταν, που είναι η μόνη απάντηση που δεν εφευρίσκει διάταξη.
  const sorted = [...movable].sort((a, b) =>
    compareBySortCriteria(keysByRow.get(a) ?? [], keysByRow.get(b) ?? [], criteria),
  );
  if (sorted.every((rowIndex, i) => rowIndex === movable[i])) {
    return { ok: false, reason: 'already-sorted' };
  }

  const order = hasHeader ? [range.firstRow, ...sorted] : sorted;
  return { ok: true, plan: { transfer: transferFor(model, range, order), order } };
}

/**
 * Ταξινόμησε — **μία** εντολή, ένα βήμα undo, μέσα από τον έναν εφαρμοστή.
 *
 * Επιστρέφει το ίδιο μοντέλο by-reference όταν η ταξινόμηση αρνείται: ο καλών δεν χρειάζεται
 * να ελέγξει δύο πράγματα, και μια άρνηση δεν πρέπει να γεννά βήμα undo για το τίποτα.
 */
export function applyTableSort(
  book: TableFormulaWorkbook,
  model: PersistedTableModel,
  request: TableSortRequest,
): PersistedTableModel {
  const outcome = planTableSort(resolveTableModel(model), request);
  return outcome.ok ? applyTableRangeTransfer(book, model, outcome.plan.transfer) : model;
}

/**
 * Η μετάθεση ως γεμίσματα: το κελί της γραμμής `order[i]` πηγαίνει στη θέση `i`.
 *
 * 🔑 Το `destination` είναι **η ίδια** περιοχή με το `source`, και το `mergeMoves` κενό: η
 * ταξινόμηση δεν μετακινεί την περιοχή, την **αναδιατάσσει**. Δες την κεφαλίδα για το τι
 * σημαίνει αυτό για τις ακμές.
 */
function transferFor(
  model: TableModel,
  range: TableCellRangeBounds,
  order: readonly number[],
): TableRangeTransferPlan {
  const fills: TableCellFill[] = [];
  order.forEach((sourceRow, offset) => {
    const targetRow = range.firstRow + offset;
    if (sourceRow === targetRow) return; // ταυτοτική γραμμή: καμία εγγραφή, κανένα «άλλαξε»
    for (let colIndex = range.firstCol; colIndex <= range.lastCol; colIndex += 1) {
      const at = refAt(model, targetRow, colIndex);
      const from = refAt(model, sourceRow, colIndex);
      if (at !== null && from !== null) fills.push({ at, from });
    }
  });

  return {
    source: range,
    destination: range,
    fills,
    intent: { copy: false, insert: false },
    mergeMoves: [],
  };
}

/** Η τιμή μιας γραμμής για μία στήλη — αριθμός αν είναι αριθμός, αλλιώς το κείμενό της. */
function keyAt(model: TableModel, rowIndex: number, colIndex: number): TableSortKey {
  const ref = refAt(model, rowIndex, colIndex);
  if (ref === null) return { numeric: null, text: '' };
  const cell = getCell(model, ref.rowId, ref.colId);
  return { numeric: cellValueToNumber(cell?.value ?? null), text: cellText(cell).trim() };
}

function refAt(model: TableModel, rowIndex: number, colIndex: number): TableCellRef | null {
  const row = model.rows[rowIndex];
  const column = model.columns[colIndex];
  if (row === undefined || column === undefined) return null;
  return { rowId: row.id, colId: column.id };
}

function isWithinModel(model: TableModel, range: TableCellRangeBounds): boolean {
  return (
    range.firstRow >= 0 &&
    range.firstCol >= 0 &&
    range.lastRow < model.rows.length &&
    range.lastCol < model.columns.length
  );
}

/**
 * Υπάρχει συγχώνευση που **αγγίζει** την περιοχή;
 *
 * Ρωτά το `ownerByCell` του {@link buildMergeIndex} και όχι το `model.merges`: το ευρετήριο
 * έχει ήδη λύσει τα εκτός εύρους και τα `1×1`, και μια δεύτερη ανάγνωση του ωμού πίνακα θα
 * ήταν δεύτερος ορισμός του «τι μετράει ως συγχώνευση».
 */
function hasMergeInside(model: TableModel, range: TableCellRangeBounds): boolean {
  const { ownerByCell } = buildMergeIndex(model);
  if (ownerByCell.size === 0) return false;
  for (let rowIndex = range.firstRow; rowIndex <= range.lastRow; rowIndex += 1) {
    for (let colIndex = range.firstCol; colIndex <= range.lastCol; colIndex += 1) {
      const ref = refAt(model, rowIndex, colIndex);
      if (ref !== null && ownerByCell.has(cellKey(ref.rowId, ref.colId))) return true;
    }
  }
  return false;
}
