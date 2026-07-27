/**
 * ADR-665 M2 — η ΕΠΙΦΑΝΕΙΑ ΤΗΣ ΤΟΜΗΣ του αναγλύφου, αναλυτικά. Καθαρό: χωρίς store, χωρίς THREE.
 *
 * ── Τι απαντά ───────────────────────────────────────────────────────────────────────────────
 * «Όταν ένα οριζόντιο επίπεδο στο υψόμετρο `levelElevMm` κόβει τον λόφο, ΠΟΙΟ σχήμα εκτίθεται;»
 * Το ανάγλυφο είναι **height field** (ένα Z ανά σημείο ΧΥ) και το χώμα είναι συμπαγές από κάτω,
 * άρα η απάντηση είναι η οριζόντια περιοχή
 *
 *     cap = { (x, y) : z_TIN(x, y) ≥ levelElevMm }
 *
 * προβεβλημένη στο `z = levelElevMm`. Δεν είναι render trick — είναι **υπολογίσιμη γεωμετρία**.
 *
 * ── Γιατί per-triangle clip και ΟΧΙ «ισοϋψής + κλείσιμο + CDT» ───────────────────────────────
 * Η προφανής λύση (βγάλε την ισοϋψή στη στάθμη, κλείσ' την με την περίμετρο, τριγωνοποίησε) έχει
 * τρεις ανεξάρτητες πηγές σφάλματος: η ισοϋψής **δεν κλείνει** όταν τερματίζει στην περίμετρο του
 * TIN· τρύπες vs νησίδες θέλουν σωστό winding, που η αλυσοποίηση σε **μη-προσανατολισμένες** ακμές
 * δεν μπορεί να δώσει (ίδιο επιχείρημα με το `topo-surface-area`, ADR-662 §12)· και το CDT είναι
 * τρίτη τριγωνοποίηση δίπλα σε αυτή που ήδη έχουμε.
 *
 * Αντ' αυτού κόβουμε **κάθε τρίγωνο χωριστά** με το ημιεπίπεδο. Το ημιεπίπεδο είναι κυρτό, άρα το
 * κομμάτι είναι κυρτό — 0, 3 ή 4 κορυφές — δηλαδή **ήδη τριγωνοποιήσιμο με fan**. Μηδέν chaining,
 * μηδέν CDT, μηδέν ανοιχτοί δακτύλιοι, **σωστό εξ ορισμού** σε τρύπες και σε πολλαπλά νησιά:
 * κανείς δεν χρειάζεται να ξέρει ότι κάτι είναι νησί, αθροίζονται απλώς τα τρίγωνα που υπάρχουν.
 *
 * ── Πλαίσια (η παγίδα που κοστίζει 5 cm) ────────────────────────────────────────────────────
 * Είσοδος: `TinSurface.positions` είναι **LOCAL** mm, `elevations` **WORLD canonical** mm.
 * Έξοδος: τρίγωνα σε **WORLD canonical mm** (LOCAL + origin) — δηλαδή ΕΓΣΑ, **πριν** τη γέφυρα
 * WORLD→DISPLAY. Η προβολή (ADR-650 §M10f) γίνεται στον converter, ακριβώς όπως στο `tin-to-three`:
 * ο καθαρός κώδικας δεν διαβάζει store, ο ακάθαρτος καλών του δίνει τον projector.
 *
 * @see ./planar-scalar-clip.ts — ο ΕΝΑΣ κόφτης (κοινός με το cut/fill)
 * @see ../../bim-3d/converters/terrain-cap-to-three.ts — WORLD mm → BufferGeometry (ο καταναλωτής)
 * @see ./topo-surface-area.ts — το ανεξάρτητο εμβαδόν που χρησιμοποιεί το anchor του M2
 */

import type { Point2D } from '../../rendering/types/Types';
import type { TinSurface } from './topo-types';
import { clipPolygonAtScalarZero } from './planar-scalar-clip';

/** Κορυφή τριγώνου TIN σε WORLD mm, με το βαθμωτό πεδίο `z − levelElevMm` προσαρτημένο. */
interface LevelVertex {
  readonly x: number;
  readonly y: number;
  /** `elevation − levelElevMm` (WORLD mm). > 0 → πάνω από την τομή, δηλαδή χώμα που αφαιρέθηκε. */
  readonly dz: number;
}

