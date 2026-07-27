/**
 * topo-surface-grips — ADR-662 §13 · οι λαβές της τοπογραφικής επιφάνειας.
 *
 * **ΑΛΛΑΓΗ ΣΥΜΒΟΛΑΙΟΥ (Giorgio 2026-07-27), όχι διόρθωση bug.** Μέχρι σήμερα η επιφάνεια
 * ήταν ρητά grip-less («derived → η επεξεργασία γίνεται από το topography subsystem»), και
 * αυτό ήταν καρφωμένο σε test. Η απόφαση άλλαξε μετά από έρευνα στους μεγάλους:
 *
 *   - **Civil 3D**: το εμφανιζόμενο «Surface Border» **δεν** έχει λαβές· επεξεργάζεσαι τον
 *     ορισμό (Add Boundary / Extract Objects → πολυγραμμή → rebuild).
 *   - **Revit Toposolid**: στην απλή επιλογή καμία λαβή σχήματος· `Modify Sub Elements` →
 *     οι κορυφές γίνονται ζωντανές και επεξεργάζονται τα **σημεία**, όχι το παράγωγο.
 *   - **ArchiCAD Mesh**: hotspots σε κάθε κόμβο — αλλά εκεί το όριο είναι **ιδιόκτητο**
 *     (ο χρήστης το σχεδίασε), άρα άλλο μοντέλο δεδομένων· δεν μεταφέρεται.
 *
 * Κανείς δεν δίνει draggable λαβές σε **παραγόμενο** όριο, γιατί κανείς δεν κρατά τον δρόμο
 * της επιστροφής προς την πηγή. **Εμείς τον κρατάμε** (`topo-survey-point-resolve`), οπότε
 * παίρνουμε το μοντέλο της Revit **χωρίς** το mode: η λαβή είναι εκεί που κλικάρει ο
 * χρήστης, και σέρνοντάς την μετακινείται το **survey point** — η αλλαγή επιβιώνει της
 * επόμενης αναδημιουργίας, γιατί έγινε στην πηγή.
 *
 * ⚠️ **ΚΑΜΙΑ ΛΑΒΗ ΠΟΥ ΔΕΝ ΚΑΝΕΙ ΤΙΠΟΤΑ (το μάθημα ADR-654).** Παράγεται λαβή **μόνο** σε
 * κορυφές που αντιστοιχούν σε survey point. Κορυφή που ήρθε από **γραμμή ασυνέχειας** δεν
 * παίρνει λαβή — δεν έχει πού να γράψει, και μια λαβή που φαίνεται αλλά δεν μετακινεί τίποτα
 * είναι ακριβώς το bug που πλήρωσε η `image`.
 *
 * ⚠️ **ΚΑΜΙΑ λαβή μέσου ακμής** (σε αντίθεση με τη γραμμοσκίαση). Στη γραμμοσκίαση σημαίνει
 * «πρόσθεσε κορυφή στο όριο» — καθαρά 2D. Εδώ θα σήμαινε «πρόσθεσε survey point», που
 * απαιτεί **υψόμετρο**: θα το επινοούσαμε με παρεμβολή και θα το παρουσιάζαμε ως μετρημένο.
 * Ένα πλαστό μετρημένο υψόμετρο σε τοπογραφικό δεν είναι διευκόλυνση, είναι σφάλμα. Η
 * Revit το κρατά κι αυτή ξεχωριστά (`Add Point`).
 *
 * ⚠️ Η λαβή είναι **planimetric** (XY). Το υψόμετρο δεν αγγίζεται ποτέ από την κάτοψη — για
 * αυτό υπάρχει το topography panel. Σέρνοντας δηλώνεις «το σημείο μετρήθηκε εκεί», όχι
 * «άλλαξε το έδαφος».
 *
 * @see ./topo-survey-point-resolve — «ποια κορυφή είναι ποιο σημείο» + τα δύο frames
 * @see ../grip/closed-ring-grips — «πού κάθονται οι λαβές» (κοινό με τη γραμμοσκίαση)
 * @see ../../snapping/shared/entity-closed-rings — «ποια rings» (κοινό με τη γραμμοσκίαση)
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { TopoSurfaceEntity } from '../../types/topo-surface';
import { entityClosedRings } from '../../snapping/shared/entity-closed-rings';
import { closedRingVertexGrips } from '../grip/closed-ring-grips';
import { resolveSurveyPointIndexAt } from './topo-survey-point-resolve';

const VERTEX_PREFIX = 'topo-vertex-';

/**
 * Grip kind της τοπογραφικής επιφάνειας: `topo-vertex-${ringIdx}-${vertexIdx}` — δείκτες
 * **μέσα στο `footprint`**, ώστε το kind να διαβάζεται χωρίς να κουβαλά συντεταγμένες.
 *
 * Ο δείκτης του **survey point** σκόπιμα ΔΕΝ μπαίνει στο kind: το ίδιο footprint μπορεί να
 * ξαναχτιστεί ενόσω η λαβή είναι οπλισμένη, και ένας παγωμένος δείκτης σημείου θα έδειχνε
 * σε λάθος μέτρηση. Η αντιστοίχιση γίνεται **στο commit**, από τις συντεταγμένες.
 */
export type TopoSurfaceGripKind = `${typeof VERTEX_PREFIX}${number}-${number}`;

