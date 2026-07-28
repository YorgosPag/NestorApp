/**
 * topo-source-cascade — ADR-718 Μ3 · ο **scene-derived reconciler** των τοπογραφικών ορισμών
 * που κρέμονται από μια οντότητα του σχεδίου.
 *
 * **ΔΕΝ ΕΙΝΑΙ ΝΕΟΣ ΜΗΧΑΝΙΣΜΟΣ.** Είναι ένας ακόμη reconciler της **υπάρχουσας** universal SSoT
 * του ADR-540 (`bim/cascade/associative-geometry-reconcile`) — μπαίνει στη λίστα δίπλα στα
 * «ανοίγματα → τοίχος», «δοκάρια → όψεις κολόνας» και «ετικέτα εμβαδού → πηγή», και κληρονομεί
 * **δωρεάν** κάθε call site της. Το idiom είναι αυτούσιο το `area-label-cascade` του ADR-649.
 *
 * **ΕΝΑΣ μηχανισμός, ΚΑΙ ΤΑ ΔΥΟ `sourceEntityId`.** Το όριο οικοπέδου (ADR-650 M6 Γ) και οι
 * ασυνέχειες (ADR-650 M2-Β) έχουν **το ίδιο ακριβώς** πρόβλημα: κρατούν snapshot κορυφών από
 * μια γραμμή του σχεδίου και κανείς δεν παρακολουθούσε τη γραμμή. Δύο δίδυμοι listeners θα
 * ήταν παραβίαση του N.18 — και εγγυημένη απόκλιση την πρώτη φορά που κάποιος διορθωνόταν.
 * Ό,τι αποκτήσει αύριο `sourceEntityId` περνά από **εδώ**.
 *
 * 🔴 **Γιατί command-time και ΟΧΙ reactive effect (ADR-492 §4 — μην το αγνοήσεις):** ένας effect
 * που άκουγε geometry events και ξανα-εξέπεμπε → βρόχος με τον proactive analysis cycle →
 * storm/freeze. Εδώ τρέχει **σύγχρονα μέσα στην εντολή**, και η ιδεμποτεντικότητα (ίδιο σχήμα
 * ⇒ **καμία** εγγραφή στο store) εγγυάται ότι ο κύκλος συγκλίνει.
 *
 * **Η ιδεμποτεντικότητα εδώ δεν είναι καλλωπισμός.** Ο cascade τρέχει μετά από **κάθε** εντολή
 * γεωμετρίας του εγγράφου. Μια εγγραφή χωρίς πραγματική αλλαγή θα ξανάχτιζε ισοϋψείς +
 * footprint (μέσω του crop reconciler) και θα προγραμμάτιζε Firestore save **κάθε φορά που ο
 * χρήστης σπρώχνει μια άσχετη γραμμή**.
 *
 * **Πότε φαίνεται η αλλαγή:** στο **commit** της χειρονομίας (mouseup), όχι σε κάθε καρέ του
 * drag — ίδια σύμβαση με Civil 3D (rebuild) και Revit (regenerate on release). Το σύρσιμο δεν
 * ξανα-τριγωνοποιεί δεκάδες φορές το δευτερόλεπτο.
 *
 * ── ΔΥΟ ΑΙΤΙΕΣ, ΕΝΑΣ ΜΗΧΑΝΙΣΜΟΣ (ADR-718 §Α) ────────────────────────────────────────────────
 * Ένας ορισμός που κρέμεται από οντότητα του σχεδίου παλιώνει με **δύο** τρόπους:
 *
 *   1. **άλλαξε η ΟΝΤΟΤΗΤΑ** — ο χρήστης έσυρε λαβή· ξαναχτίζουμε όσους δείχνουν στις
 *      `changedIds` ({@link cascadeTopoSourceGeometry}).
 *   2. **άλλαξε το ΠΛΑΙΣΙΟ** — auto-align, χειροκίνητο κοινό σημείο, «Καθαρισμός γεωαναφοράς».
 *      Η οντότητα δεν κουνήθηκε ούτε χιλιοστό, αλλά οι **ίδιες** DISPLAY κορυφές αντιστοιχούν
 *      πλέον σε **άλλες** WORLD — άρα κάθε αποθηκευμένος ορισμός είναι μπαγιάτικος
 *      ({@link cascadeTopoSourceFrame}).
 *
 * Και οι δύο απαντώνται με **ξαναχτίσιμο από την πηγή**, όχι με delta μετακίνηση: ο ορισμός
 * είναι παράγωγο, και η πηγή του (η πολυγραμμή) είναι πάντα εκεί με την τελευταία αλήθεια. Αυτή
 * είναι ακριβώς η διάκριση που κάνει ο `topo-frame-reconcile`: παράγωγα **ξαναχτίζονται**, μόνο
 * τα ψημένα προϊόντα (κάναβος, βορράς) delta-μετακινούνται γιατί περιέχουν δουλειά του χρήστη.
 *
 * ⚠️ **Χαμένη πηγή ⇒ ΔΕΝ μαντεύουμε** (fail-closed, §M10g). Δακτύλιος του οποίου η πολυγραμμή
 * διαγράφηκε μένει παγωμένος στο παλιό πλαίσιο και σημαδεύεται `'missing'` — το ribbon ήδη τον
 * βάφει πορτοκαλί (Μ3). Ένα rigid delta θα τον μετακινούσε «σωστά» χωρίς να μπορεί κανείς να το
 * επαληθεύσει· η σιωπηλή εικασία σε γεωμετρία που τιμολογείται είναι το ίδιο το σφάλμα.
 *
 * @see ../../bim/cascade/associative-geometry-reconcile — η universal SSoT (ADR-540)
 * @see ./persistence/topo-frame-reconcile — ο ΕΝΑΣ ιδιοκτήτης του «το πλαίσιο άλλαξε»
 * @see ../measure/area-label-cascade — το αδελφό idiom (ADR-649 §associative)
 * @see ./topo-boundary-pick — `buildBoundaryFromEntity` (ο ΙΔΙΟΣ builder με το εργαλείο επιλογής)
 * @see ./topo-breakline-pick — `buildBreaklineFromEntity` (ομοίως)
 * @see docs/centralized-systems/reference/adrs/ADR-718-terrain-crop-to-site-boundary.md
 */

