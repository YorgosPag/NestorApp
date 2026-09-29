/**
 * =============================================================================
 * PLANAR SNAP — έλξη σημείου σε κορυφές/ακμές γειτονικών δακτυλίων + ορθογώνιος περιορισμός
 * =============================================================================
 *
 * Ο επεξεργαστής χώρων (ADR-884 §4.14 Γ3γ-2β · §12 Δ9.6) σχεδιάζει δωμάτια που **μοιράζονται τοίχους**: μια γωνία που
 * πέφτει 3 cm δίπλα στη γωνία της κουζίνας είναι είτε κενό είτε επικάλυψη (που ο γραφέας αρνείται). Όπως το smart snapping
 * του Figma: **κορυφή πριν από ακμή** (η γωνία είναι πιο συγκεκριμένη πρόθεση), και μόνο μέσα σε ανοχή — έξω από αυτήν το
 * σημείο μένει ακριβώς όπου το έβαλε ο άνθρωπος.
 *
 * 🔑 **Χωρίς μονάδες**: ο καλών περνά την ανοχή στις μονάδες των σημείων (η οθόνη: px × μέτρα ανά px, ώστε η έλξη να είναι
 *   ίδια σε κάθε ζουμ).
 *
 * @module lib/geometry/planar-snap
 */

import { closestPointOnSegment, type PlanarPoint } from './planar-polygon';

export type PlanarSnapKind = 'vertex' | 'edge' | 'none';

export interface PlanarSnap {
  readonly point: PlanarPoint;
  readonly kind: PlanarSnapKind;
}

interface Candidate {
  readonly point: PlanarPoint;
  readonly distance: number;
}

function nearestVertex(point: PlanarPoint, rings: readonly (readonly PlanarPoint[])[]): Candidate | null {
  let best: Candidate | null = null;
  for (const ring of rings) {
    for (const v of ring) {
      const distance = Math.hypot(point.x - v.x, point.y - v.y);
      if (best === null || distance < best.distance) best = { point: { x: v.x, y: v.y }, distance };
    }
  }
  return best;
}

function nearestEdgePoint(point: PlanarPoint, rings: readonly (readonly PlanarPoint[])[]): Candidate | null {
  let best: Candidate | null = null;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const on = closestPointOnSegment(point, ring[i], ring[(i + 1) % ring.length]);
      const distance = Math.hypot(point.x - on.x, point.y - on.y);
      if (best === null || distance < best.distance) best = { point: on, distance };
    }
  }
  return best;
}

/**
 * **Έλξη σε δακτυλίους**: η πλησιέστερη κορυφή μέσα στην ανοχή· αλλιώς το πλησιέστερο σημείο ακμής μέσα στην ανοχή· αλλιώς
 * το ίδιο σημείο (`none`). Ανοχή ≤ 0 ⇒ ποτέ έλξη.
 */
export function snapToRings(point: PlanarPoint, rings: readonly (readonly PlanarPoint[])[], tolerance: number): PlanarSnap {
  if (tolerance > 0) {
    const vertex = nearestVertex(point, rings);
    if (vertex !== null && vertex.distance <= tolerance) return { point: vertex.point, kind: 'vertex' };
    const edge = nearestEdgePoint(point, rings);
    if (edge !== null && edge.distance <= tolerance) return { point: edge.point, kind: 'edge' };
  }
  return { point, kind: 'none' };
}

/**
 * **Ορθογώνιος περιορισμός** (Shift — Figma/Revit): το `to` κρατά μόνο τη μεγαλύτερη από τις δύο συνιστώσες ως προς το `from`,
 * δηλαδή η ακμή γίνεται οριζόντια ή κάθετη. Ισοπαλία ⇒ οριζόντια.
 */
export function constrainOrthogonal(from: PlanarPoint, to: PlanarPoint): PlanarPoint {
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}
