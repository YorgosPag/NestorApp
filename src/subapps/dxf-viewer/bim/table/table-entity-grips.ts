/**
 * ADR-739 Φάση Γ — **οι λαβές του πίνακα** (SSoT· η ίδια πηγή για ζωγραφική και χειρισμό).
 *
 * Πέντε είδη, όλα τοποθετημένα από την **παράγωγη** γεωμετρία (ποτέ από ωμές παραμέτρους),
 * ώστε οι λαβές να ακολουθούν πάντα τον πίνακα που πραγματικά ζωγραφίστηκε:
 *
 * ```
 *   0             → MOVE      @ λίγο μέσα από την ΠΑΝΩ-ΑΡΙΣΤΕΡΗ γωνία, πάνω στην ακμή
 *   1             → ROTATION  @ λίγο μέσα από την ΠΑΝΩ-ΔΕΞΙΑ γωνία, πάνω στην ακμή
 *   2 .. 5        → CORNER    @ οι 4 γωνίες (ne=ΠΔ, nw=ΠΑ/άγκυρα, sw=ΚΑ, se=ΚΔ)
 *   6 .. 9        → EDGE      @ τα 4 μέσα ακμών (n, e, s, w)
 *   10 .. 10+N-1  → COLUMN    @ τα εσωτερικά όρια στηλών, πάνω στην ΠΑΝΩ ακμή
 * ```
 *
 * ## 🔴 Γιατί το MOVE και το ROTATION μετακινήθηκαν
 * Μέχρι τις 03/08 κάθονταν στην **άγκυρα** και στο **μέσο της πάνω ακμής** — ακριβώς εκεί
 * όπου κάθονται πλέον οι `table-corner-nw` και `table-edge-n`, οπότε έπρεπε να φύγουν.
 *
 * Οι νέες θέσεις είναι **σταθερή εσοχή από τις δύο πάνω γωνίες** (Giorgio: «λίγα πίξελς
 * δεξιά από την αριστερή λαβή / λίγα πίξελς αριστερά από την πάνω-δεξιά»), όχι κλάσματα του
 * πλάτους — και αυτό **λύνει** τη σύμπτωση με τις λαβές ορίων στηλών, που ακολουθούν τα
 * δεδομένα: με 4 ισοπλατείς στήλες (όρια στο 25/50/75%) κανένα δεν πέφτει πάνω τους.
 *
 * ⚠️ Το `v` μένει **0** και δεν είναι στιλιστικό: λωρίδα έξω από την ακμή (`v < 0`) είναι
 * **δομικά αδύνατη** — εκεί ζει η ζώνη γραμμάτων του §27.11, με πάχος σε **px**, οπότε καμία
 * σταθερή απόσταση σε **mm** δεν μένει έξω της σε κάθε zoom. Βλ. `tableHandleInsetMm`.
 *
 * ## Γιατί ΔΕΝ υπάρχουν λαβές ύψους ΑΝΑ γραμμή (και πότε θα υπάρξουν)
 * Δεν είναι παράλειψη — είναι φράγμα απόδοσης. Ο αριθμός των λαβών **δεν επιτρέπεται** να
 * είναι ανάλογος των δεδομένων: ένας πίνακας 500 γραμμών θα παρήγαγε 500 λαβές, που
 * ζωγραφίζονται **και** ελέγχονται για hit **σε κάθε καρέ** — το ίδιο σχήμα «δουλειά
 * ανάλογη του μεγέθους, όχι της ανάγκης» που ο ADR-735 πλήρωσε σε παραγωγή. Οι στήλες
 * είναι δομικά λίγες (μονοψήφιες)· οι γραμμές δεν είναι.
 *
 * Οι 8 περιμετρικές λαβές **δεν** παραβιάζουν τον κανόνα: είναι σταθερές σε πλήθος και
 * κλιμακώνουν **όλα** τα ύψη αναλογικά. Το ύψος **μιας** γραμμής εξακολουθεί να αλλάζει από
 * τον επεξεργαστή κελιού της **Φ.Δ** (όπου υπάρχει επιλεγμένη γραμμή, άρα **μία** λαβή τη
 * φορά) — ίδιο μοτίβο με το Excel/Figma, που δείχνουν λαβή ορίου μόνο στη γραμμή κάτω από
 * τον δείκτη.
 *
 * @module subapps/dxf-viewer/bim/table/table-entity-grips
 * @see bim/table/table-box-grips.ts — η μηχανή των 8 περιμετρικών λαβών
 * @see bim/opening-info-tag/opening-info-tag-grips.ts — το πρότυπο αδελφού
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo } from '../../hooks/grip-types';
import type { TableGripKind } from '../../hooks/grip-kinds-primitives';
import type { TableEntity } from '../../types/table-entity';
import {
  MIN_TABLE_COLUMN_WIDTH_MM,
  tableHandleInsetMm,
} from '../../types/table-entity';
import {
  computeTableEntityGeometryLive,
  tableFrameToWorld,
  tableWorldToFrame,
} from './table-entity-geometry';
import {
  applyTableBoxDrag,
  isTableBoxGripKind,
  tableBoxGripPosition,
  tableRectFrame,
  TABLE_BOX_KIND_ORDER,
} from './table-box-grips';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { rotateEntityGripDrag } from '../grips/grip-math';
import { GRIP_TABLE_COLUMN_EDGE_COLOR } from '../../config/color-config';

export const TABLE_MOVE_KIND: TableGripKind = 'table-move';
export const TABLE_ROTATION_KIND: TableGripKind = 'table-rotation';
export const TABLE_COLUMN_KIND: TableGripKind = 'table-column-edge';

/**
 * Η **ταυτότητα χρώματος** μιας λαβής πίνακα — `undefined` για όσες μένουν στο κανάλι
 * κατάστασης (σιέλ σε ηρεμία, ροζ σε hover, κόκκινο στο σύρσιμο).
 *
 * Giorgio 2026-08-03: «ξεχώρισε το χρώμα των λαβών που αλλάζουν το πλάτος των στηλών».
 * Είναι οι μόνες από τις έντεκα που κάνουν κάτι **τοπικό** — μία στήλη· όλες οι άλλες
 * μετακινούν, στρέφουν ή κλιμακώνουν τον πίνακα **συνολικά**. Και μοιράζονται την ίδια
 * ακμή, οπότε χωρίς διάκριση διαβάζονται ως ένα αδιαφοροποίητο πλήθος.
 *
 * ## Γιατί εδώ και όχι μέσα στον ζωγράφο
 * «Τι χρώμα έχει αυτή η λαβή» είναι ιδιότητα **της λαβής**. Στον `TableRenderer` θα ήταν
 * μια απόφαση που ο επόμενος καταναλωτής (προεπισκόπηση, μελλοντικό overlay) θα έπρεπε να
 * ξαναπάρει — δηλαδή θα την αντέγραφε (N.18). Εδώ είναι **μία**, καθαρή και δοκιμάσιμη
 * χωρίς καμβά.
 *
 * ⚠️ Μπαίνει ως **`customColor` ανά λαβή**, ΠΟΤΕ ως κανόνας type→χρώμα μέσα στον
 * `GripColorManager`: ο ADR-048 v2.3 τον απαγορεύει ρητά, και το ελάττωμα που τον γέννησε
 * ήταν **ακριβώς σε αυτές τις λαβές** — το κλειδί παρτίδας του `renderGripSetBatched` δεν
 * περιέχει `type`, οπότε ο αντιπρόσωπος έβαφε ολόκληρη την ομάδα. Το `customColor` **είναι**
 * στο κλειδί, άρα αυτή η διαδρομή είναι ασφαλής εξ ορισμού.
 *
 * ⚠️ Το `customColor` **νικά τη θερμοκρασία**, άρα αυτές οι λαβές δεν ροζίζουν στο hover
 * ούτε κοκκινίζουν στο σύρσιμο (ίδια συμπεριφορά με τις φούξια λαβές πλατύσκαλου, ADR-637).
 * Το τίμημα είναι μετρημένο: **μόνο** αυτή η λαβή έχει δεύτερο κανάλι ανάδρασης — ο δείκτης
 * γίνεται `column-resize` (↔) όταν την πλησιάζεις (§31). Ο χρήστης δεν μένει χωρίς σήμα.
 */
