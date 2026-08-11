/**
 * 🔴 ADR-739 §58 Γ2 — **ΤΟ ΞΕΧΕΙΛΙΣΜΑ ΩΣ ΠΡΑΞΗ ΜΟΡΦΟΠΟΙΗΣΗΣ**: η ανάγνωση και η εγγραφή που
 * τροφοδοτούν **και τις δύο** επιφάνειες (κορδέλα + mini toolbar).
 *
 * ## Γιατί ΞΕΧΩΡΙΣΤΟ αρχείο από το `table-format-scope.ts`
 * Η τομή **δεν** είναι το μέγεθος — είναι η ίδια που δηλώνει ήδη, κατά λέξη, το ομώνυμο test
 * (`__tests__/table-format-overflow-scope.test.ts`): *«το `overflow` δεν είναι πεδίο του
 * `TableCellStyle`, άρα δεν περνά ούτε από το `resolveTableFormatState` ούτε από το
 * `setTableFormatField`»*. Δηλαδή αυτές οι δύο συναρτήσεις είναι **η μόνη πράξη μορφοποίησης
 * που δεν μιλά το γενικό λεξιλόγιο**: δικά τους μέλη στο συμβόλαιο, δικός τους γραφέας, δικός
 * τους κανόνας για το «πού γράφεται». Το αρχείο του γενικού λεξιλογίου πέρασε τις 500 γραμμές
 * (N.7.1) όταν ο στόχος-γράμματα απέκτησε τη **βάση** του (ADR-753 §25), και η πρώτη γραμμή
 * που έπρεπε να φύγει ήταν εκείνη που το ίδιο το έργο είχε ήδη ονομάσει ξένη.
 *
 * ⚠️ Το `clearTableFormatScope` (**Επαναφορά μορφοποίησης**) μένει στο `table-format-scope.ts`
 * επίτηδες, παρόλο που η τεκμηρίωση εδώ το επικαλείται: εκείνο είναι πράξη του **γενικού**
 * λεξιλογίου με τρία σκέλη, όχι πράξη ξεχειλίσματος. Η αναφορά είναι ο λόγος #2 παρακάτω —
 * ακριβώς επειδή **δεν** μπορεί να σβήσει το `TableColumn.overflow`.
 *
 * @module subapps/dxf-viewer/bim/table/table-format-overflow-scope
 * @see bim/table/table-format-scope.ts — το γενικό λεξιλόγιο (`setField` / `state`)
 * @see bim/table/table-cell-overflow.ts — ο ΕΝΑΣ επιλυτής της προτεραιότητας
 * @see bim/table/table-overflow-ops.ts — ο κανόνας «ίδια ⇒ ξεπάτωμα» (ζει στον καλούντα)
 */

import { forEachResolvedCellStyle } from './table-cell-style-scan';
// 🔴 ADR-739 §58 Γ2 — η **επίλυση** του ξεχειλίσματος (κελί ▸ στήλη ▸ προεπιλογή) δεν
// ξαναγράφεται εδώ: είναι ο ίδιος `resolveCellOverflow` που ρωτούν ο μετρητής, ο ζωγράφος, η
// εξαγωγή και το πινέλο. Μια πέμπτη έκφραση της προτεραιότητας θα ήταν αόρατη όσο συμφωνεί.
import { resolveCellOverflow } from './table-cell-overflow';
import { setRangeStyleField } from './table-range-style-ops';
import { tableRangeCellRefs } from './table-cell-range';
import { tableFormatScopeBounds, type TableFormatScope } from './table-format-scope';
import type { TableStyle } from './table-style';
import type { PersistedTableModel, TableCellOverflow } from '../../types/table';

/**
 * **Τι ξεχείλισμα ισχύει** στον στόχο· `null` όταν τα κελιά διαφωνούν ή ο στόχος δεν επιβίωσε.
 *
 * ## Γιατί ΔΕΝ περνά από το {@link resolveTableFormatState}
 * Το `overflow` **δεν είναι πεδίο** του `TableCellStyle` — ο τύπος `TableCellStyleKey` είναι η
 * τομή `keyof TableAxisStyleOverride & keyof TableCellStyle` και το πετάει και από τα δύο άκρα:
 * ζει **μόνο** στο `TableCellStyleOverride` (κελί) και στο `TableColumn.overflow` (στήλη). Ο
 * αποκλεισμός είναι σκόπιμος και τεκμηριωμένος στο `types/table.ts`: το ξεχείλισμα δεν είναι
 * τυπογραφία, είναι **απόφαση διάταξης** που καταναλώνεται μία φορά στο στάδιο `place`.
 *
 * Είναι η **ίδια** κατάσταση που έφερε το `numberFormat` (ADR-760) και το χρώμα (§34): όταν η
 * ερώτηση δεν χωρά στο γενικό λεξιλόγιο, αποκτά δικό της μέλος αντί να παραμορφωθεί.
 *
 * 🔑 Ο βρόχος είναι ο **ΕΝΑΣ** ({@link forEachResolvedCellStyle}): το `TableResolvedCell` κουβαλά
 * ήδη `overrides` + `column`, δηλαδή ακριβώς τα δύο επίπεδα που ρωτά ο `resolveCellOverflow`.
 *
 * ⚠️ Ο στόχος-**άξονας** μεταφράζεται σε ορθογώνιο ({@link tableFormatScopeBounds}): «τι
 * ξεχειλίζει αυτή η στήλη;» είναι ερώτηση **κελιών**, και μια μαρκαρισμένη στήλη είναι τα κελιά
 * της — ίδια μετάφραση με τη μορφή αριθμού.
 */
