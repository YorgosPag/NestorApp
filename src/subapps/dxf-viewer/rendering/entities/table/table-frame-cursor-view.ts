/**
 * 🔴 **ΤΙ ΣΗΜΑΙΝΕΙ Ο ΔΡΟΜΕΑΣ ΚΑΙ Η ΕΠΙΛΟΓΗ ΓΙΑ ΑΥΤΟ ΤΟ ΚΑΡΕ** — τρεις καθαρές ερωτήσεις,
 * μηδέν ζωγραφική.
 *
 * ## Γιατί βγήκαν από τον `TableRenderer` (N.7.1, 2026-08-04)
 * Ο ζωγράφος χτύπησε τις **514/500** γραμμές όταν το §43 πρόσθεσε το «είναι πατημένο το κουμπί
 * της γωνίας;». Η τομή **δεν** διαλέχτηκε από τις γραμμές — είναι η τομή που ήδη περιέγραφε η
 * κεφαλίδα εκείνου του αρχείου: *«καθαρό φύλλο· ό,τι ζωγραφίζει βγαίνει από τη μία μηχανή
 * διάταξης»*. Οι τρεις αυτές συναρτήσεις είναι **ερωτήσεις**, όχι πινελιές: δεν αγγίζουν
 * `CanvasRenderingContext2D`, δεν αγγίζουν `this`, και δοκιμάζονται χωρίς καμβά.
 *
 * ⚠️ Η κατεύθυνση της εξάρτησης είναι **μονόδρομη**: ο ζωγράφος ρωτά, αυτές δεν μαθαίνουν ποτέ
 * τι είναι «καμβάς». Ίδιος διαχωρισμός με το `table-indicator-geometry` ↔
 * `table-indicator-cursor-role`.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/table-frame-cursor-view
 * @see rendering/entities/TableRenderer.ts — ο ΕΝΑΣ καταναλωτής
 * @see bim/table/table-cell-range.ts — ο ΕΝΑΣ ορισμός «ποια κελιά είναι μέσα»
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §41, §43
 */

import {
  isTableWholeGridRange,
  resolveTableSelectionBounds,
  tableRangeMembership,
  tableRangeRectMm,
  type TableCellRangeBounds,
  type TableRangeMembership,
} from '../../../bim/table/table-cell-range';
// 🔴 ADR-739 §48.12 — **ο ΕΝΑΣ ορισμός** του «ποια περιοχή εννοεί ο χρήστης τώρα». Δες την
// κεφαλίδα εκείνου: γεννήθηκε στη λαβή, το ζήτησαν μετά η μετακίνηση και ο φρουρός του
// πατήματος, και εδώ αποκτά τον **πέμπτο** καταναλωτή — την απόσυρση των περιγραμμάτων.
import { tableEffectiveRangeBounds } from '../../../bim/table/table-effective-range';
import { resolveTableModel } from '../../../bim/table/table-model-helpers';
import type { TableRenderIndex } from '../../../bim/table/table-render-index';
import type { TableLayout, TableRectMm } from '../../../bim/table/table-layout-types';
import type { TableCellCursorState } from '../../../state/table-cell-cursor-store';
import type { TableEntity } from '../../../types/table-entity';
import type { TableCellRef } from './stamp-table-layout';
import { activeTableModel } from '../../../bim/table/table-worksheet-resolve';

/**
 * ADR-739 Φ.Δ βήμα 3 — ποιο κελί **δεν** ζωγραφίζει ο καμβάς.
 *
 * Μόνο σε κατάσταση γραφής (`enter` / `edit`). Σε `nav` το `<input>` είναι διαφανές και
 * χωρίς κέρσορα — αν παραλείπαμε και τότε, το κελί θα φαινόταν **άδειο** μόλις πατούσες
 * `Tab` πάνω του, δηλαδή θα «έσβηνε» κείμενο που κανείς δεν άλλαξε.
 */
export function editedCellRef(cursor: TableCellCursorState | null): TableCellRef | null {
  if (!cursor || cursor.mode === 'nav') return null;
  return { rowId: cursor.position.rowId, colId: cursor.position.colId };
}