export function tableGripCustomColor(kind: TableGripKind | undefined): string | undefined {
  return kind === TABLE_COLUMN_KIND ? GRIP_TABLE_COLUMN_EDGE_COLOR : undefined;
}

/**
 * Ο δείκτης της πρώτης λαβής **ορίου στήλης**: μετά τον σταυρό, το τόξο και τις 8
 * περιμετρικές. Παράγωγος, ώστε η προσθήκη λαβής κουτιού να μη χρειάζεται δεύτερη διόρθωση.
 */
const FIRST_COLUMN_GRIP_INDEX = 2 + TABLE_BOX_KIND_ORDER.length;

/**
 * Οι λαβές ενός πίνακα. Οι λαβές στηλών μπαίνουν **μόνο** στα εσωτερικά όρια: το
 * αριστερό όριο είναι η άγκυρα (την κινεί η γωνιακή `table-corner-nw`) και το δεξί είναι
 * το πέρας του πίνακα, το οποίο **προκύπτει** από τα πλάτη — δεν είναι ανεξάρτητος βαθμός
 * ελευθερίας.
 *
 * Άδειος πίνακας ⇒ **μόνο** ο σταυρός μετακίνησης στην άγκυρα: χωρίς στήλες/γραμμές δεν
 * υπάρχει κουτί να πιαστεί, αλλά η οντότητα πρέπει να παραμένει μετακινήσιμη.
 */
