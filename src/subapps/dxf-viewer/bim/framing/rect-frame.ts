/**
 * ADR-398 §3.15 — `RectFrame`: ορθογώνιο ως local πλαίσιο (κέντρο + μοναδιαίοι άξονες u/v + ημι-εκτάσεις).
 *
 * Leaf (μόνο `Point2D` + geometry) ώστε να το μοιράζονται **χωρίς cycle**: ο pure resolver
 * (`bim/columns/rect-cartesian-snap`), ο collector (`member-snap-targets`) και το `scene-snap-targets`.
 * Δουλεύει για **λοξά** ορθογώνια κι αυτά (οι άξονες προέρχονται από τις κορυφές· ίσιο = u=(1,0)).
 *
 * @see ../columns/rect-cartesian-snap.ts — Cartesian Magnet resolver (consumer)
 */

import type { Point2D } from '../../rendering/types/Types';
import { calculateDistance } from '../../rendering/entities/shared/geometry-vector-utils';

/** Ορθογώνιο ως local πλαίσιο. `u` = άξονας πλάτους, `v` = άξονας ύψους (μοναδιαία). Scene units. */
export interface RectFrame {
  readonly center: Point2D;
  readonly u: Point2D;
  readonly v: Point2D;
  readonly halfW: number;
  readonly halfV: number;
}

/**
 * Χτίσε `RectFrame` από τις 4 κορυφές (σειρά περιμέτρου, π.χ. `rectangleCorners`). Κέντρο = μέσο
 * διαγωνίου· u/v από τις δύο ακμές που ξεκινούν από την κορυφή 0. `null` σε εκφυλισμένο.
 */
export function rectFrameFromCorners(corners: readonly Point2D[]): RectFrame | null {
  if (corners.length < 4) return null;
  const [c0, c1, , c3] = corners;
  const c2 = corners[2];
  const width = calculateDistance(c0, c1);
  const height = calculateDistance(c0, c3);
  if (!(width > 1e-6) || !(height > 1e-6)) return null;
  return {
    center: { x: (c0.x + c2.x) / 2, y: (c0.y + c2.y) / 2 },
    u: { x: (c1.x - c0.x) / width, y: (c1.y - c0.y) / width },
    v: { x: (c3.x - c0.x) / height, y: (c3.y - c0.y) / height },
    halfW: width / 2,
    halfV: height / 2,
  };
}

/** Local (x κατά u, y κατά v) → world. **Κοινό SSoT** για snap/grid-fill/painter (μηδέν διπλό `center+x·u+y·v`). */
export function rectLocalToWorld(rect: Readonly<RectFrame>, x: number, y: number): Point2D {
  return {
    x: rect.center.x + x * rect.u.x + y * rect.v.x,
    y: rect.center.y + x * rect.u.y + y * rect.v.y,
  };
}