import type { Entity } from '../../types/entities';
import type { ISceneManager } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { buildBoundaryFromEntity } from './topo-boundary-pick';
import { buildBreaklineFromEntity } from './topo-breakline-pick';
import { getTopoDisplayProjector } from './topo-display-frame';
import {
  getTopoState, getTopoPoints, getTopoBreaklines,
  setTopoBoundaryFromSource, setTopoBreaklines,
} from './TopoPointStore';
import { TOPO_SURFACE_IDS } from './topo-types';
import type { Breakline, TopoPoint, TopoSurfaceId } from './topo-types';

/** Το ελάχιστο scene surface που χρειάζεται ο cascade (mirror `AreaLabelSceneManager`). */
type TopoSourceSceneManager = Pick<ISceneManager, 'getEntity'>;

/**
 * Ποιες πηγές αφορά αυτό το πέρασμα: ένα σύνολο ids, ή **`null` = ΟΛΕΣ**.
 *
 * Το `null` δεν είναι «παράλειψη της πύλης κόστους» — είναι η άλλη ερώτηση. Στην αλλαγή
 * πλαισίου δεν υπάρχει «ποια οντότητα άλλαξε»: άλλαξε η **αντιστοίχιση**, οπότε κάθε ορισμός
 * που κρέμεται από οντότητα είναι εξίσου μπαγιάτικος.
 */
type SourceFilter = ReadonlySet<string> | null;

/** Τα δεδομένα που κουβαλά **ένα** πέρασμα του cascade — μαζεμένα μία φορά, όχι ανά οντότητα. */
interface CascadePass {
  readonly sources: SourceFilter;
  readonly sceneManager: TopoSourceSceneManager;
  /**
   * Ο ενεργός WORLD→DISPLAY, διαβασμένος **μία φορά ανά πέρασμα**. Το
   * `getActiveWorldToDisplayProjector()` φτιάχνει νέο αντικείμενο σε κάθε κλήση, οπότε ανά
   * οντότητα θα σήμαινε μια περιττή προετοιμασία τριγωνομετρίας για κάθε ασυνέχεια.
   */
  readonly projector: WorldToDisplayProjector | null;
}

/** Αφορά αυτό το πέρασμα την πηγή `sourceId`; (`null` φίλτρο ⇒ ναι, όποια κι αν είναι.) */
function affects(pass: CascadePass, sourceId: string): boolean {
  return pass.sources === null || pass.sources.has(sourceId);
}

// ─── Σύγκριση (ΕΝΑΣ συγκριτής, δύο κατηγορήματα — όχι δίδυμες `sameXxxList`) ────

function sameList<T>(
  a: readonly T[],
  b: readonly T[],
  equal: (x: T, y: T) => boolean,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!equal(a[i]!, b[i]!)) return false;
  }
  return true;
}

const samePoint2D = (x: Point2D, y: Point2D): boolean => x.x === y.x && x.y === y.y;
const sameTopoPoint = (x: TopoPoint, y: TopoPoint): boolean =>
  x.x === y.x && x.y === y.y && x.z === y.z;

// ─── Όριο οικοπέδου ────────────────────────────────────────────────────────────

