/**
 * 🔴 ADR-767 Δ4 — **η επικάλυψη του δεσμού**: η απόφαση ανάμεσα στο μοντέλο και στο μελάνι.
 *
 * ## Γιατί ζει σε δικό της αρχείο
 * Ίδια τομή, ίδια αιτιολόγηση με το αδελφό `table-formula-overlays.ts` (ADR-754), και ο
 * πρώτος λόγος είναι πάλι σκληρός κανόνας:
 *
 *  1. **Ο `TableRenderer` ξαναέφτασε τις 500 γραμμές** (N.7.1). Κόβεται ό,τι ξεχωρίζει σε
 *     **εξάρτηση** — και αυτή η επικάλυψη είναι η μόνη που ρωτά **μοντέλο και store μαζί**.
 *  2. Ο ζωγράφος (`stamp-*`) έχει δηλωμένο συμβόλαιο: *καμία γνώση, μόνο μελάνι*. Δεν
 *     επιτρέπεται να μάθει τι είναι `sourceKey` ούτε πού ζει η ετυμηγορία φρεσκάδας. Ο
 *     `TableRenderer` πάλι δεν πρέπει να μεγαλώσει. Η **απόφαση** ζει εδώ, ανάμεσά τους.
 *
 * ## 🔴 ΓΙΑΤΙ ΑΥΤΗ Η ΕΠΙΚΑΛΥΨΗ ΕΠΙΤΡΕΠΕΤΑΙ ΣΤΟ CACHED RASTER — και οι δύο άλλες όχι
 * Το `table-formula-overlays.ts` δηλώνει ρητά «**ΠΟΤΕ** μέσα στο bitmap cache»: το πρόχειρο
 * και η επιλογή αλλάζουν **ανά χαρακτήρα**, οπότε στο κλειδί του cache θα σήμαιναν πλήρη
 * ανακατασκευή raster σε κάθε πλήκτρο.
 *
 * Εδώ ισχύει το **αντίθετο**, και δεν είναι χαλάρωση του κανόνα αλλά εφαρμογή του:
 *
 * | τι ζωγραφίζεται | από πού βγαίνει | συχνότητα |
 * |---|---|---|
 * | λωρίδες δεμένων στηλών | `column.sourceKey` — **το μοντέλο** | αλλάζει με το μοντέλο |
 * | σημάδια παράκαμψης / σύγκρουσης | `cell.bound` — **το μοντέλο** | αλλάζει με το μοντέλο |
 * | «μπαγιάτικος» | store (paint-time) | **ρητός έλεγχος**, ποτέ μόνο του (Δ3) |
 *
 * Τα δύο πρώτα ταξιδεύουν ήδη με το κλειδί του cache και **δεν μπορούν** να παλιώσουν μέσα
 * στο raster. Το τρίτο ακυρώνει ρητά το raster μέσω του `useDxfCanvasCacheInvalidation` —
 * το **ίδιο** συμβόλαιο που ήδη χρησιμοποιούν LWDISPLAY / LayerStore / linetype registry.
 *
 * 🔑 Και είναι **απαραίτητο** να μπαίνει στο normal pass: ο δεσμός είναι ιδιότητα του
 * **σχεδίου**, όχι της χειρονομίας. Ζωγραφισμένος μόνο σε επιλεγμένο πίνακα, θα τον έβρισκε
 * μόνο όποιος ήδη ξέρει ότι υπάρχει — η αστοχία ανακάλυψης που το ADR-739 §31.8 μέτρησε
 * ζωντανά δύο φορές.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/table-bound-state-overlay
 * @see bim/table/binding/table-bound-marks.ts — ΤΙ σημαδεύεται (η κρίση, χωρίς καμβά)
 * @see rendering/entities/table/stamp-table-bound-state.ts — το μελάνι (+ ο φρουρός του χαρτιού)
 * @see state/table-binding-freshness-store.ts — τι είπε ο ΤΕΛΕΥΤΑΙΟΣ ρητός έλεγχος
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4
 */

import {
  boundColumnStripsMm,
  boundExceptionMarks,
} from '../../../bim/table/binding/table-bound-marks';
import { getTableBindingFreshness } from '../../../state/table-binding-freshness-store';
import { stampTableBoundState } from './stamp-table-bound-state';
import type { StampTableContext } from './stamp-table-layout';
import type { TableCellLayout, TableColumnLayout } from '../../../bim/table/table-layout-types';
import type { TableEntity } from '../../../types/table-entity';
import { activeTableBinding, activeTableModel } from '../../../bim/table/table-worksheet-resolve';

/**
 * Ζωγραφίζει τον δείκτη δεσμού αυτού του πίνακα — ή τίποτα, αν δεν υπάρχει δεσμός.
 *
 * ⚠️ **Καμία κρίση εδώ.** Το «ποιες στήλες» και το «ποια κελιά» τα απαντά το
 * `table-bound-marks`· το «μπαγιάτικος;» το απαντά ο **τελευταίος ρητός έλεγχος**. Ο πίνακας
 * δεν ρωτά την πηγή μόνος του (Δ3) και **σίγουρα** όχι ανά καρέ: μια επίλυση + αποτύπωμα ανά
 * πίνακα ανά καρέ θα ήταν push από την πίσω πόρτα, δηλαδή το Δ3 παρακαμμένο σιωπηλά.
 *
 * Τα ορατά κελιά έρχονται **ήδη κομμένα** από τον ζωγράφο (ADR-735): ένας πίνακας 500
 * γραμμών δεν εξετάζει 500 γραμμές ανά καρέ για να σημαδέψει τις 12 που φαίνονται.
 */
export function stampTableBoundStateOverlay(
  rc: StampTableContext,
  entity: TableEntity,
  columns: readonly TableColumnLayout[],
  visibleCells: readonly TableCellLayout[],
): void {
  const model = activeTableModel(entity);
  // 🔴 ADR-769 Δ7 — ο δεσμός ταξιδεύει μαζί: η **γραψιμότητα** της στήλης απαντιέται από το
  // μητρώο **της πηγής**, οπότε η λωρίδα δεν μπορεί να κριθεί από το μοντέλο μόνο του.
  const strips = boundColumnStripsMm(model, activeTableBinding(entity), columns);
  const marks = boundExceptionMarks(model, visibleCells);
  if (strips.length === 0 && marks.length === 0) return;

  stampTableBoundState(rc, {
    strips,
    marks,
    // 🔴 «Κανείς δεν κοίταξε» **δεν** είναι «μπαγιάτικος» — είναι **σιωπή**. Μόνο το ρητό
    // `stale` βάφει· `null` (ποτέ έλεγχος), `fresh` και `unknown` αφήνουν τη λωρίδα
    // κανονική. Το `unknown` ειδικά **δεν** ισοπεδώνεται σε «μπαγιάτικος»: ο φραγμός
    // εξαγωγής το δηλώνει χωριστά, γιατί «δεν ξέρω» και «ξέρω ότι διαφέρει» απαιτούν
    // διαφορετική ενέργεια από τον χρήστη.
    stale: getTableBindingFreshness(entity.id)?.status === 'stale',
  });
}
