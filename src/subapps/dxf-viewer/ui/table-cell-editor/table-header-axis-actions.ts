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
import {
  deleteTableColumns,
  deleteTableRows,
  insertTableColumns,
  insertTableRows,
} from '../../bim/table/table-row-column-bulk-ops';
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
  readonly mutate: (model: PersistedTableModel) => PersistedTableModel;
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
    mutate: (model) =>
      target.axis === 'row'
        ? deleteTableRows(model, target.ids)
        : deleteTableColumns(model, target.ids),
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
      mutate: (model) =>
        target.axis === 'row'
          ? insertTableRows(model, at, target.count)
          : insertTableColumns(model, at, target.count),
      pick: survivorAt(target.axis, at),
    };
  };
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
  return target.axis === 'row'
    ? {
        label,
        axisLabel,
        count,
        canInsert: canInsertTableRow(model, count),
        canDelete: canDeleteTableRow(model, count),
      }
    : {
        label,
        axisLabel,
        count,
        canInsert: canInsertTableColumn(model, count),
        canDelete: canDeleteTableColumn(model, count),
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
