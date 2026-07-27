/**
 * entity-measurement-facts — SSoT για **ΕΝΑ** ερώτημα: «τι μετριέται σε αυτή την οντότητα;»
 *
 * Το εργαλείο «Ετικέτα Εμβαδού» (ADR-649) ήταν δεμένο στη γραμμοσκίαση σε **πέντε**
 * σημεία (pick, hover-highlight, FSM, κείμενο, entity builder). Προσθέτοντας δεύτερο
 * τύπο με `isTopoSurfaceEntity` σε καθένα, θα γεννιόνταν πέντε sibling clones (N.18).
 * Εδώ απαντιέται **μία φορά** ποιοι τύποι έχουν μετρήσιμο μέγεθος και πόσο είναι — και
 * όλοι οι καταναλωτές ρωτούν αυτό. Νέος τύπος ⇒ αλλαγή **μόνο** σε αυτό το αρχείο.
 *
 * ΙΣΤΟΡΙΚΟ ΟΝΟΜΑΤΟΣ (ADR-649 §measure-facts): λεγόταν `entity-area-facts` / `entityAreaFacts`
 * όσο απαντούσε **μόνο** «τι εμβαδόν». Με την κλειστή πολυγραμμή μπήκε και η **περίμετρος**,
 * οπότε το συμβόλαιο έγινε «τι μετριέται» και το όνομα ακολούθησε. Ο εναλλακτικός δρόμος —
 * αδελφό `entity-perimeter-facts.ts` — θα έσπαγε την υπόσχεση «νέος τύπος ⇒ ένα αρχείο»:
 * ο επόμενος τύπος θα έπρεπε να θυμηθεί **δύο** dispatchers (κλασικό sibling drift, N.18).
 *
 * ΤΡΕΙΣ ΑΡΙΘΜΟΙ, ΟΧΙ ΕΝΑΣ (απόφαση Giorgio 2026-07-27, Civil 3D «2D Area» / «3D Area»):
 * μια επίπεδη οντότητα (γραμμοσκίαση, πολυγραμμή) έχει **μόνο** εμβαδόν προβολής ⇒
 * `surface3DMm2 = null` («δεν υπάρχει η έννοια», ΟΧΙ 0 — το 0 θα σήμαινε «μηδενική
 * επιφάνεια»). Μια τοπογραφική επιφάνεια έχει και τα δύο, και η διαφορά τους είναι
 * πληροφορία που πληρώνεται. Το ίδιο ισχύει για το `perimeterMm`.
 *
 * ΠΟΙΑ ΓΕΩΜΕΤΡΙΑ ΡΩΤΑΕΙ Ο ΚΑΘΕ ΤΥΠΟΣ — **σκόπιμα διαφορετική**, μην τα ενοποιήσεις:
 *   - γραμμοσκίαση → `computeHatchAreaMm2` = outer **−** islands (even-odd, ίδιο με το
 *     hit-test της· τα boundaryPaths ΕΙΝΑΙ outer-minus-holes εξ ορισμού).
 *   - τοπογραφική  → `topoSurfaceAreas(getTopoSurface(id))` = άθροισμα **τριγώνων**, ΟΧΙ
 *     rings. Τα footprint rings είναι «outer + hole loops» χωρίς αξιόπιστο προσανατολισμό
 *     ⇒ κάθε πράξη πάνω τους δίνει λάθος αριθμό (βλ. `topo-surface-area.ts`).
 *   - πολυγραμμή   → `computePolygonAreaMetrics(vertices, closed)` = οι **ίδιες** κορυφές
 *     που ζωγραφίζει ο `PolylineRenderer`. ⚠️ ΟΧΙ μέσω `entityClosedRings`: εκείνο το SSoT
 *     **αποκλείει ρητά** την πολυγραμμή («θα διπλασιάζαμε τις έλξεις της» — OSNAP).
 *
 * ΔΕΝ είναι pure: το `getTopoSurface` διαβάζει το cached TIN store. Καλείται σε **event
 * time** (κλικ/hover) ή σε render του Properties palette (low-freq), ποτέ σε hot render
 * path — ίδιο μοτίβο με τους υπόλοιπους event-time readers (ADR-040). Ο υπολογιστικός
 * πυρήνας (`topoSurfaceAreas`, `computePolygonAreaMetrics`) είναι pure και εκεί ζουν τα
 * tests των αριθμών.
 *
 * ΜΟΝΑΔΕΣ: canonical mm / mm² (ADR-462) — καμία μετατροπή εδώ. Ίδια σύμβαση με το
 * `computeHatchAreaMm2`, που επίσης διαβάζει συντεταγμένες σκηνής και τις ονομάζει mm.
 * Η μετατροπή σε ενεργή μονάδα γίνεται **μία φορά στην άκρη του UI** (`formatAreaForDisplay`).
 *
 * @see ../topography/topo-surface-area.ts — ο pure πυρήνας των δύο εμβαδών
 * @see ../../rendering/entities/shared/measurement-label.ts — ο pure πυρήνας πολυγώνου
 * @see ./area-label.ts — ο καταναλωτής που τα μετατρέπει σε κείμενο ετικέτας
 * @see docs/centralized-systems/reference/adrs/ADR-649-hatch-area-label-tool.md
 */

import type { Entity } from '../../types/entities';
import { isHatchEntity, isTopoSurfaceEntity, isPolylineEntity } from '../../types/entities';
import { computeHatchAreaMm2 } from '../../bim/hatch/hatch-completion';
import { getTopoSurface } from '../topography/topo-surface';
import { topoSurfaceAreas } from '../topography/topo-surface-area';
import { computePolygonAreaMetrics } from '../../rendering/entities/shared/measurement-label';

