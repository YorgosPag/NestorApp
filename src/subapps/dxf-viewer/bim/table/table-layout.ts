/**
 * ADR-739 Φάση Α — **η μηχανή διάταξης πίνακα**. Μία, για όλο το repo.
 *
 * `layoutTable(model, style)` → γεωμετρία σε **sheet-mm και τίποτε άλλο**. Τα τέσσερα
 * backends (§3 Αρχή 3) διαβάζουν το ίδιο `TableLayout` και ζωγραφίζουν το καθένα με τα
 * δικά του μέσα — canvas 2D preview, PDF, entities σκηνής, DXF `ACAD_TABLE`. Έτσι
 * «οθόνη === PDF === DXF === σκηνή» είναι **δομή**, όχι υπόσχεση.
 *
 * ## Τρία στάδια, ρητή σειρά
 * ```
 *   measure  → πόσο πλατιά κάθε στήλη, πόσο ψηλή κάθε γραμμή   (table-layout-measure)
 *   place    → πού πέφτει κάθε κελί και κάθε κείμενο            (table-layout-place)
 *   borders  → ποιες γραμμές πλέγματος υπάρχουν και με τι μολύβι (table-layout-borders)
 * ```
 * Η διάσπαση δεν είναι διακοσμητική: το `place` δεν μπορεί να ξεκινήσει πριν κλείσει το
 * `measure` (δεν ξέρει πού είναι οι ακμές), και το `borders` χρειάζεται και τα δύο. Ο
 * N.7.1 απλώς επιβεβαιώνει ό,τι ήδη επέβαλλε η εξάρτηση.
 *
 * ## Πότε τρέχει
 * **Μόνο** όταν αλλάζει το μοντέλο ή το στυλ — ποτέ ανά frame, ποτέ σε pan/zoom (§6).
 * Το αποτέλεσμα απομνημονεύεται από τον καταναλωτή· ο ζωγράφος κάνει binary search στο
 * `layout.rows` (αύξον `yMm`) για τις ορατές γραμμές: O(log n + ορατές). Αυτό είναι το
 * άμεσο μάθημα του ADR-735 — μην κάνεις δουλειά ανάλογη του zoom.
 *
 * ## Τι ΔΕΝ κάνει (και πού ζει)
 * - **Μορφοποίηση τιμών** (mm→m, m², τεμάχια): στους formatters του ADR-363, πριν μπει
 *   η τιμή στο μοντέλο. Δύο απαντήσεις στο «πώς δείχνει αυτός ο αριθμός» θα απέκλιναν.
 * - **Τύποι** (`=SUM(...)`): Φ.Ζ, πίσω από τον adapter του §9.2.
 * - **Table breaking**: Φ.Γ, μαζί με τον renderer που το χρειάζεται — όχι προληπτικά.
 * - **Αναδίπλωση κειμένου**: όταν υπάρξει καταναλωτής. Σήμερα ένα κελί = μία γραμμή,
 *   όπως ακριβώς και ο ADR-622 που αυτή η μηχανή πρόκειται να απορροφήσει (Φ.Β). Κείμενο
 *   που δεν χωρά **περικόπτεται** στο στάδιο `place` (Φ.Δ βήμα 5, `table-cell-overflow.ts`)
 *   — η αναδίπλωση είναι η επόμενη τιμή του ίδιου διακόπτη, όχι δεύτερος μηχανισμός.
 * - **Κατακόρυφη περικοπή**: τίποτα. Το ύψος γραμμής είναι πάντα ρητό (`row.heightMm` ή
 *   `style.defaultRowHeightMm`) και το κείμενο πάντα μία γραμμή ύψους `style.textHeightMm`,
 *   άρα κατακόρυφο ξεχείλισμα προκύπτει **μόνο** από κακορυθμισμένο στυλ — ποτέ από
 *   δεδομένα του χρήστη, σε αντίθεση με το οριζόντιο (απόφαση Giorgio 2026-08-01· το
 *   `table-layout.test.ts` το καρφώνει ώστε η αλλαγή να είναι συνειδητή).
 *
 * @module subapps/dxf-viewer/bim/table/table-layout
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §3, §6
 */