export function getTableGrips(entity: TableEntity): GripInfo[] {
  const geometry = computeTableEntityGeometryLive(entity);
  const { layout, mmToWorld } = geometry;

  if (layout.columns.length === 0 || layout.rows.length === 0) {
    return [{
      entityId: entity.id,
      gripIndex: 0,
      type: 'center',
      position: entity.position,
      movesEntity: true,
      gripKind: { on: 'table', kind: TABLE_MOVE_KIND },
    }];
  }

  // Ο σταυρός λίγο μέσα από την πάνω-ΑΡΙΣΤΕΡΗ γωνία, το τόξο λίγο μέσα από την πάνω-ΔΕΞΙΑ
  // (Giorgio 03/08), **πάνω στην ακμή** (`v = 0`) — εκεί και μόνο εκεί τα καλύπτει η οπή
  // του §27.11 που κρατά μακριά τη ζώνη γραμμάτων.
  const inset = tableHandleInsetMm(layout.widthMm);
  const grips: GripInfo[] = [
    {
      entityId: entity.id,
      gripIndex: 0,
      type: 'center',
      position: tableFrameToWorld(entity, inset, 0, mmToWorld),
      movesEntity: true,
      gripKind: { on: 'table', kind: TABLE_MOVE_KIND },
    },
    {
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: tableFrameToWorld(entity, layout.widthMm - inset, 0, mmToWorld),
      movesEntity: false,
      gripKind: { on: 'table', kind: TABLE_ROTATION_KIND },
    },
  ];

  // Οι 8 περιμετρικές, από το **ίδιο** πλαίσιο που θα δει και ο engine στο drag: η θέση που
  // ζωγραφίζεται ΕΙΝΑΙ η θέση που πιάνεται. Γωνίες = `'corner'` (δομικές, επιβιώνουν τα
  // grip-type toggles + το multi-select)· ακμές = `'midpoint'` (gated από την προτίμηση
  // «Midpoints») — εικόνα / block parity.
  const frame = tableRectFrame(entity, geometry);
  TABLE_BOX_KIND_ORDER.forEach((kind, i) => {
    grips.push({
      entityId: entity.id,
      gripIndex: 2 + i,
      type: kind.startsWith('table-corner') ? 'corner' : 'midpoint',
      position: tableBoxGripPosition(frame, kind),
      movesEntity: false,
      gripKind: { on: 'table', kind },
    });
  });

  // Εσωτερικά όρια = οι αριστερές ακμές των στηλών 1..N-1 (η στήλη 0 ξεκινά στην άγκυρα).
  for (let c = 1; c < layout.columns.length; c++) {
    grips.push({
      entityId: entity.id,
      gripIndex: FIRST_COLUMN_GRIP_INDEX + c - 1,
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
 *  - `corner-*` / `edge-*` → αναλογική κλιμάκωση όλου του πίνακα μέσω του κοινού
 *                    `rect-grip-engine` (βλ. `table-box-grips.ts`). Το `shiftHeld`
 *                    **κλειδώνει** τον λόγο πλευρών — αντίστροφα από την εικόνα, επίτηδες.
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
  shiftHeld?: boolean,
): Partial<TableEntity> {
  // Ο έλεγχος κουτιού **πριν** το switch, ώστε εκείνο να μένει **εξαντλητικό** στα τρία
  // αρχικά kinds: ένα `default` θα έσβηνε τον φύλακα του compiler για κάθε μελλοντικό kind.
  if (isTableBoxGripKind(kind)) return applyTableBoxDrag(kind, entity, delta, shiftHeld);
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
