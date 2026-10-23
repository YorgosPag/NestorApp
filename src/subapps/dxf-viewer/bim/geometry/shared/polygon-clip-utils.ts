/**
 * Sutherland-Hodgman polygon clipping (ADR-363 Phase 5.5i, shared).
 *
 * Extracted verbatim from `polygon-utils.ts` (N.7.1 500-line cap). Re-exported
 * from `polygon-utils.ts` so all existing importers keep working unchanged.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { PlanarPoint } from '../../types/bim-base';
import { polygonArea } from './polygon-utils';
import { bboxOf, bboxOverlap } from './xy-bounds';
import { clipPolygonBySH } from '@/lib/geometry/planar-polygon-clip';

// ADR-920 Β1 — ο S-H και το «πολύγωνο ∩ κυρτός κόφτης» ζουν στο `@/lib/geometry/planar-polygon-clip`:
// η δημόσια αγγελία οικοπέδου κόβει το ανάγλυφο με την ίδια ερώτηση (CHECK 3.62). Επανεξαγωγή — ίδια σώματα.
export { clipPolygonBySH, clipPolygonByConvex2D } from '@/lib/geometry/planar-polygon-clip';

/**
 * Compute the intersection area (mm²) between two polygons using S-H clipping.
 *
 * `beamVertices` MUST be convex (i.e. beam rectangle outline). Fast AABB
 * rejection applied first — returns 0 when bbox do not overlap.
 */
export function polygonIntersectionAreaMm2(
  slabVertices: readonly PlanarPoint[],
  beamVertices: readonly PlanarPoint[],
): number {
  if (slabVertices.length < 3 || beamVertices.length < 3) return 0;

  // Fast AABB reject.
  // ADR-793 / N.0.2 — ο έλεγχος επικάλυψης ζει ΜΙΑ φορά, στο `xy-bounds.bboxOverlap`.
  if (!bboxOverlap(bboxOf(slabVertices), bboxOf(beamVertices))) return 0;

  // S-H: slab = subject (may be concave), beam = clip (convex rectangle → exact).
  const clipped = clipPolygonBySH(slabVertices, beamVertices);
  return polygonArea(clipped);
}