import type { TableModel } from '../../types/table';
import type { TableStyle } from './table-style';
import { measureTable, resolveTableTextMeasurer } from './table-layout-measure';
import { columnEdgesMm, placeCells, placeColumns, placeRows, rowEdgesMm } from './table-layout-place';
import { buildTableBorders } from './table-layout-borders';
import { TABLE_PAPER_HEX } from './table-ink';
import type { TableLayout, TableLayoutOptions } from './table-layout-types';

/** Άδειος πίνακας — μηδενικές διαστάσεις, καμία γεωμετρία. Ποτέ `null`. */
const EMPTY_LAYOUT: TableLayout = {
  widthMm: 0,
  heightMm: 0,
  columns: [],
  rows: [],
  cells: [],
  borders: [],
};

/**
 * Η διάταξη ενός πίνακα. Καθαρή συνάρτηση: ίδιο μοντέλο + ίδιο στυλ + ίδιες επιλογές ⇒
 * ίδιο αποτέλεσμα, πάντα (προϋπόθεση για snapshot tests και για ασφαλή απομνημόνευση).
 */
export function layoutTable(
  model: TableModel,
  style: TableStyle,
  options?: TableLayoutOptions,
): TableLayout {
  if (model.rows.length === 0 || model.columns.length === 0) return EMPTY_LAYOUT;

  const measurement = measureTable(model, style, options);
  const xEdges = columnEdgesMm(measurement.columnWidthsMm);
  const yEdges = rowEdgesMm(measurement.rowHeightsMm);

  return {
    widthMm: xEdges[xEdges.length - 1],
    heightMm: yEdges[yEdges.length - 1],
    columns: placeColumns(model, measurement.columnWidthsMm, xEdges),
    rows: placeRows(model, measurement.rowHeightsMm, yEdges),
    // Ο ΙΔΙΟΣ μετρητής που έκρινε τα πλάτη στηλών κρίνει και την περικοπή (Φ.Δ βήμα 5) —
    // αλλιώς «χωράει;» και «κόβεται;» απαντιούνται από δύο διαφορετικά όργανα.
    //
    // 🔴 ADR-739 §38 — η **επιφάνεια** μπαίνει εδώ και πουθενά αλλού: το `placeCells` είναι το
    // σημείο όπου το αυτόματο μελάνι (`AUTOMATIC_TABLE_INK`) γίνεται πραγματικό hex. Η
    // προεπιλογή είναι το **χαρτί** — δες `TableLayoutOptions.surfaceHex` για το γιατί η
    // αποτυχία πρέπει να δείχνει προς τα εκεί.
    cells: placeCells(
      model,
      style,
      measurement,
      xEdges,
      yEdges,
      resolveTableTextMeasurer(options),
      options?.surfaceHex ?? TABLE_PAPER_HEX,
    ),
    borders: buildTableBorders(model, style, measurement.merges, xEdges, yEdges),
  };
}

/**
 * Οι γραμμές που τέμνουν το κατακόρυφο παράθυρο `[topMm, bottomMm)`, ως εύρος δεικτών
 * `[start, end)` πάνω στο `layout.rows`.
 *
 * Ο ζωγράφος **πρέπει** να περνά από εδώ αντί να σαρώνει όλες τις γραμμές: σε πίνακα
 * 500 γραμμών με 12 ορατές, η σάρωση κάνει 40× περιττή δουλειά **σε κάθε καρέ**, και
 * χειροτερεύει όσο ο χρήστης κάνει zoom in — δηλαδή ακριβώς το σχήμα O(zoom²) που ο
 * ADR-735 πλήρωσε σε παραγωγή. Δυαδική αναζήτηση στο αύξον `yMm`: O(log n).
 */
export function visibleRowRange(
  layout: TableLayout,
  topMm: number,
  bottomMm: number,
): { readonly start: number; readonly end: number } {
  const rows = layout.rows;
  if (rows.length === 0 || bottomMm <= topMm) return { start: 0, end: 0 };

  // Πρώτη γραμμή που ΤΕΛΕΙΩΝΕΙ μετά το `topMm` (δηλαδή τέμνει ή ακολουθεί το παράθυρο).
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].yMm + rows[mid].heightMm <= topMm) lo = mid + 1;
    else hi = mid;
  }
  const start = lo;

  // Πρώτη γραμμή που ΑΡΧΙΖΕΙ στο ή μετά το `bottomMm` — το πέρας του εύρους.
  hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].yMm < bottomMm) lo = mid + 1;
    else hi = mid;
  }

  return { start, end: Math.max(lo, start) };
}
