/**
 * ADR-739 Φάση Γ — **οι λαβές του πίνακα** (SSoT· η ίδια πηγή για ζωγραφική και χειρισμό).
 *
 * Τρία είδη, όλα τοποθετημένα από την **παράγωγη** γεωμετρία (ποτέ από ωμές παραμέτρους),
 * ώστε οι λαβές να ακολουθούν πάντα τον πίνακα που πραγματικά ζωγραφίστηκε:
 *
 * ```
 *   0            → MOVE      @ την άγκυρα (πάνω-αριστερά)
 *   1            → ROTATION  @ το μέσο της ΠΑΝΩ ακμής, πάνω στην ακμή
 *   2 .. 2+N-1   → COLUMN    @ τα εσωτερικά όρια στηλών, πάνω στην ΠΑΝΩ ακμή
 * ```
 *
 * ## Γιατί ΔΕΝ υπάρχουν λαβές ύψους γραμμής (και πότε θα υπάρξουν)
 * Δεν είναι παράλειψη — είναι φράγμα απόδοσης. Ο αριθμός των λαβών **δεν επιτρέπεται** να
 * είναι ανάλογος των δεδομένων: ένας πίνακας 500 γραμμών θα παρήγαγε 500 λαβές, που
 * ζωγραφίζονται **και** ελέγχονται για hit **σε κάθε καρέ** — το ίδιο σχήμα «δουλειά
 * ανάλογη του μεγέθους, όχι της ανάγκης» που ο ADR-735 πλήρωσε σε παραγωγή. Οι στήλες
 * είναι δομικά λίγες (μονοψήφιες)· οι γραμμές δεν είναι.
 *
 * Το ύψος γραμμής αλλάζει από τον επεξεργαστή κελιού της **Φ.Δ** (όπου υπάρχει επιλεγμένη
 * γραμμή, άρα **μία** λαβή τη φορά) — ίδιο μοτίβο με το Excel/Figma, που δείχνουν λαβή
 * ορίου μόνο στη γραμμή κάτω από τον δείκτη.
 *
 * @module subapps/dxf-viewer/bim/table/table-entity-grips
 * @see bim/opening-info-tag/opening-info-tag-grips.ts — το πρότυπο αδελφού
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import type { TableGripKind } from '../../hooks/grip-kinds-primitives';
import type { TableEntity } from '../../types/table-entity';
import { MIN_TABLE_COLUMN_WIDTH_MM } from '../../types/table-entity';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
  tableWorldToFrame,
} from './table-entity-geometry';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { rotateEntityGripDrag } from '../grips/grip-math';

export const TABLE_MOVE_KIND: TableGripKind = 'table-move';
export const TABLE_ROTATION_KIND: TableGripKind = 'table-rotation';
export const TABLE_COLUMN_KIND: TableGripKind = 'table-column-edge';

/**
 * Οι λαβές ενός πίνακα. Οι λαβές στηλών μπαίνουν **μόνο** στα εσωτερικά όρια: το
 * αριστερό όριο είναι η άγκυρα (την κινεί το MOVE) και το δεξί είναι το πέρας του
 * πίνακα, το οποίο **προκύπτει** από τα πλάτη — δεν είναι ανεξάρτητος βαθμός ελευθερίας.
 */
export function getTableGrips(entity: TableEntity): GripInfo[] {
  const { layout, mmToWorld } = computeTableEntityGeometryLive(entity);

  const grips: GripInfo[] = [
    {
      entityId: entity.id,
      gripIndex: 0,
      type: 'center',
      position: entity.position,
      movesEntity: true,
      gripKind: { on: 'table', kind: TABLE_MOVE_KIND },
    },
  ];
  if (layout.columns.length === 0 || layout.rows.length === 0) return grips;

  grips.push({
    entityId: entity.id,
    gripIndex: 1,
    type: 'vertex',
    position: tableFrameToWorld(entity, layout.widthMm / 2, 0, mmToWorld),
    movesEntity: false,
    gripKind: { on: 'table', kind: TABLE_ROTATION_KIND },
  });

  // Εσωτερικά όρια = οι αριστερές ακμές των στηλών 1..N-1 (η στήλη 0 ξεκινά στην άγκυρα).
  for (let c = 1; c < layout.columns.length; c++) {
    grips.push({
      entityId: entity.id,
      gripIndex: 1 + c,
      type: 'vertex',
      position: tableFrameToWorld(entity, layout.columns[c].xMm, 0, mmToWorld),
      movesEntity: false,
      gripKind: { on: 'table', kind: TABLE_COLUMN_KIND },
    });
  }

  return grips;
}

/**
 * Το καθαρό μετασχηματιστικό σύρσιμο — το ΙΔΙΟ που τρέχουν το commit και το ζωντανό
 * φάντασμα, ώστε «προεπισκόπηση ≡ commit» κατά ταυτότητα.
 *
 *  - `move`        → μεταφορά της άγκυρας.
 *  - `rotation`    → κοινό swept-angle SSoT με scale-bar / opening-info-tag: τροχιά γύρω
 *                    από επιλεγμένο κέντρο όταν υπάρχει, αλλιώς στροφή περί την άγκυρα.
 *  - `column-edge` → η στήλη **αριστερά** του ορίου παίρνει νέο ρητό πλάτος (`fixed`).
 *
 * Η υπογραφή είναι **ακριβώς** αυτή που περιμένει το `commitParametricAnnotationGripDrag`
 * (το κοινό SSoT των παραμετρικών σημειώσεων) — μηδέν νέος μηχανισμός commit.
 */
