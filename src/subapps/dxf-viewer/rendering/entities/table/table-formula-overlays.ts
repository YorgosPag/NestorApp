/**
 * 🔴 ADR-754 — **οι δύο επικαλύψεις των τύπων**, μαζί: τα χρωματιστά περιγράμματα των
 * αναφορών (Β1) και η λαβή συμπλήρωσης (Γ4).
 *
 * ## Γιατί ζουν σε δικό τους αρχείο
 * Δύο ανεξάρτητοι λόγοι, και ο πρώτος είναι σκληρός κανόνας:
 *
 *  1. **Ο `TableRenderer` έφτασε τις 500 γραμμές** (N.7.1). Η τομή δεν είναι αυθαίρετη: είναι
 *     η ίδια που ακολούθησαν ήδη το `stamp-table-layout.ts` (πλέγμα / κείμενο) — κόβεται
 *     ό,τι ξεχωρίζει σε **εξάρτηση**. Αυτές οι δύο είναι οι μόνες επικαλύψεις που ρωτούν το
 *     **μοντέλο** και τον **δρομέα** μαζί.
 *  2. Είναι οι δύο όψεις **της ίδιας ερώτησης** — «τι λέει ο τύπος αυτού του κελιού και τι
 *     πρόκειται να γίνει με αυτόν;». Ο ζωγράφος (`stamp-*`) δεν επιτρέπεται να ξέρει από
 *     store ή μοντέλο (δηλωμένο συμβόλαιο: *καμία γνώση, μόνο μελάνι*), και ο `TableRenderer`
 *     δεν πρέπει να μεγαλώσει άλλο. Η **απόφαση** ζει εδώ, ανάμεσά τους.
 *
 * ## 🔴 ΠΟΤΕ μέσα στο bitmap cache — ADR-040 κανόνας #3
 * Και οι δύο τρέχουν **μόνο** στο overlay pass της επιλεγμένης οντότητας. Αν το πρόχειρο ή η
 * επιλογή έμπαιναν στο κλειδί του `dxf-bitmap-cache-key.ts`, **κάθε χαρακτήρας** θα ζητούσε
 * πλήρη ανακατασκευή raster όλων των οντοτήτων — το μετρημένο «60Hz rebuild ⇒ FPS 1».
 *
 * @module subapps/dxf-viewer/rendering/entities/table/table-formula-overlays
 * @see rendering/entities/table/stamp-table-formula-references.ts — το μελάνι του Β1
 * @see rendering/entities/table/stamp-table-fill-handle.ts — το μελάνι του Γ4
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §11, §13
 */

import { tableFormulaReferenceSpans } from '../../../bim/table/formula/table-formula-reference-spans';
import { tableEffectiveRangeBounds } from '../../../bim/table/table-effective-range';
import { resolveTableModel } from '../../../bim/table/table-model-helpers';
import { getTableFillPreview } from '../../../state/table-fill-preview-store';
import { stampTableFillHandle, stampTableFillPreview } from './stamp-table-fill-handle';
import { stampTableFormulaReferences } from './stamp-table-formula-references';
import type { StampTableContext } from './stamp-table-layout';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { TableCellCursorState } from '../../../state/table-cell-cursor-store';
import type { TableLayout } from '../../../bim/table/table-layout-types';
import type { TableEntity } from '../../../types/table-entity';

