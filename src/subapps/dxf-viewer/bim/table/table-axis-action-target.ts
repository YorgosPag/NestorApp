/**
 * ADR-739 §27.17 — **ΠΟΙΟΥΣ ΑΞΟΝΕΣ ΑΦΟΡΑ Η ΠΡΑΞΗ**: τον έναν που πατήθηκε, ή ολόκληρη την
 * επιλογή όταν το πάτημα έπεσε **μέσα** της.
 *
 * ## Το ελάττωμα που κλείνει (Giorgio, 2026-08-04, με στιγμιότυπο)
 * Ο χρήστης μάρκαρε τρεις στήλες από τη ζώνη με τα γράμματα, δεξί κλικ, «Διαγραφή στήλης» —
 * και **έσβηνε μία**. Το μενού ρωτούσε μόνο το `hit`, δηλαδή το γράμμα κάτω από τον δείκτη·
 * η επιλογή που φώτιζε στην οθόνη δεν συμμετείχε πουθενά στην απόφαση. Η οθόνη έλεγε «τρεις»,
 * η πράξη έκανε «μία», και τίποτα δεν το δήλωνε.
 *
 * ## 🔴 Ο κανόνας ΔΕΝ είναι καινούριος — είναι ο Α22 του ADR-750, στον άξονα
 * ```
 * επιλογή στηλών B:D, δεξί κλικ στο C  ⇒  στόχος B:D   (μέσα στην επιλογή)
 * επιλογή στηλών B:D, δεξί κλικ στο F  ⇒  στόχος F     (έξω από αυτήν)
 * καμία επιλογή,      δεξί κλικ στο F  ⇒  στόχος F
 * επιλογή ΓΡΑΜΜΩΝ 2:4, δεξί κλικ σε ΣΤΗΛΗ C ⇒ στόχος C (άλλος άξονας — δεν αφορά)
 * ```
 * Το `tableBorderTargetBounds` απαντά **την ίδια ερώτηση για κελιά** και με τα ίδια λόγια
 * («η επιλογή αν το κλικ ανήκει σε αυτήν, αλλιώς ο σκέτος στόχος»). Εδώ η απάντηση είναι
 * **ταυτότητες άξονα** αντί για ορθογώνιο, γιατί αυτό ζητούν οι δομικές πράξεις: η διαγραφή
 * θέλει ταυτότητες (σταθερές σε αναδιατάξεις), η εισαγωγή θέλει **θέση**.
 *
 * ⚠️ **Το είδος της επιλογής είναι φράγμα, όχι διακοσμητικό.** Μια επιλογή `'range'` (σύρση
 * μέσα στο πλέγμα) που τυχαίνει να πιάνει όλες τις γραμμές **δεν** σημαίνει «ο χρήστης
 * διάλεξε στήλες» — το §27.15 έβγαλε ρητά την προεπιλογή από το `kind` ακριβώς για να μη
 * συμπεραίνεται πρόθεση από γεωμετρία. Άρα διαγραφή τριών στηλών γίνεται **μόνο** όταν ο
 * χρήστης μάρκαρε τρεις στήλες *ως στήλες*.
 *
 * ## Γιατί το δεξί κλικ ΔΕΝ μετακινεί την επιλογή
 * Το Excel συμπεραίνει τον στόχο **μετακινώντας** την επιλογή στο σημείο που πατήθηκε. Εδώ
 * το δεξί κλικ δεν αγγίζει ποτέ την επιλογή (§27.14: «το δεξί σταματά εδώ»), οπότε ο ίδιος
 * κανόνας βγαίνει από την **ερώτηση** αντί από τη μεταβολή — ο χρήστης βλέπει το μαρκάρισμά
 * του ανέπαφο και ο τίτλος του μενού γράφει τι ακριβώς θα φύγει.
 *
 * @module subapps/dxf-viewer/bim/table/table-axis-action-target
 * @see ui/table-cell-editor/use-table-range-menu.ts — ο ίδιος κανόνας για **κελιά** (Α22)
 * @see bim/table/table-row-column-bulk-ops.ts — ΤΙ κάνει η πράξη σε πολλούς άξονες
 * @see bim/table/table-cell-range.ts — ο ΕΝΑΣ δρόμος ερμηνείας μιας επιλογής
 */

import { resolveTableSelectionBounds, type TableAxisTarget, type TableSelectionSpan } from './table-cell-range';
import type { TableModel } from '../../types/table';

/**
 * Οι άξονες που αφορά μια δομική πράξη — **ταυτότητες και θέσεις μαζί**, γιατί οι δύο
 * καταναλωτές ρωτούν διαφορετικά (διαγραφή: ποιοι· εισαγωγή: πού).
 *
 * Οι ταυτότητες είναι στη **σειρά του μοντέλου** και το διάστημα `[firstIndex, lastIndex]`
 * είναι κλειστό και στα δύο άκρα — ίδια σύμβαση με το {@link TableCellRangeBounds}.
 */
