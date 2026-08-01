/**
 * ADR-739 Φ.Δ βήμα 8 — **αντιγραφή και επικόλληση περιοχής κελιών**. Καθαρή, μηδέν DOM.
 *
 * Παίρνει μοντέλο και περιοχή, δίνει TSV· παίρνει TSV και μοντέλο, δίνει **νέο μοντέλο**.
 * Το πρόχειρο του λειτουργικού, τα συμβάντα του browser και τα μηνύματα προς τον χρήστη
 * ζουν **έξω** — εδώ δεν υπάρχει τίποτα που να μη μπορεί να δοκιμαστεί με σκέτα δεδομένα.
 *
 * ## 🔴 ΓΙΑΤΙ ΕΝΑ ΜΟΝΤΕΛΟ ΚΑΙ ΟΧΙ Ν ΕΝΤΟΛΕΣ — η απάντηση στο «ένα undo»
 * Η απαίτηση είναι ρητή: **20 κελιά επικολλημένα = ένα `Ctrl+Z`** (Excel parity· το αντίθετο
 * είναι η κλασική στιγμή που ο χρήστης χάνει την εμπιστοσύνη του στο undo). Ο πειρασμός
 * είναι μια σύνθετη εντολή — και υπάρχει ήδη υποδομή γι' αυτό (`CompositeCommand`,
 * `executeAsAtomicBatch`).
 *
 * **Δεν χρειάζεται.** Το `setPersistedCellText` είναι ήδη **καθαρός, αμετάβλητος** γραφέας:
 * εφαρμόζεται Ν φορές πάνω στο ενδιάμεσο αποτέλεσμα χωρίς να αγγίξει τίποτα, και μετά
 * γίνεται **μία** εγγραφή του τελικού μοντέλου. Ένα `UpdateEntityCommand`, ένα undo, και —
 * το σημαντικότερο — **η ίδια ακριβώς διαδρομή commit** με τη μονή επεξεργασία κελιού. Καμία
 * νέα μηχανική, κανένα δεύτερο μονοπάτι που θα μπορούσε να αποκλίνει (§6.6).
 *
 * ## Ο πίνακας ΔΕΝ μεγαλώνει μόνος του
 * Ό,τι δεν χωράει **κόβεται**, και ο χρήστης το μαθαίνει. Ίδιο επιχείρημα με το «το `Tab`
 * στο τελευταίο κελί δεν φτιάχνει γραμμή» (`table-cell-navigation.ts`): μια σιωπηλή μεταβολή
 * **γεωμετρίας οντότητας σχεδίου** από πλήκτρο είναι μη-αναστρέψιμη έκπληξη σε undo stack
 * CAD. Το AutoCAD κάνει ακριβώς αυτό — γεμίζει όσα χωρούν. Η προσθήκη γραμμών ανήκει σε
 * **ρητή** εντολή.
 *
 * @module subapps/dxf-viewer/bim/table/table-range-clipboard
 * @see lib/spreadsheet/tsv.ts — η σειριοποίηση (SSoT, κοινή με κάθε φύλλο υπολογισμού)
 * @see bim/table/table-cell-range.ts — ποια κελιά είναι μέσα
 * @see bim/table/table-cell-edit-session.ts — η ΜΙΑ διαδρομή commit
 */

import type { TsvGrid } from '@/lib/spreadsheet/tsv';
import type { PersistedTableModel, TableModel } from '../../types/table';
import {
  buildMergeIndex,
  cellKey,
  cellText,
  getCell,
  indexById,
  resolveTableModel,
  setPersistedCellText,
} from './table-model-helpers';
import type { TableCellRangeBounds, TableCellRef } from './table-cell-range';
import { tableRangeCellRefs } from './table-cell-range';

/**
 * Η περιοχή ως ορθογώνιο πλέγμα κειμένου, σε σειρά **γραμμή × στήλη**.
 *
 * Τα **καλυμμένα** κελιά μιας συγχώνευσης βγαίνουν **κενά**, και είναι το σωστό: το TSV
 * είναι ορθογώνιο, οπότε μια συγχώνευση 1×3 δίνει το κείμενό της στην πρώτη στήλη και κενά
 * στις δύο επόμενες — αλλιώς οι υπόλοιπες στήλες ολισθαίνουν αριστερά και ο πίνακας που
 * επικολλάται στο Excel βγαίνει στραβός. Έρχεται δωρεάν: το `cells` είναι **αραιό** και μόνο
 * η άγκυρα κρατά εγγραφή.
 */
