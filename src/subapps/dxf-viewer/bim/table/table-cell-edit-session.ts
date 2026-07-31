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
 *   - `getPersistedCellText` / `setPersistedCellText` (ADR-739 Φ.Δ βήμα 1) — ανάγνωση/
 *     εγγραφή του αμετάβλητου κειμένου
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
import type { TableColumnId, TableRowId } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';
import {
  computeTableEntityGeometryLive,
  tableCellAtWorld,
  tableFrameToWorld,
} from './table-entity-geometry';
import { getPersistedCellText, setPersistedCellText } from './table-model-helpers';

/** Το κελί που χτυπήθηκε, έτοιμο να ανοίξει editor: ταυτότητα + τρέχον κείμενο + αγκύρωση. */
export interface TableCellEditTarget {
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  /** Το τρέχον κείμενο του κελιού (`getPersistedCellText` — κενό κελί ⇒ κενό αλφαριθμητικό). */
  readonly text: string;
  /**
   * Η **πάνω-αριστερή** γωνία του κελιού σε μονάδες σκηνής — το ίδιο σημείο αγκύρωσης
   * που χρησιμοποιεί το `text-editor-anchor-2d.ts` (`createTextEditorAnchor2D`). Πάνω-
   * αριστερά, όχι κέντρο, ώστε ο editor να ξεκινά ΕΚΕΙ που ξεκινά και το κείμενο του
   * κελιού στη ζωγραφική — ίδια σύμβαση με το `TableCellLayout.rect`.
   */
  readonly anchorWorldPoint: Point2D;
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

  const { x, y } = hit.rectMm;
  return {
    rowId: hit.rowId,
    colId: hit.colId,
    text: getPersistedCellText(entity.model, hit.rowId, hit.colId),
    anchorWorldPoint: tableFrameToWorld(entity, x, y, geometry.mmToWorld),
  };
}

/**
 * Το commit ενός κελιού → ένα undoable `UpdateEntityCommand` πάνω στο `model` της
 * οντότητας, ή `null` όταν δεν άλλαξε τίποτα.
 *
 * Το «τίποτα δεν άλλαξε» ΔΕΝ ελέγχεται εδώ με δεύτερη σύγκριση: το `setPersistedCellText`
 * ήδη επιστρέφει το ΙΔΙΟ μοντέλο by-reference όταν το κείμενο είναι ταυτόσημο (ADR-739
 * Φ.Δ βήμα 1) — αρκεί μια σύγκριση `===` πάνω σε αυτή την εγγύηση, όχι re-implementation
 * της λογικής ισότητας.
 */
export function buildTableCellEditCommand(
  entity: TableEntity,
  rowId: TableRowId,
  colId: TableColumnId,
  nextText: string,
  sceneManager: ISceneManager,
): ICommand | null {
  const nextModel = setPersistedCellText(entity.model, rowId, colId, nextText);
  if (nextModel === entity.model) return null;
  return new UpdateEntityCommand(entity.id, { model: nextModel }, sceneManager);
}
