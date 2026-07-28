/**
 * ADR-650 M6 (Γ) — pure core: «κλειστή γραμμή του σχεδίου → όριο υπολογισμού όγκων».
 *
 * The οικόπεδο is already drawn on the plan. Making the user re-trace it would create a second
 * source of truth for the same polygon — so the boundary is PICKED, exactly like the breaklines
 * of M2-Β (Civil 3D: a surface boundary is an existing closed polyline you select).
 *
 * Only CLOSED linear entities qualify: an open polyline has no inside, and «count the earth
 * inside this open line» has no meaning. Refusing it is honest; auto-closing it would invent a
 * boundary the surveyor never drew — and quietly change the volume.
 *
 * ── ΤΑ ΔΥΟ ΠΛΑΙΣΙΑ (ADR-718 §Α — το blocker που πλήρωσε αυτό το αρχείο) ──────────────────────
 * Η οντότητα ζει σε **DISPLAY** (τοπικά mm του σχεδίου, γύρω από το 0). Το `TopoBoundary` το
 * καταναλώνουν αποκλειστικά μηχανές που δουλεύουν σε **WORLD** (ΕΓΣΑ canonical mm): η κοπή του
 * TIN (`tin-clip-to-boundary`), οι όγκοι (`cut-fill`), οι ετικέτες κορυφών, το QA. Ο τύπος το
 * **δήλωνε** WORLD· ο builder παρέδιδε DISPLAY. Σε μη-γεωαναφερμένο έργο τα δύο ταυτίζονται —
 * γι' αυτό το κενό πέρασε από κάθε test — ενώ σε αληθινό (ΕΓΣΑ ~4·10⁸ mm έναντι σχεδίου ~10⁵)
 * η τομή ήταν **κενή**, δηλαδή «η κοπή εξαφανίζει το ανάγλυφο».
 *
 * Γι' αυτό ο projector είναι **υποχρεωτική παράμετρος** και όχι προαιρετική με default: υπάρχουν
 * δύο καλούντες (το εργαλείο επιλογής και ο reconciler του Μ3) και **αρκεί ο ένας να τον ξεχάσει**
 * για να ξαναγράψει DISPLAY κορυφές πάνω σε WORLD μετά το πρώτο σύρσιμο λαβής. Υποχρεωτική
 * παράμετρος = ο μεταγλωττιστής το πιάνει· default τιμή = το πιάνει ο χρήστης, σε παραγωγή.
 */

import type { Entity } from '../../types/entities';
import { isPolylineEntity, isLWPolylineEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { unprojectDisplayPoints } from './topo-display-frame';
import type { TopoBoundary } from './topo-types';

/**
 * Οι κορυφές που κάνουν για όριο, **στο πλαίσιο της οντότητας** (DISPLAY) — ή `null`.
 *
 * Ξεχωριστό από το χτίσιμο επειδή το ερώτημα «κάνει για όριο;» είναι **τοπολογικό** (κλειστή;
 * ≥3 κορυφές;) και άρα αναλλοίωτο σε κάθε rigid μετασχηματισμό. Έτσι το κατηγόρημα του pick
 * δεν χρειάζεται projector — και δεν μπαίνει στον πειρασμό να περάσει `null` «γιατί δεν πειράζει»,
 * που είναι ακριβώς πώς μια τέτοια παράλειψη ξαναγεννιέται.
 */
function closedRingVerticesOf(entity: Entity): readonly Point2D[] | null {
  if (!isPolylineEntity(entity) && !isLWPolylineEntity(entity)) return null;
  if (entity.closed !== true || entity.vertices.length < 3) return null;
  return projectVerticesTo2D(entity.vertices);
}

/** A boundary needs an inside: closed polyline / lwpolyline with at least a triangle's worth of vertices. */
export function isBoundaryCandidate(entity: Entity): boolean {
  return closedRingVerticesOf(entity) !== null;
}

/**
 * Build the site boundary from a closed linear entity (WORLD canonical mm, implicitly closed).
 * Returns `null` for anything that is not a usable closed ring — the caller reports it; the
 * volume engine is never handed a boundary it cannot trust.
 *
 * The predicate above shares {@link closedRingVerticesOf} so «what may be picked» and «what is
 * actually built» can never drift apart (the classic pick-tool bug: the cursor accepts a line the
 * builder rejects).
 *
 * @param projector ο ενεργός WORLD→DISPLAY (`getTopoDisplayProjector()`), ή `null` σε
 *   μη-γεωαναφερμένο έργο. Ο δακτύλιος γεννιέται **ήδη σε WORLD**, οπότε κανένας καταναλωτής
 *   δεν χρειάζεται να ξέρει ότι υπάρχει γεωαναφορά.
 */
export function buildBoundaryFromEntity(
  entity: Entity,
  projector: WorldToDisplayProjector | null,
): TopoBoundary | null {
  const displayVertices = closedRingVerticesOf(entity);
  if (!displayVertices) return null;
  return {
    vertices: unprojectDisplayPoints(displayVertices, projector),
    sourceEntityId: entity.id,
  };
}