/** Το grip kind για την κορυφή `vertexIdx` του ring `ringIdx`. */
export function topoVertexGripKind(ringIdx: number, vertexIdx: number): TopoSurfaceGripKind {
  return `${VERTEX_PREFIX}${ringIdx}-${vertexIdx}`;
}

/** Αποκωδικοποίηση `topo-vertex-${ringIdx}-${vertexIdx}` → `[ringIdx, vertexIdx]` ή `null`. */
export function decodeTopoVertexGripKind(
  gripKind: TopoSurfaceGripKind,
): [number, number] | null {
  if (!gripKind.startsWith(VERTEX_PREFIX)) return null;
  const parts = gripKind.slice(VERTEX_PREFIX.length).split('-');
  if (parts.length !== 2) return null;
  const ringIdx = parseInt(parts[0], 10);
  const vertexIdx = parseInt(parts[1], 10);
  if (!Number.isFinite(ringIdx) || !Number.isFinite(vertexIdx)) return null;
  if (ringIdx < 0 || vertexIdx < 0) return null;
  return [ringIdx, vertexIdx];
}

/** Μία λαβή επιφάνειας: πού κάθεται, σε ποια κορυφή, και ποιο σημείο επεξεργάζεται. */
export interface TopoSurfaceVertexGrip {
  readonly ringIdx: number;
  readonly vertexIdx: number;
  /** Θέση στο **DISPLAY** frame — ό,τι πλαίσιο έχει το `footprint`. */
  readonly point: Point2D;
  /** Ο δείκτης του survey point που θα γραφτεί· η λαβή δεν παράγεται χωρίς αυτόν. */
  readonly pointIndex: number;
}

/**
 * **Η ΜΙΑ** πηγή για «πού είναι οι λαβές αυτής της επιφάνειας». Τη διαβάζουν **και** ο
 * ορατός renderer (`TopoSurfaceRenderer.getGrips`) **και** το interaction registry
 * (`computeDxfEntityGrips`), οπότε «ορατό» και «πιάσιμο» δεν μπορούν να αποκλίνουν — το
 * ίδιο συμβόλαιο που κρατά η γραμμοσκίαση (ADR-507 §grip-SSoT).
 *
 * Το φιλτράρισμα των μη-επιλύσιμων κορυφών (breakline) γίνεται **εδώ**, μία φορά: αν
 * φιλτράριζε ο ένας καταναλωτής και όχι ο άλλος, οι δείκτες θα ξέφευγαν και θα έσερνες
 * άλλη κορυφή από αυτή που έπιασες.
 */
export function topoSurfaceVertexGrips(entity: TopoSurfaceEntity): TopoSurfaceVertexGrip[] {
  const grips: TopoSurfaceVertexGrip[] = [];
  for (const g of closedRingVertexGrips(entityClosedRings(entity))) {
    const pointIndex = resolveSurveyPointIndexAt(entity.surfaceId, g.point);
    if (pointIndex === null) continue;
    grips.push({ ringIdx: g.ringIdx, vertexIdx: g.vertexIdx, point: g.point, pointIndex });
  }
  return grips;
}

/** Ο τύπος-φύλακας ως `Entity` overload, ώστε οι καταναλωτές να μη ξαναγράφουν το cast. */
export function topoSurfaceGripsOf(entity: Entity): TopoSurfaceVertexGrip[] {
  return entity.type === 'topo-surface'
    ? topoSurfaceVertexGrips(entity as TopoSurfaceEntity)
    : [];
}

/**
 * Καθαρός μετασχηματισμός **ΜΟΝΟ ΓΙΑ ΤΟ PREVIEW**: το footprint με τη μία κορυφή
 * μετατοπισμένη κατά `delta` (DISPLAY frame).
 *
 * ⚠️ Αυτό **δεν** είναι το commit. Το μόνιμο αποτέλεσμα γράφεται στο survey point και το
 * footprint **ξαναπαράγεται** από την TIN — και μπορεί κάλλιστα να βγει διαφορετικό από
 * αυτό το preview (η επανατριγωνοποίηση αλλάζει το κυρτό περίβλημα). Το preview δείχνει
 * «πού πάει η λαβή», όχι «πώς θα καταλήξει η επιφάνεια»· η αλήθεια έρχεται με το commit.
 *
 * Επιστρέφει τον **ΑΡΧΙΚΟ** πίνακα σε εκτός-ορίων δείκτη ή μηδενικό delta (σήμα no-op).
 */
export function applyTopoSurfaceGripDrag(
  gripKind: TopoSurfaceGripKind,
  footprint: ReadonlyArray<ReadonlyArray<Point2D>>,
  delta: Point2D,
): Point2D[][] {
  const decoded = decodeTopoVertexGripKind(gripKind);
  if (!decoded) return footprint as Point2D[][];
  const [ringIdx, vertexIdx] = decoded;
  if (ringIdx >= footprint.length) return footprint as Point2D[][];
  if (vertexIdx >= footprint[ringIdx].length) return footprint as Point2D[][];
  if (delta.x === 0 && delta.y === 0) return footprint as Point2D[][];

  return footprint.map((ring, r) =>
    ring.map((v, i) =>
      r === ringIdx && i === vertexIdx ? { x: v.x + delta.x, y: v.y + delta.y } : { x: v.x, y: v.y },
    ),
  );
}