/** Η επιφάνεια τομής ως λίστα τριγώνων σε WORLD canonical mm (ADR-462). */
export interface TerrainCutCapPlan {
  /**
   * Επίπεδα σημεία, **τριάδες**: `[i*3, i*3+1, i*3+2]` είναι ένα τρίγωνο. Επίπεδη λίστα και όχι
   * πολύγωνα — ο καταναλωτής γράφει buffer, και ο κόφτης παράγει ήδη τριγωνοποιήσιμα κυρτά
   * κομμάτια, οπότε ένα ενδιάμεσο σχήμα «πολύγωνο» θα ήταν σκέτη κατανομή χωρίς πληροφορία.
   */
  readonly points: readonly Point2D[];
  /** Πόσα τρίγωνα (`points.length / 3`). 0 σημαίνει «η στάθμη είναι πάνω από όλον τον λόφο». */
  readonly triangleCount: number;
  /**
   * Το εμβαδόν ΚΑΤΟΨΗΣ του cap σε canonical mm². Το **anchor** του M2: πρέπει να αθροίζει με το
   * εμβαδόν του κάτω μέρους στο συνολικό `topoSurfaceAreas(tin).plan2DMm2` — ανεξάρτητα
   * υπολογισμένο. Αν κάποιος «απλοποιήσει» τον κόφτη, αυτός ο αριθμός σκάει πρώτος.
   */
  readonly planAreaMm2: number;
}

const EMPTY_CAP: TerrainCutCapPlan = { points: [], triangleCount: 0, planAreaMm2: 0 };

/**
 * Η επιφάνεια της τομής του αναγλύφου στο υψόμετρο `levelElevMm`, σε WORLD canonical mm.
 *
 * `sign = 1` (κρατάμε `z ≥ level`) επειδή ο cap είναι το **αποτύπωμα του χώματος που αφαιρέθηκε**:
 * η κοπή του ADR-665 κρατά ό,τι είναι κάτω από το επίπεδο, οπότε η τρύπα που μένει έχει το σχήμα
 * του πάνω μέρους. Στάθμη **πάνω** από όλον τον λόφο ⇒ κενός cap· **κάτω** από όλον ⇒ πλήρης cap
 * με εμβαδόν ίσο με την προβολή όλης της επιφάνειας.
 *
 * Μη-πεπερασμένη στάθμη ή επιφάνεια χωρίς τρίγωνα ⇒ κενό, **ποτέ** NaN: ένα NaN εδώ θα κατέληγε
 * σε `Box3` της σκηνής και θα μαύριζε ολόκληρο το 3Δ (ADR-537).
 */
export function buildTerrainCutCapPlan(tin: TinSurface, levelElevMm: number): TerrainCutCapPlan {
  if (!Number.isFinite(levelElevMm) || tin.triangles.length === 0) return EMPTY_CAP;

  const points: Point2D[] = [];
  let planAreaMm2 = 0;

  for (const [i, j, k] of tin.triangles) {
    const triangle = worldTriangleAtLevel(tin, i, j, k, levelElevMm);
    if (!triangle) continue;
    // Κρατάμε το ΠΑΝΩ μέρος: αυτό είναι το χώμα που έφυγε, άρα το σχήμα της τομής.
    const piece = clipPolygonAtScalarZero(triangle, 1, fieldOfLevel, levelVertexAtCrossing);
    planAreaMm2 += fanTriangulateInto(piece, points);
  }

  return { points, triangleCount: points.length / 3, planAreaMm2 };
}

/**
 * Το εμβαδόν ΚΑΤΟΨΗΣ (canonical mm²) του μέρους της επιφάνειας που μένει **κάτω** από τη στάθμη —
 * ο συμπληρωματικός υπολογισμός, με το **αντίθετο** πρόσημο και τον ίδιο κόφτη.
 *
 * Δεν το χρειάζεται το render· υπάρχει για το **anchor** (ADR-665 §M2.10): `cap + below` οφείλει να
 * ισούται με το `topoSurfaceAreas(tin).plan2DMm2`, που παράγεται από **εντελώς άλλη** διαδρομή
 * (άθροισμα εξωτερικών γινομένων ανά τρίγωνο, ADR-662 §12). Δύο ανεξάρτητοι δρόμοι που πρέπει να
 * συμφωνήσουν είναι ο μόνος τρόπος να πιαστεί μια σιωπηλή «απλοποίηση» του κόφτη — ένα τεστ που
 * ρωτούσε τον ίδιο τον κόφτη θα ήταν ταυτολογία.
 */
