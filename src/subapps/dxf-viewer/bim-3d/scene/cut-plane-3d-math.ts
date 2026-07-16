/**
 * ADR-452 — cut-plane 3D math (PURE, no stores → unit-testable without Firebase).
 *
 * Converts the FFL-relative cut elevation into a Three.js world-Y horizontal
 * clipping plane. World is Y-up, metres (ADR-009).
 */

import * as THREE from 'three';

/** mm → metres (matches the converters' MM_TO_M, ADR-009). */
export const MM_TO_M = 0.001;

/**
 * ADR-452 — anti clip-boundary z-fight bias. The horizontal cut keeps `p.y < worldY`.
 * When the user parks the cut AT a storey level (cutPlaneMm = ceiling height), the
 * structural TOP faces sit at EXACTLY `worldY` → `dot == 0` at the boundary →
 * floating-point makes adjacent fragments fall on either side of the plane → the top
 * faces flicker / mix colours (Giorgio 2026-06-19: «μίξη χρωμάτων μόνο όταν το slider
 * της οριζόντιας τομής είναι στην κορυφή»). A tiny upward bias keeps those boundary
 * faces reliably BELOW the plane (kept, not flickering) and lifts the section cap a
 * hair above them so it can't z-fight either. 1 mm is imperceptible at building scale.
 *
 * ADR-665 — lives in this PURE module (not the store-wired `cut-plane-3d`) so the
 * terrain's level cut can share the ONE constant without dragging stores into its
 * unit tests. `cut-plane-3d` re-exports it; there is no second 1 mm constant.
 */
export const CUT_PLANE_KEEP_EPSILON_M = 0.001;

/**
 * ADR-455 — the three cut axes. `z` = the legacy horizontal cut (ADR-452, Revit
 * View Range); `x`/`y` = the new vertical section cuts along the DXF world axes.
 */
export type CutAxis = 'x' | 'y' | 'z';

/**
 * ADR-455 — DXF world axis → three.js axis (Y-up, metres), per `BimToThreeConverter`:
 *   DXF X (East)  → three.js  X   (no flip)
 *   DXF Y (North) → three.js −Z   (handedness flip: shape Y → world −Z)
 *   DXF Z (Up)    → three.js  Y   (no flip)
 * `AXIS_UNIT` is the |three.js axis| the cut runs along; `AXIS_FLIP` carries the
 * handedness so a positive DXF coordinate maps to the correct three.js half-space.
 */
const AXIS_UNIT: Record<CutAxis, readonly [number, number, number]> = {
  x: [1, 0, 0],
  y: [0, 0, 1],
  z: [0, 1, 0],
};
const AXIS_FLIP: Record<CutAxis, 1 | -1> = { x: -1, y: 1, z: -1 };

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

/**
 * ADR-455 — build an axis-aligned cut plane for any axis + viewing side.
 *
 * `worldCoordM` is the DXF coordinate in metres along the axis (X/Y plan position,
 * or the resolved Z world-Y). `sign` picks the KEPT side in DXF terms: `+1` keeps the
 * lower-coordinate side, `-1` keeps the higher. Formula: `normal = u·(sign·flip)`,
 * `constant = sign·worldCoordM`, where `flip` carries the DXF→three.js handedness
 * (DXF-Y → −Z). A point `p` is kept ⇔ `normal·p + constant > 0`.
 *
 * Verified per axis (sign +1): X ⇒ plane at three.js x=coord keeping x<coord; Y ⇒
 * plane at three.js z=−coord keeping the DXF-South side; Z ⇒ normal (0,−1,0),
 * constant=worldY — identical to the legacy horizontal cut (keep at/below height).
 */
export function buildAxisCutPlane(axis: CutAxis, worldCoordM: number, sign: 1 | -1): THREE.Plane {
  const [ux, uy, uz] = AXIS_UNIT[axis];
  const k = sign * AXIS_FLIP[axis];
  const normal = new THREE.Vector3(ux * k, uy * k, uz * k);
  return new THREE.Plane(normal, sign * worldCoordM);
}

/** Build the horizontal clipping plane that keeps everything at/below `worldY`. */
export function buildCutPlane(worldY: number): THREE.Plane {
  return buildAxisCutPlane('z', worldY, 1);
}
