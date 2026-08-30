/**
 * ADR-739 Φάση Δ βήμα 2 — **η συνεδρία επεξεργασίας ενός κελιού πίνακα**, χωρίς React.
 *
 * Καθρέφτης του `ui/text-toolbar/text-edit-session.ts` (ADR-344 Φ6.E): ΠΟΙΟ κελί ανοίγει
 * ο editor + ΠΩΣ γίνεται commit, μία φορά, ώστε η μελλοντική 3D όψη να μην αντιγράψει τον
 * κανόνα ξανά (το ίδιο δίδυμο που ο ADR-739 §15 ονομάζει «τέταρτη μηχανή πίνακα»).
 *
 * ΤΙ ΜΕΝΕΙ ΕΞΩ (και γιατί): καμία γνώση React/DOM/anchor — αυτό ζει στον 2D «ανοιχτήρα»
 * (`ui/table-cell-editor/useTableCellDoubleClickEditor.ts`), ακριβώς όπως η αγκύρωση
 * μένει έξω από το `text-edit-session.ts`.
 *
 * Και οι δύο συναρτήσεις εδώ είναι απλές γέφυρες πάνω σε ΗΔΗ υπάρχον SSoT (N.18 — καμία
 * νέα γνώση γεωμετρίας ή σειριοποίησης δεν γεννιέται εδώ):
 *   - `tableCellAtWorld` (ADR-739 Φ.Γ)     — ΠΟΙΟ κελί χτυπήθηκε
 *   - `tableFrameToWorld` (ADR-739 Φ.Γ)    — η γωνία του κελιού σε μονάδες σκηνής
 *   - `cellInputText` / `writeCellInput` (ADR-739 Φ.Ζ) — ανάγνωση/εγγραφή του περιεχομένου
 *     κελιού, με τη **μία** διακλάδωση `=` (τύπος ή κείμενο) και τον επαναϋπολογισμό μέσα
 *     στην ίδια εντολή· από κάτω τους ζουν αυτούσιοι οι αμετάβλητοι γραφείς της Φ.Δ βήμα 1
 *
 * @module subapps/dxf-viewer/bim/table/table-cell-edit-session
 * @see ui/table-cell-editor/useTableCellDoubleClickEditor.ts — ο 2D καταναλωτής
 * @see ui/text-toolbar/text-edit-session.ts — ο αδελφός που καθρεφτίζει (κείμενο, όχι κελί)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §Φ.Δ
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { ICommand, ISceneManager } from '../../core/commands';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import type { TextAlign } from '../structural/detail-sheet/detail-sheet-types';
import type {
  PersistedTableModel,
  TableBinding,
  TableCellTextRun,
  TableColumnId,
  TableRowId,
} from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
// 🔴 ADR-753 §28 — η **μία** αναζήτηση αποθηκευμένου κελιού· τα `runs` ταξιδεύουν με το κείμενό
// τους (δες το πεδίο `TableCellEditTarget.runs`).
import { findPersistedCell } from './table-cell-content';
// 🔴 ADR-769 Δ7 — ο ΕΝΑΣ κριτής του «**πού πάει** η γραφή αυτού του κελιού;». Διαδέχεται το
// δυαδικό `isBoundCellWritable` του ADR-767 Δ1, το οποίο **καταναλώνει** από μέσα: η Φ.Η
// πρόσθεσε τρίτη απάντηση («γράφεται, αλλά στην οντότητα») και μια δεύτερη ανάγνωση εδώ θα
// ήταν ακριβώς το σφάλμα του §11.2 #4 ανάποδα — read-only πεδίο πάνω από γραφέα που δέχεται.
import {
  isTableCellTypeable,
  resolveTableCellWriteRoute,
} from './write-back/table-cell-write-route';
import type { TableCellLayout, TableRectMm } from './table-layout-types';
import { cellBaselineYMm } from './table-layout-align';
import type { TableCellStyle } from './table-style';
import { activeTableBinding, activeTableModel, resolveWorksheets } from './table-worksheet-resolve';
import {
  tableWorksheetsPatch,
  worksheetsWithActiveModel,
  worksheetsWithActiveModelAndBinding,
} from './table-worksheet-write';
import {
  computeTableEntityGeometryLive,
  tableCellAtWorld,
  tableFrameToWorld,
  tableWorldToFrame,
} from './table-entity-geometry';
import {
  cellInputText,
  commitCellWrites,
  writeCellInput,
} from './formula/table-formula-engine';

/**
 * Το κελί που χτυπήθηκε, έτοιμο να ανοίξει editor: ταυτότητα + τρέχον κείμενο + αγκύρωση
 * **+ ολόκληρη η όψη του κελιού σε sheet-mm**.
 *
 * ## Γιατί κουβαλά την όψη (ADR-739 Φ.Δ βήμα 3)
 * Ο επεξεργαστής πρέπει να είναι **αόρατος ως κουτί**: ίδιο ορθογώνιο, ίδια γραμματοσειρά,
 * ίδια γραμμή βάσης, ίδια στοίχιση, ίδια χρώματα με το κείμενο που ήδη βλέπει ο χρήστης.
 * Κάθε ένα από αυτά τα νούμερα υπάρχει **ήδη** στη διάταξη· αν ο επεξεργαστής τα ξαναέβρισκε
 * μόνος του, θα ήταν μια δεύτερη μηχανή διάταξης που αποκλίνει σιωπηλά (N.18). Εδώ απλώς
 * **προωθούνται** — καμία νέα γνώση δεν γεννιέται σε αυτό το αρχείο.
 *
 * Όλα σε **sheet-mm του πλαισίου του πίνακα** (η μονάδα της διάταξης). Η μετατροπή σε px
 * οθόνης είναι δουλειά του καταναλωτή, με τον **έναν** πολλαπλασιαστή `tablePxPerMm`.
 */