/**
 * Ξαναχτίζει το όριο από την πολυγραμμή-πηγή του και ενημερώνει την **υγεία του δεσμού**.
 *
 * Και στις δύο αστοχίες ο **τελευταίος έγκυρος δακτύλιος διατηρείται** — η κοπή δεν εξαφανίζεται
 * σιωπηλά. Σιωπηλό ξε-κόψιμο θα μεγάλωνε την επιφάνεια, θα άλλαζε τους όγκους εκσκαφής και μαζί
 * τους μια **τιμή**, εξαιτίας μιας επεξεργασίας που ο χρήστης έκανε αλλού. (Civil 3D: «Copy
 * Deleted Dependent Objects = Yes», η προεπιλογή.) Η διαφορά μας: το **λέμε** — δες
 * `TopoBoundaryLink` και το ribbon toggle «Κοπή στο όριο».
 *
 * Η θεραπεία είναι συμμετρική και χωρίς ειδική διαδρομή: μόλις η οντότητα ξαναγίνει έγκυρη
 * (undo διαγραφής, ξανακλείσιμο της πολυγραμμής), το επόμενο πέρασμα τη βρίσκει και ο δεσμός
 * επιστρέφει σε `live` μόνος του.
 */
function reconcileBoundary(pass: CascadePass): void {
  const { boundary } = getTopoState();
  const sourceId = boundary?.sourceEntityId;
  if (!boundary || !sourceId || !affects(pass, sourceId)) return;

  const entity = pass.sceneManager.getEntity(sourceId) as Entity | undefined;
  if (!entity) return setTopoBoundaryFromSource(boundary, 'missing');

  const rebuilt = buildBoundaryFromEntity(entity, pass.projector);
  if (!rebuilt) return setTopoBoundaryFromSource(boundary, 'invalid');

  // Ίδιο σχήμα ⇒ κρατάμε το ΥΠΑΡΧΟΝ αντικείμενο: το `getActiveCropRing()` συγκρίνεται με
  // **ταυτότητα**, οπότε νέο ισοδύναμο object θα ξανάχτιζε ισοϋψείς + 3Δ χωρίς λόγο.
  const unchanged = sameList(boundary.vertices, rebuilt.vertices, samePoint2D);
  setTopoBoundaryFromSource(unchanged ? boundary : rebuilt, 'live');
}

// ─── Ασυνέχειες (breaklines) ───────────────────────────────────────────────────

/**
 * Η μία ασυνέχεια, ξαναχτισμένη — ή **η ίδια αναφορά** όταν δεν χρειάστηκε αλλαγή (το σήμα
 * ιδεμποτεντικότητας του καλούντος).
 *
 * `id` και `sourceEntityId` επιβιώνουν μέσω spread: το id είναι το κλειδί με το οποίο το
 * εργαλείο κάνει toggle-off την ασυνέχεια — αν χανόταν στο ξαναχτίσιμο, το δεύτερο κλικ στην
 * ίδια γραμμή θα πρόσθετε δεύτερη αντί να αφαιρέσει την πρώτη.
 *
 * Χαμένη ή μη-χτίσιμη πηγή → κρατάμε το τελευταίο έγκυρο σχήμα, ίδιος κανόνας με το όριο.
 * (Μια proximity ασυνέχεια δεν χτίζεται χωρίς φορτωμένα σημεία — `buildBreaklineFromEntity`.)
 */
function rebuiltBreakline(
  breakline: Breakline,
  pass: CascadePass,
  surfaceId: TopoSurfaceId,
): Breakline {
  const sourceId = breakline.sourceEntityId;
  if (!sourceId || !affects(pass, sourceId)) return breakline;

  const entity = pass.sceneManager.getEntity(sourceId) as Entity | undefined;
  if (!entity) return breakline;

  const built = buildBreaklineFromEntity(entity, getTopoPoints(surfaceId), pass.projector);
  if (!built) return breakline;

  const unchanged =
    built.closed === (breakline.closed ?? false) &&
    sameList(breakline.vertices, built.vertices, sameTopoPoint);
  return unchanged ? breakline : { ...breakline, vertices: built.vertices, closed: built.closed };
}

/**
 * ΟΛΕΣ οι named επιφάνειες (`TOPO_SURFACE_IDS`), όχι μόνο η `existing`: το εργαλείο σήμερα
 * γράφει στην `existing`, αλλά μια ασυνέχεια της `proposed` που δεν ακολουθεί θα ήταν ακριβώς
 * η ίδια νεκρή λαβή, μόνο πιο δύσκολα ορατή.
 *
 * Γράφει **ανά επιφάνεια και μόνο όταν κάτι άλλαξε**: το `setTopoBreaklines` αντικαθιστά τον
 * ορισμό, άρα ακυρώνει το memo του TIN → **ξανατρέχει ο CDT**. Αυτό είναι σωστό (η ασυνέχεια
 * είναι μέρος του ορισμού, όχι της εμβέλειας) αλλά ακριβό — γι' αυτό η πύλη.
 */
