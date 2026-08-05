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
 * **Δεν χρειάζεται.** Το `writeCellInput` είναι ήδη **καθαρός, αμετάβλητος** γραφέας:
 * εφαρμόζεται Ν φορές πάνω στο ενδιάμεσο αποτέλεσμα χωρίς να αγγίξει τίποτα, και μετά
 * γίνεται **μία** εγγραφή του τελικού μοντέλου. Ένα `UpdateEntityCommand`, ένα undo, και —
 * το σημαντικότερο — **η ίδια ακριβώς διαδρομή commit** με τη μονή επεξεργασία κελιού. Καμία
 * νέα μηχανική, κανένα δεύτερο μονοπάτι που θα μπορούσε να αποκλίνει (§6.6).
 *
 * ## 🔴 ΔΥΟ ΣΦΑΛΜΑΤΑ ΠΟΥ ΕΖΗΣΑΝ ΕΔΩ ΩΣ ΤΟ 2026-08-05 (ADR-739 §47)
 * Και τα δύο είχαν το ίδιο σχήμα: **η επικόλληση δεν περνούσε από τη μηχανή τύπων**, ενώ
 * κάθε αδελφή διαδρομή περνούσε. Κανένα gate δεν τα έβλεπε, γιατί και τα δύο παράγουν
 * **σιωπηλά λάθος νούμερα** σε πίνακα ποσοτήτων — όχι εξαίρεση, όχι κόκκινο test.
 *
 *  1. **Καμία επαναξιολόγηση.** Ο βρόχος έγραφε κελιά και το αποτέλεσμα πήγαινε κατευθείαν
 *     στο commit. Επικόλληση 20 αριθμών σε στήλη που την αθροίζει ένα `=SUM(A1:A20)` άφηνε
 *     **το παλιό άθροισμα** στην οθόνη και στο DXF. Η απόδειξη ότι ήταν παράλειψη κι όχι
 *     σχεδίαση: `table-fill-apply.ts` και `table-range-transfer.ts` καλούν αμφότερα
 *     {@link recalculateTableModel} — **μόνο** η επικόλληση το ξεχνούσε, ενώ το ίδιο το
 *     `table-cell-edit-session.ts` επικαλείται την επικόλληση ως το παράδειγμά του.
 *  2. **Ωμό `setPersistedCellText`.** Κείμενο `=SUM(A1:A3)` από το πρόχειρο αποθηκευόταν ως
 *     **κείμενο**, ποτέ ως τύπος — παρότι το `table-formula-engine.ts` δηλώνει ρητά «ό,τι
 *     πληκτρολογεί **ή επικολλά** ο χρήστης περνά από εδώ». Η δήλωση ήταν ψευδής· τώρα
 *     είναι αληθής.
 *
 * ## 🚪 Η ΠΟΡΤΑ ΓΙΑ ΤΗΝ ΕΙΣΑΓΩΓΗ ΑΠΟ ΑΡΧΕΙΟ EXCEL (μελλοντική φάση)
 * Το {@link pasteTsvIntoTable} **δεν ξέρει από πρόχειρο**: δέχεται ορθογώνιο πλέγμα
 * κειμένου και ενεργό κελί. Ένας μελλοντικός εισαγωγέας `.xlsx` έχει ακριβώς μία δουλειά —
 * να παραγάγει `TsvGrid` — και κληρονομεί δωρεάν το κόψιμο στα όρια, τον σεβασμό των
 * συγχωνεύσεων, την αναγνώριση τύπων, τον επαναϋπολογισμό και το **ένα** undo. Δεν
 * χρειάζεται δεύτερος γραφέας, και **δεν επιτρέπεται** να γραφτεί: θα ήταν το τρίτο σημείο
 * που μπορεί να ξεχάσει το recalc.
 *
 * ⚠️ Ό,τι **δεν** χωρά σε πλέγμα κειμένου (μορφοποίηση, πλάτη στηλών, συγχωνεύσεις της
 * πηγής) ανήκει σε χωριστό στρώμα **πάνω** από αυτό, όχι σε παραλλαγή αυτού.
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
import type { CellWriteTarget, PendingCellWrites } from './table-model-helpers';
import {
  buildMergeIndex,
  cellKey,
  cellText,
  clearPersistedCells,
  getCell,
  indexById,
  resolveTableModel,
} from './table-model-helpers';
// 🔴 ADR-739 Φ.Ζ — ο γραφέας που **καταλαβαίνει** `=`, και ο επαναϋπολογισμός που ακολουθεί.
// Δες την κεφαλίδα: η επικόλληση έγραφε ωμό κείμενο και δεν ξαναϋπολόγιζε τίποτα.
import { commitCellWrites, writeCellInput } from './formula/table-formula-engine';
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
 * ταυτότητας του `writeCellInput`, **συνεχισμένη** από τον {@link commitCellWrites} (που
 * δεν καλείται καν όταν κανένα κελί δεν άγγιξε τίποτα). Σημαίνει «καμία εντολή, κανένα βήμα
 * undo» για μια επικόλληση που δεν έφερε τίποτα νέο.
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

  const written = writeGridCells(persisted, model, start, grid, {
    rows: fittedRows,
    columns: fittedColumns,
  });

  return {
    model: commitCellWrites(written),
    offeredRows,
    offeredColumns,
    fittedRows,
    fittedColumns,
    skippedMergedCells: written.skippedMergedCells,
  };
}

