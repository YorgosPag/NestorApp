/**
 * topo-survey-point-resolve — ADR-662 §13 · SSoT για **ΕΝΑ** ερώτημα: «αυτή η κορυφή του
 * περιγράμματος ΠΟΙΟ survey point είναι;»
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: η τοπογραφική επιφάνεια είναι **derived**. Το `footprint` του entity δεν
 * κατέχει γεωμετρία — είναι οι boundary edges της TIN, και **κάθε κορυφή του ΕΙΝΑΙ κόμβος
 * της TIN** (`positions[idx]` → `localToWorld` → projector). Άρα, σε αντίθεση με το
 * «Surface Border» του Civil 3D — που είναι ζωγραφιά χωρίς δείκτη πίσω στα δεδομένα και
 * γι' αυτό **δεν έχει λαβές** — εμείς **έχουμε** τον δρόμο της επιστροφής. Αυτό το module
 * τον διασχίζει, και είναι ο λόγος που η επιφάνεια μπορεί να αποκτήσει ζωντανές λαβές
 * (απόφαση Giorgio 2026-07-27: μοντέλο Revit «Modify Sub Elements» — η λαβή επεξεργάζεται
 * την **πηγή**, όχι το παράγωγο).
 *
 * ⚠️ **ΤΑΥΤΟΤΗΤΑ ΜΕ ΣΥΝΤΕΤΑΓΜΕΝΕΣ, ΟΧΙ ΜΕ ΔΕΙΚΤΗ.** Ο `TopoPoint` **δεν έχει id** και ο
 * `TinSurface` **δεν κρατά** back-pointer προς τα σημεία. Ο πειρασμός «το `positions[i]`
 * είναι το `points[i]`» είναι **ΛΑΘΟΣ**: ο `collectVertices` κάνει **dedup** σε πλέγμα
 * μικρομέτρου, οπότε δύο συμπίπτοντα survey points καταρρέουν σε **έναν** κόμβο και όλοι
 * οι επόμενοι δείκτες μετατοπίζονται. Η μόνη έγκυρη ταυτότητα είναι το ΙΔΙΟ κλειδί
 * πλέγματος που χρησιμοποιεί ο ίδιος ο TIN builder — γι' αυτό εδώ καλείται το **εξαγόμενο**
 * `localVertexKey`, ποτέ μια δεύτερη στρογγυλοποίηση (θα διαφωνούσαν σιωπηλά στο όριο).
 *
 * ΤΡΙΑ ΠΛΑΙΣΙΑ, ΜΗΝ ΤΑ ΜΠΕΡΔΕΨΕΙΣ (η κλασική παγίδα αυτού του υποσυστήματος):
 *   DISPLAY (η λαβή, DXF local mm) ──unproject──▶ WORLD (ΕΓΣΑ mm, ο store) ──−origin──▶ LOCAL (TIN)
 * Παράλειψη του πρώτου βήματος = η λαβή δείχνει σωστά και γράφει το σημείο σε **λάθος
 * συντεταγμένες** σε κάθε geo-referenced έργο· παράλειψη του δεύτερου = καμία αντιστοίχιση.
 *
 * ΜΝΗΜΟΝΕΥΜΕΝΟ όπως το `topo-surface`: το ευρετήριο ξαναχτίζεται **μόνο** όταν αλλάξει ο
 * ορισμός της επιφάνειας (pointer compare), ώστε η παραγωγή λαβών να μη σαρώνει χιλιάδες
 * σημεία σε κάθε επιλογή.
 *
 * @see ./tin-builder — `localVertexKey` (η SSoT ταυτότητα κόμβου) + `collectVertices`
 * @see ./topo-surface-grips — ο καταναλωτής (παραγωγή λαβών + μετασχηματισμός)
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { TopoDefinition, TopoPoint, TopoSurfaceId } from './topo-types';
import { getTopoDefinition } from './TopoPointStore';
import { getTopoSurface } from './topo-surface';
import { localVertexKey } from './tin-builder';
import { hasElevation } from './topo-point-elevation';
import { worldToLocal } from './topo-local-origin';
// ADR-650 §M10f / ADR-718 §Α — η ΕΙΣΕΡΧΟΜΕΝΗ πύλη. Ό,τι ΜΠΑΙΝΕΙ από το χαρτί περνά από εδώ·
// ποτέ ωμό `getActiveWorldToDisplayProjector().unproject(...)`, αλλιώς η κανονικοποίηση του
// identity (fast path) ξαναγράφεται ανά καλούντα και οι δύο κατευθύνσεις της γέφυρας αποκλίνουν.
import { getTopoDisplayProjector, unprojectDisplayPoint } from './topo-display-frame';

/** Ευρετήριο «κλειδί πλέγματος TIN → δείκτης survey point», για μία επιφάνεια. */
interface SurveyKeyIndex {
  readonly definition: TopoDefinition;
  readonly keyToPointIndex: ReadonlyMap<string, number>;
}

const indexes = new Map<TopoSurfaceId, SurveyKeyIndex>();

/**
 * Το ευρετήριο της επιφάνειας, ξαναχτισμένο μόνο σε αλλαγή ορισμού.
 *
 * Ο βρόχος είναι **σκόπιμα καθρέφτης** του `collectVertices` του TIN builder: ίδια σειρά
 * (τα survey points πρώτα), ίδιο κλειδί, «ο πρώτος κρατά τη θέση» σε σύμπτωση. Έτσι, όταν
 * δύο σημεία καταρρέουν σε έναν κόμβο, η λαβή επεξεργάζεται **αυτό ακριβώς** το σημείο που
 * ο TIN θεώρησε τον κόμβο — καμία απόκλιση μεταξύ «τι φαίνεται» και «τι γράφεται».
 */