function reconcileBreaklines(pass: CascadePass): void {
  for (const surfaceId of TOPO_SURFACE_IDS) {
    const current = getTopoBreaklines(surfaceId);
    if (current.length === 0) continue;

    let dirty = false;
    const next = current.map((b) => {
      const rebuilt = rebuiltBreakline(b, pass, surfaceId);
      if (rebuilt !== b) dirty = true;
      return rebuilt;
    });
    if (dirty) setTopoBreaklines(next, surfaceId);
  }
}

/** Το ΕΝΑ σώμα του cascade — και οι δύο δημόσιες είσοδοι το εκτελούν με άλλο φίλτρο. */
function runCascade(sources: SourceFilter, sceneManager: TopoSourceSceneManager): void {
  const pass: CascadePass = { sources, sceneManager, projector: getTopoDisplayProjector() };
  reconcileBoundary(pass);
  reconcileBreaklines(pass);
}

// ─── Η μία είσοδος ─────────────────────────────────────────────────────────────

/**
 * Ξανα-derive-άρει κάθε τοπογραφικό ορισμό που δείχνει σε μία από τις `changedIds`.
 *
 * Ο έλεγχος `changedIds` είναι **πύλη κόστους**, όχι διακοσμητικός: χωρίς αυτόν κάθε
 * μετακίνηση οποιασδήποτε οντότητας θα ξανα-χτιζε κάθε ασυνέχεια της αποτύπωσης — και το
 * ξαναχτίσιμο μιας proximity ασυνέχειας σαρώνει ΟΛΑ τα μετρημένα σημεία ανά κορυφή.
 *
 * ⚠️ Γράφει σε **store**, όχι σε scene entities — γι' αυτό δεν επιστρέφει `SceneEntity[]` για
 * το ενιαίο `bim:entities-moved` του ADR-540 (όπως κάνει ο area-label cascade). Τα παράγωγα
 * της κάτοψης (ισοϋψείς + footprint) ανανεώνονται από τον **ήδη υπάρχοντα** reconciler του
 * `useTopoPersistence`, που παρακολουθεί την ταυτότητα του `getActiveCropRing()` — μηδέν
 * δεύτερος δρόμος ξαναχτισίματος (ADR-718 Μ2).
 */
export function cascadeTopoSourceGeometry(
  changedIds: readonly string[],
  sceneManager: TopoSourceSceneManager,
): void {
  if (changedIds.length === 0) return;
  runCascade(new Set(changedIds), sceneManager);
}

/**
 * ADR-718 §Α — ξανα-derive-άρει **κάθε** τοπογραφικό ορισμό επειδή άλλαξε το **πλαίσιο**, όχι
 * κάποια οντότητα.
 *
 * Τρέχει από τον ΕΝΑ ιδιοκτήτη του κύκλου ζωής (`reconcileTopoFrame`), δηλαδή στις **τρεις**
 * στιγμές που το πλαίσιο μπορεί να έχει αλλάξει: φόρτωση εγγράφου, αλλαγή ορόφου, αλλαγή
 * γεωαναφοράς. Καμία δεύτερη συνδρομή στο `subscribeGeoReference` — η ερώτηση «το πλαίσιο
 * άλλαξε, ποιος μετακινείται;» έχει ήδη ιδιοκτήτη (§M10g) και δεν αποκτά δεύτερο.
 *
 * **Η φόρτωση δεν είναι μπόνους, είναι το migration.** Ένα έγγραφο αποθηκευμένο πριν από αυτή
 * τη διόρθωση κουβαλά δακτύλιο σε DISPLAY. Επειδή το πέρασμα ξαναχτίζει από το `sourceEntityId`,
 * ο δακτύλιος διορθώνεται **στο άνοιγμα** — όχι «στην πρώτη επεξεργασία της πολυγραμμής». Γι'
 * αυτό η αλλαγή πλαισίου **δεν** απαιτεί ούτε σφραγίδα στο έγγραφο, ούτε version bump, ούτε
 * script μετάπτωσης: η πηγή είναι η αλήθεια, και είναι πάντα εκεί.
 *
 * Ιδεμποτεντικό όπως και ο δίδυμός του: ίδιο σχήμα ⇒ καμία εγγραφή, άρα το επαναλαμβανόμενο
 * πέρασμα σε κάθε επίσκεψη ορόφου δεν ξαναχτίζει ισοϋψείς και δεν προγραμματίζει save.
 */
export function cascadeTopoSourceFrame(sceneManager: TopoSourceSceneManager): void {
  runCascade(null, sceneManager);
}
