/**
 * ADR-739 §39 — **το λεξιλόγιο του επιλογέα μεγέθους**: καθαρές συναρτήσεις, μηδέν React.
 *
 * ## Η μία απόφαση που κωδικοποιεί αυτό το αρχείο
 * Ο builder προσθέτει **πάντα** μία γραμμή τίτλου και μία κεφαλίδας πάνω από τις γραμμές
 * δεδομένων ({@link TABLE_FIXED_ROW_COUNT}). Το πλέγμα της κορδέλας μιλά **σύνολα**: το «2»
 * στο «Πίνακας 5×2» είναι **2 γραμμές στην οθόνη**, όπως ακριβώς στο Word.
 *
 * Ο λόγος δεν είναι η μίμηση του Word — είναι συνέπεια της απόφασης της 2026-08-04 ότι ο
 * πίνακας γεννιέται **ουδέτερος**: το γκρι γέμισμα, τα έντονα και τα μεγέθη έφυγαν από το
 * στυλ `standard`, άρα ο τίτλος και η κεφαλίδα **δεν ξεχωρίζουν οπτικά** από τα δεδομένα.
 * Στην οθόνη ο πίνακας είναι N αδιαφοροποίητες οριζόντιες ζώνες, και η ερώτηση «πόσες
 * γραμμές έχει;» έχει **μία** ειλικρινή απάντηση: `TABLE_FIXED_ROW_COUNT + dataRowCount`.
 * Ένα πλέγμα που μετρούσε μόνο γραμμές δεδομένων θα έγραφε «×2» ενώ ο χρήστης θα έβλεπε 4
 * — θα μετρούσε μια **αόρατη** διάκριση.
 *
 * ## Ο καθαρισμός δεν ξαναγράφεται εδώ
 * Τα φράγματα ζουν στο `build-table-entity.ts` (`sanitizeTable*`) και είναι **ένα**: εδώ
 * γίνεται μόνο η μετάφραση λεξιλογίου γύρω τους (N.18).
 *
 * @module subapps/dxf-viewer/ui/ribbon/components/table/table-size-menu-model
 * @see bim/table/build-table-entity.ts — η αυθεντία του «+1 τίτλος +1 κεφαλίδα»
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §39
 */

import {
  MAX_TABLE_DATA_ROW_COUNT,
  TABLE_FIXED_ROW_COUNT,
  sanitizeTableColumnCount,
  sanitizeTableDataRowCount,
} from '../../../../bim/table/build-table-entity';
import { fitTableGrid } from '../../../../bim/table/table-capacity';
import { MAX_TABLE_COLUMN_COUNT } from '../../../../bim/table/table-ooxml-limits';

