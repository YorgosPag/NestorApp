/**
 * Landing finish-tread footprint projection (ADR-358, Giorgio 2026-07-23). The landing's
 * walkable finish tread noses over the flight BELOW it — like every step nose — so the whole
 * stair clads continuously with one tread material (the bare-concrete landing had no claddable
 * top before). Pure polygon geometry; the caller extrudes it into the 40 mm finish slab.
 */
import type { Polygon3D } from '../../bim/types/stair-types';
import { polygonCentroid } from '../../bim/geometry/shared/polygon-utils';

/**
 * Extend the landing footprint over the flight below it by `nosingScene` (scene units). The
 * down-flight is the highest tread under the landing; the direction landing-centroid → that
 * tread's centroid is the nose direction. Only the LEADING vertices (flight side of the
 * centroid) move — the far edge stays put. Returns the landing unchanged when there is no
 * nosing, no lower flight, or a degenerate footprint.
 */
export function projectLandingTreadTowardDownFlight(
  landing: Polygon3D,
  allTreads: readonly Polygon3D[],
  nosingScene: number,
): Polygon3D {
  if (nosingScene <= 0 || landing.length < 3) return landing;
  const zL = landing[0]!.z;
  let top: Polygon3D | undefined;
  for (const t of allTreads) {
    const tz = t[0]?.z ?? 0;
    if (tz < zL - 1e-6 && (!top || tz > (top[0]?.z ?? -Infinity))) top = t;
  }
  if (!top) return landing;
  const lc = polygonCentroid(landing);
  const tc = polygonCentroid(top);
  const dx = tc.x - lc.x, dy = tc.y - lc.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return landing;
  const ux = dx / len, uy = dy / len; // horizontal unit direction toward the down-flight
  return landing.map((p) =>
    (p.x - lc.x) * ux + (p.y - lc.y) * uy > 0
      ? { ...p, x: p.x + ux * nosingScene, y: p.y + uy * nosingScene }
      : p,
  );
}