export function resolveTableFormatOverflow(
  model: PersistedTableModel,
  style: TableStyle,
  scope: TableFormatScope,
): TableCellOverflow | null {
  const bounds = tableFormatScopeBounds(model, scope);
  if (bounds === null) return null;

  let value: TableCellOverflow | undefined;
  let mixed = false;
  const visited = forEachResolvedCellStyle(
    model, style, tableRangeCellRefs(model, bounds), (cell) => {
      const current = resolveCellOverflow(cell.overrides.cell?.overflow, cell.column.overflow);
      if (value === undefined) value = current;
      else if (current !== value) mixed = true;
    },
  );

  return !visited || mixed || value === undefined ? null : value;
}

/**
 * Γράφει το ξεχείλισμα — **πάντα σε επίπεδο ΚΕΛΙΟΥ**, όποιος κι αν είναι ο στόχος.
 *
 * ## 🔴 Η ΜΟΝΗ ΠΡΑΞΗ ΜΟΡΦΟΠΟΙΗΣΗΣ ΠΟΥ ΔΕΝ ΑΚΟΛΟΥΘΕΙ ΤΟ ΣΚΕΛΟΣ ΤΟΥ ΣΤΟΧΟΥ — και γιατί
 * Κάθε άλλο πεδίο γράφεται εκεί που δείχνει η **πρόθεση της επιλογής** (§52: μαρκαρισμένη στήλη
 * ⇒ `TableColumn.styleOverride`). Το ξεχείλισμα **δεν μπορεί**, και ο λόγος είναι μετρήσιμος,
 * όχι αισθητικός:
 *
 * 1. **Υπάρχει ήδη γραφέας, και γράφει κελιά.** Το πινέλο μορφοποίησης (ADR-768 Φ3) γράφει
 *    `overflow` στο `TableCell.styleOverride` μέσα στην όψη `'alignment'`. Δεύτερος γραφέας σε
 *    **άλλο επίπεδο** θα ήταν δύο απαντήσεις στο «πού ζει η αναδίπλωση αυτού του κελιού» — και
 *    η διαφωνία τους θα ήταν αόρατη, γιατί κάθε πλευρά της δουλεύει.
 * 2. **Το `TableColumn.overflow` ΔΕΝ είναι μέρος του `styleOverride`.** Άρα το
 *    {@link clearTableFormatScope} («Επαναφορά μορφοποίησης») **δεν μπορεί να το σβήσει**: ο
 *    χρήστης θα δημιουργούσε με ένα κλικ κατάσταση που η ορατή αναιρετική πράξη δεν αναιρεί.
 * 3. **Η στήλη χάνει από το κελί.** Ένα `'wrap'` γραμμένο στη στήλη είναι σιωπηλά ανίσχυρο σε
 *    κάθε κελί που δηλώνει ήδη δικό του ξεχείλισμα — δηλαδή το κουμπί θα «δούλευε» παντού εκτός
 *    από εκεί που ο χρήστης είχε ήδη ασχοληθεί.
 *
 * ⚠️ Το `TableColumn.overflow` **δεν καταργείται**: παραμένει η προεπιλογή που κληρονομεί κάθε
 * νέα στήλη (`insertTableColumn`) και που διαβάζει η επίλυση. Απλώς **καμία επιφάνεια δεν το
 * γράφει** — και αυτό είναι δηλωμένο, όχι σιωπηλά απόν.
 */
export function setTableFormatOverflow(
  model: PersistedTableModel,
  scope: TableFormatScope,
  value: TableCellOverflow | undefined,
): PersistedTableModel {
  const bounds = tableFormatScopeBounds(model, scope);
  return bounds === null ? model : setRangeStyleField(model, bounds, 'overflow', value);
}