export interface TableCellEditTarget {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  /**
   * Ό,τι **επεξεργάζεται** ο χρήστης (`cellInputText`): το πηγαίο `=…` σε κελί τύπου, το
   * κείμενο σε κάθε άλλο· κενό κελί ⇒ κενό αλφαριθμητικό. **Δεν** είναι ό,τι ζωγραφίζεται —
   * στον καμβά φαίνεται το αποτέλεσμα.
   */
  readonly text: string;
  /**
   * 🔴 ADR-753 §28 — η μορφοποίηση **ανά χαρακτήρα** του κελιού, σε δείκτες του {@link text}.
   *
   * Ταξιδεύει **δίπλα στο κείμενό της** και όχι ζητούμενη χωριστά από τον επεξεργαστή: δείκτες
   * χωρίς τη βάση τους δεν μπορούν να πουν αν δείχνουν ακόμη στα ίδια γράμματα, και μια δεύτερη
   * ανάγνωση του μοντέλου μέσα στο ίδιο render μπορεί να δει **άλλο** κελί (undo, ασύγχρονο
   * ξαναστήσιμο σκηνής). Είναι ακριβώς η αρχή που κατέγραψε το §25 πληρώνοντάς την:
   * **η βάση σύγκρισης ταξιδεύει με το αίτημα** (ADR-769).
   *
   * Απόντα ⇒ καμία μορφοποίηση ανά χαρακτήρα, δηλαδή ο επεξεργαστής ζωγραφίζει ό,τι ακριβώς
   * ζωγράφιζε πριν από το §28.
   */
  readonly runs?: readonly TableCellTextRun[];
  /**
   * Η **πάνω-αριστερή** γωνία του κελιού σε μονάδες σκηνής — το ίδιο σημείο αγκύρωσης
   * που χρησιμοποιεί το `text-editor-anchor-2d.ts` (`createTextEditorAnchor2D`). Πάνω-
   * αριστερά, όχι κέντρο, ώστε ο editor να ξεκινά ΕΚΕΙ που ξεκινά και το κείμενο του
   * κελιού στη ζωγραφική — ίδια σύμβαση με το `TableCellLayout.rect`.
   */
  readonly anchorWorldPoint: Point2D;
  /** Το ορθογώνιο του κελιού σε sheet-mm (τοπικά στο πλαίσιο του πίνακα). */
  readonly rectMm: TableRectMm;
  /** Το τελικό στυλ του κελιού — τυπογραφία, χρώματα, περιθώρια (sheet-mm). */
  readonly style: TableCellStyle;
  /** Η επιλυμένη οριζόντια στοίχιση (κελί → στήλη → κλάση γραμμής). */
  readonly hAlign: TextAlign;
  /**
   * 🔴 ADR-739 §59 Δ2 — η **εσοχή σε sheet-mm**, όπως τη μέτρησε η διάταξη (0 όταν δεν ισχύει).
   *
   * Έτοιμη τιμή και **ποτέ** ξαναϋπολογισμένη εδώ: η μετατροπή σκαλιού→mm θέλει τον μετρητή
   * κειμένου, και ο επεξεργαστής δεν έχει — ούτε επιτρέπεται να αποκτήσει (N.18). Χωρίς αυτήν,
   * το πεδίο θα άνοιγε με τα γράμματα **κολλητά στο περιθώριο** ενώ ο καμβάς τα ζωγραφίζει
   * μέσα, δηλαδή το κείμενο θα αναπηδούσε στο διπλό κλικ — ακριβώς το ελάττωμα που το βήμα 3
   * υπάρχει για να μην υπάρχει.
   */
  readonly indentMm: number;
  /**
   * Η **γραμμή βάσης** του κειμένου, σε sheet-mm **από την πάνω ακμή του κελιού**. Σχετική
   * και όχι απόλυτη επίτηδες: ο καταναλωτής τοποθετεί μέσα σε ένα κουτί που ξεκινά στην
   * `anchorWorldPoint`, άρα το απόλυτο `v` θα το ξαναφαιρούσε ούτως ή άλλως.
   */
  readonly baselineFromTopMm: number;
  /**
   * Πού έπεσε το κλικ **οριζόντια** μέσα στο κελί, σε sheet-mm από την αριστερή του ακμή.
   *
   * `undefined` όταν η συνεδρία **δεν** ξεκίνησε από κλικ (`Tab` / `F2` / βέλη): τότε ο
   * κέρσορας πάει στο τέλος του κειμένου, όπως στο Excel. Δεν είναι γεωμετρία του κελιού —
   * είναι «από πού μπήκες», και γι' αυτό είναι προαιρετικό.
   */
  readonly clickOffsetMm?: number;
  /**
   * 🔴 ADR-767 Δ1 — **το κελί τρέφεται από πηγή και δεν δέχεται πληκτρολόγηση.**
   *
   * Δεν είναι σφάλμα ούτε κλείδωμα του χρήστη: στη Φ.ΣΤ δεν υπάρχει write-back (αυτό είναι
   * ρητά η Φ.Η), άρα **δεν υπάρχει ιδιοκτήτης να δεχτεί τη γραφή** — μια πληκτρολογημένη
   * τιμή θα εξαφανιζόταν στο επόμενο refresh. Πρότυπο: AutoCAD Data Link («*locked from
   * editing by default*») + Revit Calculated Values (ποτέ).
   *
   * ⚠️ Αφορά **μόνο** το περιεχόμενο. Η μορφοποίηση (χρώμα, στοίχιση, πλάτος) μένει
   * ελεύθερη, όπως ρητά στο AutoCAD: «*Cell formatting changes do not require unlocking*».
   *
   * Ο άνθρωπος **ξεκλειδώνει ρητά** (Δ2) και τότε το κελί ξαναγίνεται γράψιμο **χωρίς** να
   * σπάσει ο δεσμός — γι' αυτό `overridden` και `conflict` απαντούν `false` εδώ.
   */
  readonly readOnly: boolean;
}

