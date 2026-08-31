/**
 * ADR-739 §27.17 — **τι κάνει κάθε δομικό item του μενού ζωνών**, ως καθαρή γνώση: η μεταβολή
 * του μοντέλου, το πού κάθεται ο δρομέας μετά, και τι γράφουν οι ετικέτες.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Ζούσαν στο `use-table-header-menu.ts`, που έφτασε τις **510/500** γραμμές όταν τα τρία items
 * έπαψαν να δουλεύουν με ένα `hit.index` το καθένα. **Εξαγωγή, ποτέ trim** — και το κριτήριο
 * της τομής δεν είναι το μέγεθος αλλά η **ανεξαρτησία**: τίποτα εδώ δεν βλέπει React, store,
 * DOM ή δρομέα. Ίδιο μοτίβο και ίδιος λόγος με το `table-header-format-snapshot.ts`.
 *
 * ## Ο διαχωρισμός που κάνει τη διαφορά
 * «Τι κάνει η πράξη» (εδώ) ≠ «ποιος την εκτελεί» (το hook) ≠ «ποιους άξονες αφορά»
 * (`table-axis-action-target.ts`). Πριν, και τα τρία ήταν μπλεγμένα μέσα σε τρία object
 * literals του μενού — και εκεί ακριβώς χανόταν σιωπηλά η επιλογή του χρήστη: η διαγραφή
 * έσβηνε **μία** στήλη ενώ η οθόνη είχε **τρεις** φωτισμένες (Giorgio, 2026-08-04).
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-header-axis-actions
 * @see bim/table/table-axis-action-target.ts — ΠΟΙΟΥΣ άξονες αφορά το πάτημα
 * @see bim/table/table-row-column-bulk-ops.ts — η πράξη σε πολλούς άξονες (όλα ή τίποτα)
 */

import { columnLetter } from '@/lib/spreadsheet/column-letter';
import {
  canDeleteTableColumn,
  canDeleteTableRow,
  canInsertTableColumn,
  canInsertTableRow,
} from '../../bim/table/table-row-column-ops';
import type { TableFormulaWorkbook } from '../../bim/table/formula/table-formula-workbook';
import {
  deleteTableColumns,
  deleteTableRows,
  insertTableColumns,
  insertTableRows,
} from '../../bim/table/table-row-column-bulk-ops';
// 🔴 ADR-739 §58 Γ2 — «ποιος κατέχει το ύψος». Καθαρό SSoT, δεύτερος καταναλωτής μετά τα tests.
import {
  clearTableRowHeights,
  hasFixedTableRowHeight,
} from '../../bim/table/table-row-height-ops';
import { tableCursorAt, type TableCursorPosition } from '../../bim/table/table-cell-navigation';
import type { TableAxisActionTarget } from '../../bim/table/table-axis-action-target';
import type { TableCellRef } from '../../bim/table/table-cell-range';
import type { TableHeaderMenuState } from '../components/TableHeaderMenuItems';
import type { PersistedTableModel } from '../../types/table';

/** Ποιον άξονα καρφώνει η πράξη· ο άλλος κληρονομείται από τον τρέχοντα δρομέα. */
export interface SurvivorPick {
  readonly rowIndex?: number;
  readonly colIndex?: number;
}

/** Τι κάνει μια δομική πράξη: η μεταβολή, και πού κάθεται ο δρομέας μετά από αυτήν. */
export interface AxisActionPlan {
  /**
   * 🔴 ADR-833 Φάση 7 — δέχεται **και βιβλίο**: μια διαγραφή γραμμής ξαναϋπολογίζει τύπους,
   * και ένας τύπος μπορεί να διαβάζει άλλο φύλλο. Το βιβλίο το δίνει ο εκτελεστής, που έχει
   * ήδη τη ζωντανή οντότητα — ο σχεδιαστής μένει καθαρός.
   */
  readonly mutate: (
    model: PersistedTableModel,
    book: TableFormulaWorkbook,
  ) => PersistedTableModel;
  readonly pick: SurvivorPick;
}

/** Ο σχεδιαστής μιας πράξης — καθαρός: στόχος μέσα, σχέδιο έξω, μηδέν store. */
export type AxisActionPlanner = (target: TableAxisActionTarget) => AxisActionPlan;

/**
 * **Διαγραφή ολόκληρου του στόχου** — μία, τρεις ή όσες μάρκαρε ο χρήστης.
 *
 * Ο δρομέας πηγαίνει στην **πρώτη** θέση που σβήστηκε: το {@link survivingCursor} την κόβει
 * στα νέα όρια, οπότε μετά τη διαγραφή των τελευταίων στηλών πέφτει στη νέα τελευταία —
 * ακριβώς όπως κάθε φύλλο υπολογισμού.
 */
export function deleteAxisTarget(target: TableAxisActionTarget): AxisActionPlan {
  return {
    mutate: (model, book) =>
      target.axis === 'row'
        ? deleteTableRows(book, model, target.ids)
        : deleteTableColumns(book, model, target.ids),
    pick: survivorAt(target.axis, target.firstIndex),
  };
}

