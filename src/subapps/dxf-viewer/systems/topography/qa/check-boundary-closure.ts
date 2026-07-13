/**
 * ADR-650 M5α — closed-ring validity (boundary + closed breaklines).
 *
 * The deterministic slice of «COGO / closure» we can honestly do from COORDINATES alone:
 * a closed ring must form a valid simple loop. Two blunders it catches — edges that cross
 * themselves (a pick that back-tracked) and a degenerate near-zero-area ring (a mis-pick, a
 * plot that is really a line). Both use the geometry SSoT (`polygon-utils`), never a second
 * area/intersection implementation.
 *
 * NOT re-implemented here (SSoT boundary): the measured-vs-DECLARED area/perimeter tolerance
 * (Ν.4495/2017) already lives in `deliverables/greek-survey-rules.ts` (M7). And traverse
 * MISCLOSURE (bearing/distance) needs raw field observations this subsystem does not hold —
 * out of scope, flagged as such rather than faked (§9, human-certifier honesty).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Point3D } from '../../../bim/types/bim-base';
import type { TopoBoundary, Breakline } from '../topo-types';
import type { TopoQaFlag } from './topo-qa-types';
import { TOPO_QA_CONFIG } from './topo-qa-config';
import { isPolygonSelfIntersecting, polygonArea, polygon2DCentroid } from '../../../bim/geometry/shared/polygon-utils';
import { areaMm2ToM2 } from '../../../utils/scene-units';

/** A ring to validate, with the message-key suffix that names it (`Boundary` / `Breakline`). */
interface Ring {
  readonly suffix: 'Boundary' | 'Breakline';
  readonly index: number;
  readonly verts2d: readonly Point2D[];
  readonly verts3d: readonly Point3D[];
}

function toRing(suffix: Ring['suffix'], index: number, verts: readonly Point2D[]): Ring {
  return { suffix, index, verts2d: verts, verts3d: verts.map((p) => ({ x: p.x, y: p.y, z: 0 })) };
}

/** Flags for ONE ring: self-intersection (high) and degenerate area (high). */
function checkRing(ring: Ring): TopoQaFlag[] {
  if (ring.verts2d.length < 3) return [];
  const at = polygon2DCentroid(ring.verts2d);
  const params = { ring: ring.index + 1 };
  const flags: TopoQaFlag[] = [];
  if (isPolygonSelfIntersecting(ring.verts3d)) {
    flags.push({
      id: `self-intersection:${ring.suffix}:${ring.index}`,
      kind: 'self-intersection', severity: 'high', at,
      messageKey: `topography.qa.flag.selfIntersection${ring.suffix}`, messageParams: params,
    });
  }
  const area = polygonArea(ring.verts3d);
  if (area < TOPO_QA_CONFIG.RING_MIN_AREA_MM2) {
    flags.push({
      id: `boundary-closure:${ring.suffix}:${ring.index}`,
      kind: 'boundary-closure', severity: 'high', at,
      messageKey: `topography.qa.flag.degenerate${ring.suffix}`,
      messageParams: { ...params, area: areaMm2ToM2(area).toFixed(2) },
    });
  }
  return flags;
}

/** Validate the site boundary and every CLOSED breakline. */
export function checkBoundaryClosure(
  boundary: TopoBoundary | null,
  breaklines: readonly Breakline[],
): TopoQaFlag[] {
  const rings: Ring[] = [];
  if (boundary) rings.push(toRing('Boundary', 0, boundary.vertices));
  breaklines.forEach((bl, i) => {
    if (bl.closed) rings.push(toRing('Breakline', i, bl.vertices.map((v) => ({ x: v.x, y: v.y }))));
  });
  return rings.flatMap(checkRing);
}