/**
 * 🔴 ADR-739 §41 — **το ορθογώνιο του ενεργού κελιού**, σε sheet-mm· `undefined` όταν ο
 * δρομέας δείχνει κελί εκτός του ορατού παραθύρου.
 *
 * Η αναζήτηση περνά από το **ήδη υπολογισμένο** ευρετήριο (`cellsByRowId`): O(στήλες) αντί
 * για γραμμική σάρωση όλων των κελιών σε κάθε καρέ — το μάθημα του ADR-735.
 *
 * ## Γιατί έπαψε να είναι μέθοδος που **ζωγραφίζει**
 * Ήταν `drawCellCursor`, δηλαδή «βρες το κελί **και** βάψ' το». Από τη στιγμή που το ίδιο
 * ορθογώνιο έγινε **και** η τρύπα της σκίασης (`stampTableSelection`), το «βρες» απέκτησε
 * δεύτερο καταναλωτή — και μια δεύτερη αναζήτηση θα ήταν ακριβώς το sibling clone που πιάνει
 * το CHECK 3.28 (N.18), με το επιπλέον ρίσκο να απαντήσει **αλλιώς** μέσα στο ίδιο καρέ.
 *
 * Το `undefined` (αντί `null`) είναι σκόπιμο — ταιριάζει με την **προαιρετική** παράμετρο
 * του `stampTableSelection`, όπου «δεν υπάρχει ενεργό κελί» σημαίνει «σκίασε τα πάντα».
 */
export function activeCellRectOf(
  cursor: TableCellCursorState,
  index: TableRenderIndex,
): TableRectMm | undefined {
  const bucket = index.cellsByRowId.get(cursor.position.rowId);
  return bucket?.find((c) => c.colId === cursor.position.colId)?.rect;
}

/** Ό,τι χρειάζεται το καρέ για την επιλογή — δες {@link tableFrameSelectionView}. */
export interface TableFrameSelectionView {
  readonly rectMm: TableRectMm;
  readonly membership: TableRangeMembership;
  /**
   * 🔴 ADR-754 Γ4 — τα ίδια όρια, για τη **λαβή συμπλήρωσης**: δεύτερος υπολογισμός τους θα
   * ήταν δεύτερη απάντηση στο «τι μάρκαρε ο χρήστης», μέσα στο ίδιο καρέ.
   */
  readonly bounds: TableCellRangeBounds;
  /**
   * 🔴 ADR-739 §43 — **καλύπτει η επιλογή ολόκληρο το πλέγμα;** — δηλαδή «είναι πατημένο το
   * κουμπί της γωνίας;».
   *
   * Γεννιέται **εδώ** και όχι στον καλούντα, παρότι θα ήταν μία γραμμή και εκεί: το `model`
   * είναι ήδη λυμένο σε αυτό το σώμα, οπότε μια δεύτερη κλήση `resolveTableModel` στον
   * καλούντα θα ήταν δεύτερη αναζήτηση `WeakMap` ανά πίνακα ανά καρέ — και, ουσιωδέστερα,
   * **δεύτερη ερμηνεία** της ίδιας επιλογής. Ίδιο επιχείρημα με το `bounds` από πάνω.
   */
  readonly whole: boolean;
}

/**
 * ADR-739 Φ.Δ βήμα 8 — η **επιλεγμένη περιοχή** αυτού του πίνακα, ως ορθογώνιο φύλλου
 * + ιδιότητα μέλους ανά άξονα· `null` όταν δεν υπάρχει επιλογή.
 *
 * ## Γιατί `null` χωρίς `selection`, αντί για «περιοχή ενός κελιού»
 * Το ένα κελί το δείχνει ήδη ο **δρομέας** — ένα ημιδιαφανές γέμισμα από κάτω του θα ήταν
 * δεύτερη δήλωση του ίδιου πράγματος, και θα έκανε τον πίνακα να φαίνεται μονίμως
 * «μαρκαρισμένος» από τη στιγμή που μπαίνεις μέσα του. «Καμία επιλογή» δεν είναι
 * «επιλογή 1×1»: είναι άλλη κατάσταση, και φαίνεται αλλιώς.
 *
 * Το ορθογώνιο συντίθεται από τη **διάταξη** (θέσεις/πλάτη στηλών και γραμμών) — καμία
 * δεύτερη γεωμετρία δεν γεννιέται εδώ.
 *
 * @param layout 🔴 ADR-739 §38 — η διάταξη **περνά ως όρισμα** αντί να ξαναζητηθεί. Ήταν
 *   δεύτερη κλήση `computeTableEntityGeometryLive` μέσα στο ίδιο καρέ: η ίδια διάταξη
 *   (απομνημονευμένη), αλλά **δεύτερη ανάγνωση `getComputedStyle`** για την επιφάνεια —
 *   δηλαδή διπλάσιο style recalc ανά πίνακα ανά καρέ για μηδέν πληροφορία.
 */