/**
 * **Εισαγωγή τόσων όσα μάρκαρε ο χρήστης** — ο κανόνας του Excel: με τρεις στήλες
 * επιλεγμένες, η «Εισαγωγή αριστερά» βάζει τρεις.
 *
 * Οι δύο κατευθύνσεις είναι **μία** υλοποίηση με άλλη θέση (`πριν την πρώτη` / `μετά την
 * τελευταία`): δύο σώματα θα ήταν sibling clone (N.18) και δύο σημεία να ξεχάσει κάποιο
 * κάποτε το πλήθος.
 */
export function insertAt(side: 'before' | 'after'): AxisActionPlanner {
  return (target) => {
    const at = side === 'before' ? target.firstIndex : target.lastIndex + 1;
    return {
      mutate: (model, book) =>
        target.axis === 'row'
          ? insertTableRows(book, model, at, target.count)
          : insertTableColumns(book, model, at, target.count),
      pick: survivorAt(target.axis, at),
    };
  };
}

/**
 * 🔴 ADR-739 §58 Γ2 — **«Αυτόματο ύψος γραμμής»**: το ύψος ξαναγίνεται παράγωγο του περιεχομένου.
 *
 * Τρίτος `AxisActionPlanner`, με τον **ίδιο** στόχο και τον ίδιο εκτελεστή που έχουν η εισαγωγή
 * και η διαγραφή (§27.17 · §42): ένα `Ctrl+Z`, επιζών δρομέας, καμία δεύτερη διαδρομή εγγραφής.
 *
 * ⚠️ **`pick: {}` — ο δρομέας ΔΕΝ κουνιέται**, και είναι η μόνη από τις τρεις πράξεις όπου αυτό
 * ισχύει: η εισαγωγή και η διαγραφή **αλλάζουν το πλέγμα** (μια θέση παύει να υπάρχει ή
 * μετακινείται), ενώ εδώ κάθε ταυτότητα μένει ακριβώς όπου ήταν. Το {@link survivingCursor}
 * διαβάζει τότε την **τρέχουσα** θέση και την κόβει στα όρια — δηλαδή δεν αλλάζει τίποτα.
 *
 * ⚠️ **Στηλες ⇒ no-op**, δηλωμένο και όχι σιωπηλό: η ερώτηση «ποιος κατέχει το ύψος» έχει νόημα
 * μόνο στον κατακόρυφο άξονα. Το οριζόντιο αντίστοιχο υπάρχει ήδη με **άλλο λεξιλόγιο**
 * (`TableColumnSizing`: `fixed` vs `hug`) και **δεν** συγχωνεύεται εδώ βίαια — δύο πεδία με
 * διαφορετικό σχήμα πίσω από ένα κουμπί θα ήταν το πρώτο σημείο όπου το ένα από τα δύο ξεχνιέται.
 */
export function autoFitAxisHeight(target: TableAxisActionTarget): AxisActionPlan {
  return {
    mutate: (model) =>
      target.axis === 'row' ? clearTableRowHeights(model, target.ids) : model,
    pick: {},
  };
}

/**
 * Έχει **αυτός** ο στόχος τι να επαναφέρει; — η μία έκφραση, όπως το {@link canDeleteAxisTarget}.
 *
 * Εξηγεί γιατί το κουμπί μπορεί να είναι σβηστό: όχι επειδή η πράξη είναι αδύνατη, αλλά επειδή
 * **δεν υπάρχει καρφωμένο ύψος**. Στο Excel η ίδια εντολή είναι πάντα πατήσιμη και πάντα
 * σιωπηλή — δες `hasFixedTableRowHeight` για το τι κερδίζει ο χρήστης από τη διαφορά.
 */
export function canAutoFitAxisHeight(
  model: PersistedTableModel,
  target: TableAxisActionTarget,
): boolean {
  return target.axis === 'row' && hasFixedTableRowHeight(model, target.ids);
}

/**
 * 🔴 ADR-739 §42 — **ΕΠΙΤΡΕΠΕΤΑΙ Η ΔΙΑΓΡΑΦΗ ΑΥΤΟΥ ΤΟΥ ΣΤΟΧΟΥ;** — η μία έκφραση, δύο
 * καταναλωτές: το μενού ζωνών (γκριζάρει το item) και το **⊖** (δεν εμφανίζεται καθόλου).
 *
 * Ρωτά με το **πλήθος του στόχου** και όχι με `1` — δες το {@link resolveHeaderState}: με
 * τέσσερις στήλες μαρκαρισμένες σε πίνακα τεσσάρων η απάντηση είναι «όχι», γιατί μια μερική
 * διαγραφή θα ήταν χειρότερη από καμία (`table-row-column-bulk-ops`: όλα ή τίποτα).
 *
 * Εξήχθη τη στιγμή που απέκτησε δεύτερο καταναλωτή: δύο αντίγραφα του τριαδικού θα ήταν δύο
 * ευκαιρίες να απαντήσει το ένα «ναι» και το άλλο «όχι» για τον ίδιο στόχο — δηλαδή ⊖ ορατό
 * πάνω σε πράξη που το μενού δηλώνει αδύνατη.
 */