/** Τα μετρήσιμα μεγέθη μιας οντότητας, σε canonical mm / mm² (ADR-462). */
export interface EntityMeasurementFacts {
  /**
   * Μήκος ορίου (mm), ή `null` όταν ο τύπος **δεν** ορίζει περίμετρο με έναν μονοσήμαντο
   * τρόπο. `null` ≠ `0`. Η γραμμοσκίαση και η τοπογραφική επιφάνεια επιστρέφουν `null`
   * **σκόπιμα**: το όριό τους είναι «εξωτερικός δακτύλιος + νησιά» / TIN hull, οπότε ένας
   * μοναδικός αριθμός «περίμετρος» θα ήταν εφεύρεση — ούτε το AutoCAD τον δίνει για hatch.
   */
  readonly perimeterMm: number | null;
  /** Εμβαδόν προβολής σε κάτοψη — υπάρχει πάντα όταν η οντότητα έχει εμβαδόν. */
  readonly plan2DMm2: number;
  /**
   * Πραγματική επιφάνεια στον χώρο, ή `null` όταν η οντότητα είναι **επίπεδη** και η
   * έννοια δεν υφίσταται. `null` ≠ `0`: το 0 θα ήταν ισχυρισμός για μηδενική επιφάνεια.
   */
  readonly surface3DMm2: number | null;
  /**
   * `true` όταν το όριο κλείνει **από μόνο του**. `false` ⇒ το `plan2DMm2` προϋποθέτει
   * **νοητό κλείσιμο** τέλος→αρχή (κανόνας AutoCAD για ανοιχτή LWPOLYLINE: το εμβαδόν
   * υπολογίζεται σαν να έκλεινε, ενώ η περίμετρος **αγνοεί** το τμήμα κλεισίματος —
   * ακριβώς αυτό κάνει το `computePolygonAreaMetrics` περνώντας του το `closed` flag).
   *
   * Είναι ο διακόπτης που ξεχωρίζει τα δύο ερωτήματα: το panel δείχνει τον αριθμό
   * (AutoCAD parity), αλλά το εργαλείο «Ετικέτα Εμβαδού» απαιτεί **αληθινά** κλειστό
   * σχήμα — δεν κολλάει ετικέτα σε περίγραμμα που έκλεισε μόνο στη φαντασία μας
   * (απόφαση Giorgio 2026-07-27).
   */
  readonly closedBoundary: boolean;
}

/**
 * Τα μετρήσιμα μεγέθη της οντότητας, ή `null` αν ο τύπος **δεν** μετριέται (γραμμή,
 * κείμενο, BIM, …). Το `null` είναι η απάντηση «δεν μετριέται», όχι σφάλμα.
 */
export function entityMeasurementFacts(entity: Entity): EntityMeasurementFacts | null {
  if (isHatchEntity(entity)) {
    return {
      perimeterMm: null, // όριο = outer − islands· ένας αριθμός θα ήταν εφεύρεση (βλ. interface)
      plan2DMm2: computeHatchAreaMm2(entity),
      surface3DMm2: null,
      closedBoundary: true,
    };
  }
  if (isTopoSurfaceEntity(entity)) {
    const areas = topoSurfaceAreas(getTopoSurface(entity.surfaceId));
    if (areas.triangleCount === 0) return null; // καμία τριγωνοποιήσιμη επιφάνεια
    return {
      perimeterMm: null, // όριο = TIN hull· το ADR-662 δεν όρισε μονοσήμαντη περίμετρο
      plan2DMm2: areas.plan2DMm2,
      surface3DMm2: areas.surface3DMm2,
      closedBoundary: true,
    };
  }
  if (isPolylineEntity(entity)) {
    const vertices = entity.vertices;
    if (!vertices || vertices.length < 2) return null; // εκφυλισμένη — τίποτα να μετρηθεί
    const closed = entity.closed === true;
    // ΕΝΑΣ υπολογισμός, ο ΙΔΙΟΣ που ζωγραφίζει ο PolylineRenderer + το hover overlay:
    // εμβαδόν = shoelace με αυτόματο κλείσιμο (AutoCAD «σαν να έκλεινε»)· περίμετρος =
    // άθροισμα ακμών ΜΕ το τμήμα κλεισίματος μόνο όταν `closed`. Μηδέν νέα μαθηματικά.
    const metrics = computePolygonAreaMetrics(vertices, closed);
    return {
      perimeterMm: metrics.perimeter,
      plan2DMm2: metrics.area,
      surface3DMm2: null, // οι κορυφές είναι Point2D — η πολυγραμμή είναι ΔΟΜΙΚΑ επίπεδη
      closedBoundary: closed,
    };
  }
  return null;
}

/**
 * Το predicate του pick/hover του εργαλείου «Ετικέτα Εμβαδού»: «μπορεί αυτή η οντότητα
 * να δώσει ετικέτα εμβαδού;». Απαιτεί **αληθινά κλειστό** όριο (`closedBoundary`), όχι
 * απλώς «υπάρχει αριθμός»: μια ανοιχτή πολυγραμμή έχει εμβαδόν στο panel (AutoCAD parity)
 * αλλά **δεν** δέχεται ετικέτα.
 *
 * Περνά στο `pickTopEntityAt`, το οποίο εφαρμόζει το **σωστό ανά τύπο** hit-test
 * (γραμμοσκίαση = even-odd, τοπογραφική = οποιοδήποτε ring) — γι' αυτό ΔΕΝ χρειάζεται
 * ξεχωριστός picker ανά τύπο.
 */
export function hasMeasurableArea(entity: Entity): boolean {
  return entityMeasurementFacts(entity)?.closedBoundary === true;
}
