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
 *   10 .. 10+N-2  → COLUMN    @ τα εσωτερικά όρια στηλών, πάνω στην ΠΑΝΩ ακμή
 *   μετά          → ROW       @ τα εσωτερικά όρια γραμμών, πάνω στην ΑΡΙΣΤΕΡΗ ακμή
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
 * ## Λαβές ύψους ΑΝΑ γραμμή — υπάρχουν από 2026-08-04, **με φράγμα**
 * Ο Giorgio τις ζήτησε ρητά («όπως υπάρχουν αντίστοιχα λαβές που ρυθμίζουν το πλάτος των
 * στηλών»). Μέχρι τότε αυτό το σχόλιο τις **απαγόρευε**, και ο λόγος ήταν σωστός: ο αριθμός
 * των λαβών δεν επιτρέπεται να είναι ανάλογος των δεδομένων — πίνακας 500 γραμμών θα
 * παρήγαγε 500 λαβές, που ζωγραφίζονται **και** ελέγχονται για hit **σε κάθε καρέ** (το ίδιο
 * σχήμα «δουλειά ανάλογη του μεγέθους, όχι της ανάγκης» που ο ADR-735 πλήρωσε σε παραγωγή).
 *
 * 🔑 Η λύση δεν ήταν να διαλέξουμε ανάμεσα στα δύο: το φράγμα **δεν ήταν ποτέ για τις
 * γραμμές** — ήταν για το **πλήθος**. Και το ίδιο επιχείρημα ίσχυε ήδη, ασυζήτητα, για τις
 * στήλες: το `MAX_TABLE_COLUMN_COUNT` είναι **256**, οπότε η αιτιολόγηση «οι στήλες είναι
 * δομικά λίγες» ήταν εμπειρική παρατήρηση που περνούσε για εγγύηση. Τώρα υπάρχει ένα
 * {@link MAX_AXIS_EDGE_GRIPS} και ισχύει **και στους δύο** άξονες: πάνω από αυτό, οι λαβές
 * του άξονα παραλείπονται συνολικά (ποτέ μερικώς — μισές λαβές είναι χειρότερες από καμία,
 * γιατί ο χρήστης δεν μπορεί να μαντέψει ποιες λείπουν).
 *
 * Οι 8 περιμετρικές λαβές **δεν** μπαίνουν ποτέ στο φράγμα: είναι σταθερές σε πλήθος και
 * κλιμακώνουν **όλα** τα ύψη αναλογικά — δηλαδή σε τεράστιο πίνακα μένουν η διαθέσιμη
 * χειρονομία, μαζί με τα μενού ζωνών του §27.
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
  MIN_TABLE_ROW_HEIGHT_MM,
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
import {
  GRIP_TABLE_COLUMN_EDGE_COLOR,
  GRIP_TABLE_ROW_EDGE_COLOR,
} from '../../config/color-config';

export const TABLE_MOVE_KIND: TableGripKind = 'table-move';
export const TABLE_ROTATION_KIND: TableGripKind = 'table-rotation';
export const TABLE_COLUMN_KIND: TableGripKind = 'table-column-edge';
export const TABLE_ROW_KIND: TableGripKind = 'table-row-edge';

/**
 * 🔴 **Το φράγμα πλήθους**, κοινό και στους δύο άξονες (βλ. κεφαλίδα module).
 *
 * Το `64` δεν είναι στρογγυλός αριθμός για την ομορφιά του: είναι το σημείο όπου η **ίδια η
 * λαβή** παύει να είναι χρήσιμη πριν καν μετρήσει η απόδοση. Με 64 όρια πάνω στην ίδια ακμή,
 * δύο γειτονικές λαβές απέχουν λιγότερο από το μέγεθος ζωγραφίσματος της λαβής σε τυπικό
 * zoom — δηλαδή ο χρήστης βλέπει μια συμπαγή γραμμή από τετραγωνάκια και δεν μπορεί να
 * στοχεύσει καμία. Πάνω από εκεί, η σωστή χειρονομία είναι το **μενού ζώνης** (§27) και οι
 * 8 περιμετρικές, όχι μια λαβή που δεν πιάνεται.
 *
 * ⚠️ Ισχύει **ανά άξονα και συνολικά**: πίνακας με 3 στήλες και 900 γραμμές κρατά τις λαβές
 * στηλών του και χάνει μόνο τις λαβές γραμμών.
 */