export function canDeleteAxisTarget(
  model: PersistedTableModel,
  target: TableAxisActionTarget,
): boolean {
  return target.axis === 'row'
    ? canDeleteTableRow(model, target.count)
    : canDeleteTableColumn(model, target.count);
}

function survivorAt(axis: 'row' | 'column', index: number): SurvivorPick {
  return axis === 'row' ? { rowIndex: index } : { colIndex: index };
}

/**
 * Οι σημαίες + η ετικέτα + **το πλήθος**, απαντημένα τη στιγμή που ανοίγει το μενού.
 *
 * 🔴 Τα φράγματα ρωτιούνται με το **πλήθος του στόχου**, όχι με το `1`: με τέσσερις στήλες
 * μαρκαρισμένες σε πίνακα τεσσάρων, η «Διαγραφή» είναι **ανενεργή** — ο πίνακας χρειάζεται
 * τουλάχιστον μία στήλη, και μια μερική διαγραφή θα ήταν χειρότερη από καμία (δες
 * `table-row-column-bulk-ops.ts`: όλα ή τίποτα).
 */
export function resolveHeaderState(
  model: PersistedTableModel | null,
  target: TableAxisActionTarget | null,
): TableHeaderMenuState {
  if (!target) {
    return { label: '', axisLabel: '', count: 0, canInsert: false, canDelete: false };
  }
  const label = tableHeaderLabel(target);
  const axisLabel = axisName(target, target.hitIndex);
  const { count } = target;
  if (!model) return { label, axisLabel, count, canInsert: false, canDelete: false };
  return {
    label,
    axisLabel,
    count,
    canInsert:
      target.axis === 'row'
        ? canInsertTableRow(model, count)
        : canInsertTableColumn(model, count),
    // §42 — **η ίδια** έκφραση που ρωτά και το ⊖, ώστε τα δύο χειριστήρια να μη μπορούν να
    // διαφωνήσουν για το αν η πράξη επιτρέπεται.
    canDelete: canDeleteAxisTarget(model, target),
  };
}

/**
 * Το κελί όπου κάθεται ο δρομέας **μετά** την πράξη.
 *
 * Ο δείκτης κόβεται στα νέα όρια: διαγραφή της τελευταίας γραμμής αφήνει δείκτη εκτός
 * πλέγματος, και ο δρομέας πρέπει να πέσει στη νέα τελευταία — όπως σε κάθε φύλλο
 * υπολογισμού. Το `-1` του `findIndex` (η γραμμή του δρομέα ήταν αυτή που σβήστηκε) περνά
 * από το ίδιο κόψιμο και καταλήγει στην πρώτη.
 */
export function survivingCursor(
  model: PersistedTableModel,
  current: TableCellRef,
  pick: SurvivorPick,
): TableCursorPosition | null {
  if (model.rows.length === 0 || model.columns.length === 0) return null;
  const rowIndex = pick.rowIndex ?? model.rows.findIndex((row) => row.id === current.rowId);
  const colIndex = pick.colIndex ?? model.columns.findIndex((col) => col.id === current.colId);
  const row = model.rows[clampIndex(rowIndex, model.rows.length)];
  const column = model.columns[clampIndex(colIndex, model.columns.length)];
  return tableCursorAt(row.id, column.id);
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}

/**
 * `A` / `B` για στήλη, `1` / `2` για γραμμή — **η ίδια ονομασία** που ζωγραφίζει η ζώνη
 * (`tableColumnTicks` / `tableRowTicks`), από το ίδιο SSoT γράμματος.
 *
 * Πολλαπλός στόχος ⇒ `A:C` / `2:5`, δηλαδή **η γλώσσα που ήδη μιλά ο χρήστης** στη γραμμή
 * τύπων και στο μενού περιοχής (`rangeLabel`: `B2:D4`). Δεν εφευρίσκεται τρίτος τρόπος να
 * γραφτεί ένα διάστημα — ο τίτλος του μενού λέει ακριβώς ό,τι δείχνει φωτισμένο η λωρίδα.
 */
export function tableHeaderLabel(target: TableAxisActionTarget): string {
  return target.count === 1
    ? axisName(target, target.firstIndex)
    : `${axisName(target, target.firstIndex)}:${axisName(target, target.lastIndex)}`;
}

/** Το όνομα **μιας** υποδιαίρεσης του άξονα — ο ένας κανόνας ονομασίας, δύο καταναλωτές. */
function axisName(target: TableAxisActionTarget, index: number): string {
  return target.axis === 'column' ? columnLetter(index) : String(index + 1);
}
