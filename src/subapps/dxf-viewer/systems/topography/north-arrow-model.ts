/**
 * ADR-656 M12 — North-arrow PURE MODEL (the ONE angle SSoT, two consumers).
 *
 * Computes the direction the arrow points, in the DISPLAY frame, for both consumers (screen HUD
 * + baked entity). The displayed drawing is either raw ΕΓΣΑ world (no geo-reference) or the
 * building-local frame (rotated by `rotationDeg`, ADR-369). The viewer transform has NO rotation
 * (pan/zoom only), so «up on screen» = the display frame's +Y.
 *
 *   - Grid North  = world +Northing (0,1) expressed in the display frame = angle `90° − rotationDeg`.
 *   - True North  = Grid North + meridian convergence γ (computed at the survey centroid in ΕΓΣΑ).
 *
 * Reuses `geo-transform` (rotationDeg) and `egsa87-projection` (γ) — no re-derived rotation or
 * projection math. Pure: the reference + points are passed in, so it stays unit-testable.
 */

import type { GeoReference } from '../geo-referencing/geo-transform';
import { meridianConvergenceDeg } from '../geo-referencing/egsa87-projection';
import { lengthMmToM } from '../../utils/scene-units';
import type { TopoPoint } from './topo-types';
import type { NorthMode } from './north-arrow-config';

/** Survey centroid in ΕΓΣΑ world coordinates (canonical mm), or `null` for an empty survey. */
export interface CentroidMm {
  readonly E: number;
  readonly N: number;
}

/** Mean of the survey points (ΕΓΣΑ world mm). `null` when there are no points. */
export function surveyCentroidEN(points: readonly TopoPoint[]): CentroidMm | null {
  if (points.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const p of points) { sx += p.x; sy += p.y; }
  return { E: sx / points.length, N: sy / points.length };
}

/** Grid-North direction in the display frame (degrees, CCW from +X; identity → 90° = up). */
function gridNorthAngleDeg(geo: GeoReference | null): number {
  return 90 - (geo?.rotationDeg ?? 0);
}

/**
 * The display-frame angle (degrees, CCW from +X) the arrow points to. Grid mode returns Grid
 * North; True mode adds the meridian convergence at the survey centroid. With no centroid (empty
 * survey) True falls back to Grid — never a fabricated angle.
 */
export function northAngleDeg(
  mode: NorthMode,
  geo: GeoReference | null,
  centroid: CentroidMm | null,
): number {
  const grid = gridNorthAngleDeg(geo);
  if (mode === 'grid' || !centroid) return grid;
  const gamma = meridianConvergenceDeg(lengthMmToM(centroid.E), lengthMmToM(centroid.N));
  return grid + gamma;
}

/**
 * SVG rotation (degrees, clockwise) for an arrow whose static path is drawn pointing up. Maps the
 * math angle (CCW from +X, up = 90°) to the SVG's clockwise-from-up convention: `90 − angleDeg`.
 * identity → 0 (straight up); True North east of the central meridian → slight CCW (tilts west).
 */
export function svgRotationDeg(angleDeg: number): number {
  return 90 - angleDeg;
}
