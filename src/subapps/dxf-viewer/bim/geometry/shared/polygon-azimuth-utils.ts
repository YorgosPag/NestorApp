/**
 * Compass-azimuth polygon helpers (ADR-422 L7.2, shared).
 *
 * Extracted from `polygon-utils.ts` (N.7.1 500-line cap). Pure functions that
 * derive a compass azimuth from a 2D direction or from the edge of a polygon
 * footprint. Consumed by the thermal heat-load space-boundary resolver
 * (orientation-aware solar gains).
 *
 * Compass convention: **0°=+Y ("North"), increasing clockwise toward +X
 * ("East")**: +Y→0, +X→90, −Y→180, −X→270.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import type { PlanarPoint } from '../../types/bim-base';
import { clamp01 } from '../../../utils/scalar-math';
import { edgeOutwardAzimuthDeg } from '@/lib/geometry/polygon-azimuth';

/**
 * ADR-937 Φάση Γ — `directionAzimuthDeg` + `edgeOutwardAzimuthDeg` προωθήθηκαν στο `@/lib/geometry/polygon-azimuth`
 * (τα χρειάζεται και ο διάλογος χάρτη της καρτέλας ακινήτου — CHECK 3.62). Οι εισαγωγείς του subapp μένουν αμετάβλητοι.
 *
 * Frame note: callers that map this to a geographic compass treat scene **+Y as project north (= true north, no
 * rotation)** — a documented advisory simplification (ADR-422 L7.2). The property orientation proposal (ADR-937) applies
 * the project north rotation on top.
 */
export { directionAzimuthDeg, edgeOutwardAzimuthDeg } from '@/lib/geometry/polygon-azimuth';

/** Clamped distance² from point `(px,py)` to segment `a→b` (XY plane). */
function pointSegmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) return (px - ax) ** 2 + (py - ay) ** 2;
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp01(t);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

/**
 * Outward-facing azimuth (deg — see {@link directionAzimuthDeg}) of the polygon
 * edge nearest to `p`. Picks the nearest edge index, then delegates to the
 * {@link edgeOutwardAzimuthDeg} SSoT. Returns `null` for `<3` vertices or a
 * degenerate nearest edge. Used to derive an opening's orientation from its room
 * footprint (ADR-422 L7.2 orientation-aware solar gains).
 */
export function nearestEdgeOutwardAzimuthDeg(
  polygon: readonly PlanarPoint[],
  p: PlanarPoint,
): number | null {
  const n = polygon.length;
  if (n < 3) return null;

  let bestIndex = -1;
  let bestSq = Infinity;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const d = pointSegmentDistanceSq(p.x, p.y, a.x, a.y, b.x, b.y);
    if (d < bestSq) {
      bestSq = d;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return null;
  return edgeOutwardAzimuthDeg(polygon, bestIndex);
}
