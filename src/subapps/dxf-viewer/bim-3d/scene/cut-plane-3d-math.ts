/**
 * ADR-452 — cut-plane 3D math (PURE, no stores → unit-testable without Firebase).
 *
 * Converts the FFL-relative cut elevation into a Three.js world-Y horizontal
 * clipping plane. World is Y-up, metres (ADR-009).
 */

import * as THREE from 'three';

/** mm → metres (matches the converters' MM_TO_M, ADR-009). */
export const MM_TO_M = 0.001;

/** Downward normal: `Plane(normal,constant)` keeps `normal·p + constant > 0` ⇒ y < constant (below the cut). */
const CUT_PLANE_NORMAL = new THREE.Vector3(0, -1, 0);

/**
 * World-Y (metres) of the horizontal cut plane.
 * `worldY = (floorElevationMm + cutPlaneMm) * 0.001 + buildingBaseElevationM`.
 *
 * @param floorElevationMm datum-relative FFL of the active storey (mm)
 * @param cutPlaneMm       cut elevation above the active floor FFL (mm)
 * @param buildingBaseElevationM building base offset above site datum (metres)
 */
export function computeCutPlaneWorldY(
  floorElevationMm: number,
  cutPlaneMm: number,
  buildingBaseElevationM: number,
): number {
  return (floorElevationMm + cutPlaneMm) * MM_TO_M + buildingBaseElevationM;
}

/** Build the horizontal clipping plane that keeps everything at/below `worldY`. */
export function buildCutPlane(worldY: number): THREE.Plane {
  return new THREE.Plane(CUT_PLANE_NORMAL.clone(), worldY);
}
