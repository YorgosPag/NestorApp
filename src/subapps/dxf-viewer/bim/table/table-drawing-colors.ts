/**
 * ADR-739 Φ.Ε/Φ4 — **«Χρώματα του σχεδίου»**: η ζώνη εγγράφου του επιλογέα χρώματος κειμένου.
 *
 * ## Γιατί υπάρχει αυτή η ζώνη — και γιατί ΔΕΝ λέγεται «χρώματα θέματος»
 * Και οι τέσσερις μεγάλοι δίνουν στον επιλογέα μια ζώνη με εύρος ζωής **το έγγραφο**:
 * Figma «On this page» (τα χρώματα που όντως υπάρχουν στο αρχείο) · Cinema 4D
 * `SWATCH_CATEGORY::DOCUMENT` · ArchiCAD **Pen Set** (ιδιότητα του έργου) · Excel «Χρώματα
 * θέματος» (από το `theme1.xml` **του αρχείου**). Τρεις από τους τέσσερις τη δείχνουν
 * **επίπεδη**, χωρίς παραγόμενες αποχρώσεις — μόνο το Excel φτιάχνει ράμπα, και τη φτιάχνει
 * από θέμα που το DXF **δεν έχει**. Άρα εδώ: επίπεδη λίστα, με το όνομα που λέει την αλήθεια.
 *
 * ## Οι τρεις πηγές, με σειρά — και γιατί αυτή τη σειρά
 * ```
 *   1. το ενεργό TableStyle       ← «τι λέει το στυλ αυτού του πίνακα» (πάντα υπάρχει)
 *   2. ρητά χρώματα ΑΥΤΟΥ του πίνακα ← «τι έχω ήδη διαλέξει εδώ»      (Figma «on this page»)
 *   3. τα χρώματα των layers      ← «το λεξιλόγιο του σχεδίου»        (ArchiCAD Pen Set)
 * ```
 * Η σειρά είναι από το **στενότερο** στο ευρύτερο συμφραζόμενο: ό,τι αφορά τον πίνακα που
 * κοιτάς μπαίνει πρώτο, γιατί εκεί πέφτει το μάτι και εκεί είναι πιθανότερη η επόμενη επιλογή.
 *
 * ## 🔴 Δύο κανόνες που ΔΕΝ είναι φιλτράρισμα καλλωπισμού
 * - **Ό,τι δεν επιβιώνει ως μελάνι, δεν προσφέρεται.** Το προεπιλεγμένο layer `0` ενός DXF
 *   είναι λευκό (σύμβαση σκοτεινού φόντου του AutoCAD)· χωρίς αυτόν τον κανόνα η ζώνη θα
 *   πρόσφερε **λευκό κείμενο σε λευκό φύλλο** στο πρώτο κιόλας σχέδιο. Το κατώφλι δεν
 *   αντιγράφεται — ρωτιέται το `survivesAsInk` του `print-color-policy`, ώστε επιλογέας και
 *   εκτυπωτής να απαντούν **το ίδιο** πράγμα.
 * - **Ανώτατο όριο.** Ένα εισαγόμενο σχέδιο έχει άνετα 200 layers. Μια ζώνη «εγγράφου» με 200
 *   δείγματα δεν είναι συντόμευση, είναι δεύτερος κατάλογος — και θα έσπρωχνε το πλέγμα ACI
 *   εκτός οθόνης. Το Figma κόβει με τον ίδιο τρόπο.
 *
 * @module subapps/dxf-viewer/bim/table/table-drawing-colors
 * @see ui/color/aci-color-grid.ts — η **καθολική** ζώνη (σταθερή σε κάθε σχέδιο)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §28.14
 */

import { normalizeHexColor } from '../../config/color-math';
import { survivesAsInk } from '../../config/print-color-policy';
import type { TableStyle } from './table-style';
import type { PersistedTableModel, TableRowClass } from '../../types/table';

/**
 * Πόσα δείγματα το πολύ. Δώδεκα = μία σειρά κάτω από το πλέγμα των 13 στηλών, δηλαδή η ζώνη
 * δεν αλλάζει ποτέ το πλάτος του μενού.
 */
export const DRAWING_COLORS_LIMIT = 12;

/**
 * Ό,τι χρειάζεται η συλλογή, **δοσμένο ως δεδομένα**.
 *
 * 🔴 Τα χρώματα των layers περνούν ως ορίσματα και δεν διαβάζονται από store εδώ μέσα: έτσι το
 * module μένει καθαρό (δοκιμάσιμο χωρίς σκηνή) **και** ο καλών αναγκάζεται να τα διαβάσει με
 * getter τη στιγμή του συμβάντος — ο κανόνας #2 του ADR-040. Ένα `getAllLayers()` κρυμμένο εδώ
 * θα ήταν συνδρομή-φάντασμα μέσα σε καθαρή συνάρτηση.
 */
export interface DrawingColorSources {
  readonly style: TableStyle;
  readonly model: PersistedTableModel;
  /** Τα χρώματα των layers της σκηνής, στη σειρά τους. */
  readonly layerColors: readonly string[];
}

const ROW_CLASS_ORDER: readonly TableRowClass[] = ['title', 'header', 'data'];

/**
 * Τα χρώματα του σχεδίου, κανονικοποιημένα, χωρίς διπλότυπα, το πολύ
 * {@link DRAWING_COLORS_LIMIT}.
 *
 * Ποτέ κενή στην πράξη: οι τρεις κλάσεις γραμμής **πάντα** δηλώνουν `textColorHex`. Ο καλών
 * οφείλει παρ' όλα αυτά να χειρίζεται το κενό — ένα στυλ μπορεί κάποτε να έχει και τις τρεις
 * κλάσεις σχεδόν λευκές, και μια επικεφαλίδα πάνω από τίποτα είναι χειρότερη από καθόλου ζώνη.
 */
export function collectDrawingColors(sources: DrawingColorSources): readonly string[] {
  const { style, model, layerColors } = sources;
  const seen = new Set<string>();
  const out: string[] = [];

  const offer = (raw: string | undefined): void => {
    if (raw === undefined || out.length >= DRAWING_COLORS_LIMIT) return;
    const hex = normalizeHexColor(raw);
    if (seen.has(hex) || !survivesAsInk(hex)) return;
    seen.add(hex);
    out.push(hex);
  };

  for (const rowClass of ROW_CLASS_ORDER) offer(style.rowClasses[rowClass].textColorHex);
  for (const column of model.columns) offer(column.styleOverride?.textColorHex);
  for (const row of model.rows) offer(row.styleOverride?.textColorHex);
  // `TableCellEntry` είναι **τριάδα** `[rowId, colId, cell]` (η Λύση Α του §19.2 — λίστα στο
  // αρχείο, ευρετήριο στη μνήμη), όχι αντικείμενο με πεδία.
  for (const [, , cell] of model.cells) offer(cell.styleOverride?.textColorHex);
  for (const layerColor of layerColors) offer(layerColor);

  return out;
}