/**
 * Ποιο κελί χτυπά ένα σημείο **σκηνής** πάνω σε μια οντότητα πίνακα, έτοιμο για inline
 * editor. `null` όταν το σημείο πέφτει έξω από κάθε κελί (κενός πίνακας, ή κλικ έξω από
 * το πλέγμα).
 *
 * Η ζωντανή κλίμακα σχεδίασης διαβάζεται μέσα στο `computeTableEntityGeometryLive`
 * (ADR-040 — event-time read, το διπλό κλικ ΕΙΝΑΙ event), ίδια σύμβαση με το
 * `hitTestTable`/`calculateTableBounds` του ADR-739 Φ.Γ.
 */
export function resolveTableCellEditTarget(
  entity: TableEntity,
  worldPoint: Point2D,
  sceneUnits: SceneUnits = 'mm',
): TableCellEditTarget | null {
  const geometry = computeTableEntityGeometryLive(entity, sceneUnits);
  const hit = tableCellAtWorld(entity, worldPoint, geometry);
  if (!hit) return null;
  const cell = findCell(geometry, hit.rowId, hit.colId);
  if (!cell) return null;
  // Η οριζόντια θέση του κλικ **μέσα** στο κελί — ο κέρσορας πέφτει στο γράμμα που
  // δείχνει ο χρήστης (Excel), όχι πάντα στο τέλος. Ίδια, μοναδική αντιστροφή πλαισίου.
  const frame = tableWorldToFrame(entity, worldPoint, geometry.mmToWorld);
  return buildEditTarget(entity, geometry, cell, frame.u - cell.rect.x);
}

