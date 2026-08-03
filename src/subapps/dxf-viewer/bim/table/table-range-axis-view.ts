/**
 * 🔴 ADR-739 §36 (ΦΑΣΗ 2) — **ο πίνακας ιδωμένος κατά μήκος ενός άξονα**. Καθαρή γεωμετρία.
 *
 * Η «εισαγωγή & ολίσθηση» είναι η **ίδια** πράξη δύο φορές: προς τα **κάτω** σπρώχνει γραμμές
 * μέσα σε μια λωρίδα στηλών· προς τα **δεξιά** σπρώχνει στήλες μέσα σε μια λωρίδα γραμμών.
 * Δύο συμμετρικά σώματα θα ήταν ακριβώς το sibling clone που πιάνει το CHECK 3.28 (N.18) —
 * και, χειρότερα, δύο σημεία που μπορούν κάποτε να μάθουν διαφορετικό κανόνα για το ίδιο
 * ερώτημα. Το ίδιο μοτίβο χρησιμοποιούν ήδη το `table-row-column-ops.ts` («μία υλοποίηση,
 * δύο όψεις») και το `table-axis-style-ops.ts`.
 *
 * ## Το λεξιλόγιο — δανεικό, όχι νέο
 * ```
 *   γραμμή άξονα (line)  →  αυτό που ΟΛΙΣΘΑΙΝΕΙ   (γραμμή για 'down', στήλη για 'right')
 *   λωρίδα (track)       →  αυτό που ΜΕΝΕΙ ακίνητο (στήλη για 'down', γραμμή για 'right')
 * ```
 * Οι λέξεις `'down'`/`'right'` είναι οι δύο επιλογές που δείχνει το ίδιο το Excel στη
 * «Εισαγωγή κελιών» (*Shift cells down* / *Shift cells right*) — μία έννοια, ένα ζευγάρι
 * λέξεων, κανένα τέταρτο λεξιλόγιο (η παγίδα «2 λεξιλόγια ρόλων» του ADR-694).
 *
 * @module subapps/dxf-viewer/bim/table/table-range-axis-view
 * @see bim/table/table-range-transfer-plan.ts — ο μοναδικός καταναλωτής
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §36
 */

import type { PersistedTableModel } from '../../types/table';
import type { TableCellRangeBounds, TableCellRef } from './table-cell-range';

/**
 * Προς τα πού σπρώχνονται τα υπάρχοντα όταν ο χρήστης κρατά `Shift`.
 *
 * ⚠️ **Δεν ζει στο `TableRangeDragIntent`** (Φάση 1) και δεν είναι παράλειψη: η πρόθεση
 * γεννιέται από τα **πλήκτρα** (`Ctrl` = αντιγραφή, `Shift` = εισαγωγή), ενώ η κατεύθυνση
 * γεννιέται από τη **γεωμετρία** — ποια από τις δύο γραμμές-Ι δείχνει το Excel εκεί που
 * κρέμεται το ποντίκι. Δύο διαφορετικές πηγές, δύο διαφορετικά ορίσματα· ενωμένα, κάθε
 * χειριστής πλήκτρων θα υποχρεωνόταν να επινοήσει κατεύθυνση που δεν ξέρει.
 */
export type TableRangeShiftAxis = 'down' | 'right';

/** Κλειστό διάστημα δεικτών πάνω σε έναν άξονα. */
export interface TableAxisSpanRange {
  readonly first: number;
  readonly last: number;
}

/**
 * Ο πίνακας ιδωμένος κατά μήκος ενός άξονα: πόσες γραμμές-άξονα υπάρχουν, πώς γίνεται ένα
 * ζεύγος (γραμμή, λωρίδα) ταυτότητα κελιού, και πώς προβάλλεται ένα ορθογώνιο στους δύο
 * άξονες.
 */
export interface TableAxisView {
  /** Πόσες θέσεις έχει ο άξονας που ολισθαίνει. */
  readonly lineCount: number;
  /** Το κελί στη θέση (γραμμή άξονα, λωρίδα) — η **μία** μετάφραση. */
  readonly cellAt: (line: number, track: number) => TableCellRef;
  /** Η προβολή ενός ορθογωνίου στον άξονα που ολισθαίνει. */
  readonly linesOf: (bounds: TableCellRangeBounds) => TableAxisSpanRange;
  /** Η προβολή ενός ορθογωνίου στον άξονα που μένει ακίνητος. */
  readonly tracksOf: (bounds: TableCellRangeBounds) => TableAxisSpanRange;
  /**
   * Η **αντίστροφη** των δύο προβολών: δύο διαστήματα → ορθογώνιο.
   *
   * Υπάρχει επειδή η ολίσθηση χρειάζεται να **ονομάσει** τη ζώνη που θα αναταραχθεί (για τον
   * έλεγχο συγχωνεύσεων) με το ίδιο λεξιλόγιο που χρησιμοποιεί όλος ο υπόλοιπος πίνακας. Χωρίς
   * αυτήν, ο καλών θα ξανάγραφε το `axis === 'down' ? … : …` — δηλαδή θα επέστρεφε η ασυμμετρία
   * ακριβώς εκεί που αυτό το αρχείο υπάρχει για να τη σβήσει.
   */
  readonly rectOf: (lines: TableAxisSpanRange, tracks: TableAxisSpanRange) => TableCellRangeBounds;
}

/**
 * Η όψη του πίνακα για τη ζητούμενη κατεύθυνση.
 *
 * Οι δύο κλάδοι είναι **καθρέφτης** ο ένας του άλλου και αυτό είναι όλη η αξία του αρχείου:
 * από εδώ και κάτω κανένας αλγόριθμος δεν ξαναρωτά «γραμμή ή στήλη;». Ο καλών γράφεται μία
 * φορά και δουλεύει και για τις δύο — δηλαδή η ασυμμετρία ανάμεσα στις δύο κατευθύνσεις
 * γίνεται **μη εκφράσιμη**, αντί να αποφεύγεται με προσοχή.
 */
export function tableAxisView(
  model: PersistedTableModel,
  axis: TableRangeShiftAxis,
): TableAxisView {
  const { rows, columns } = model;

  if (axis === 'down') {
    return {
      lineCount: rows.length,
      cellAt: (line, track) => ({ rowId: rows[line].id, colId: columns[track].id }),
      linesOf: (bounds) => ({ first: bounds.firstRow, last: bounds.lastRow }),
      tracksOf: (bounds) => ({ first: bounds.firstCol, last: bounds.lastCol }),
      rectOf: (lines, tracks) => ({
        firstRow: lines.first,
        lastRow: lines.last,
        firstCol: tracks.first,
        lastCol: tracks.last,
      }),
    };
  }

  return {
    lineCount: columns.length,
    cellAt: (line, track) => ({ rowId: rows[track].id, colId: columns[line].id }),
    linesOf: (bounds) => ({ first: bounds.firstCol, last: bounds.lastCol }),
    tracksOf: (bounds) => ({ first: bounds.firstRow, last: bounds.lastRow }),
    rectOf: (lines, tracks) => ({
      firstRow: tracks.first,
      lastRow: tracks.last,
      firstCol: lines.first,
      lastCol: lines.last,
    }),
  };
}

/** Ανήκει ο δείκτης στο κλειστό διάστημα; */
export function axisSpanContains(span: TableAxisSpanRange, index: number): boolean {
  return index >= span.first && index <= span.last;
}

/** Πόσες θέσεις πιάνει το διάστημα· `0` για εκφυλισμένο. */
export function axisSpanSize(span: TableAxisSpanRange): number {
  return Math.max(span.last - span.first + 1, 0);
}