export function tableRangeToTsvGrid(
  persisted: PersistedTableModel,
  bounds: TableCellRangeBounds,
): TsvGrid {
  const model = resolveTableModel(persisted);
  const width = Math.min(bounds.lastCol, model.columns.length - 1) - Math.max(bounds.firstCol, 0) + 1;
  if (width <= 0) return [];

  const flat = tableRangeCellRefs(model, bounds).map((ref) =>
    cellText(getCell(model, ref.rowId, ref.colId)),
  );

  const grid: string[][] = [];
  for (let i = 0; i < flat.length; i += width) grid.push(flat.slice(i, i + width));
  return grid;
}

/**
 * Τι έγινε στην επικόλληση — **όλα** τα νούμερα που χρειάζεται ένα τίμιο μήνυμα.
 *
 * Το «τι δεν χώρεσε» δεν συνάγεται από αφαίρεση στον καταναλωτή: το προσφερόμενο πλέγμα
 * μπορεί να κόπηκε **και** επειδή τελείωσε ο πίνακας **και** επειδή συνάντησε συγχωνεύσεις,
 * και τα δύο πρέπει να λέγονται ξεχωριστά για να μη μαντεύει ο χρήστης.
 */
export interface TablePasteResult {
  /** Το νέο μοντέλο· **το ίδιο by-reference** όταν τίποτα δεν άλλαξε. */
  readonly model: PersistedTableModel;
  readonly offeredRows: number;
  readonly offeredColumns: number;
  /** Πόσες γραμμές/στήλες του προσφερόμενου πλέγματος χώρεσαν στο πλέγμα του πίνακα. */
  readonly fittedRows: number;
  readonly fittedColumns: number;
  /**
   * Κελιά που έπεσαν πάνω σε **καλυμμένο** κελί συγχώνευσης και παραλείφθηκαν.
   *
   * ## Γιατί παραλείπονται και δεν γράφονται
   * Ένα καλυμμένο κελί **δεν ζωγραφίζεται πουθενά** — ούτε στον καμβά, ούτε στο DXF, ούτε
   * στο PDF: το περιεχόμενο μιας συγχώνευσης ζει στην άγκυρα. Γράφοντάς το, το κείμενο θα
   * **εξαφανιζόταν από την οθόνη ενώ θα υπήρχε στο αρχείο** — η χειρότερη δυνατή έκβαση,
   * γιατί ο χρήστης δεν έχει κανέναν τρόπο να τη δει. Το Excel λύνει το ίδιο πρόβλημα
   * αρνούμενο ολόκληρη την επικόλληση («*We can't do that to a merged cell*»)· εδώ
   * προτιμάται η **μερική** επιτυχία με ρητή αναφορά, ώστε ο χρήστης να μη χάνει και τα
   * κελιά που χωρούσαν μια χαρά.
   */
  readonly skippedMergedCells: number;
}

/**
 * Επικολλά ένα πλέγμα κειμένου με **πάνω-αριστερή γωνία το ενεργό κελί**, κομμένο στα όρια
 * του πίνακα.
 *
 * Επιστρέφει το **ίδιο** μοντέλο by-reference όταν καμία τιμή δεν άλλαξε — η εγγύηση
 * ταυτότητας του `setPersistedCellText`, που εδώ σημαίνει «καμία εντολή, κανένα βήμα undo»
 * για μια επικόλληση που δεν έφερε τίποτα νέο.
 *
 * ⚠️ Η **επανάληψη μοτίβου** του Excel (πηγή × Ν σε πολλαπλάσιο προορισμό) **δεν**
 * υλοποιείται: δεν ζητήθηκε, και προσθέτει έναν κανόνα που κανένα CAD δεν έχει. Το ενεργό
 * κελί είναι η **αρχή**, όχι το σχήμα.
 */
