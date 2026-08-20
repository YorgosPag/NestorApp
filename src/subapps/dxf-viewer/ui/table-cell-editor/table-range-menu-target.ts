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
  return selected && tableRangeContains(selected, cellBounds) ? selected : cellBounds;
}

/**
 * Είναι **το ίδιο** ορθογώνιο; — «περιέχει και περιέχεται», χωρίς τέταρτη σύγκριση δεικτών.
 *
 * Γραμμένο πάνω στο {@link tableRangeContains} και όχι με τέσσερα `===`: ο ορισμός της ισότητας ορίων
 * μένει **ένας**, και η μέρα που τα όρια αποκτήσουν πέμπτο πεδίο δεν αφήνει πίσω της μια
 * σύγκριση που το αγνοεί σιωπηλά.
 */
export function sameTableRangeBounds(
  a: TableCellRangeBounds,
  b: TableCellRangeBounds,
): boolean {
  return tableRangeContains(a, b) && tableRangeContains(b, a);
}

/** Περιέχει το `outer` ολόκληρο το `inner`; Σύγκριση ορθογωνίων σε δείκτες, τίποτα άλλο. */
export function tableRangeContains(
  outer: TableCellRangeBounds,
  inner: TableCellRangeBounds,
): boolean {
  return (
    outer.firstRow <= inner.firstRow
    && outer.lastRow >= inner.lastRow
    && outer.firstCol <= inner.firstCol
    && outer.lastCol >= inner.lastCol
  );
}

/**
 * 🔴 ADR-739 §68 — **ΠΡΕΠΕΙ ΤΟ ΔΕΞΙ ΚΛΙΚ ΝΑ ΜΕΤΑΚΙΝΗΣΕΙ ΤΗΝ ΕΠΙΛΟΓΗ ΕΔΩ;**
 *
 * ```
 * ενεργό A1, καμία περιοχή, δεξί κλικ στο B2   ⇒  true   (έξω από ό,τι ήδη ισχύει)
 * ενεργό A1, καμία περιοχή, δεξί κλικ στο A1   ⇒  false  (είναι ήδη εκεί)
 * επιλογή B2:D4,            δεξί κλικ στο C3   ⇒  false  (μέσα στην επιλογή — Excel)
 * επιλογή B2:D4,            δεξί κλικ στο E5   ⇒  true
 * ```
 *
 * ## 🔑 «Ό,τι ήδη ισχύει» είναι **ΔΥΟ** πεδία, όχι ένα
 * Στο Excel το ενεργό κελί ανήκει **πάντα** στην επιλογή — μία έννοια, ένα ερώτημα. Εδώ η
 * επιλογή είναι **έκταση** και ζει χωριστά από τη **θέση** (§27.15: «καμία επιλογή ≠ επιλογή
 * 1×1», απόφαση του ιδιοκτήτη 02/08), οπότε η ίδια ερώτηση θέλει και τα δύο πεδία.
 *
 * ⚠️ **Χωρίς το σκέλος του ενεργού κελιού η συνάρτηση θα ήταν λάθος με τρόπο που δεν φαίνεται**:
 * δεξί κλικ πάνω στο ήδη ενεργό κελί θα απαντούσε `true` ⇒ νέα εγγραφή δρομέα ⇒ **νέα στήλη
 * αγκύρωσης** (`tableCursorAt`), δηλαδή το επόμενο `Enter` θα επέστρεφε σε άλλη στήλη από
 * εκείνη που περίμενε ο χρήστης. Μια «αβλαβής» περιττή εγγραφή που αλλάζει σιωπηλά την πλοήγηση.
 *
 * 🔑 Και τα δύο σκέλη περνούν από τον **ΕΝΑ** resolver επιλογής, άρα το κούμπωμα σε συγχώνευση
 * έρχεται δωρεάν και **στα δύο**: με ενεργό το `A1` μιας συγχώνευσης `A1:B2`, δεξί κλικ στο
 * `B2` απαντά `false` — είναι το ίδιο κελί, όσο κι αν οι δείκτες διαφέρουν.
 *
 * `false` και σε μπαγιάτικο κελί (undo ανάμεσα στο πάτημα και την ερώτηση): καμία μαντεψιά.
 */
export function tableContextMenuMovesSelection(
  model: TableModel,
  cell: TableCellRef,
  active: TableCellRef,
  selection: TableSelectionSpan | null | undefined,
): boolean {
  const targetBounds = resolveTableSelectionBounds(model, { from: cell, to: cell, kind: 'range' });
  if (!targetBounds) return false;

  const current = selection
    ? resolveTableSelectionBounds(model, selection)
    : resolveTableSelectionBounds(model, { from: active, to: active, kind: 'range' });

  return !(current && tableRangeContains(current, targetBounds));
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
