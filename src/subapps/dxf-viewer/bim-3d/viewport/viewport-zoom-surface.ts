/**
 * viewport-zoom-surface.ts — Revit-grade surface-anchored dolly math (ADR-363 / 3D nav).
 *
 * Problem (Giorgio): three.js OrbitControls `zoomToCursor` keeps the point on the ORBIT
 * SPHERE under the cursor fixed — it never raycasts the geometry — and its dolly step is
 * geometric on the distance to the (often far, behind-the-wall) orbit TARGET. So a single
 * wheel notch near a wall is a large absolute move → you punch straight through the body.
 *
 * Revit instead makes the zoom step proportional to the distance to the SURFACE under the
 * cursor: as you approach, the step shrinks, so you converge on the face asymptotically and
 * never enter it. This module is the pure step math; the wheel wiring lives in
 * `viewport-camera.ts` (resolves the cursor anchor via the SSoT `raycastWorldPointOrPlane`:
 * BIM surface → DXF ground-plane → camera-facing plane, so empty/DXF/BIM share this one dolly).
 *
 * Pure: zero DOM / controls / scene deps — just vector arithmetic, fully unit-tested.
 */

import * as THREE from 'three';

/**
 * New camera position for one wheel step, dollying the camera along cam→hit so the
 * camera-to-surface distance is multiplied by `factor` (geometric), clamped to
 * `[marginM, maxDistM]`.
 *
 *  - `factor < 1` → zoom IN (camera moves toward the hit; never closer than `marginM`,
 *    so it can hug the face for detail but can NOT cross into the solid).
 *  - `factor > 1` → zoom OUT (camera recedes from the hit; capped at `maxDistM`).
 *
 * Pairs with `computeSurfaceZoomPose`, which slides the orbit target by the SAME
 * translation so the view direction is preserved and the surface under the cursor
 * stays put — Revit "zoom to what I'm pointing at", with no recenter jump.
 *
 * @param camPos current camera world position
 * @param hit    world point under the cursor (geometry raycast hit)
 * @param factor geometric distance multiplier for this wheel step (see above)
 * @param marginM minimum allowed camera-to-surface distance (no punch-through), metres
 * @param maxDistM maximum allowed camera-to-surface distance (sanity cap), metres
 * @returns a NEW Vector3 — the dollied camera position (input is never mutated)
 */
export function computeSurfaceDolly(
  camPos: THREE.Vector3,
  hit: THREE.Vector3,
  factor: number,
  marginM: number,
  maxDistM: number,
): THREE.Vector3 {
  const toHit = new THREE.Vector3().subVectors(hit, camPos);
  const dist = toHit.length();
  // Degenerate (camera already on the surface) → nothing sensible to do.
  if (dist < 1e-6) return camPos.clone();
  const dir = toHit.multiplyScalar(1 / dist); // unit cam→hit
  const newDist = Math.min(Math.max(dist * factor, marginM), maxDistM);
  // Move forward by (dist − newDist): positive when zooming in, negative when out.
  return camPos.clone().addScaledVector(dir, dist - newDist);
}

/** Camera pose (position + orbit target) after one surface-anchored wheel step. */
export interface SurfaceZoomPose {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}

/**
 * Full camera pose for one surface-anchored wheel step. Dollies the camera along
 * cam→hit (`computeSurfaceDolly`) AND slides the orbit `target` by the SAME
 * translation, so the camera→target VIEW DIRECTION is unchanged.
 *
 * Why slide instead of snapping `target = hit`: snapping re-aims the camera at an
 * off-axis cursor point on the next `OrbitControls.update()` `lookAt(target)` → the
 * image swings/jumps on every wheel notch (the 2026-06-10 regression). Sliding keeps
 * camera→target constant → `lookAt` is a no-op (no jump), while the camera still moves
 * along the cursor ray so the world point under the cursor stays anchored on screen.
 *
 * Returns NEW vectors; inputs are never mutated.
 */
export function computeSurfaceZoomPose(
  camPos: THREE.Vector3,
  target: THREE.Vector3,
  hit: THREE.Vector3,
  factor: number,
  marginM: number,
  maxDistM: number,
): SurfaceZoomPose {
  const position = computeSurfaceDolly(camPos, hit, factor, marginM, maxDistM);
  const camDelta = new THREE.Vector3().subVectors(position, camPos);
  return { position, target: target.clone().add(camDelta) };
}

/**
 * Geometric distance multiplier for a wheel event. Mirrors OrbitControls' feel
 * (`base^(deltaY · sensitivity · zoomSpeed)`) but applied to the surface distance.
 *
 * Browser convention: `deltaY > 0` (wheel down) = zoom OUT, `deltaY < 0` = zoom IN.
 * With the leading minus, `deltaY < 0` → exponent > 0 → `factor < 1` → zoom IN. ✔
 */
export function wheelZoomFactor(
  deltaY: number,
  base: number,
  sensitivity: number,
  zoomSpeed: number,
): number {
  return Math.pow(base, -deltaY * sensitivity * zoomSpeed);
}