function surveyKeyIndex(surfaceId: TopoSurfaceId): SurveyKeyIndex {
  const definition = getTopoDefinition(surfaceId);
  const cached = indexes.get(surfaceId);
  if (cached && cached.definition === definition) return cached;

  const { origin } = getTopoSurface(surfaceId);
  const keyToPointIndex = new Map<string, number>();
  definition.points.forEach((p, i) => {
    // ADR-720 — μόνο τα ΜΕΤΡΗΜΕΝΑ σημεία, γιατί μόνο αυτά έγιναν κόμβοι (ο `buildTin` φιλτράρει).
    // Ο δείκτης `i` παραμένει δείκτης στον ΑΡΧΙΚΟ πίνακα (skip, όχι pre-filter): το `moveSurveyPoint`
    // γράφει σε αυτόν. Χωρίς αυτόν τον έλεγχο, ένα δισδιάστατο σημείο που πέφτει στο ίδιο κελί
    // πλέγματος με έναν κόμβο θα κέρδιζε τον κανόνα «ο πρώτος κρατά τη θέση» και η λαβή θα
    // μετακινούσε **άλλο** σημείο από αυτό που ο χρήστης βλέπει — ακριβώς σε μια κορυφή οικοπέδου,
    // όπου το δισδιάστατο και το μετρημένο σημείο συνήθως συμπίπτουν.
    if (!hasElevation(p)) return;
    const key = localVertexKey(p.x - origin.x, p.y - origin.y);
    if (!keyToPointIndex.has(key)) keyToPointIndex.set(key, i);
  });

  const fresh: SurveyKeyIndex = { definition, keyToPointIndex };
  indexes.set(surfaceId, fresh);
  return fresh;
}

/** Καθαρισμός των ευρετηρίων (tests / teardown), mirror του `invalidateTopoSurface`. */
export function invalidateTopoSurveyPointIndex(): void {
  indexes.clear();
}

/**
 * Ο δείκτης του survey point κάτω από μια κορυφή του περιγράμματος (σε **DISPLAY** frame,
 * ακριβώς όπως ζει στο `TopoSurfaceEntity.footprint`), ή `null` όταν η κορυφή **δεν** είναι
 * survey point.
 *
 * Το `null` **δεν** είναι σφάλμα — είναι η ειλικρινής απάντηση «αυτός ο κόμβος ήρθε από
 * **γραμμή ασυνέχειας**, όχι από μέτρηση». Οι καταναλωτές οφείλουν να **μην παράγουν λαβή**
 * σε τέτοια κορυφή: μια λαβή που δεν μπορεί να γράψει πουθενά είναι ακριβώς το bug ADR-654
 * (λαβές που φαίνονταν και δεν μετακινούσαν ποτέ). Η κορυφή breakline επεξεργάζεται από τη
 * γραμμή ασυνέχειας, που είναι η δική της πηγή.
 */
export function resolveSurveyPointIndexAt(
  surfaceId: TopoSurfaceId,
  displayVertex: Point2D,
): number | null {
  const { origin } = getTopoSurface(surfaceId);
  const world = unprojectDisplayPoint(displayVertex, getTopoDisplayProjector());
  const local = worldToLocal(world, origin);
  const found = surveyKeyIndex(surfaceId).keyToPointIndex.get(localVertexKey(local.x, local.y));
  return found ?? null;
}

/**
 * Καθαρός μετασχηματισμός: τα survey points με **ένα** από αυτά μετατοπισμένο κατά
 * `worldDelta` (planimetric — το **υψόμετρο δεν αγγίζεται ποτέ**: η λαβή κάτοψης δηλώνει
 * «το σημείο μετρήθηκε εκεί», όχι «άλλαξε το έδαφος»).
 *
 * Επιστρέφει τον **ΑΡΧΙΚΟ** πίνακα σε μηδενικό delta ή εκτός ορίων δείκτη — σήμα no-op που
 * ο καλών ανιχνεύει με ταυτότητα αναφοράς, ώστε να μη γεννηθεί κενή εγγραφή στο ιστορικό
 * (idempotency, N.7.2 #3). Δεν μεταλλάσσει την είσοδο.
 */
export function moveSurveyPoint(
  points: readonly TopoPoint[],
  pointIndex: number,
  worldDelta: Point2D,
): readonly TopoPoint[] {
  if (pointIndex < 0 || pointIndex >= points.length) return points;
  if (worldDelta.x === 0 && worldDelta.y === 0) return points;
  return points.map((p, i) =>
    i === pointIndex ? { ...p, x: p.x + worldDelta.x, y: p.y + worldDelta.y } : p,
  );
}

/**
 * Το ίδιο planimetric delta, εκφρασμένο σε **WORLD** mm, από ένα delta που γεννήθηκε σε
 * **DISPLAY** mm (ό,τι δίνει το ποντίκι πάνω στην κάτοψη).
 *
 * Δεν αρκεί το `unproject` του σημείου: το delta είναι **διάνυσμα**, οπότε η μετάθεση της
 * geo-reference πρέπει να ακυρωθεί — αλλιώς κάθε geo-referenced έργο θα εκτόξευε το σημείο
 * κατά το `originWorld`. Το διάνυσμα προκύπτει ως διαφορά δύο unprojected σημείων, άρα
 * περνά **μόνο** η στροφή. Ένα σημείο αναφοράς αρκεί (η απεικόνιση είναι rigid).
 */
export function displayDeltaToWorld(displayDelta: Point2D): Point2D {
  const projector = getTopoDisplayProjector();
  if (!projector) return displayDelta;
  const origin = unprojectDisplayPoint({ x: 0, y: 0 }, projector);
  const moved = unprojectDisplayPoint(displayDelta, projector);
  return { x: moved.x - origin.x, y: moved.y - origin.y };
}