export function applyTableGripDrag(
  kind: TableGripKind,
  entity: TableEntity,
  gripWorldPos: Point2D,
  delta: Point2D,
  rotate?: { readonly pivot: Point2D; readonly anchor: Point2D },
): Partial<TableEntity> {
  switch (kind) {
    case 'table-move':
      return { position: translatePoint(entity.position, delta) };
    case 'table-rotation':
      return rotateEntityGripDrag(entity, gripWorldPos, delta, rotate);
    case 'table-column-edge':
      return resizeColumnAtEdge(entity, gripWorldPos, delta);
  }
}

/**
 * Νέο πλάτος για τη στήλη αριστερά του συρόμενου ορίου.
 *
 * **Ποιο** όριο σύρθηκε το λέει η ίδια η θέση της λαβής, όχι ένας δείκτης: η `gripWorldPos`
 * προβάλλεται στο πλαίσιο και ταιριάζεται με το πλησιέστερο όριο στήλης — το ίδιο τέχνασμα
 * που κάνουν οι 4 γωνιακές λαβές του `opening-info-tag`, που επίσης μοιράζονται ένα kind.
 * Έτσι η υπογραφή μένει ίδια με των αδελφών και δεν χρειάζεται δικό της commit path.
 *
 * Οι στήλες **δεξιά** μένουν άθικτες: το όριό τους ολισθαίνει μαζί, όπως στο Excel και
 * στο AutoCAD. Εναλλακτικά θα έπρεπε να «κλέψουμε» πλάτος από τη διπλανή, που κάνει το
 * σύρσιμο δύο αλλαγές αντί για μία και δεν αντιστρέφεται καθαρά με undo.
 */
function resizeColumnAtEdge(
  entity: TableEntity,
  gripWorldPos: Point2D,
  delta: Point2D,
): Partial<TableEntity> {
  const { layout, mmToWorld } = computeTableEntityGeometryLive(entity);
  const leftIndex = grabbedColumnEdgeIndex(entity, layout.columns, gripWorldPos, mmToWorld) - 1;
  if (leftIndex < 0 || leftIndex >= layout.columns.length) return {};

  const newEdge = tableWorldToFrame(entity, translatePoint(gripWorldPos, delta), mmToWorld);
  const model = resizeTableColumnLeftOfEdge(entity, leftIndex + 1, newEdge.u);
  return model ? { model } : {};
}

/**
 * 🔴 ADR-739 §31.9 — **Η ΜΙΑ αριθμητική του «νέο πλάτος στήλης»**, από δείκτη ορίου + θέση `u`.
 *
 * Εξήχθη από το {@link resizeColumnAtEdge} τη στιγμή που απέκτησε **δεύτερο** καταναλωτή: τη
 * σύρση του διαχωριστικού **μέσα στη λωρίδα**, που δεν περνά από λαβή και άρα δεν έχει ούτε
 * `gripWorldPos` ούτε `delta`. Δύο αντίγραφα θα ήταν sibling clone του N.18 — και θα απέκλιναν
 * ακριβώς εκεί που πονάει: στο **ελάχιστο πλάτος** και στο ποια στήλη «κρατά» το όριο.
 *
 * `edgeIndex` = ο δείκτης του **εσωτερικού ορίου** (1..N-1), δηλαδή η στήλη που ξεκινά εκεί·
 * το πλάτος αλλάζει στη στήλη **αριστερά** του (`edgeIndex - 1`). Οι στήλες δεξιά ολισθαίνουν
 * μαζί — δες την κεφαλίδα από πάνω για το γιατί δεν «κλέβουμε» πλάτος από τη διπλανή.
 *
 * `null` όταν ο δείκτης είναι εκτός εύρους: ο καλών δεν εφευρίσκει τίποτα.
 */
export function resizeTableColumnLeftOfEdge(
  entity: TableEntity,
  edgeIndex: number,
  newEdgeUMm: number,
): TableEntity['model'] | null {
  const { layout } = computeTableEntityGeometryLive(entity);
  const leftIndex = edgeIndex - 1;
  if (leftIndex < 0 || leftIndex >= layout.columns.length) return null;

  const widthMm = Math.max(newEdgeUMm - layout.columns[leftIndex].xMm, MIN_TABLE_COLUMN_WIDTH_MM);
  const columnId = layout.columns[leftIndex].id;
  const columns = entity.model.columns.map((col) =>
    col.id === columnId ? { ...col, sizing: { kind: 'fixed' as const, widthMm } } : col,
  );
  // Το `model` του entity είναι απλό JSON (Φ.Δ Λύση Α) — το `columns` όμως είναι πίνακας
  // και στα δύο σχήματα, άρα το spread μένει ακριβώς όπως ήταν. Νέο αντικείμενο ⇒ οι δύο
  // απομνημονεύσεις ακυρώνονται από μόνες τους σε σειρά (`resolveTableModel` →
  // `resolveTableLayout`): η ταυτότητα ΕΙΝΑΙ η έκδοση.
  return { ...entity.model, columns };
}

/**
 * Ο δείκτης του ορίου στηλών που αντιστοιχεί στη γραμμένη θέση λαβής (πλησιέστερο `xMm`).
 * Επιστρέφει `0` όταν δεν υπάρχουν στήλες — ο καλών το απορρίπτει ως εκτός εύρους.
 */
function grabbedColumnEdgeIndex(
  entity: TableEntity,
  columns: readonly { readonly xMm: number }[],
  gripWorldPos: Point2D,
  mmToWorld: number,
): number {
  const { u } = tableWorldToFrame(entity, gripWorldPos, mmToWorld);
  let best = 0;
  let bestDistance = Infinity;
  for (let c = 1; c < columns.length; c++) {
    const distance = Math.abs(columns[c].xMm - u);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = c;
    }
  }
  return best;
}
