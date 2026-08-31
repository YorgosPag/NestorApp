/**
 * 🔴 ADR-833 Φάση 7 / N.18 — **ΤΑ ΔΥΟ ΠΕΡΑΣΜΑΤΑ ΠΑΝΩ ΣΤΑ ΚΕΛΙΑ ΕΝΟΣ ΜΟΝΤΕΛΟΥ**, με την
 * εγγύηση ταυτότητας γραμμένη **μία** φορά. Καθαρές συναρτήσεις: μηδέν React/DOM/store.
 *
 * ## Γιατί γεννήθηκε — το `jscpd` το μέτρησε, δεν το μάντεψε
 * Τέσσερις καταναλωτές έγραφαν τον **ίδιο** βρόχο *«πέρασε τα κελιά, άλλαξε ό,τι πρέπει,
 * επίστρεψε το ίδιο μοντέλο αν τίποτα δεν άλλαξε»*:
 *
 * ```
 *   ΔΕΝΤΡΟ   remapTableFormulaRefs · healTableFormulaRefs        (8 γρ., 60 tokens)
 *   ΤΙΜΗ     recalculateTableModel · worksheetsAfterHomeChange   (33 γρ., 66 tokens)
 * ```
 *
 * Το CHECK 3.28 τα ανέφερε ως **νέους** κλώνους μέσα στο ίδιο commit. Δεν είναι στιλιστικό:
 * η εγγύηση ταυτότητας **δεν είναι βελτιστοποίηση** — νέο αντικείμενο χωρίς λόγο σημαίνει
 * ακυρωμένα `WeakMap` (`resolveTableModel` → `resolveTableLayout`) **και** βήμα undo που δεν
 * αναιρεί τίποτα. Τέσσερα αντίγραφα ενός φύλακα είναι τέσσερις ευκαιρίες να ξεχαστεί ο ένας.
 *
 * ## 🔑 Γιατί ΔΥΟ συναρτήσεις και όχι μία με σημαία
 * Οι δύο ερωτήσεις είναι **ασύμβατες** στην είσοδο και στην έξοδο: το ένα πέρασμα αγγίζει
 * **μόνο κελιά τύπου** και ξαναγράφει **δέντρο**· το άλλο αγγίζει **κάθε** κελί που έχει
 * αποτέλεσμα και ξαναγράφει **τιμή**. Μια κοινή συνάρτηση με σημαία «τι κάνουμε» θα ήταν δύο
 * ερωτήσεις με μία απάντηση — ακριβώς αυτό που απορρίπτει η κεφαλίδα του
 * `table-formula-rewrite.ts` για τη μετακόμιση και την αντιγραφή.
 *
 * @module subapps/dxf-viewer/bim/table/formula/table-formula-cells
 * @see bim/table/formula/table-formula-rewrite.ts — η ΜΙΑ κάθοδος **μέσα** σε ένα δέντρο
 * @see docs/centralized-systems/reference/adrs/ADR-833-table-xlsx-import-and-worksheets.md §5.9
 */

import type { CellKey, PersistedTableModel, TableCellEntry, TableFormulaNode } from '../../../types/table';
import type { ScheduleCellValue } from '../../schedule/types';
import { cellKey } from '../table-model-helpers';

/**
 * Κάθε κελί **τύπου** με τη ρίζα του ξαναγραμμένη — **το ίδιο** μοντέλο by-reference όταν
 * κανένα δέντρο δεν άλλαξε.
 *
 * ⚠️ Ο μετασχηματιστής οφείλει να επιστρέφει **τον ίδιο κόμβο** όταν δεν αλλάζει τίποτα: η
 * σύγκριση εδώ είναι ταυτότητας αντικειμένου, όπως και μέσα στο `rewriteTableFormulaRefs`.
 * Ένας μετασχηματιστής που γεννά πάντα νέο δέντρο κάνει αυτόν τον φύλακα διακοσμητικό.
 */
export function mapTableFormulaTrees(
  model: PersistedTableModel,
  rewriteRoot: (root: TableFormulaNode) => TableFormulaNode,
): PersistedTableModel {
  let changed = false;
  const cells: readonly TableCellEntry[] = model.cells.map((entry) => {
    const [rowId, colId, cell] = entry;
    if (cell.kind !== 'formula' || cell.formula === undefined) return entry;
    const root = rewriteRoot(cell.formula.root);
    if (root === cell.formula.root) return entry;
    changed = true;
    return [rowId, colId, { ...cell, formula: { ...cell.formula, root } }] as TableCellEntry;
  });
  return changed ? { ...model, cells } : model;
}

/**
 * Τα κελιά με τις **νέες τιμές** γραμμένες — **το ίδιο** μοντέλο by-reference όταν καμία τιμή
 * δεν άλλαξε.
 *
 * ⚠️ Κελί που **λείπει** από τον χάρτη μένει ανέγγιχτο, και κελί του οποίου η νέα τιμή είναι
 * `===` με την παλιά επίσης: ο επαναϋπολογισμός τρέχει σε **κάθε** δεσμευμένη αλλαγή, και ένα
 * ανεξέλεγκτο `{...cell, value}` θα γεννούσε νέο μοντέλο σε κάθε πάτημα πλήκτρου.
 */
export function withRecalculatedValues(
  model: PersistedTableModel,
  values: ReadonlyMap<CellKey, ScheduleCellValue>,
): PersistedTableModel {
  let changed = false;
  const cells: readonly TableCellEntry[] = model.cells.map((entry) => {
    const [rowId, colId, cell] = entry;
    const next = values.get(cellKey(rowId, colId));
    if (next === undefined || next === cell.value) return entry;
    changed = true;
    return [rowId, colId, { ...cell, value: next }] as TableCellEntry;
  });
  return changed ? { ...model, cells } : model;
}
