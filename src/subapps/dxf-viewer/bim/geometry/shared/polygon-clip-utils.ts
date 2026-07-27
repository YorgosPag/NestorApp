/**
 * Sutherland-Hodgman polygon clipping (ADR-363 Phase 5.5i, shared).
 *
 * Extracted verbatim from `polygon-utils.ts` (N.7.1 500-line cap). Re-exported
 * from `polygon-utils.ts` so all existing importers keep working unchanged.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { Point3D } from '../../types/bim-base';
import type { Point2D } from '../../../rendering/types/Types';
import { polygonArea, polygonBbox, shoelaceArea } from './polygon-utils';

/**
 * Sutherland-Hodgman polygon clip. Clips `subject` against a **convex** `clip`
 * polygon. Returns the clipped output polygon (possibly empty).
 *
 * Contract:
 *   - `clip` MUST be convex (CCW winding). Beam outlines from `buildOutlineRect`
 *     are always convex rectangles → this contract is satisfied for Phase 5.5i+.
 *   - `subject` may be concave (slab outline).
 *   - Returns [] when the polygons have no intersection.
 *
 * Algorithm reference: Sutherland-Hodgman (1974). For each clip edge the
 * output list is clipped against the half-plane defined by that edge.
 * "Inside" = left of the directed edge (CCW convention).
 */
export function clipPolygonBySH(
  subject: readonly Point3D[],
  clip: readonly Point3D[],
): Point3D[] {
  if (subject.length < 3 || clip.length < 3) return [];
  let output: Point3D[] = subject.slice() as Point3D[];
  const n = clip.length;

  for (let i = 0; i < n; i++) {
    if (output.length === 0) return [];
    const input = output;
    output = [];
    const edgeA = clip[i];
    const edgeB = clip[(i + 1) % n];

    for (let j = 0; j < input.length; j++) {
      const curr = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const currInside = shIsInside(curr, edgeA, edgeB);
      const prevInside = shIsInside(prev, edgeA, edgeB);

      if (currInside) {
        if (!prevInside) output.push(shIntersect(prev, curr, edgeA, edgeB));
        output.push(curr);
      } else if (prevInside) {
        output.push(shIntersect(prev, curr, edgeA, edgeB));
      }
    }
  }

  return output;
}

/**
 * Compute the intersection area (mm²) between two polygons using S-H clipping.
 *
 * `beamVertices` MUST be convex (i.e. beam rectangle outline). Fast AABB
 * rejection applied first — returns 0 when bbox do not overlap.
 */
export function polygonIntersectionAreaMm2(
  slabVertices: readonly Point3D[],
  beamVertices: readonly Point3D[],
): number {
  if (slabVertices.length < 3 || beamVertices.length < 3) return 0;

  // Fast AABB reject.
  const sb = polygonBbox(slabVertices);
  const bb = polygonBbox(beamVertices);
  if (sb.max.x <= bb.min.x || bb.max.x <= sb.min.x) return 0;
  if (sb.max.y <= bb.min.y || bb.max.y <= sb.min.y) return 0;

  // S-H: slab = subject (may be concave), beam = clip (convex rectangle → exact).
  const clipped = clipPolygonBySH(slabVertices, beamVertices);
  return polygonArea(clipped);
}

/**
 * Planimetric intersection «πολύγωνο ∩ ΚΥΡΤΟΣ κόφτης», σε καθαρό {@link Point2D} — το ΕΝΑ σπίτι
 * για το boilerplate που περιβάλλει κάθε κλήση του {@link clipPolygonBySH} σε 2D συμφραζόμενα:
 * ανύψωση σε `z = 0`, **CCW re-winding του κόφτη**, και προβολή πίσω σε 2D.
 *
 * ⚠️ Το CCW re-winding δεν είναι αμυντικός θόρυβος. Το S-H διαβάζει «μέσα = αριστερά της
 * προσανατολισμένης ακμής», οπότε ένας **δεξιόστροφος** κόφτης απορρίπτει **κάθε** σημείο και το
 * αποτέλεσμα βγαίνει κενό **χωρίς λέξη** — στον υπολογισμό όγκων αυτό είναι χώμα που εξαφανίζεται
 * από την αναφορά, στην κοπή αναγλύφου είναι τρίγωνα που λείπουν από την επιφάνεια. Το σφάλμα
 * είναι σιωπηλό και στις δύο περιπτώσεις, γι' αυτό ο κανόνας ζει εδώ, μία φορά.
 *
 * Καλούντες (N.18 — μηδέν δίδυμο): `cut-fill.clipToBoundary` (τρίγωνο ∩ όριο οικοπέδου, ADR-650 M6)
 * και `tin-clip-to-boundary` (το ίδιο ερώτημα, για την κοπή της ίδιας της επιφάνειας, ADR-718).
 *
 * @param subject       Μπορεί να είναι **μη κυρτό** (το οικόπεδο· Γ-σχήμα είναι ο κανόνας).
 * @param convexClipper ΠΡΕΠΕΙ να είναι κυρτός· η φορά διορθώνεται εδώ. Τρίγωνο πάντα ικανοποιεί.
 */
export function clipPolygonByConvex2D(
  subject: readonly Point2D[],
  convexClipper: readonly Point2D[],
): Point2D[] {
  if (subject.length < 3 || convexClipper.length < 3) return [];
  const lift = (p: Point2D): Point3D => ({ x: p.x, y: p.y, z: 0 });
  const lifted = convexClipper.map(lift);
  const ccwClipper = shoelaceArea(lifted) >= 0 ? lifted : [...lifted].reverse();
  return clipPolygonBySH(subject.map(lift), ccwClipper).map((p) => ({ x: p.x, y: p.y }));
}

// ─── S-H internal helpers ─────────────────────────────────────────────────────

/** True when `pt` is on the left side of directed edge A→B (CCW = inside). */
function shIsInside(pt: Point3D, a: Point3D, b: Point3D): boolean {
  return (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x) >= 0;
}

/** Intersection of segment p1→p2 with infinite line through a→b. */
function shIntersect(p1: Point3D, p2: Point3D, a: Point3D, b: Point3D): Point3D {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = b.x - a.x;
  const dy2 = b.y - a.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return { x: p1.x, y: p1.y, z: 0 };
  const t = ((a.x - p1.x) * dy2 - (a.y - p1.y) * dx2) / denom;
  return { x: p1.x + t * dx1, y: p1.y + t * dy1, z: 0 };
}