/**
 * 🔴 ADR-754 Β1 — τα χρωματιστά περιγράμματα των κελιών που **διαβάζει** ο τύπος που γράφεται
 * αυτή τη στιγμή.
 *
 * ## Γιατί ΔΕΝ ελέγχεται εδώ αν το πρόχειρο είναι τύπος
 * Θα ήταν δεύτερος ορισμός του «τι είναι τύπος», δίπλα στον έναν που ζει στον λεξικογράφο
 * (`formulaBodyStart`) — και θα απέκλινε την πρώτη φορά που ο πρώτος δεχτεί κάτι παραπάνω
 * (αρχικά κενά, άλλο πρόθεμα). Η **κενή** απάντηση είναι νόμιμη και φθηνή.
 *
 * Ο μόνος φρουρός είναι «γράφεται κάτι;» — που δεν είναι γραμματική ερώτηση αλλά ο κανόνας
 * που ήδη διέπει κάθε επεξεργασία εδώ: σε πλοήγηση το πρόχειρο είναι `''` εξ ορισμού.
 *
 * ⚠️ **ΜΕΤΡΗΜΕΝΟ ΟΡΙΟ (ζωντανά, 04/08)**: η σειρά μέσα στον καμβά **δεν** αρκεί για την
 * κυκλική αναφορά — `=A1+B2` γραμμένο μέσα στο **B2** δείχνει το περίγραμμα του B2 μερικώς
 * κομμένο (428 px έναντι 728 του A1), γιατί το `<textarea>` του επεξεργαστή είναι **DOM πάνω
 * από τον καμβά** και κανένας κανόνας στοίβαξης εδώ δεν τον φτάνει.
 */
export function stampTableFormulaReferenceOverlay(
  rc: StampTableContext,
  layout: TableLayout,
  entity: TableEntity,
  cursor: TableCellCursorState,
): void {
  if (!cursor.draft) return;
  const model = resolveTableModel(entity.model);
  stampTableFormulaReferences(rc, layout, tableFormulaReferenceSpans(model, cursor.draft));
}

/**
 * 🔴 ADR-754 Γ4 — **η λαβή συμπλήρωσης**, ή η προεπισκόπησή της όσο σέρνεται.
 *
 * Σιωπά σε **γραφή**: όσο ο χρήστης πληκτρολογεί, το χερούλι δεν έχει νόημα και θα διεκδικούσε
 * pixel δίπλα στο `<textarea>`. Είναι και Excel parity — εκεί εξαφανίζεται κι αυτό μόλις
 * ανοίξει ο επεξεργαστής κελιού.
 *
 * Πηγή είναι η **επιλογή**· χωρίς επιλογή, το ενεργό κελί. Τα όρια της επιλογής περνούν ως
 * όρισμα και δεν ξαναϋπολογίζονται: δεύτερος υπολογισμός τους θα ήταν δεύτερη απάντηση στο
 * «τι μάρκαρε ο χρήστης», μέσα στο **ίδιο καρέ** — δηλαδή λαβή που κάθεται αλλού από το
 * περίγραμμα που την υποτίθεται ότι συνοδεύει.
 */
export function stampTableFillHandleOverlay(
  rc: StampTableContext,
  layout: TableLayout,
  entity: TableEntity,
  cursor: TableCellCursorState,
  selectionBounds: TableCellRangeBounds | undefined,
): void {
  const preview = getTableFillPreview();
  // Δύο πίνακες στην ίδια σκηνή δεν μοιράζονται σύρση — ίδιο φίλτρο με το φάντασμα μεταφοράς.
  if (preview?.entityId === entity.id) {
    stampTableFillPreview(rc, layout, preview.bounds);
    return;
  }
  if (cursor.mode !== 'nav') return;

  // 🔴 ADR-754 §14 — **ο ΕΝΑΣ ορισμός** του «ποια περιοχή έχει λαβή». Εδώ έγραφε
  // `selectionBounds ?? rawTableCellRangeBounds(...)` με το χέρι· η ίδια πρόταση ζούσε και στον
  // φρουρό του πατήματος, **διαφορετικά διατυπωμένη** — και ο δείκτης θα ήταν ο τρίτος. Δες
  // την κεφαλίδα της `tableEffectiveRangeBounds` για την απόκλιση που είχαν ήδη.
  const cell = { rowId: cursor.position.rowId, colId: cursor.position.colId };
  const bounds = tableEffectiveRangeBounds(
    resolveTableModel(entity.model),
    cell,
    selectionBounds ?? null,
  );
  if (bounds) stampTableFillHandle(rc, layout, bounds);
}
