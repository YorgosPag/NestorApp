/**
 * ADR-363/449 — Αντιπροσωπευτικό ΕΣΩΤΕΡΙΚΟ σημείο πολυγώνου (pole-of-inaccessibility approx).
 *
 * Επιστρέφει ένα σημείο **εγγυημένα μέσα στο συμπαγές υλικό** του footprint, με **μέγιστη
 * απόσταση από την περίμετρο**. Για convex πολύγωνο ≈ centroid· για **κοίλο** (Γ/Τ/Π, L/T/U)
 * το γεωμετρικό centroid/bbox-center μπορεί να πέσει **έξω από το υλικό** (στην εγκοπή) — εδώ
 * επιστρέφεται σημείο στο κέντρο του ευρύτερου σκέλους.
 *
 * Χρήση (ADR-363/449): θέση της λαβής **περιστροφής** ενός freeform δομικού στοιχείου — σε ένα
 * καθαρό εσωτερικό σημείο, μακριά από τις λαβές γωνιών/πλευρών (που ζουν στην περίμετρο), ώστε να
 * μη συμπίπτει με καμία. Pure· REUSE `pointInPolygon` + `polygonCentroid` (μηδέν duplicate).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import type { Point3D } from '../../types/bim-base';
import type { Point2D } from '../../../rendering/types/Types';
import { pointInPolygon, polygonCentroid } from './polygon-utils';
// REUSE του κανονικού SSoT απόστασης σημείου↔τμήματος (systems/guides) — το ΙΔΙΟ που χρησιμοποιούν
// ήδη `structural-finish-scene` / `building-footprint` / `envelope-column-bridge` (μηδέν duplicate).
import { pointToSegmentDistance } from '../../../systems/guides';

type XY = Point2D;

/** Ελάχιστη απόσταση σημείου από την περίμετρο (min over edges· REUSE `pointToSegmentDistance`). */
function clearanceToBoundary(p: XY, verts: readonly XY[]): number {
  let min = Number.POSITIVE_INFINITY;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const d = pointToSegmentDistance(p, verts[i], verts[(i + 1) % n]);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Εσωτερικό σημείο με μέγιστη απόσταση από την περίμετρο **μαζί με αυτή την clearance**
 * (min distance του σημείου από κάθε ακμή). Υποψήφια: το centroid + τα μέσα ΟΛΩΝ των ζευγών
 * κορυφών (O(n²), n μικρό σε δομικές διατομές)· κρατά αυτό που είναι **μέσα** στο πολύγωνο με τη
 * μεγαλύτερη clearance. Fallback (degenerate) → centroid με clearance 0.
 *
 * ADR-520 — η clearance εκτίθεται ώστε ο caller (free-reshape rotation handle) να μπορεί να
 * μετατοπίσει μια δεύτερη λαβή κατά απόσταση `< clearance` και να μένει **εγγυημένα μέσα** στο
 * σώμα (ο εγγεγραμμένος δίσκος ακτίνας clearance γύρω από το σημείο είναι όλος εντός πολυγώνου).
 */
export function interiorAnchorPointWithClearance(verts: readonly XY[]): { point: XY; clearance: number } {
  const n = verts.length;
  const poly3: Point3D[] = verts.map((v) => ({ x: v.x, y: v.y, z: 0 }));
  const centroid = polygonCentroid(poly3);
  if (n < 3) return { point: centroid, clearance: 0 };

  const candidates: XY[] = [centroid];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      candidates.push({ x: (verts[i].x + verts[j].x) / 2, y: (verts[i].y + verts[j].y) / 2 });
    }
  }
  let best: XY = centroid;
  let bestClearance = -1;
  for (const c of candidates) {
    if (!pointInPolygon(c, poly3)) continue;
    const cl = clearanceToBoundary(c, verts);
    if (cl > bestClearance) {
      bestClearance = cl;
      best = c;
    }
  }
  return { point: best, clearance: Math.max(bestClearance, 0) };
}

/**
 * Εσωτερικό σημείο με μέγιστη απόσταση από την περίμετρο. Thin wrapper πάνω στο
 * {@link interiorAnchorPointWithClearance} (το σημείο μόνο) — backward-compatible SSoT.
 */
export function interiorAnchorPoint(verts: readonly XY[]): XY {
  return interiorAnchorPointWithClearance(verts).point;
}