/**
 * Το ίδιο, αλλά για κελί που **ήδη ξέρεις ποιο είναι** — η διαδρομή του δρομέα
 * πληκτρολογίου (ADR-739 Φ.Δ βήμα 2): το `Tab` δεν έχει σημείο κλικ να αντιστρέψει, έχει
 * ταυτότητα κελιού.
 *
 * `null` όταν το κελί δεν υπάρχει στη διάταξη — είτε γιατί σβήστηκε η γραμμή/στήλη κάτω
 * από τον δρομέα (undo, ταυτόχρονη επεξεργασία), είτε γιατί είναι **καλυμμένο** από
 * συγχώνευση. Και οι δύο περιπτώσεις σημαίνουν το ίδιο για τον καλούντα: μπαγιάτικος
 * δρομέας, κλείσ' τον.
 */
export function resolveTableCellEditTargetById(
  entity: TableEntity,
  rowId: TableRowId,
  colId: TableColumnId,
  sceneUnits: SceneUnits = 'mm',
): TableCellEditTarget | null {
  const geometry = computeTableEntityGeometryLive(entity, sceneUnits);
  const cell = findCell(geometry, rowId, colId);
  // Καμία `clickOffsetMm`: το `Tab` δεν έχει σημείο κλικ ⇒ κέρσορας στο τέλος (Excel).
  return cell ? buildEditTarget(entity, geometry, cell) : null;
}

/** Το κελί της διάταξης με αυτή την ταυτότητα — `undefined` σε καλυμμένο/σβησμένο κελί. */
function findCell(
  geometry: ReturnType<typeof computeTableEntityGeometryLive>,
  rowId: TableRowId,
  colId: TableColumnId,
): TableCellLayout | undefined {
  return geometry.layout.cells.find((c) => c.rowId === rowId && c.colId === colId);
}

/** Ο ΕΝΑΣ τόπος όπου συναρμολογείται ο στόχος — και οι δύο είσοδοι καταλήγουν εδώ (N.18). */
function buildEditTarget(
  entity: TableEntity,
  geometry: ReturnType<typeof computeTableEntityGeometryLive>,
  cell: TableCellLayout,
  clickOffsetMm?: number,
): TableCellEditTarget {
  const { rect, style } = cell;
  const runs = findPersistedCell(activeTableModel(entity), cell.rowId, cell.colId)?.runs;
  return {
    rowId: cell.rowId,
    colId: cell.colId,
    // ADR-739 Φ.Ζ — **πηγαίο** σε κελί τύπου, κείμενο σε κάθε άλλο. Ό,τι επιστρέφεται εδώ
    // το δείχνουν **και** ο επεξεργαστής μέσα στο κελί **και** η γραμμή τύπων (μέσω του
    // `initialText`): μία ερώτηση, μία απάντηση, καμία πιθανότητα να διαφωνήσουν.
    text: cellInputText(activeTableModel(entity), cell.rowId, cell.colId),
    // 🔴 ADR-753 §28 — διαβασμένα από το **ίδιο** μοντέλο, στην ίδια αναπνοή με το κείμενο.
    // Δες το σχόλιο του πεδίου: χωριστή ανάγνωση σημαίνει δείκτες πάνω σε άλλο κείμενο.
    ...(runs !== undefined && { runs }),
    anchorWorldPoint: tableFrameToWorld(entity, rect.x, rect.y, geometry.mmToWorld),
    rectMm: rect,
    style,
    hAlign: cell.hAlign,
    indentMm: cell.indentMm,
    // Η γραμμή βάσης έρχεται από τη ΜΙΑ συνάρτηση που τη γνωρίζει (`table-layout-align`),
    // ξαναβασισμένη στην κορυφή του κελιού.
    baselineFromTopMm: cellBaselineYMm(rect, style.align, style) - rect.y,
    clickOffsetMm,
    // 🔴 ADR-769 Δ7 — ρωτιέται **ο ίδιος κριτής** που ήδη απαντά στον φρουρό της εντολής και
    // στον ζωγράφο. Ένας δεύτερος έλεγχος `cell.bound?.overridden` εδώ θα ήταν η δεύτερη
    // ερμηνεία των ίδιων σημαιών, δηλαδή δύο απαντήσεις στο «γράφεται;» μέσα στην ίδια
    // χειρονομία: read-only επεξεργαστής πάνω από γραφέα που δέχεται (ή το αντίστροφο).
    //
    // ⚠️ Κελί συντεταγμένης **δέχεται** πληκτρολόγηση: η γραφή έχει παραλήπτη, απλώς δεν
    // είναι το μοντέλο. Δες `isTableCellTypeable`.
    readOnly: !isTableCellTypeable(
      resolveTableCellWriteRoute(activeTableModel(entity), activeTableBinding(entity), cell.rowId, cell.colId),
    ),
  };
}

