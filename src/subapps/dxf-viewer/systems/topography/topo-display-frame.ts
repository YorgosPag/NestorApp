/**
 * ADR-650 §M10f — WORLD (ΕΓΣΑ) → DISPLAY frame: το ΕΝΑ πέρασμα που κάνει κάθε τοπογραφικό προϊόν.
 *
 * ── Η κλάση του σφάλματος που κλείνει αυτό το module ────────────────────────────────────────
 * Η τοπογραφία γεννιέται σε ΕΓΣΑ'87 (`TopoPointStore` → mm world), το σχέδιο ζει σε τοπικές
 * γύρω από το 0, και η γέφυρα είναι ΜΙΑ: ο `WorldToDisplayProjector` (ADR-650 M10b). Κάθε
 * παραγωγός που *κάθεται* στη σκηνή πρέπει να περάσει από αυτή τη γέφυρα — αλλιώς γράφει
 * συντεταγμένες 4·10⁵ mm σε σκηνή που ζει στα 10² mm: αόρατος (ADR-635 culling), άπιαστος,
 * και ο χρήστης βλέπει «η γεωαναφορά δεν έκανε τίποτα».
 *
 * Μέχρι εδώ η προβολή ήταν **αντιγραμμένη** σε δύο σημεία (`regenerate-topo.projectContoursToLocal`,
 * `topo-surface-entity.projectFootprintToDisplay`) και **απούσα** σε τέσσερα (interactive contours,
 * point labels, baked grid, live graticule). Ένα αντίγραφο ανά παραγωγό σημαίνει ότι ο επόμενος
 * παραγωγός γεννιέται χωρίς αυτό — που είναι ακριβώς ό,τι έγινε. Άρα: ΕΝΑ σπίτι.
 *
 * ## Ο κανόνας (τον ρωτάει κάθε νέος παραγωγός)
 *   1. **Η ΓΕΩΜΕΤΡΙΑ προβάλλεται.** Ό,τι κάθεται στο χαρτί περνά από `project`.
 *   2. **Το ΚΕΙΜΕΝΟ δεν προβάλλεται ΠΟΤΕ.** Το «Χ407723.104» μιας κορυφής οικοπέδου είναι
 *      **νομικό μέγεθος** σε ΕΓΣΑ — προβάλλοντάς το θα τυπώναμε τοπικές συντεταγμένες με
 *      ετικέτα ΕΓΣΑ. Η θέση του κειμένου προβάλλεται· η ΤΙΜΗ του όχι.
 *   3. **Τα offsets του υπομνήματος είναι display-frame.** Τα glyphs σχεδιάζονται
 *      οριζόντια στο χαρτί· αν στρίψουμε το offset μαζί με τον κάναβο, η ετικέτα κάθεται
 *      πάνω στην κουκίδα σε στραμμένο έργο. Η ΓΕΩΜΕΤΡΙΑ του καννάβου (οι βραχίονες του
 *      σταυρού) όμως στρίβει — δείχνει τη διεύθυνση των γραμμών ΕΓΣΑ.
 *
 * Καθαρό module: οι helpers δέχονται τον projector (unit-testable, store-free). Η **μία**
 * είσοδος που διαβάζει store είναι το {@link getTopoDisplayProjector}.
 *
 * @see ../geo-referencing/geo-transform.ts — ο rigid μετασχηματισμός (SSoT)
 * @see ./__tests__/topo-display-frame.test.ts — παραμετρικό anchor πάνω σε ΟΛΟΥΣ τους παραγωγούς
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { getActiveWorldToDisplayProjector } from '../geo-referencing/geo-reference-store';
import type { ContourLine } from './topo-types';
import type { WorldRectMm } from './topo-grid-model';

/**
 * Ο ενεργός projector, **κανονικοποιημένος σε `null` όταν είναι identity** — έτσι το fast path
 * («μη-γεωαναφερμένο έργο ⇒ τίποτα δεν αλλάζει, byte-for-byte») είναι ένας έλεγχος `null` που
 * δεν ξεχνιέται, αντί για ένα `if (projector.isIdentity)` που κάθε καλών ξαναγράφει.
 */
export function getTopoDisplayProjector(): WorldToDisplayProjector | null {
  const projector = getActiveWorldToDisplayProjector();
  return projector.isIdentity ? null : projector;
}

/** WORLD (ΕΓΣΑ mm) → DISPLAY (τοπικά mm) για ένα σημείο. `null` projector ⇒ no-op. */
export function projectWorldPoint(p: Point2D, projector: WorldToDisplayProjector | null): Point2D {
  return projector ? projector.project(p.x, p.y) : p;
}

/** Το ίδιο για μια ακολουθία κορυφών (πολυγραμμή, δακτύλιος, σταυρός καννάβου). */
export function projectWorldPoints(
  points: readonly Point2D[],
  projector: WorldToDisplayProjector | null,
): Point2D[] {
  if (!projector) return points.map((p) => ({ x: p.x, y: p.y }));
  return points.map((p) => projector.project(p.x, p.y));
}

/** Το ίδιο για δακτυλίους (footprint επιφάνειας). */
export function projectWorldRings(
  rings: readonly (readonly Point2D[])[],
  projector: WorldToDisplayProjector | null,
): Point2D[][] {
  if (!projector) return rings as Point2D[][];
  return rings.map((ring) => projectWorldPoints(ring, projector));
}

/**
 * Το ίδιο για ισοϋψείς: **μόνο οι κορυφές** μετακινούνται. Το `level` είναι υψόμετρο (Z) και ο
 * rigid μετασχηματισμός είναι επίπεδος (ADR-650 M10b: «Z/elevation is never touched») — το
 * υψόμετρο μιας ισοϋψούς δεν αλλάζει επειδή μετακινήθηκε το σχέδιο.
 */
export function projectContourLines(
  contours: readonly ContourLine[],
  projector: WorldToDisplayProjector | null,
): ContourLine[] {
  if (!projector) return contours as ContourLine[];
  return contours.map((c) => ({ ...c, vertices: projectWorldPoints(c.vertices, projector) }));
}

/**
 * DISPLAY ορθογώνιο → το WORLD **AABB** που το περιέχει (μέσω `unproject` των τεσσάρων γωνιών).
 *
 * Ο ζωντανός κάναβος ξέρει τι βλέπει η οθόνη σε DISPLAY· ο `topo-grid-model` απαντά «ποιες
 * στρογγυλές γραμμές ΕΓΣΑ πέφτουν μέσα». Οι δύο μιλούν διαφορετικό σύστημα. Σε στραμμένο έργο
 * το unprojected ορθογώνιο είναι **λοξό**, γι' αυτό επιστρέφεται το περιβάλλον AABB: υπερ-καλύπτει
 * (μερικοί σταυροί εκτός οθόνης, μηδέν κόστος στην πράξη) αντί να κόψει κάναβο που φαίνεται.
 */
export function unprojectRectToWorld(
  rect: WorldRectMm,
  projector: WorldToDisplayProjector | null,
): WorldRectMm {
  if (!projector) return rect;
  const corners = [
    projector.unproject(rect.minX, rect.minY),
    projector.unproject(rect.maxX, rect.minY),
    projector.unproject(rect.minX, rect.maxY),
    projector.unproject(rect.maxX, rect.maxY),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}