/** Μέγεθος στο λεξιλόγιο **του χρήστη**: στήλες × γραμμές που θα δει στην οθόνη. */
export interface TableMenuSize {
  readonly columnCount: number;
  /** **ΣΥΝΟΛΙΚΕΣ** γραμμές — περιλαμβάνει τίτλο και κεφαλίδα. Ποτέ < {@link MIN_TOTAL_TABLE_ROWS}. */
  readonly totalRowCount: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Το πλέγμα
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 10 × 8 — οι διαστάσεις του Word. Δεν είναι αυθαίρετες: το πλέγμα καλύπτει το **συνηθισμένο**
 * και ο διάλογος «Εισαγωγή πίνακα…» τα άκρα. Μεγαλύτερο πλέγμα θα έκανε τις κυψελίδες
 * μικρότερες από στόχο ποντικιού χωρίς να καλύψει ούτως ή άλλως το εύρος.
 */
export const TABLE_SIZE_GRID_COLUMNS = 10;
export const TABLE_SIZE_GRID_ROWS = 8;

/** Οι δύο σταθερές γραμμές είναι το δάπεδο: πίνακας με 1 γραμμή δεν είναι εκφράσιμος. */
export const MIN_TOTAL_TABLE_ROWS = TABLE_FIXED_ROW_COUNT;
export const MAX_TOTAL_TABLE_ROWS = MAX_TABLE_DATA_ROW_COUNT + TABLE_FIXED_ROW_COUNT;

export const MIN_TABLE_COLUMNS = 1;
export const MAX_TABLE_COLUMNS = MAX_TABLE_COLUMN_COUNT;

// ──────────────────────────────────────────────────────────────────────────────
// Ο μετασχηματισμός — το ΕΝΑ σημείο όπου «σύνολο» γίνεται «δεδομένα»
// ──────────────────────────────────────────────────────────────────────────────

/** Σύνολο → γραμμές δεδομένων (αυτό που καταλαβαίνει ο store). Ποτέ αρνητικό. */
export function totalRowsToDataRowCount(totalRowCount: number): number {
  return Math.max(0, totalRowCount - TABLE_FIXED_ROW_COUNT);
}

/** Γραμμές δεδομένων → σύνολο (αυτό που βλέπει ο χρήστης). */
export function dataRowCountToTotalRows(dataRowCount: number): number {
  return dataRowCount + TABLE_FIXED_ROW_COUNT;
}

/** Η τρέχουσα κατάσταση του store, στο λεξιλόγιο του μενού. */
export function toMenuSize(columnCount: number, dataRowCount: number): TableMenuSize {
  return { columnCount, totalRowCount: dataRowCountToTotalRows(dataRowCount) };
}

/**
 * Καθαρισμός στο λεξιλόγιο του μενού. **Delegates** στα `sanitizeTable*` — καμία αντιγραφή
 * κανόνα, ώστε ένα μελλοντικό όριο να αλλάξει σε ένα μόνο σημείο.
 */
export function sanitizeMenuSize(raw: TableMenuSize): TableMenuSize {
  const columnCount = sanitizeTableColumnCount(raw.columnCount);
  const dataRowCount = sanitizeTableDataRowCount(totalRowsToDataRowCount(raw.totalRowCount));

  // 🔴 ADR-833 Φ5Β — **και το ΓΙΝΟΜΕΝΟ, γιατί αλλιώς το μενού λέει άλλα από όσα κάνει.**
  // Οι δύο καθαριστές βλέπουν έναν άξονα ο καθένας· το `resolveShape` όμως κόβει το πλέγμα
  // στο γινόμενο πριν χτίσει. Χωρίς αυτή τη γραμμή το μενού θα εμφάνιζε «10.000 × 10.000»
  // και ο πίνακας θα γεννιόταν άλλος — ακριβώς το «UI που λέει άλλα από αυτά που κάνει»
  // που το ίδιο το `build-table-entity` ονομάζει ψέμα. **Ο ίδιος** κανόνας, ένας καλών
  // παραπάνω (N.18): καμία δεύτερη διατύπωση του «τι χωράει».
  const fitted = fitTableGrid(dataRowCountToTotalRows(dataRowCount), columnCount, MIN_TOTAL_TABLE_ROWS);
  // ⚠️ **Εδώ υπήρχε `Math.max(MIN_TOTAL_TABLE_ROWS, …)` και ΑΦΑΙΡΕΘΗΚΕ** (μετάλλαξη M44,
  // Φ5Β): το `fitTableGrid` δέχεται το δάπεδο ως **όρισμα** και εγγυάται ήδη ότι δεν
  // επιστρέφει λιγότερες. Ήταν πλεονασμός δίπλα σε εγγύηση που τον κάλυπτε — και ένας
  // δεύτερος τόπος όπου το δάπεδο θα μπορούσε να αποκλίνει από τον πρώτο.
  return { columnCount: fitted.columnCount, totalRowCount: fitted.rowCount };
}

// ──────────────────────────────────────────────────────────────────────────────
// Πλέγμα ⇄ μέγεθος
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Κυψελίδα (**0-based**) → μέγεθος. Ο άξονας των γραμμών **κόβεται στο δάπεδο**: η πρώτη και
 * η δεύτερη σειρά του πλέγματος δίνουν και οι δύο σύνολο 2.
 *
 * Έτσι καμία κυψελίδα δεν είναι νεκρή ή απενεργοποιημένη — το πλέγμα φωτίζει πάντα από τη
 * γραμμή 1 μέχρι τη γραμμή του δείκτη, με ελάχιστο δύο.
 */
export function gridCellToSize(colIndex: number, rowIndex: number): TableMenuSize {
  return {
    columnCount: colIndex + 1,
    totalRowCount: Math.max(MIN_TOTAL_TABLE_ROWS, rowIndex + 1),
  };
}

/** `true` όταν η κυψελίδα ανήκει στην τρέχουσα (φωτισμένη) περιοχή του πλέγματος. */
export function isCellInSelection(
  colIndex: number,
  rowIndex: number,
  size: TableMenuSize,
): boolean {
  return colIndex < size.columnCount && rowIndex < size.totalRowCount;
}

// ADR-700 §4 (2026-08-24): TABLE_COLUMN_WIDTH_PRESETS_MM ΔΙΑΓΡΑΦΗΚΕ — μηδέν καταναλωτές
// (το πεδίο mm του μενού δεν πρόσφερε ποτέ presets στην οθόνη).
