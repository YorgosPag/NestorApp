/**
 * ADR-449 — Structural Finish exterior/interior classifier.
 *
 * Extracted from `structural-finish-scene.ts` (Google file-size SSoT, N.7.1). ΕΝΑ σημείο
 * για το «exterior ή interior» μιας εκτεθειμένης υπο-ακμής δομικού στοιχείου (κολόνα/δοκάρι):
 *   1. ρητό `envelopeFunction` ('exterior'/'interior') υπερισχύει.
 *   2. αλλιώς γεωμετρικά: exterior όταν το midpoint βρίσκεται πάνω στο εξώτατο όριο (outer
 *      ring) ενός component που ΠΕΡΙΚΛΕΙΕΙ χώρο (holes>0 = πραγματικό περίγραμμα κτιρίου).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { EnvelopeFunction } from '../types/thermal-envelope-types';
import { computeBuildingFootprint } from '../geometry/building-footprint';
import { pointToSegmentDistance } from '../../systems/guides';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { toPt2 } from './structural-finish-point';
import type { FinishEdgeClassifier } from './structural-finish-resolver';
import type { WallFinishObstacle } from './structural-finish-scene';

/** Ανοχή (canvas units ανά mm) — 2mm για «πάνω στο εξώτατο όριο». */
export const EXTERIOR_EDGE_TOL_MM = 2;

/** Εξώτατες ακμές components που περικλείουν χώρο (holes>0) → exterior reference. */
function collectExteriorEdges(walls: readonly WallFinishObstacle[]): Array<[Pt2, Pt2]> {
  const fp = computeBuildingFootprint(
    walls.map((w) => ({ id: w.id, kind: w.kind, params: w.params })),
  );
  const edges: Array<[Pt2, Pt2]> = [];
  for (const comp of fp.components) {
    if (comp.holes.length === 0) continue; // open-structure → όχι exterior boundary
    const pts = comp.outer.points.points; // FootprintRing.points = Polyline3D → .points = Point3D[]
    for (let i = 0; i < pts.length; i++) {
      edges.push([toPt2(pts[i]), toPt2(pts[(i + 1) % pts.length])]);
    }
  }
  return edges;
}

/**
 * Build classifier για δομικό στοιχείο (κολόνα/δοκάρι): override-aware + geometric
 * outer-ring test. Entity-agnostic — μόνο `envelopeFunction` + walls + tol. ΕΝΑ SSoT
 * για κολόνες ΚΑΙ δοκάρια (πρώην `buildColumnClassifier`).
 */
export function buildStructuralFinishClassifier(
  envelopeFunction: EnvelopeFunction | undefined,
  walls: readonly WallFinishObstacle[],
  tol: number,
): FinishEdgeClassifier {
  if (envelopeFunction === 'exterior') return () => 'exterior';
  if (envelopeFunction === 'interior') return () => 'interior';
  const exteriorEdges = collectExteriorEdges(walls);
  return (mid) => {
    for (const [a, b] of exteriorEdges) {
      if (pointToSegmentDistance(mid, a, b) <= tol) return 'exterior';
    }
    return 'interior';
  };
}