/**
 * Το commit ενός κελιού → ένα undoable `UpdateEntityCommand` πάνω στο `model` της
 * οντότητας, ή `null` όταν δεν άλλαξε τίποτα.
 *
 * Το «τίποτα δεν άλλαξε» ΔΕΝ ελέγχεται εδώ με δεύτερη σύγκριση: **και οι τρεις** καθαρές
 * συναρτήσεις της αλυσίδας (`writeCellInput` → `commitCellWrites` →
 * `buildTableModelCommand`) επιστρέφουν το ΙΔΙΟ μοντέλο by-reference όταν δεν άλλαξε τίποτα
 * (ADR-739 Φ.Δ βήμα 1, εγγύηση 4· Φ.Ζ την επεκτείνει σε τύπους και αποτελέσματα) — αρκεί μια
 * σύγκριση `===` πάνω σε αυτή την εγγύηση, όχι re-implementation της λογικής ισότητας.
 */
export function buildTableCellEditCommand(
  entity: TableEntity,
  rowId: TableRowId,
  colId: TableColumnId,
  nextText: string,
  sceneManager: ISceneManager,
): ICommand | null {
  // 🔴 ADR-767 Δ1 — **Ο ΦΡΟΥΡΟΣ, ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΓΡΑΦΗ.**
  //
  // Ο επεξεργαστής ανοίγει ήδη read-only (`TableCellEditTarget.readOnly`), οπότε αυτό εδώ
  // είναι το δεύτερο σκέλος του belt-and-suspenders (N.7.2 #4): κάθε **άλλο** μονοπάτι
  // εγγραφής — πληκτρολόγιο, μελλοντική επιφάνεια, προγραμματιστική κλήση — πέφτει στον
  // ίδιο τοίχο. Ένας φρουρός μόνο στο UI θα ήταν ευγενική παράκληση.
  //
  // ⚠️ **`null`, ΠΟΤΕ εξαίρεση.** Δεμένο κελί που δεν γράφεται **στο μοντέλο** είναι
  // **φυσιολογική κατάσταση**, όχι σφάλμα προγραμματισμού — και το `null` σημαίνει ήδη «καμία
  // εντολή, κανένα βήμα undo», δηλαδή δεν γεννιέται καμία νέα σημασιολογία για τον καλούντα.
  //
  // 🔴 ADR-769 — καλύπτει **και** τη διαδρομή `'owner'`: εκείνη η τιμή ανήκει στην οντότητα και
  // περνά από το `useTableCellWriteBack`. Αν γραφόταν **και** εδώ, ο πίνακας θα κρατούσε
  // αντίγραφο της τιμής δίπλα στην πηγή — δηλαδή θα έσπαγε το Α2 («ΕΝΑΣ ιδιοκτήτης») τη στιγμή
  // ακριβώς που το υλοποιεί.
  if (resolveTableCellWriteRoute(activeTableModel(entity), activeTableBinding(entity), rowId, colId).kind !== 'model') {
    return null;
  }
  // 🔴 ADR-739 Φ.Ζ — **η γραφή και ο επαναϋπολογισμός είναι ΕΝΑΣ μετασχηματισμός**, μέσα
  // στην ίδια εντολή. Δεν είναι λεπτομέρεια υλοποίησης: αν ο επαναϋπολογισμός γινόταν σε
  // δεύτερη εντολή, ένα `Ctrl+Z` θα ανέτρεπε τα αποτελέσματα αφήνοντας τον τύπο — ή το
  // αντίστροφο. Η ατομικότητα βγαίνει δωρεάν από την **καθαρότητα** των δύο συναρτήσεων,
  // ακριβώς όπως η επικόλληση 20 κελιών γίνεται ένα βήμα (δες `buildTableModelCommand`).
  const recalculated = commitCellWrites(writeCellInput(activeTableModel(entity), rowId, colId, nextText));
  return buildTableModelCommand(entity, recalculated, sceneManager);
}

