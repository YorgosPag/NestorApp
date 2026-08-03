/**
 * ADR-739 Φ.Ζ — **ο adapter**: το συμβόλαιο του §9.2 και η μία διαδρομή «γράψε κελί →
 * ξαναϋπολόγισε». Το αρχείο που θα άλλαζε — **μόνο αυτό** — αν κάποτε μπει εξωτερική
 * βιβλιοθήκη τύπων.
 *
 * ## Η υπογραφή δεν επινοήθηκε εδώ
 * Το `evaluate(model, changed)` είναι **αυτούσιο** από το ADR-739 §9.2, γραμμένο πριν
 * υπάρξει μηχανή. Ο λόγος 1 του §9.2 («αναστρεψιμότητα») το απαιτεί: ό,τι κι αν κάνει από
 * κάτω, ο υπόλοιπος πίνακας ξέρει μόνο αυτή τη γραμμή.
 *
 * ## 🔑 Η εγγύηση ταυτότητας ταξιδεύει μέχρι εδώ
 * Όταν τίποτα δεν άλλαξε, επιστρέφεται **το ίδιο** μοντέλο by-reference. Χωρίς αυτό, κάθε
 * commit που δεν αλλάζει τίποτα θα γεννούσε νέο αντικείμενο, δηλαδή **βήμα undo για το
 * τίποτα** και ακύρωση των `WeakMap` του `resolveTableModel`/`resolveTableLayout` — η ίδια
 * τέταρτη εγγύηση που δίνει ήδη το `setPersistedCellText`, συνεχισμένη αντί για ξαναγραμμένη.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-engine
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §9.2
 */

import type {
  CellKey,
  PersistedTableModel,
  TableColumnId,
  TableModel,
  TableRowId,
} from '../../../types/table';
import type { ScheduleCellValue } from '../../schedule/types';
import {
  cellKey,
  getPersistedCellText,
  resolveTableModel,
  setPersistedCellFormula,
  setPersistedCellText,
} from '../table-model-helpers';
import { isFormulaInput, parseTableFormula } from './table-formula-parse';
import { printTableFormula } from './table-formula-print';
import { evaluateTableFormulas } from './table-formula-recalc';

/**
 * Το συμβόλαιο του ADR-739 §9.2 — αυτούσιο.
 *
 * Παραμένει **interface** και όχι σκέτη συνάρτηση ώστε ο καταναλωτής να μπορεί να δεχτεί
 * άλλη υλοποίηση (δοκιμαστική διπλή, ή αυριανή βιβλιοθήκη) χωρίς να αλλάξει τύπο.
 */
export interface TableFormulaEngine {
  evaluate(model: TableModel, changed: readonly CellKey[]): ReadonlyMap<CellKey, ScheduleCellValue>;
}

/** Η υλοποίηση της Φ.Ζ: δικός μας αναλυτής, δικός μας γράφος, μηδέν εξάρτηση. */
export const tableFormulaEngine: TableFormulaEngine = {
  evaluate: evaluateTableFormulas,
};

/**
 * **Η ΜΙΑ διακλάδωση `=`**: ό,τι πληκτρολογεί ή επικολλά ο χρήστης περνά από εδώ.
 *
 * - Κείμενο που ξεκινά με `=` **και** αναλύεται ⇒ κελί τύπου.
 * - Κείμενο που ξεκινά με `=` και **δεν** αναλύεται (`'=1+'`) ⇒ μένει **κείμενο**, αυτούσιο.
 *   Ο χρήστης βλέπει ό,τι έγραψε και το διορθώνει· τίποτα δεν χάνεται, καμία κατάσταση
 *   σφάλματος δεν χρειάζεται εξήγηση.
 * - Οτιδήποτε άλλο ⇒ κείμενο, ακριβώς όπως πριν αυτή τη φάση.
 *
 * Η **τιμή** δεν υπολογίζεται εδώ: μπαίνει προσωρινά κενή και τη γράφει ο
 * {@link recalculateTableModel} στο ίδιο commit. Ο λόγος είναι η επικόλληση: είκοσι κελιά
 * γράφονται ένα-ένα και ξαναϋπολογίζονται **μία** φορά, με τη σωστή τοπολογική σειρά — αν
 * υπολόγιζε το καθένα μόνο του, το πρώτο θα διάβαζε κελιά που δεν έχουν γραφτεί ακόμα.
 */
export function writeCellInput(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
  text: string,
): PersistedTableModel {
  if (!isFormulaInput(text)) return setPersistedCellText(model, rowId, colId, text);

  const formula = parseTableFormula(resolveTableModel(model), text);
  return formula === null
    ? setPersistedCellText(model, rowId, colId, text)
    : setPersistedCellFormula(model, rowId, colId, formula);
}

/**
 * **Η αντίστροφη του {@link writeCellInput}**: τι βλέπει ο χρήστης όταν ανοίγει το κελί.
 *
 * Κελί τύπου ⇒ το **πηγαίο** (`=SUM(A1:A5)`), παραγμένο από το δέντρο τη στιγμή της
 * ερώτησης· οτιδήποτε άλλο ⇒ το κείμενό του. Ένα σημείο, γιατί τη ρωτούν **δύο** καταναλωτές
 * με την ίδια απαίτηση — ο επεξεργαστής μέσα στο κελί και η γραμμή τύπων — και μια δεύτερη
 * απάντηση θα σήμαινε ότι η γραμμή τύπων μπορεί κάποτε να δείχνει άλλο κείμενο από αυτό που
 * επεξεργάζεσαι.
 *
 * Στον **καμβά** εξακολουθεί να φαίνεται το αποτέλεσμα: εκείνος διαβάζει `cellText(value)`
 * και δεν περνά ποτέ από εδώ — όπως ακριβώς σε Excel, Sheets και AutoCAD.
 */
export function cellInputText(
  model: PersistedTableModel,
  rowId: TableRowId,
  colId: TableColumnId,
): string {
  const cell = model.cells.find(([r, c]) => r === rowId && c === colId)?.[2];
  if (cell?.kind === 'formula' && cell.formula !== undefined) {
    return printTableFormula(resolveTableModel(model), cell.formula);
  }
  return getPersistedCellText(model, rowId, colId);
}

/**
 * Ξαναϋπολογίζει ό,τι εξαρτάται από τα αλλαγμένα κελιά και επιστρέφει το **νέο** μοντέλο —
 * ή το ίδιο by-reference όταν καμία τιμή δεν άλλαξε.
 */
export function recalculateTableModel(
  model: PersistedTableModel,
  changed: readonly CellKey[],
): PersistedTableModel {
  const results = tableFormulaEngine.evaluate(resolveTableModel(model), changed);
  if (results.size === 0) return model;

  let touched = false;
  const cells = model.cells.map((entry) => {
    const [rowId, colId, cell] = entry;
    const next = results.get(cellKey(rowId, colId));
    if (next === undefined || next === cell.value) return entry;
    touched = true;
    return [rowId, colId, { ...cell, value: next }] as const;
  });

  return touched ? { ...model, cells } : model;
}
