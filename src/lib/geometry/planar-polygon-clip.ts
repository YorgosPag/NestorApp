/**
 * Sutherland-Hodgman polygon clipping (SSoT) — «πολύγωνο ∩ ΚΥΡΤΟΣ κόφτης».
 *
 * Καθαρή επίπεδη γεωμετρία χωρίς μονάδες. Ζούσε στο `subapps/dxf-viewer/bim/geometry/shared/polygon-clip-utils.ts`,
 * που **επανεξάγει** πλέον από εδώ (πρότυπο `planar-polygon.ts`): η δημόσια αγγελία οικοπέδου (ADR-920 Β1)
 * κόβει το ανάγλυφο στο όριο του οικοπέδου με την ίδια ερώτηση και δεν επιτρέπεται να εισάγει από το subapp
 * (CHECK 3.62).
 *
 * ⚠️ **ΜΗΝ προσθέσεις εισαγωγή εκτός `planar-polygon`.** Η αξία του αρχείου είναι ότι δεν σέρνει τίποτα.
 *
 * @module lib/geometry/planar-polygon-clip
 */

import { shoelaceArea, type PlanarPoint } from './planar-polygon';


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
  subject: readonly PlanarPoint[],
  clip: readonly PlanarPoint[],
): PlanarPoint[] {
  if (subject.length < 3 || clip.length < 3) return [];
  let output: PlanarPoint[] = subject.slice();
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
 * Planimetric intersection «πολύγωνο ∩ ΚΥΡΤΟΣ κόφτης», σε καθαρό {@link PlanarPoint} — το ΕΝΑ σπίτι
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
  subject: readonly PlanarPoint[],
  convexClipper: readonly PlanarPoint[],
): PlanarPoint[] {
  if (subject.length < 3 || convexClipper.length < 3) return [];
  // ADR-789 — μηδέν lift: ο S-H δέχεται `PlanarPoint`, άρα το 2D πολύγωνο μπαίνει αυτούσιο.
  const ccwClipper = shoelaceArea(convexClipper) >= 0 ? convexClipper : [...convexClipper].reverse();
  return clipPolygonBySH(subject, ccwClipper).map((p) => ({ x: p.x, y: p.y }));
}

// ─── S-H internal helpers ─────────────────────────────────────────────────────

/** True when `pt` is on the left side of directed edge A→B (CCW = inside). */
function shIsInside(pt: PlanarPoint, a: PlanarPoint, b: PlanarPoint): boolean {
  return (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x) >= 0;
}

/** Intersection of segment p1→p2 with infinite line through a→b. */
function shIntersect(p1: PlanarPoint, p2: PlanarPoint, a: PlanarPoint, b: PlanarPoint): PlanarPoint {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = b.x - a.x;
  const dy2 = b.y - a.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return { x: p1.x, y: p1.y };
  const t = ((a.x - p1.x) * dy2 - (a.y - p1.y) * dx2) / denom;
  return { x: p1.x + t * dx1, y: p1.y + t * dy1 };
}