/**
 * 🔴 ADR-739 Φ.Δ βήμα 8 — **Η ΜΙΑ ΔΙΑΔΡΟΜΗ COMMIT ΤΟΥ ΠΙΝΑΚΑ**: νέο μοντέλο → μία
 * undoable εντολή, ή `null` όταν δεν άλλαξε τίποτα.
 *
 * ## Γιατί εξήχθη
 * Το βήμα 8 έφερε **τρεις** ακόμη γραφείς πάνω στο ίδιο μοντέλο: επικόλληση περιοχής,
 * άδειασμα περιοχής, και (Φ.Δ.9) η λαβή συμπλήρωσης. Αν ο καθένας έγραφε το δικό του
 * `new UpdateEntityCommand(entity.id, { model }, sceneManager)`, θα υπήρχαν τέσσερα σημεία
 * όπου μπορεί να ξεχαστεί ο έλεγχος ταυτότητας ή να αλλάξει το σχήμα του patch — ακριβώς ο
 * structural clone που πιάνει το CHECK 3.28 (N.18), ανεξάρτητα ονόματος.
 *
 * ## Γιατί ΕΝΑ `UpdateEntityCommand` και όχι `CompositeCommand`
 * Μια επικόλληση 20 κελιών πρέπει να αναιρείται με **ένα** `Ctrl+Z`. Υπάρχει έτοιμη υποδομή
 * γι' αυτό (`executeAsAtomicBatch` / `CompositeCommand`, ADR-539) — και **δεν χρειάζεται**:
 * το `setPersistedCellText` είναι καθαρό, οπότε οι 20 εγγραφές γίνονται **στη μνήμη** πάνω
 * σε αμετάβλητα ενδιάμεσα και φτάνουν εδώ ως **ένα** τελικό μοντέλο. Η ατομικότητα βγαίνει
 * δωρεάν από την καθαρότητα, αντί να χτιστεί από πάνω της.
 *
 * Ο έλεγχος «τίποτα δεν άλλαξε» είναι σύγκριση **ταυτότητας**, όχι περιεχομένου: το
 * `setPersistedCellText` εγγυάται ίδια αναφορά όταν το κείμενο είναι ταυτόσημο (ADR-739 Φ.Δ
 * βήμα 1), και μια αλυσίδα από καθαρές εφαρμογές διατηρεί αυτή την εγγύηση.
 */
export function buildTableModelCommand(
  entity: TableEntity,
  nextModel: PersistedTableModel,
  sceneManager: ISceneManager,
): ICommand | null {
  // 🔴 ADR-833 Φάση 2 — ο φύλακας ταυτότητας **ανέβηκε ένα επίπεδο** και λέει ακριβώς το ίδιο:
  // το `worksheetsWithActiveModel` επιστρέφει τον **ίδιο** πίνακα φύλλων by-reference όταν το
  // μοντέλο του ενεργού φύλλου δεν άλλαξε. Ό,τι ίσχυε για το `nextModel === entity.model`
  // ισχύει αυτούσιο εδώ — δες `bim/table/table-worksheet-write.ts`.
  const worksheets = worksheetsWithActiveModel(entity, nextModel);
  if (worksheets === resolveWorksheets(entity)) return null;
  return new UpdateEntityCommand(entity.id, tableWorksheetsPatch(entity, worksheets), sceneManager);
}

