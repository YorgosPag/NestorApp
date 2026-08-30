/**
 * ADR-833 §1.2 — **πλέγμα φύλλου → `PersistedTableModel`**, στις ακριβείς του διαστάσεις.
 *
 * Ο δεύτερος κρίκος της εισαγωγής: παίρνει το ουδέτερο `TsvGrid` του
 * {@link readXlsxWorksheets} και παραδίδει μοντέλο πίνακα έτοιμο να μπει σε οντότητα.
 *
 * ## 🔴 Γιατί χτίζει ΚΑΙΝΟΥΡΓΙΟ μοντέλο αντί να επικολλήσει σε υπάρχον
 *
 * Το `pasteTsvIntoTable` **κόβει στα όρια του πίνακα** — δηλωμένο ρητά στην κεφαλίδα του:
 * *«ο πίνακας δεν μεγαλώνει ποτέ μόνος του»*. Επικόλληση ενός φύλλου 40×12 σε προεπιλεγμένο
 * πίνακα 3×3 θα έδινε **9 κελιά από τα 480** — και τα υπόλοιπα θα έλειπαν χωρίς να τα ζητήσει
 * κανείς. Άρα το μέγεθος αποφασίζεται **πριν**: `buildTableModel` στις διαστάσεις του φύλλου,
 * και μετά η επικόλληση χωρά εξ ορισμού.
 *
 * ## 🔴 Θεσιακή ταύτιση 1:1 — η γραμμή N του Excel είναι η γραμμή N του πίνακα
 *
 * Η άγκυρα είναι το **πρώτο κελί του πίνακα** (γραμμή τίτλου), όχι η πρώτη γραμμή δεδομένων.
 * Η εναλλακτική — «η πρώτη γραμμή του Excel είναι προφανώς κεφαλίδα, βάλ' την στη γραμμή
 * κεφαλίδας» — είναι **μαντεψιά**: πάρα πολλά φύλλα ξεκινούν με τίτλο, με κενή γραμμή, ή με
 * δεδομένα κατευθείαν, και μια λάθος μαντεψιά μετατοπίζει **κάθε** γραμμή κατά μία.
 *
 * Η ταύτιση θέσεων δεν είναι μόνο συντηρητική — είναι **προαπαιτούμενο**: την ημέρα που οι
 * τύποι του Excel θα εισάγονται ως τύποι (ADR-833 Φάση 6), το `A1` του Excel πρέπει να δείχνει
 * στο ίδιο κελί που έδειχνε εκεί. Μια μετατόπιση δύο γραμμών σήμερα θα ήταν αδύνατο να
 * αναιρεθεί αύριο.
 *
 * Οι δύο πρώτες γραμμές παίρνουν το στυλ `title`/`header` του πίνακα — αυτό είναι **εμφάνιση**,
 * την αλλάζει η κορδέλα μορφοποίησης, και δεν αγγίζει ούτε μία τιμή.
 *
 * @module bim/table/import/worksheet-to-model
 * @see bim/table/import/xlsx-to-worksheets.ts — ο προηγούμενος κρίκος
 */

import type { PersistedTableModel } from '../../../types/table';
import type { TsvGrid } from '@/lib/spreadsheet/tsv';
import {
  buildTableModel,
  MAX_TABLE_COLUMN_COUNT,
  MAX_TABLE_DATA_ROW_COUNT,
  TABLE_FIXED_ROW_COUNT,
} from '../build-table-entity';
import { pasteTsvIntoTable } from '../table-range-clipboard';

/**
 * Τι μπήκε και **τι δεν χώρεσε**.
 *
 * ⚠️ Τα «δεν χώρεσε» δεν είναι διακοσμητικά: ένα φύλλο μεγαλύτερο από τα όρια του πίνακα
 * **κόβεται**, και ο χρήστης οφείλει να το μάθει με αριθμό — όχι να το ανακαλύψει
 * κατεβαίνοντας. Σιωπηλή μερική εισαγωγή είναι σφάλμα **τιμής**, όχι εμφάνισης.
 */
export interface WorksheetImportResult {
  readonly model: PersistedTableModel;
  /** Γραμμές που είχε το φύλλο. */
  readonly offeredRows: number;
  /** Στήλες που είχε το φύλλο (η πλατύτερη γραμμή του). */
  readonly offeredColumns: number;
  /** Γραμμές που **δεν** χώρεσαν στα όρια του πίνακα (`0` = μπήκαν όλες). */
  readonly droppedRows: number;
  /** Στήλες που **δεν** χώρεσαν στα όρια του πίνακα (`0` = μπήκαν όλες). */
  readonly droppedColumns: number;
}

/** Η πλατύτερη γραμμή — το πλέγμα μπορεί να είναι οδοντωτό (κενά κελιά στο τέλος γραμμής). */
function widestRow(grid: TsvGrid): number {
  return grid.reduce((max, row) => Math.max(max, row.length), 0);
}

/**
 * Πλέγμα φύλλου → μοντέλο πίνακα στις **δικές του** διαστάσεις, κομμένο μόνο εκεί που τα
 * όρια του πίνακα το επιβάλλουν — και με ρητή αναφορά για ό,τι κόπηκε.
 *
 * Κενό φύλλο ⇒ ο προεπιλεγμένος κενός πίνακας (`buildTableModel({})`): η εισαγωγή ενός άδειου
 * φύλλου δεν είναι σφάλμα, είναι άδειο φύλλο.
 */
export function worksheetGridToModel(
  grid: TsvGrid,
  columnWidthMm?: number,
): WorksheetImportResult {
  const offeredRows = grid.length;
  const offeredColumns = widestRow(grid);
  if (offeredRows === 0 || offeredColumns === 0) {
    return {
      model: buildTableModel({ columnWidthMm }),
      offeredRows,
      offeredColumns,
      droppedRows: 0,
      droppedColumns: 0,
    };
  }

  // Ο πίνακας έχει ΠΑΝΤΑ τις δύο σταθερές γραμμές (τίτλος + κεφαλίδα), οπότε το «σύνολο
  // γραμμών» που ζητάει το φύλλο μεταφράζεται σε «γραμμές δεδομένων» αφαιρώντας τες.
  const fitRows = Math.min(offeredRows, TABLE_FIXED_ROW_COUNT + MAX_TABLE_DATA_ROW_COUNT);
  const fitColumns = Math.min(offeredColumns, MAX_TABLE_COLUMN_COUNT);

  const empty = buildTableModel({
    columnCount: fitColumns,
    dataRowCount: Math.max(0, fitRows - TABLE_FIXED_ROW_COUNT),
    columnWidthMm,
  });

  // Η άγκυρα: το **πρώτο** κελί του πίνακα. Διαβάζεται από το ίδιο το μοντέλο και όχι από
  // σύμβαση ονομασίας (`c0`/`r0`) — ο εργοστασιάρχης είναι ο ιδιοκτήτης των ids, όχι εμείς.
  const anchor = { rowId: empty.rows[0].id, colId: empty.columns[0].id };
  const pasted = pasteTsvIntoTable(empty, anchor, grid);

  return {
    model: pasted.model,
    offeredRows,
    offeredColumns,
    droppedRows: offeredRows - pasted.fittedRows,
    droppedColumns: offeredColumns - pasted.fittedColumns,
  };
}