export const MAX_AXIS_EDGE_GRIPS = 64;

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
  if (kind === TABLE_COLUMN_KIND) return GRIP_TABLE_COLUMN_EDGE_COLOR;
  // Ίδιο χρώμα, γιατί είναι η ίδια **εμβέλεια** (ένα κελί-πλάτος, όχι όλος ο πίνακας) — τον
  // άξονα τον λένε ήδη η θέση και ο δείκτης. Βλ. `GRIP_TABLE_ROW_EDGE_COLOR`.
  if (kind === TABLE_ROW_KIND) return GRIP_TABLE_ROW_EDGE_COLOR;
  return undefined;
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
  if (layout.columns.length - 1 <= MAX_AXIS_EDGE_GRIPS) {
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
  }

  // Και συμμετρικά για τις γραμμές, πάνω στην **αριστερή** ακμή (`u = 0`) — εκεί όπου ο
  // χρήστης ήδη πηγαίνει το χέρι του για τη ζώνη αριθμών, όπως στο Excel.
  //
  // ⚠️ Ο δείκτης ξεκινά μετά τις λαβές στηλών **που όντως μπήκαν** (`grips.length`), όχι από
  // υπολογισμένο άθροισμα: με φράγμα ενεργό στον έναν άξονα, ένα σταθερό offset θα άφηνε
  // τρύπα στους δείκτες — και ο δείκτης λαβής είναι το κλειδί με το οποίο ο engine ταιριάζει
  // ζωγραφισμένη λαβή με πιασμένη λαβή.
  if (layout.rows.length - 1 <= MAX_AXIS_EDGE_GRIPS) {
    const firstRowGripIndex = grips.length;
    for (let r = 1; r < layout.rows.length; r++) {
      grips.push({
        entityId: entity.id,
        gripIndex: firstRowGripIndex + r - 1,
        type: 'vertex',
        position: tableFrameToWorld(entity, 0, layout.rows[r].yMm, mmToWorld),
        movesEntity: false,
        gripKind: { on: 'table', kind: TABLE_ROW_KIND },
      });
    }
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
 *  - `row-edge`    → η γραμμή **πάνω** από το όριο παίρνει νέο ρητό ύψος. Ακριβώς κατοπτρικό:
 *                    η ίδια σύμβαση «η μονάδα πριν το όριο κρατά την αλλαγή, οι επόμενες
 *                    ολισθαίνουν» που εφαρμόζουν Excel και AutoCAD και στους δύο άξονες.
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
    case 'table-row-edge':
      return resizeRowAtEdge(entity, gripWorldPos, delta);
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
 * Νέο ύψος για τη γραμμή **πάνω** από το συρόμενο όριο — το κάτοπτρο του
 * {@link resizeColumnAtEdge}, με τον άξονα `v` στη θέση του `u`.
 *
 * ⚠️ Δεν είναι αντιγραφή του αδελφού του (N.18): οι δύο συναρτήσεις μοιράζονται **σχήμα**, όχι
 * σώμα — διαφορετικός άξονας πλαισίου, διαφορετικό πεδίο μοντέλου (`sizing.widthMm` vs
 * `heightMm`), διαφορετικό ελάχιστο. Ό,τι ήταν πράγματι κοινό — «ποιο όριο πιάστηκε;» — ζει
 * σε **μία** γενικευμένη {@link nearestEdgeIndex}.
 */
function resizeRowAtEdge(
  entity: TableEntity,
  gripWorldPos: Point2D,
  delta: Point2D,
): Partial<TableEntity> {
  const { layout, mmToWorld } = computeTableEntityGeometryLive(entity);
  const { v } = tableWorldToFrame(entity, gripWorldPos, mmToWorld);
  const edgeIndex = nearestEdgeIndex(layout.rows.map((row) => row.yMm), v);
  if (edgeIndex <= 0) return {};

  const newEdge = tableWorldToFrame(entity, translatePoint(gripWorldPos, delta), mmToWorld);
  const model = resizeTableRowAboveEdge(entity, edgeIndex, newEdge.v);
  return model ? { model } : {};
}

/**
 * 🔴 **Η ΜΙΑ αριθμητική του «νέο ύψος γραμμής»** — αδελφή της {@link resizeTableColumnLeftOfEdge}.
 *
 * Εξάγεται από την πρώτη στιγμή, όχι όταν εμφανιστεί δεύτερος καταναλωτής: ο αδελφός της
 * χρειάστηκε ακριβώς αυτή την εξαγωγή όταν ήρθε η σύρση του διαχωριστικού (§31.9), και η
 * σύρση της **ζώνης αριθμών** είναι το προφανές επόμενο βήμα του ίδιου σχήματος. Ένα
 * ιδιωτικό σώμα εδώ θα ξαναγραφόταν εκεί — δηλαδή sibling clone με αποκλίνον ελάχιστο ύψος.
 *
 * `edgeIndex` = ο δείκτης του **εσωτερικού ορίου** (1..N-1), δηλαδή η γραμμή που ξεκινά εκεί·
 * το ύψος αλλάζει στη γραμμή **από πάνω** (`edgeIndex - 1`). `null` εκτός εύρους.
 */
export function resizeTableRowAboveEdge(
  entity: TableEntity,
  edgeIndex: number,
  newEdgeVMm: number,
): TableEntity['model'] | null {
  const { layout } = computeTableEntityGeometryLive(entity);
  const aboveIndex = edgeIndex - 1;
  if (aboveIndex < 0 || aboveIndex >= layout.rows.length) return null;

  const heightMm = Math.max(newEdgeVMm - layout.rows[aboveIndex].yMm, MIN_TABLE_ROW_HEIGHT_MM);
  const rowId = layout.rows[aboveIndex].id;
  const rows = entity.model.rows.map((row) =>
    row.id === rowId ? { ...row, heightMm } : row,
  );
  // Νέο αντικείμενο ⇒ οι δύο απομνημονεύσεις ακυρώνονται σε σειρά (`resolveTableModel` →
  // `resolveTableLayout`): η ταυτότητα ΕΙΝΑΙ η έκδοση. Ίδια σύμβαση με τις στήλες.
  return { ...entity.model, rows };
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
  return nearestEdgeIndex(columns.map((column) => column.xMm), u);
}

/**
 * «Ποιο **εσωτερικό** όριο είναι πιο κοντά στη θέση `along`;» — ένας άξονας, καμία γνώση
 * γεωμετρίας πίνακα.
 *
 * Ήταν το σώμα του {@link grabbedColumnEdgeIndex}· γενικεύτηκε μόλις οι γραμμές απέκτησαν
 * λαβές, γιατί αυτό ακριβώς ήταν το **κοινό** κομμάτι των δύο αξόνων (N.18: γενίκευση, όχι
 * κλώνος). Το `0` δεν είναι έγκυρο όριο — είναι η άγκυρα — και επιστρέφεται ως «τίποτα δεν
 * βρέθηκε», όπως το διάβαζε ήδη ο καλών.
 */
function nearestEdgeIndex(starts: readonly number[], along: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 1; i < starts.length; i++) {
    const distance = Math.abs(starts[i] - along);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}