/**
 * ADR-739 §52 — **η αλλαγή ονοματισμένου στυλ**: το αδελφό μονοπάτι του
 * {@link buildTableModelCommand}, για το **μόνο** πεδίο μορφοποίησης που δεν ζει στο μοντέλο.
 *
 * ## Γιατί ξεχωριστή συνάρτηση και όχι παράμετρος του από πάνω
 * Το `styleId` είναι πεδίο της **οντότητας**, όχι του `model` (`types/table-entity.ts`), και
 * το patch του `UpdateEntityCommand` είναι άλλο. Μια ενιαία υπογραφή
 * `(entity, patch: Partial<TableEntity>)` θα έχανε ακριβώς αυτό που κάνει τις δύο χρήσιμες:
 * τον **φύλακα ταυτότητας** ανά πεδίο — «διάλεξα το στυλ που είχα ήδη» δεν επιτρέπεται να
 * γεννήσει βήμα αναίρεσης, όπως δεν το γεννά ούτε το «Β» σε ήδη έντονο κελί.
 *
 * ⚠️ Δεν αγγίζει το `model`: το στυλ είναι **κληρονομιά** (§28.4 σειρά προτεραιότητας), όχι
 * παράκαμψη. Οι ρητές παρακάμψεις γραμμών/στηλών/κελιών **επιβιώνουν** της αλλαγής στυλ —
 * είναι η ίδια σημασιολογία με το `ByLayer` του AutoCAD, και ο δρόμος να φύγουν είναι η
 * «Επαναφορά», ποτέ μια παρενέργεια της επιλογής στυλ.
 */
/**
 * 🔴 ADR-767 Δ3/Δ5 — **η ανανέωση του δεσμού**: το τρίτο αδελφό μονοπάτι δέσμευσης πίνακα.
 *
 * ## Γιατί ΔΕΝ αρκεί το {@link buildTableModelCommand}
 * Η ανανέωση αλλάζει **δύο** πράγματα ταυτόχρονα: τα κελιά (`model`) **και** το αποτύπωμα
 * (`binding.revision`). Δύο εντολές θα σήμαιναν ότι ένα `Ctrl+Z` αναιρεί τα νούμερα αλλά
 * αφήνει το νέο αποτύπωμα — δηλαδή ο πίνακας θα δήλωνε «ενημερωμένος» δείχνοντας τα **παλιά**
 * νούμερα. Ακριβώς το είδος ασυνέπειας που η Φ.Ζ έκλεισε για τύπους+αποτελέσματα, με το ίδιο
 * επιχείρημα: **ένας** μετασχηματισμός, **μία** εντολή, **ένα** undo (ADR-767 §9).
 *
 * ## 🔴 Ο φύλακας του no-op είναι ΔΙΠΛΟΣ — και οφείλει να είναι
 * Το early cutoff (Δ5) επιστρέφει το **ίδιο** μοντέλο **και** το ίδιο binding by-reference
 * όταν τα δεδομένα βγήκαν ίδια. Ελέγχονται **και τα δύο**: μια ανανέωση που δεν άλλαξε τιμές
 * αλλά ξαναέγραψε ίδιο revision θα γεννούσε βήμα undo για το τίποτα — και ο χρήστης θα
 * πατούσε «Ανανέωση» σε καθαρό έργο και θα έβλεπε το `Ctrl+Z` να «γεμίζει».
 */
export function buildTableBindingRefreshCommand(
  entity: TableEntity,
  nextModel: PersistedTableModel,
  nextBinding: TableBinding | undefined,
  sceneManager: ISceneManager,
): ICommand | null {
  // 🔴 ADR-833 Φάση 2 — τα δύο πεδία ζουν πλέον στο **ίδιο φύλλο**, οπότε η ατομικότητα που
  // αυτή η συνάρτηση υπάρχει για να εξασφαλίσει έγινε **δομική**: ένα αντικείμενο, μία
  // αντικατάσταση, αδύνατο να χωριστούν. Ο διπλός φύλακας μένει διπλός — μέσα στο
  // `worksheetsWithActiveModelAndBinding`, που επιστρέφει την ίδια αναφορά όταν **κανένα** από
  // τα δύο δεν άλλαξε.
  const worksheets = worksheetsWithActiveModelAndBinding(entity, nextModel, nextBinding);
  if (worksheets === resolveWorksheets(entity)) return null;
  return new UpdateEntityCommand(entity.id, tableWorksheetsPatch(entity, worksheets), sceneManager);
}

export function buildTableStyleCommand(
  entity: TableEntity,
  nextStyleId: string,
  sceneManager: ISceneManager,
): ICommand | null {
  if (nextStyleId === entity.styleId) return null;
  return new UpdateEntityCommand(entity.id, { styleId: nextStyleId }, sceneManager);
}
