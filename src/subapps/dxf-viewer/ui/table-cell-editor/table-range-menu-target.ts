/**
 * ADR-750 Φ4 / ADR-739 §61 — **ποια κελιά εννοεί το δεξί κλικ, και πώς λέγονται**.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Ζούσαν στο τέλος του `use-table-range-menu.ts`, που έφτασε τις **470/500** γραμμές (N.7.1) και
 * χρειάστηκε χώρο για την υποδοχή «Μορφοποίηση κελιών…». **Εξαγωγή, ποτέ trim.**
 *
 * Το κριτήριο της τομής δεν ήταν το μέγεθος αλλά η **φύση**: εδώ ζει καθαρή γεωμετρία δεικτών —
 * καμία React, κανένα store, κανένας `levelManager`. Το ίδιο κριτήριο διάλεξε ήδη τα όρια του
 * `TableHeaderMenuItems` και του `table-range-menu-commands.ts`. Ο μάρτυρας ότι ήταν πάντα
 * ξεχωριστό πράγμα υπήρχε **πριν** από την εξαγωγή: το test τους λεγόταν ήδη
 * `table-range-menu-target.test.ts`, δηλαδή το αρχείο απέκτησε το όνομα που η σουίτα του είχε
 * δώσει μήνες πριν.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-range-menu-target
 * @see ui/table-cell-editor/use-table-range-menu.ts — ποιος τα ρωτά και με ποια αφορμή
 * @see bim/table/table-axis-action-target.ts — η **ίδια** ερώτηση για ζώνες δείκτη
 */

import { columnLetter } from '@/lib/spreadsheet/column-letter';
import {
  resolveTableSelectionBounds,
  type TableCellRangeBounds,
  type TableCellRef,
  type TableSelectionSpan,
} from '../../bim/table/table-cell-range';
import type { TableModel } from '../../types/table';

/**
 * Τα όρια που θα βαφτούν: η τρέχουσα επιλογή αν το κελί ανήκει σε αυτήν, αλλιώς το κελί μόνο
 * του. Και τα δύο περνούν από τον **ΕΝΑ** δρόμο ερμηνείας επιλογής (Α22 — δες την κεφαλίδα του
 * `use-table-range-menu.ts`).
 *
 * Η επιλογή περνά ως **όρισμα** και δεν διαβάζεται από το store εδώ μέσα: έτσι ο κανόνας Α22
 * είναι καθαρή συνάρτηση και ελέγχεται με τέσσερα σχήματα σε τέσσερις γραμμές, αντί να απαιτεί
 * στημένο store και προσποιητό δρομέα. Ο καλών κάνει την **μία** ανάγνωση, τη στιγμή του
 * συμβάντος (ADR-040 κανόνας #2).
 *
 * `null` όταν το κελί δεν υπάρχει στο μοντέλο — μπαγιάτικη αναφορά μετά από undo.
 */
export function tableBorderTargetBounds(
  model: TableModel,
  cell: TableCellRef,
  selection: TableSelectionSpan | null | undefined,
): TableCellRangeBounds | null {
  const cellBounds = resolveTableSelectionBounds(model, { from: cell, to: cell, kind: 'range' });
  if (!cellBounds) return null;

  const selected = selection ? resolveTableSelectionBounds(model, selection) : null;
  return selected && contains(selected, cellBounds) ? selected : cellBounds;
}

/**
 * Είναι **το ίδιο** ορθογώνιο; — «περιέχει και περιέχεται», χωρίς τέταρτη σύγκριση δεικτών.
 *
 * Γραμμένο πάνω στο {@link contains} και όχι με τέσσερα `===`: ο ορισμός της ισότητας ορίων
 * μένει **ένας**, και η μέρα που τα όρια αποκτήσουν πέμπτο πεδίο δεν αφήνει πίσω της μια
 * σύγκριση που το αγνοεί σιωπηλά.
 */
export function sameTableRangeBounds(
  a: TableCellRangeBounds,
  b: TableCellRangeBounds,
): boolean {
  return contains(a, b) && contains(b, a);
}

/** Περιέχει το `outer` ολόκληρο το `inner`; Σύγκριση ορθογωνίων σε δείκτες, τίποτα άλλο. */
function contains(outer: TableCellRangeBounds, inner: TableCellRangeBounds): boolean {
  return (
    outer.firstRow <= inner.firstRow
    && outer.lastRow >= inner.lastRow
    && outer.firstCol <= inner.firstCol
    && outer.lastCol >= inner.lastCol
  );
}

/**
 * `C3` για ένα κελί, `B2:D4` για περιοχή — **η γλώσσα του χρήστη** (Α5: δεν μαθαίνει ποτέ τη
 * λέξη «ακμή»). Το γράμμα βγαίνει από το ίδιο SSoT με τις ζώνες δείκτη (`columnLetter`), ώστε
 * ο τίτλος του μενού να λέει ακριβώς ό,τι δείχνει η λωρίδα από πάνω.
 */
export function rangeLabel(bounds: TableCellRangeBounds): string {
  const start = cellName(bounds.firstRow, bounds.firstCol);
  const end = cellName(bounds.lastRow, bounds.lastCol);
  return start === end ? start : `${start}:${end}`;
}

function cellName(rowIndex: number, colIndex: number): string {
  return `${columnLetter(colIndex)}${rowIndex + 1}`;
}