export function terrainBelowLevelPlanAreaMm2(tin: TinSurface, levelElevMm: number): number {
  if (!Number.isFinite(levelElevMm) || tin.triangles.length === 0) return 0;

  const scratch: Point2D[] = [];
  let areaMm2 = 0;
  for (const [i, j, k] of tin.triangles) {
    const triangle = worldTriangleAtLevel(tin, i, j, k, levelElevMm);
    if (!triangle) continue;
    scratch.length = 0;
    areaMm2 += fanTriangulateInto(
      clipPolygonAtScalarZero(triangle, -1, fieldOfLevel, levelVertexAtCrossing),
      scratch,
    );
  }
  return areaMm2;
}

// ─── internals ─────────────────────────────────────────────────────────────────

function fieldOfLevel(vertex: LevelVertex): number {
  return vertex.dz;
}

/** Κορυφή πάνω στη στάθμη: το `dz` της είναι 0 **εξ ορισμού**, δεν ξαναϋπολογίζεται. */
function levelVertexAtCrossing(point: Point2D): LevelVertex {
  return { x: point.x, y: point.y, dz: 0 };
}

/**
 * Ένα τρίγωνο του TIN σε WORLD mm με το πεδίο `z − level` σε κάθε κορυφή, ή `null` αν κάποια
 * συντεταγμένη δεν είναι πεπερασμένη (το τρίγωνο απλώς δεν συμμετέχει — δεν μολύνει το σύνολο).
 */
function worldTriangleAtLevel(
  tin: TinSurface,
  i: number,
  j: number,
  k: number,
  levelElevMm: number,
): readonly [LevelVertex, LevelVertex, LevelVertex] | null {
  const a = worldVertexAtLevel(tin, i, levelElevMm);
  const b = worldVertexAtLevel(tin, j, levelElevMm);
  const c = worldVertexAtLevel(tin, k, levelElevMm);
  return a && b && c ? [a, b, c] : null;
}

/** LOCAL → WORLD (καθαρή μετατόπιση κατά `origin`) + προσάρτηση του πεδίου. */
function worldVertexAtLevel(tin: TinSurface, index: number, levelElevMm: number): LevelVertex | null {
  const local = tin.positions[index];
  const elevation = tin.elevations[index];
  if (!local || elevation === undefined) return null;
  const x = local[0] + tin.origin.x;
  const y = local[1] + tin.origin.y;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(elevation)) return null;
  return { x, y, dz: elevation - levelElevMm };
}

/**
 * Fan-τριγωνοποίηση ενός **κυρτού** κομματιού μέσα στο `out`, επιστρέφοντας το εμβαδόν του.
 *
 * Fan από την πρώτη κορυφή είναι σωστό **επειδή** το κομμάτι είναι κυρτό (τομή τριγώνου με
 * ημιεπίπεδο) — δεν είναι γενική τριγωνοποίηση και δεν πρέπει να χρησιμοποιηθεί ως τέτοια.
 * Το εμβαδόν αθροίζεται εδώ, ανά τρίγωνο, με το ίδιο εξωτερικό γινόμενο που ήδη γράφεται —
 * μηδέν επιπλέον πέρασμα, και το άθροισμα αφορά **ακριβώς** ό,τι γράφτηκε στον buffer.
 */
function fanTriangulateInto(piece: readonly LevelVertex[], out: Point2D[]): number {
  if (piece.length < 3) return 0;
  const first = piece[0]!;
  let areaMm2 = 0;

  for (let v = 1; v < piece.length - 1; v++) {
    const second = piece[v]!;
    const third = piece[v + 1]!;
    const cross =
      (second.x - first.x) * (third.y - first.y) - (third.x - first.x) * (second.y - first.y);
    if (!Number.isFinite(cross) || cross === 0) continue; // εκφυλισμένη λωρίδα: μηδενικό εμβαδόν
    areaMm2 += Math.abs(cross) / 2;
    out.push({ x: first.x, y: first.y }, { x: second.x, y: second.y }, { x: third.x, y: third.y });
  }
  return areaMm2;
}
