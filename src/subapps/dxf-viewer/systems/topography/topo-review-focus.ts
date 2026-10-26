/**
 * ADR-920 Β4.8 Β3.1 · ADR-650 §M10f — «πήγαινέ με σε αυτό το τοπογραφικό εύρημα», με τη γέφυρα WORLD→DISPLAY.
 *
 * ── Η κλάση του σφάλματος που κλείνει ──────────────────────────────────────────────────────────
 * Κάθε τοπογραφικό εύρημα (QA flag, υποψήφια ασυνέχεια, δεσμευμένη ασυνέχεια) ζει σε **WORLD** (ΕΓΣΑ mm),
 * γιατί εκεί ζει η αποτύπωση. Ο 2Δ καμβάς όμως ζει σε **DISPLAY** (τοπικά mm του σχεδίου) — τα
 * `canvas-fit-to-view-selected` / `canvas-center-on-point` δέχονται συντεταγμένες σκηνής. Οι λίστες QA και
 * αυτόματων ασυνεχειών έδιναν στο {@link focusReviewTarget} κουτί σε ΕΓΣΑ: σε μη-γεωαναφερμένο έργο τα δύο
 * πλαίσια ταυτίζονται και το κενό ήταν αόρατο· σε **κάθε** γεωαναφερμένο το 2Δ «Zoom To» πήγαινε ~4·10⁵ mm
 * μακριά από το εύρημα, ενώ η 3Δ (που προβάλλει μέσω `topoWorldPointToThree`) πήγαινε σωστά. Ίδια
 * οικογένεια με τα overlays χωρίς projector που βρήκε το Β1 — ο κανόνας του `topo-display-frame`:
 * «ό,τι ΒΓΑΙΝΕΙ στο χαρτί περνά από `project`». Ένα κλικ που μετακινεί την όψη ΒΓΑΙΝΕΙ στο χαρτί.
 *
 * ── Γιατί εδώ και όχι στο `review-focus` ──────────────────────────────────────────────────────
 * Το `review-focus` είναι αγνωστικό πλαισίου και το χρησιμοποιεί και το «Μοντέλο από σχέδιο», του οποίου τα
 * σημεία είναι ΗΔΗ DISPLAY. Η γνώση «αυτά τα σημεία είναι ΕΓΣΑ» ανήκει στην τοπογραφία — άρα ένα topo
 * σύνορο, που το περνούν ΟΛΟΙ οι τοπογραφικοί καταναλωτές· ο επόμενος δεν γεννιέται χωρίς αυτό.
 *
 * ── Ένα κουτί, και για τις δύο όψεις ───────────────────────────────────────────────────────────
 * Το κουτί χτίζεται από τα **προβεβλημένα** σημεία: η 3Δ σκηνή κάθεται κι αυτή στο DISPLAY πλαίσιο
 * (`topoWorldPointToThree` προβάλλει πρώτα), οπότε το ίδιο `halfExtentM` πλαισιώνει σωστά και την κάμερα — και
 * σε στραμμένο έργο είναι το σφιχτό κουτί της οθόνης, όχι το κουτί ΕΓΣΑ που περιστράφηκε. Ο 3Δ resolver
 * παίρνει το κέντρο **πίσω σε WORLD** (`unproject` του ίδιου κέντρου): εκεί ζουν ο TIN και τα υψόμετρα, και
 * επειδή είναι ο ακριβής αντίστροφος, το σημείο της κάμερας προβάλλεται ακριβώς στο κέντρο του 2Δ κουτιού.
 *
 * @see ../coordination/review-focus.ts — η δρομολόγηση 2Δ/3Δ (αμετάβλητη)
 * @see ./topo-display-frame.ts — η γέφυρα WORLD↔DISPLAY (SSoT)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WorldTriple } from '../../bim-3d/viewport/plan-to-world-math';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import {
  focusReviewTarget,
  reviewFocusExtent,
  type ReviewFocusExtent,
} from '../coordination/review-focus';
import { getTopoDisplayProjector, projectWorldPoints, unprojectDisplayPoint } from './topo-display-frame';

/**
 * Περιθώριο (canonical mm) γύρω από το εύρημα — ΕΝΑ σημείο για όλες τις τοπογραφικές λίστες (ADR-920 Β3.5):
 *   - `point` (15 μ) — ένα QA εύρημα ή μια σύγκρουση είναι ΣΗΜΕΙΟ, και κρίνεται μόνο δίπλα στους γείτονές του
 *     (αυτό το κάνει «λάθος»)· άρα κουτί 30 μ, όχι τα εκατοστά που θέλει μια σύγκρουση BIM.
 *   - `line` (5 μ) — μια ασυνέχεια (υποψήφια ή δεσμευμένη) είναι ΓΡΑΜΜΗ: το πλαίσιο το ορίζει το μήκος της και το
 *     περιθώριο απλώς την ξεκολλάει από την άκρη της οθόνης.
 */
export const TOPO_REVIEW_FOCUS_PAD_MM = { point: 15_000, line: 5_000 } as const;

/** Ό,τι χρειάζεται για να πλαισιωθεί ΕΝΑ τοπογραφικό εύρημα. */
export interface TopoReviewFocusFrame {
  /** Το κουτί σε DISPLAY — 2Δ fit/centre και 3Δ half-extent. */
  readonly extent: ReviewFocusExtent;
  /** Το κέντρο του κουτιού πίσω σε WORLD (ΕΓΣΑ mm) — εκεί ρωτά ο 3Δ resolver για υψόμετρο. */
  readonly worldCentre: Point2D;
}

/**
 * Pure: τα WORLD σημεία ενός ευρήματος → το DISPLAY κουτί του + το WORLD κέντρο του. `null` projector =
 * μη-γεωαναφερμένο (ταυτότητα). `null` αποτέλεσμα όταν δεν μένει τίποτα πεπερασμένο (ίδιος κανόνας με το
 * {@link reviewFocusExtent}: ο καλών δεν μετακινεί τίποτα).
 */
export function topoReviewFocusFrame(
  worldPoints: readonly Point2D[],
  padMm: number,
  projector: WorldToDisplayProjector | null,
): TopoReviewFocusFrame | null {
  const extent = reviewFocusExtent(projectWorldPoints(worldPoints, projector), padMm);
  if (!extent) return null;
  return { extent, worldCentre: unprojectDisplayPoint(extent.centre, projector) };
}

/**
 * Μετακίνησε τη ζωντανή όψη στο τοπογραφικό εύρημα με κορυφές `worldPoints` (ΕΓΣΑ mm).
 *
 * `resolveWorld` παραμένει thunk (σε κάτοψη η 3Δ μετατροπή είναι σπατάλη) και παίρνει το WORLD κέντρο του
 * κουτιού. Επιστρέφει `false` όταν δεν υπήρχε τίποτα να πλαισιωθεί — ο καλών έχει ήδη φωτίσει τη γραμμή.
 */
export function focusTopoReviewTarget(
  worldPoints: readonly Point2D[],
  padMm: number,
  resolveWorld: (worldCentre: Point2D) => WorldTriple | null,
  preserveZoom: boolean,
): boolean {
  const frame = topoReviewFocusFrame(worldPoints, padMm, getTopoDisplayProjector());
  if (!frame) return false;
  focusReviewTarget(frame.extent, () => resolveWorld(frame.worldCentre), preserveZoom);
  return true;
}
