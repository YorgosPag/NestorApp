'use client';

/**
 * 🔴 ADR-739 §43 — **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ «ΕΠΙΛΕΞΕ ΤΑ ΠΑΝΤΑ»**.
 *
 * ## Γιατί υπάρχει: τρεις πόρτες, μία εντολή
 * Η ίδια πράξη ζητιέται πλέον από **τρία** ανεξάρτητα σημεία:
 *
 *  1. `Ctrl+A` — `use-table-cell-session-keys` → `useTableRangeActions.selectAll`
 *  2. **αριστερό** κλικ στο τετραγωνάκι της γωνίας — `use-table-cell-pointer` (§43)
 *  3. **δεξί** κλικ στο ίδιο τετραγωνάκι — `use-table-range-menu` (§43, Excel parity)
 *
 * Μέχρι το §43 υπήρχε μία πόρτα, οπότε το σώμα ζούσε σωστά μέσα στο `useCallback` του hook. Με
 * τρεις, ένα δεύτερο `setTableCellSelection` θα ήταν sibling clone που πιάνει το CHECK 3.28
 * (N.18) — αλλά το σοβαρό δεν είναι οι γραμμές: θα ήταν **δεύτερη άποψη για το τι σημαίνει
 * «όλα»**. Την ημέρα που ο ορισμός αλλάξει (π.χ. κρυμμένες γραμμές), οι δύο θα αποκλίνουν και
 * η απόκλιση θα είναι **αόρατη**, γιατί και οι δύο απαντήσεις είναι απολύτως έγκυρες.
 *
 * ## Γιατί ΔΕΝ ζει στο `bim/table/` παρότι μοιάζει καθαρό
 * Γράφει σε store. Το `table-cell-range` είναι καθαρή γεωμετρία/λογική περιοχών και **δεν
 * επιτρέπεται** να μάθει τι είναι «δρομέας» — η ίδια μονόδρομη εξάρτηση που κρατά καθαρό και
 * το `table-indicator-geometry`. Εδώ ζει η **πράξη**· εκεί ο **ορισμός** ({@link
 * tableWholeGridRange}), και αυτή η συνάρτηση απλώς τον εκτελεί.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-select-all-action
 * @see bim/table/table-cell-range.ts — ο ΕΝΑΣ ορισμός του «όλα» (`tableWholeGridRange`)
 * @see bim/table/table-select-all-corner.ts — ΠΟΥ πατιέται (η γωνία)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §43
 */

import { tableWholeGridRange, type TableCellRangeBounds } from '../../bim/table/table-cell-range';
import { setTableCellSelection } from '../../state/table-cell-cursor-store';
import type { TableModel } from '../../types/table';

/**
 * Μαρκάρει **όλα** τα κελιά αυτού του πίνακα και επιστρέφει τα όρια που γράφτηκαν· `null` σε
 * εκφυλισμένο μοντέλο (μηδέν γραμμές ή μηδέν στήλες), όπου δεν υπάρχει τίποτα να μαρκαριστεί.
 *
 * ## 🔴 Το ενεργό κελί ΔΕΝ μετακινείται
 * Το `Ctrl+A` **επιλέγει**, δεν πλοηγεί — Excel και Sheets συμφωνούν, και ο ιδιοκτήτης το
 * μέτρησε στην οθόνη (04/08): με ενεργό το `A9`, μετά την «επιλογή όλων» το πλαίσιο ονόματος
 * εξακολουθεί να γράφει **`A9`**, όχι `A1`. Γι' αυτό ακριβώς η επιλογή κρατά **δύο δικές της
 * γωνίες** και δεν αντλεί τη μία από τη θέση του δρομέα — δες το σχόλιο του `selection` στο
 * store.
 *
 * ## Επιστρέφει τα όρια, και δεν είναι διακοσμητικό
 * Ο τρίτος καλών (το **δεξί** κλικ) χρειάζεται **ακριβώς αυτά** τα όρια για να τιτλοφορήσει το
 * μενού που ανοίγει αμέσως μετά. Ένας δεύτερος υπολογισμός τους εκεί θα ήταν η κλασική
 * ρωγμή: το μενού να γράφει `A1:E7` ενώ γράφτηκε κάτι άλλο. Μία πράξη, μία απάντηση.
 */
export function selectWholeTable(model: TableModel): TableCellRangeBounds | null {
  const whole = tableWholeGridRange(model);
  if (!whole) return null;
  setTableCellSelection({
    from: { rowId: model.rows[whole.firstRow].id, colId: model.columns[whole.firstCol].id },
    to: { rowId: model.rows[whole.lastRow].id, colId: model.columns[whole.lastCol].id },
    // ADR-739 §27.15 — **περιοχή**, και το κούμπωμα είναι ταυτοτικό: όλες οι συγχωνεύσεις είναι
    // ήδη μέσα εξ ορισμού. Δεν χρειάζεται τέταρτο είδος «όλα» για να ειπωθεί κάτι που το
    // ορθογώνιο ήδη λέει.
    kind: 'range',
  });
  return whole;
}
