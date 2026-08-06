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
import type { TableColumnId, TableRowId } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import type { TableCellLayout, TableRectMm } from './table-layout-types';
import { cellBaselineYMm } from './table-layout-place';
import type { TableCellStyle } from './table-style';
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
  return {
    rowId: cell.rowId,
    colId: cell.colId,
    // ADR-739 Φ.Ζ — **πηγαίο** σε κελί τύπου, κείμενο σε κάθε άλλο. Ό,τι επιστρέφεται εδώ
    // το δείχνουν **και** ο επεξεργαστής μέσα στο κελί **και** η γραμμή τύπων (μέσω του
    // `initialText`): μία ερώτηση, μία απάντηση, καμία πιθανότητα να διαφωνήσουν.
    text: cellInputText(entity.model, cell.rowId, cell.colId),
    anchorWorldPoint: tableFrameToWorld(entity, rect.x, rect.y, geometry.mmToWorld),
    rectMm: rect,
    style,
    hAlign: cell.hAlign,
    // Η γραμμή βάσης έρχεται από τη ΜΙΑ συνάρτηση που τη γνωρίζει (`table-layout-place`),
    // ξαναβασισμένη στην κορυφή του κελιού.
    baselineFromTopMm: cellBaselineYMm(rect, style.align, style) - rect.y,
    clickOffsetMm,
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
  // 🔴 ADR-739 Φ.Ζ — **η γραφή και ο επαναϋπολογισμός είναι ΕΝΑΣ μετασχηματισμός**, μέσα
  // στην ίδια εντολή. Δεν είναι λεπτομέρεια υλοποίησης: αν ο επαναϋπολογισμός γινόταν σε
  // δεύτερη εντολή, ένα `Ctrl+Z` θα ανέτρεπε τα αποτελέσματα αφήνοντας τον τύπο — ή το
  // αντίστροφο. Η ατομικότητα βγαίνει δωρεάν από την **καθαρότητα** των δύο συναρτήσεων,
  // ακριβώς όπως η επικόλληση 20 κελιών γίνεται ένα βήμα (δες `buildTableModelCommand`).
  const recalculated = commitCellWrites(writeCellInput(entity.model, rowId, colId, nextText));
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
  nextModel: TableEntity['model'],
  sceneManager: ISceneManager,
): ICommand | null {
  if (nextModel === entity.model) return null;
  return new UpdateEntityCommand(entity.id, { model: nextModel }, sceneManager);
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
export function buildTableStyleCommand(
  entity: TableEntity,
  nextStyleId: string,
  sceneManager: ISceneManager,
): ICommand | null {
  if (nextStyleId === entity.styleId) return null;
  return new UpdateEntityCommand(entity.id, { styleId: nextStyleId }, sceneManager);
}
