/**
 * ADR-524 / ADR-911 — «Όμοια πλαίσια ίδιου χρώματος»: ο χρωματικός σαρωτής ορθογωνίων.
 *
 * Ουδέτερο ως προς το ΤΙ θα χτιστεί μέσα στο πλαίσιο. Δύο καταναλωτές, μία υλοποίηση:
 *   - `bim/columns/column-batch-fill.ts` (ADR-524) — μαζική πλήρωση κολωνών/τοιχίων.
 *   - `bim/model-from-drawing/wall-proposal.ts` (ADR-911) — πρόταση τοίχων από το σχέδιο.
 *
 * Ζούσε στο `bim/columns/`, όπου ο μόνος λόγος που έμοιαζε «δικό του κολώνας» ήταν η
 * θέση του αρχείου: καμία γραμμή του δεν ξέρει τι είναι κολώνα (ADR-911, ενότητα 4.4).
 *
 * PURE module — μηδέν React/store. Το χρώμα εισάγεται ως `colorOf` resolver (ο caller το
 * χτίζει με `resolveEntityColorHex` + layers), ώστε η ανίχνευση χρώματος να ζει στο ΕΝΑ SSoT.
 *
 * @see ./wall-in-region.ts (region detection SSoT)
 * @see ../../systems/selection/select-similar-by-color.ts (resolveEntityColorHex SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  extractLineSegments,
  findRectanglesFromSegments,
  pickSegmentAt,
  type DetectedRectangle,
  type RegionLineSeg,
} from './wall-in-region';

/** Resolver resolved/rendered χρώματος (lowercase hex) μιας οντότητας· `null` αν άγνωστο. */
export type EntityColorResolver = (entity: Entity) => string | null;

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function near(p: Point2D, q: Point2D, tol: number): boolean {
  return Math.hypot(p.x - q.x, p.y - q.y) <= tol;
}

/**
 * Τα τμήματα-πηγή μιας ακμής a→b — ΟΛΑ, όχι ένα.
 *
 * ΠΡΩΤΑ ταύτιση άκρων (κάθε τμήμα που ενώνει ΑΥΤΕΣ τις δύο κορυφές, όποιας φοράς). Το
 * «πλησιέστερο στο μέσο» από μόνο του ΔΕΝ αρκεί — μετρημένο στο σχέδιο δοκιμής του ADR-911:
 *   · το κοντό άκρο ενός τοίχου σε κόμβο Τ κάθεται ΠΑΝΩ στη μακριά παρειά του γείτονα
 *     (απόσταση 0 και οι δύο) ⇒ η γραμμή του γείτονα έπαιρνε τη θέση της·
 *   · δύο τοίχοι που ακουμπούν άκρο με άκρο έχουν ο καθένας ΤΗ ΔΙΚΗ ΤΟΥ γραμμή στο κοινό
 *     άκρο (6 ζεύγη συμπιπτουσών γραμμών) ⇒ «μία γραμμή ανά ακμή» άφηνε τη δίδυμη ορφανή.
 *
 * Fallback στο μέσο ΜΟΝΟ όταν καμία γραμμή δεν ενώνει τις δύο κορυφές (ακμή που είναι
 * κομμάτι μακρύτερης γραμμής — πηγές άλλες από το corner-graph).
 */
function edgeSourceSegments(
  a: Point2D,
  b: Point2D,
  segments: readonly RegionLineSeg[],
  tol: number,
): readonly RegionLineSeg[] {
  const exact = segments.filter(
    (s) => (near(s.start, a, tol) && near(s.end, b, tol)) || (near(s.start, b, tol) && near(s.end, a, tol)),
  );
  if (exact.length > 0) return exact;
  const nearest = pickSegmentAt(midpoint(a, b), segments, tol);
  return nearest ? [nearest] : [];
}

/**
 * Τα ids των τμημάτων-πηγή των 4 ακμών ενός πλαισίου: ένας πίνακας ανά ακμή, σε σειρά ακμών.
 * Κενός πίνακας = καμία γραμμή-πηγή εντός ανοχής. Πάνω από ένα id = συμπίπτουσες γραμμές.
 */
export function rectEdgeSourceIds(
  rect: DetectedRectangle,
  segments: readonly RegionLineSeg[],
  tol: number,
): readonly (readonly string[])[] {
  const poly = rect.polygon;
  const perEdge: string[][] = [];
  for (let i = 0; i < 4; i++) {
    const ids = edgeSourceSegments(poly[i], poly[(i + 1) % 4], segments, tol)
      .map((s) => s.id)
      .filter((id): id is string => id !== undefined);
    perEdge.push([...new Set(ids)]);
  }
  return perEdge;
}

/**
 * Κυρίαρχο (majority) resolved χρώμα των 4 ακμών ενός πλαισίου: ακμή → τμήμα-πηγή
 * (`rectEdgeSourceIds`, μία ψήφος ανά ακμή) → οντότητα (`entityById`) → resolved χρώμα
 * (`colorOf`). Επιστρέφει το πιο συχνό hex, ή `null` αν καμία ακμή δεν αντιστοιχίστηκε.
 */
export function resolveRectFrameColorHex(
  rect: DetectedRectangle,
  segments: readonly RegionLineSeg[],
  tol: number,
  entityById: ReadonlyMap<string, Entity>,
  colorOf: EntityColorResolver,
): string | null {
  const counts = new Map<string, number>();
  for (const [id] of rectEdgeSourceIds(rect, segments, tol)) {
    if (!id) continue;
    const entity = entityById.get(id);
    if (!entity) continue;
    const hex = colorOf(entity);
    if (!hex) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  let best: { hex: string; n: number } | null = null;
  for (const [hex, n] of counts) {
    if (!best || n > best.n) best = { hex, n };
  }
  return best?.hex ?? null;
}

/**
 * Όλα τα κλειστά ορθογώνια που σχηματίζονται ΜΟΝΟ από οντότητες resolved χρώματος
 * `targetHex`. Επαναχρησιμοποιεί ΑΚΡΙΒΩΣ την ίδια region-detection SSoT — το μόνο
 * επιπλέον είναι το χρωματικό προ-φίλτρο των οντοτήτων.
 */
export function findSameColorRects(
  entities: readonly Entity[],
  targetHex: string,
  tol: number,
  colorOf: EntityColorResolver,
): DetectedRectangle[] {
  const sameColor = entities.filter((e) => colorOf(e) === targetHex);
  const segs = extractLineSegments(sameColor);
  return findRectanglesFromSegments(segs, tol);
}