export function pasteTsvIntoTable(
  persisted: PersistedTableModel,
  activeCell: TableCellRef,
  grid: TsvGrid,
): TablePasteResult {
  const model = resolveTableModel(persisted);
  const offeredRows = grid.length;
  const offeredColumns = grid.reduce((max, row) => Math.max(max, row.length), 0);

  const start = startIndexOf(model, activeCell);
  if (!start) {
    return emptyResult(persisted, offeredRows, offeredColumns);
  }

  const fittedRows = Math.max(Math.min(offeredRows, model.rows.length - start.row), 0);
  const fittedColumns = Math.max(Math.min(offeredColumns, model.columns.length - start.col), 0);
  const covered = buildMergeIndex(model).covered;

  let next = persisted;
  let skippedMergedCells = 0;
  for (let r = 0; r < fittedRows; r++) {
    for (let c = 0; c < fittedColumns; c++) {
      const rowId = model.rows[start.row + r].id;
      const colId = model.columns[start.col + c].id;
      if (covered.has(cellKey(rowId, colId))) {
        skippedMergedCells++;
        continue;
      }
      // Το πλέγμα μπορεί να είναι ακανόνιστο (κείμενο από τον έξω κόσμο): μια γραμμή με
      // λιγότερα κελιά δεν σβήνει τα υπόλοιπα — δεν πρόσφερε τιμή γι' αυτά.
      const value = grid[r][c];
      if (value === undefined) continue;
      // 🔴 Ο ΕΝΑΣ αμετάβλητος γραφέας, Ν φορές, **καθαρά**. Το αποτέλεσμα κάθε βήματος
      // τροφοδοτεί το επόμενο· καμία μετάλλαξη, καμία ενδιάμεση εντολή, ένα undo.
      next = setPersistedCellText(next, rowId, colId, value);
    }
  }

  return {
    model: next,
    offeredRows,
    offeredColumns,
    fittedRows,
    fittedColumns,
    skippedMergedCells,
  };
}

/**
 * Αδειάζει κάθε κελί μιας περιοχής (`Delete` πάνω σε μαρκαρισμένη περιοχή).
 *
 * Ίδια διαδρομή με την επικόλληση — **ένα** μοντέλο, **ένα** undo. Χωρίς αυτό, το `Delete`
 * θα άδειαζε μόνο το ενεργό κελί ενώ έξι θα φαίνονταν φωτισμένα: το χειρότερο είδος
 * ασυμφωνίας, γιατί η οθόνη υπόσχεται κάτι που η ενέργεια δεν κάνει.
 *
 * Τα **καλυμμένα** κελιά παραλείπονται όπως και στην επικόλληση: δεν κρατούν περιεχόμενο,
 * άρα δεν έχουν τι να χάσουν.
 */
export function clearTableRange(
  persisted: PersistedTableModel,
  bounds: TableCellRangeBounds,
): PersistedTableModel {
  const model = resolveTableModel(persisted);
  const covered = buildMergeIndex(model).covered;
  let next = persisted;
  for (const ref of tableRangeCellRefs(model, bounds)) {
    if (covered.has(cellKey(ref.rowId, ref.colId))) continue;
    next = setPersistedCellText(next, ref.rowId, ref.colId, '');
  }
  return next;
}

/** Πού αρχίζει η επικόλληση, σε δείκτες· `null` για μπαγιάτικο ενεργό κελί. */
function startIndexOf(
  model: TableModel,
  activeCell: TableCellRef,
): { readonly row: number; readonly col: number } | null {
  const row = indexById(model.rows).get(activeCell.rowId);
  const col = indexById(model.columns).get(activeCell.colId);
  return row === undefined || col === undefined ? null : { row, col };
}

/** Μπαγιάτικο ενεργό κελί ⇒ τίποτα δεν χώρεσε, τίποτα δεν άλλαξε — ποτέ σιωπηλή επιτυχία. */
function emptyResult(
  model: PersistedTableModel,
  offeredRows: number,
  offeredColumns: number,
): TablePasteResult {
  return {
    model,
    offeredRows,
    offeredColumns,
    fittedRows: 0,
    fittedColumns: 0,
    skippedMergedCells: 0,
  };
}