/**
 * Τι άφησε πίσω του ο βρόχος γραφής: η **εκκρεμότητα** του γραφέα, συν τι προσπέρασε.
 *
 * 🔴 ADR-739 §50 — ήταν δικό του `{ model, touched }`, δηλαδή χειροποίητο αντίγραφο του
 * {@link PendingCellWrites}. Το ότι αυτό το σχήμα γεννήθηκε **εδώ πρώτα**, ιδιωτικά, είναι η
 * απόδειξη ότι ο τύπος έλειπε από τον γραφέα: η ίδια απάντηση ξαναγράφτηκε τοπικά από τον
 * πρώτο που τη χρειάστηκε, και οι επόμενοι τρεις δεν την είχαν.
 */
interface TableGridWrite extends PendingCellWrites {
  readonly skippedMergedCells: number;
}

/**
 * Ο βρόχος γραφής: πλέγμα → κελιά, με τη γωνία στο `start`.
 *
 * Χωριστή συνάρτηση επειδή ο καλών μετρά **έξι** μεγέθη για την αναφορά του και ο βρόχος
 * γράφει **τρία** — μαζί ξεπερνούσαν το όριο των 40 γραμμών του N.7.1, και ο διαχωρισμός
 * είναι ούτως ή άλλως σημασιολογικός: εκείνος απαντά «τι χώρεσε», αυτός «τι γράφτηκε».
 *
 * 🔴 Γράφει με **`writeCellInput`** και όχι `setPersistedCellText`: **η ίδια διακλάδωση `=`
 * με το πληκτρολόγιο**. Κελί που έρχεται ως `=SUM(A1:A3)` γίνεται τύπος· που έρχεται ως
 * `=1+` μένει κείμενο αυτούσιο. Δες την κεφαλίδα, σφάλμα 2.
 *
 * Ο ΕΝΑΣ αμετάβλητος γραφέας εφαρμόζεται Ν φορές **καθαρά**: το αποτέλεσμα κάθε βήματος
 * τροφοδοτεί το επόμενο, καμία μετάλλαξη, καμία ενδιάμεση εντολή, ένα undo. Κελί που
 * επιστρέφει **ίδια αναφορά** δεν άλλαξε τίποτα, άρα δεν μπαίνει στα `written`: δεν έχει τι
 * να διαδώσει, και ο περιττός κόμβος θα κόστιζε πέρασμα του γράφου για το τίποτα.
 */
function writeGridCells(
  persisted: PersistedTableModel,
  model: TableModel,
  start: { readonly row: number; readonly col: number },
  grid: TsvGrid,
  fitted: { readonly rows: number; readonly columns: number },
): TableGridWrite {
  const covered = buildMergeIndex(model).covered;
  const written: CellWriteTarget[] = [];
  let next = persisted;
  let skippedMergedCells = 0;

  for (let r = 0; r < fitted.rows; r++) {
    for (let c = 0; c < fitted.columns; c++) {
      const rowId = model.rows[start.row + r].id;
      const colId = model.columns[start.col + c].id;
      const key = cellKey(rowId, colId);
      if (covered.has(key)) {
        skippedMergedCells++;
        continue;
      }
      // Το πλέγμα μπορεί να είναι ακανόνιστο (κείμενο από τον έξω κόσμο): μια γραμμή με
      // λιγότερα κελιά δεν σβήνει τα υπόλοιπα — δεν πρόσφερε τιμή γι' αυτά.
      const value = grid[r][c];
      if (value === undefined) continue;
      const cellWritten = writeCellInput(next, rowId, colId, value);
      if (cellWritten.model === next) continue;
      next = cellWritten.model;
      written.push(...cellWritten.written);
    }
  }

  return { model: next, written, skippedMergedCells };
}