export interface TableAxisActionTarget {
  readonly axis: 'row' | 'column';
  readonly ids: readonly string[];
  readonly firstIndex: number;
  readonly lastIndex: number;
  /** `lastIndex - firstIndex + 1` — το πλήθος που γράφει και η ετικέτα του μενού. */
  readonly count: number;
  /**
   * Η θέση του **ενός** άξονα που πατήθηκε — μέσα στο διάστημα, αλλά όχι απαραίτητα η αρχή του.
   *
   * ⚠️ Δεν είναι πλεονασμός: η **γραμμή μορφοποίησης** (ADR-739 Φ.Ε) δρα ακόμη σε έναν άξονα,
   * και το προσβάσιμο όνομά της οφείλει να λέει σε **ποιον**. Χωρίς αυτό το πεδίο θα έγραφε
   * «Μορφοποίηση στήλης A:C» ενώ βάφει μία — δηλαδή η διόρθωση της διαγραφής θα γεννούσε ένα
   * νέο, μικρότερο ψέμα δίπλα της. Φεύγει όταν η μορφοποίηση ακολουθήσει κι αυτή την επιλογή.
   */
  readonly hitIndex: number;
}

/**
 * Ο στόχος ενός χτυπήματος σε ζώνη δείκτη — δες την κεφαλίδα για τον κανόνα.
 *
 * `null` όταν η ταυτότητα δεν υπάρχει στο μοντέλο: μπαγιάτικο `hit` μετά από undo. Ο καλών
 * δεν κάνει τίποτα — ποτέ μαντεψιά για το ποιον άξονα εννοούσε ο χρήστης.
 *
 * ⚠️ Δέχεται {@link TableAxisTarget} και **όχι** `TableIndicatorHit`: το `index` του δεύτερου
 * είναι πληροφορία **γεωμετρίας ζώνης**, ενώ εδώ η θέση βγαίνει από το ίδιο το μοντέλο. Ένα
 * `hit` περνά αυτούσιο (είναι δομικά υπερσύνολο), χωρίς αυτό το module — καθαρή γνώση
 * μοντέλου — να αποκτήσει εξάρτηση από τα mm των ζωνών.
 */
export function resolveTableAxisActionTarget(
  model: TableModel,
  hit: TableAxisTarget,
  selection: TableSelectionSpan | null | undefined,
): TableAxisActionTarget | null {
  const items = hit.axis === 'column' ? model.columns : model.rows;
  const hitId = hit.axis === 'column' ? hit.colId : hit.rowId;
  const index = items.findIndex((item) => item.id === hitId);
  if (index < 0) return null;

  const span = selectedSpan(model, hit.axis, selection);
  // Ο κανόνας, σε μία γραμμή: η επιλογή μετράει **μόνο** αν το πάτημα έπεσε μέσα της.
  const inside = span !== null && index >= span.first && index <= span.last;
  const firstIndex = inside ? span.first : index;
  const lastIndex = inside ? span.last : index;

  return {
    axis: hit.axis,
    ids: items.slice(firstIndex, lastIndex + 1).map((item) => item.id),
    firstIndex,
    lastIndex,
    count: lastIndex - firstIndex + 1,
    hitIndex: index,
  };
}

/**
 * Το διάστημα της τρέχουσας επιλογής **κατά μήκος του άξονα που πατήθηκε**, ή `null` όταν η
 * επιλογή δεν είναι του ίδιου είδους (δες το φράγμα στην κεφαλίδα).
 *
 * Περνά υποχρεωτικά από το {@link resolveTableSelectionBounds}: είναι ο **ΕΝΑΣ** δρόμος από
 * «τι διάλεξε ο χρήστης» σε «ποια κελιά είναι μέσα», και μαζί του έρχεται δωρεάν η
 * κανονικοποίηση των δύο γωνιών (η επιλογή γράφεται σε αυθαίρετη σειρά — σύρση από δεξιά
 * προς αριστερά είναι το ίδιο συνηθισμένη).
 */
function selectedSpan(
  model: TableModel,
  axis: 'row' | 'column',
  selection: TableSelectionSpan | null | undefined,
): { readonly first: number; readonly last: number } | null {
  if (!selection || selection.kind !== axis) return null;
  const bounds = resolveTableSelectionBounds(model, selection);
  if (!bounds) return null;
  return axis === 'column'
    ? { first: bounds.firstCol, last: bounds.lastCol }
    : { first: bounds.firstRow, last: bounds.lastRow };
}
