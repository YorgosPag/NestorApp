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
 * ## Η ΔΕΥΤΕΡΗ κατεύθυνση — η ΕΙΣΕΡΧΟΜΕΝΗ πύλη (ADR-718 §Α)
 * Το M10f έχτισε τη μισή γέφυρα. Η άλλη μισή έλειπε, και κόστισε το blocker του ADR-718: ένας
 * **καταναλωτής** του σχεδίου που τροφοδοτεί το τοπογραφικό υποσύστημα (πολυγραμμή → όριο
 * οικοπέδου, γραμμή → ασυνέχεια) διαβάζει κορυφές σε **DISPLAY** και τις παρέδιδε στο
 * `TopoPointStore`, που είναι **WORLD**. Σε μη-γεωαναφερμένο έργο τα δύο ταυτίζονται, οπότε το
 * κενό ήταν αόρατο σε 489 tests — και μοιραίο σε **κάθε** αληθινό έργο, όπου η αποτύπωση είναι
 * ΕΓΣΑ. Άρα ο κανόνας είναι συμμετρικός:
 *
 *   > Ό,τι ΒΓΑΙΝΕΙ στο χαρτί περνά από `project`. Ό,τι ΜΠΑΙΝΕΙ από το χαρτί περνά από `unproject`.
 *
 * Και οι δύο κατευθύνσεις ζουν εδώ **επίτηδες**: η μέρα που θα ζούσαν σε δύο modules είναι η
 * μέρα που η μία θα διορθωνόταν και η άλλη όχι.
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

/**
 * Ο κοινός πυρήνας **και των δύο** κατευθύνσεων. Το `project` και το `unproject` έχουν την ίδια
 * υπογραφή (`(x, y) => Point2D`), άρα η ακολουθία κορυφών μεταφέρεται με τον ίδιο βρόχο και η
 * κατεύθυνση είναι **δεδομένο**, όχι δεύτερο σώμα συνάρτησης.
 *
 * Δύο δίδυμοι βρόχοι εδώ ήταν ακριβώς ο κλώνος που έπιασε το CHECK 3.28 (N.18) — και η βλάβη που
 * φυλάει δεν είναι αισθητική: ο ένας βρόχος θα αποκτούσε κάποτε fast path ή guard, ο άλλος όχι,
 * και οι δύο κατευθύνσεις της ίδιας γέφυρας θα απέκλιναν σιωπηλά. Ίδιο σκεπτικό με το να ζουν
 * `project`/`unproject` στο ίδιο module.
 *
 * `null` projector ⇒ **αντίγραφα**, ποτέ η ίδια αναφορά (βλ. {@link unprojectDisplayPoints}).
 */
function mapPointSequence(
  points: readonly Point2D[],
  projector: WorldToDisplayProjector | null,
  direction: 'project' | 'unproject',
): Point2D[] {
  if (!projector) return points.map((p) => ({ x: p.x, y: p.y }));
  const map = projector[direction];
  return points.map((p) => map(p.x, p.y));
}

/** Το ίδιο για μια ακολουθία κορυφών (πολυγραμμή, δακτύλιος, σταυρός καννάβου). */
export function projectWorldPoints(
  points: readonly Point2D[],
  projector: WorldToDisplayProjector | null,
): Point2D[] {
  return mapPointSequence(points, projector, 'project');
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
 * DISPLAY (τοπικά mm) → WORLD (ΕΓΣΑ mm) για **μία** κορυφή. `null` projector ⇒ αντίγραφο.
 *
 * Ο ακριβής αντίστροφος του {@link projectWorldPoint} — ίδιος πυρήνας `RigidMap`, οπότε οι δύο
 * κατευθύνσεις δεν μπορούν να αποκλίνουν (ADR-650 M10b).
 */
export function unprojectDisplayPoint(p: Point2D, projector: WorldToDisplayProjector | null): Point2D {
  return projector ? projector.unproject(p.x, p.y) : { x: p.x, y: p.y };
}

/**
 * Το ίδιο για μια ακολουθία κορυφών **που ήρθε από οντότητα του σχεδίου** — δακτύλιος ορίου
 * οικοπέδου, πολυγραμμή ασυνέχειας.
 *
 * ⚠️ Επιστρέφει **πάντα νέα** αντικείμενα, ακόμη και σε `null` projector. Δεν είναι σπατάλη:
 * ο δακτύλιος αποθηκεύεται στο store και συγκρίνεται με **ταυτότητα** (`topo-surface.ts` memo),
 * ενώ οι κορυφές της οντότητας ανήκουν στη σκηνή και μπορούν να μεταλλαχθούν από κάτω του.
 * Κοινή αναφορά μεταξύ σκηνής και store θα ήταν aliasing που καμία από τις δύο πλευρές δεν
 * δηλώνει.
 */
export function unprojectDisplayPoints(
  points: readonly Point2D[],
  projector: WorldToDisplayProjector | null,
): Point2D[] {
  return mapPointSequence(points, projector, 'unproject');
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