// 🔴 ADR-739 §50 — ο ιδιωτικός `recalculatedAfter` **ανυψώθηκε** σε `commitCellWrites`
// (`formula/table-formula-engine.ts`). Ήταν σωστός και μόνος του: το ίδιο σκεπτικό χρειάζονταν
// άλλοι τέσσερις γραφείς, και τρεις από αυτούς δεν το είχαν. Ένας κανόνας γραμμένος ιδιωτικά
// στο αρχείο που τον ανακάλυψε πρώτο δεν προστατεύει κανέναν άλλον — δες §47.5.

/**
 * Αδειάζει κάθε κελί μιας περιοχής (`Delete` πάνω σε μαρκαρισμένη περιοχή).
 *
 * Ίδια διαδρομή με την επικόλληση — **ένα** μοντέλο, **ένα** undo. Χωρίς αυτό, το `Delete`
 * θα άδειαζε μόνο το ενεργό κελί ενώ έξι θα φαίνονταν φωτισμένα: το χειρότερο είδος
 * ασυμφωνίας, γιατί η οθόνη υπόσχεται κάτι που η ενέργεια δεν κάνει.
 *
 * Τα **καλυμμένα** κελιά παραλείπονται όπως και στην επικόλληση: δεν κρατούν περιεχόμενο,
 * άρα δεν έχουν τι να χάσουν.
 *
 * ⚠️ **ADR-755 — ένα πέρασμα, όχι βρόχος ανά κελί.** Εδώ υπήρχε `setPersistedCellText` μέσα
 * σε βρόχο, δηλαδή `findIndex` + `slice()` ολόκληρου του `cells` για **κάθε** κελί: ένα
 * `Ctrl+A` + `Delete` σε πίνακα 500 × 8 έκανε 4.000 τέτοια περάσματα. Ο μαζικός γραφέας
 * ({@link clearPersistedCells}) υπήρχε ήδη για ακριβώς αυτό το μέγεθος — απλώς ο πρώτος
 * καταναλωτής του ήταν οι διαγώνιοι. Η σημασιολογία είναι **ταυτόσημη**, γιατί το άδειασμα
 * περνά από το ίδιο `asTextCell`.
 */
export function clearTableRange(
  persisted: PersistedTableModel,
  bounds: TableCellRangeBounds,
): PersistedTableModel {
  const model = resolveTableModel(persisted);
  const covered = buildMergeIndex(model).covered;

  // 🔴 ADR-739 §50 — **η δεύτερη απάντηση έφυγε από εδώ.** Ο βρόχος υπολόγιζε παράλληλα τα
  // κλειδιά που θα διαδίδονταν· τα ξέρει πλέον ο ίδιος ο γραφέας, και μάλιστα **ακριβέστερα**
  // (μόνο όσα κελιά όντως άδειασαν, όχι όσα ζητήθηκαν). Ο ένας βρόχος μένει, με μία δουλειά.
  const targets: TableCellRef[] = [];
  for (const ref of tableRangeCellRefs(model, bounds)) {
    if (covered.has(cellKey(ref.rowId, ref.colId))) continue;
    targets.push(ref);
  }

  // Ο επαναϋπολογισμός δεν είναι πια χωριστό βήμα που πρέπει να θυμηθεί ο καλών: ένα
  // `=SUM(A1:A20)` πάνω από στήλη που μόλις άδειασε **δεν μπορεί** να δείχνει το άθροισμα
  // δεδομένων που δεν υπάρχουν πια, γιατί ο τύπος επιστροφής δεν επιτρέπει να παραλειφθεί.
  return commitCellWrites(clearPersistedCells(persisted, targets));
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