export function tableFrameSelectionView(
  entity: TableEntity,
  cursor: TableCellCursorState,
  layout: TableLayout,
): TableFrameSelectionView | null {
  if (!cursor.selection) return null;
  const model = resolveTableModel(activeTableModel(entity));
  // ADR-739 §27.15 — ο ζωγράφος **δεν ερμηνεύει**: ρωτά τον ΕΝΑ δρόμο «τι διάλεξε ο χρήστης →
  // ποια κελιά είναι μέσα», που ξέρει μόνος του πότε κουμπώνει.
  const bounds = resolveTableSelectionBounds(model, cursor.selection);
  if (!bounds) return null;
  const rectMm = tableRangeRectMm(layout, bounds);
  if (!rectMm) return null;
  return {
    rectMm,
    membership: tableRangeMembership(model, bounds),
    bounds,
    // §43 — **παράγωγο**, ποτέ σημαία: ρωτά το ίδιο `tableWholeGridRange` που γράφει το
    // `selectAll()`. Δες την κεφαλίδα του `isTableWholeGridRange`.
    whole: isTableWholeGridRange(model, bounds),
  };
}

/**
 * 🔴 ADR-739 §48.12 — **Η ΠΕΡΙΟΧΗ ΠΟΥ ΕΝΝΟΕΙ Ο ΧΡΗΣΤΗΣ ΑΥΤΟ ΤΟ ΚΑΡΕ**: η επιλογή· χωρίς
 * επιλογή, το **ενεργό κελί** (κουμπωμένο σε ολόκληρη τη συγχώνευσή του).
 *
 * ## 🔴 ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ Η {@link tableFrameSelectionView} — ΕΔΩ ΗΤΑΝ ΤΟ ΕΛΑΤΤΩΜΑ
 * Εκείνη επιστρέφει `null` χωρίς επιλογή, **και σωστά**: «καμία επιλογή» δεν είναι «επιλογή
 * 1×1» και δεν φαίνεται το ίδιο. Αλλά η ερώτηση *«τι είναι στο πρόχειρο;»* **δεν** έχει αυτόν
 * τον διαχωρισμό — το `Ctrl+C` πάνω σε σκέτο ενεργό κελί γεμίζει το πρόχειρο κανονικά.
 *
 * Έτσι γεννήθηκε ασυμμετρία που **μετρήθηκε ζωντανά** (2026-08-05): με επιλεγμένη *περιοχή* η
 * απόσυρση του §48.12 δούλευε· με σκέτο *ενεργό κελί* το `stampTableSelection` δεν καλούνταν
 * **καθόλου**, οπότε το περίγραμμα που έβλεπε ο χρήστης ήταν ο **δρομέας** — που δεν ρωτούσε
 * τίποτα. Συμπαγής γραμμή 2 px `#0099ff` κάτω από μυρμήγκια 3 px `#0A6BFF`: τα κενά του
 * μοτίβου γέμιζαν από κάτω και το μάτι διάβαζε **συνεχή γραμμή**. Ούτε η απόσυρση φαινόταν,
 * ούτε η κίνηση, ούτε το μέγεθος του μοτίβου.
 *
 * ## Γιατί εδώ, και όχι τρίτος υπολογισμός στον ζωγράφο
 * Ο {@link tableEffectiveRangeBounds} είναι **ήδη** ο ΕΝΑΣ ορισμός, και η λαβή τον ρωτούσε
 * ήδη — μέσα από το `stampTableFillHandleOverlay`. Η ερώτηση απλώς **ανέβηκε ένα επίπεδο**
 * ώστε να τη μοιραστούν και οι τρεις καταναλωτές του ίδιου καρέ (περίγραμμα επιλογής, δρομέας,
 * λαβή). Το πλήθος των κλήσεων `resolveTableModel` ανά πίνακα ανά καρέ μένει **ίδιο**: η
 * κλήση μετακόμισε, δεν προστέθηκε.
 *
 * ⚠️ Τα όρια της επιλογής ζητούνται **ήδη λυμένα** (`selectionBounds`), ποτέ ξαναλυμένα εδώ:
 * ο ίδιος κανόνας που τεκμηριώνει ο {@link tableEffectiveRangeBounds}, για τον ίδιο λόγο —
 * δεύτερη λύση θα ήταν δεύτερη απάντηση στο «τι μάρκαρε ο χρήστης» μέσα στο ίδιο καρέ.
 */
export function tableFrameEffectiveRange(
  entity: TableEntity,
  cursor: TableCellCursorState,
  selectionBounds: TableCellRangeBounds | undefined,
): TableCellRangeBounds | null {
  return tableEffectiveRangeBounds(
    resolveTableModel(activeTableModel(entity)),
    { rowId: cursor.position.rowId, colId: cursor.position.colId },
    selectionBounds ?? null,
  );
}
