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
 * ## 🔴 §68 — ΤΟ ΔΕΞΙ ΚΛΙΚ **ΜΕΤΑΚΙΝΕΙ** ΠΛΕΟΝ ΤΗΝ ΕΠΙΛΟΓΗ (full parity, 2026-08-20)
 * Εδώ έγραφε ότι «το δεξί κλικ δεν αγγίζει ποτέ την επιλογή (§27.14)», ώστε ο κανόνας να
 * βγαίνει από την **ερώτηση** αντί από τη μεταβολή. Ο ιδιοκτήτης ζήτησε ρητά **full parity με
 * το Excel**, όπου η επιλογή **μετακινείται** — και η ίδια απόφαση είχε ήδη παρθεί μία φορά,
 * για τη γωνία (§43).
 *
 * 🔑 **Αυτή η συνάρτηση δεν άλλαξε ούτε κατά μία γραμμή λογικής, και δεν είναι σύμπτωση.** Η
 * μεταβολή ζει στο `mousedown` ({@link table-context-menu-selection}), δηλαδή **πριν** φτάσει
 * εδώ οτιδήποτε: όταν το μενού ρωτά, η επιλογή είναι ήδη εκεί που πρέπει, οπότε ο κανόνας
 * απαντά «η επιλογή» από μόνος του. Ο έλεγχος `inside` έπαψε να είναι ο **μηχανισμός** και
 * έμεινε **φρουρός** — και σωστά: αν κάποτε το πάτημα δεν προλάβει να γράψει, εδώ δεν
 * γεννιέται ψέμα, γεννιέται ο παλιός, τίμιος στόχος.
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
  /**
   * 🔴 ADR-739 §68 — **έπεσε το πάτημα ΜΕΣΑ στην επιλογή;**
   *
   * Είναι το `inside` του κανόνα, εκτεθειμένο αντί για πεταμένο. Ο λόγος είναι ότι απέκτησε
   * **δεύτερο** καταναλωτή: το δεξί κλικ σε ζώνη **εκτός** επιλογής πρέπει πλέον να μαρκάρει
   * εκείνον τον άξονα (Excel parity — δες `table-context-menu-selection.ts`), και η ερώτηση
   * «είναι έξω;» είναι **ακριβώς** αυτή που ήδη απαντά αυτή η συνάρτηση.
   *
   * ⚠️ **Δεν συνάγεται από τα υπόλοιπα πεδία**: επιλογή **μιας** στήλης που ταυτίζεται με τη
   * ζώνη που πατήθηκε δίνει `count === 1` και `firstIndex === hitIndex` — ταυτόσημα με το «καμία
   * επιλογή». Ένας καλών που το μάντευε θα ξαναμάρκαρε τη στήλη που ήταν ήδη μαρκαρισμένη,
   * δηλαδή θα μετακινούσε το ενεργό κελί στην αρχή της χωρίς κανείς να το ζητήσει.
   */
  readonly insideSelection: boolean;
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
    insideSelection: inside,
  };
}

/**
 * Ο **ένας** άξονας του στόχου σε θέση `index`, στο λεξιλόγιο που δέχονται οι συναρτήσεις
 * επιλογής ({@link TableAxisTarget}).
 *
 * Υπάρχει ώστε ο καλών να μη γράφει `axis === 'column' ? { axis, colId: id } : { axis, rowId: id }`
 * — μια έκφραση αθώα από μόνη της, που όμως θα ξαναγραφόταν σε **κάθε** σημείο που μεταφράζει
 * στόχο σε επιλογή. Εδώ ζει μία φορά, δίπλα στον τύπο που παράγει.
 *
 * Δείκτης εκτός ορίων ⇒ ο πρώτος/τελευταίος του στόχου (κόψιμο, ποτέ `undefined` ταυτότητα).
 */
export function axisTargetAt(target: TableAxisActionTarget, index: number): TableAxisTarget {
  const at = Math.min(Math.max(index, 0), target.ids.length - 1);
  return axisTargetOf(target.axis, target.ids[at]);
}

/**
 * ADR-739 §52 — **ο πυρήνας του {@link axisTargetAt}: άξονας + ταυτότητα → στόχος επιλογής.**
 *
 * Το `axisTargetAt` το ήθελε από `TableAxisActionTarget` (δείκτης μέσα σε διάστημα)· το
 * `tableFormatScopeBounds` το θέλει από **σκέτο** `(axis, id)`, γιατί ένα `TableFormatScope`
 * κρατά ταυτότητες χωρίς διάστημα. Ο ορισμός μένει **ΕΝΑΣ**: το τριαδικό
 * `axis === 'column' ? { colId } : { rowId }` γράφεται εδώ και πουθενά αλλού — ακριβώς ό,τι
 * λέει η κεφαλίδα του `axisTargetAt` από την πρώτη μέρα.
 */
export function axisTargetOf(axis: 'row' | 'column', id: string): TableAxisTarget {
  return axis === 'column' ? { axis: 'column', colId: id } : { axis: 'row', rowId: id };
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
