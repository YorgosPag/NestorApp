/**
 * grip-plane-projection.ts — PURE ray ∩ horizontal-plane math for the 3D reshape
 * grips (ADR-535 Φ1).
 *
 * A slab footprint lives at one elevation (the slab top), so a per-vertex drag in
 * the 3D viewport is a projection of the mouse ray onto ONE horizontal world plane
 * `y = planeWorldY`. The intersection → plan-mm delta is fed verbatim to the SAME
 * view-agnostic `applySlabGripDrag` / `UpdateSlabParamsCommand` the 2D grips use.
 *
 * Pure Three.js + the `worldToDxfPlan` SSoT — no React, no store, no scene mutation.
 * Jest-friendly (deterministic given rays + plane).
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import { worldToDxfPlan } from '../viewport/coordinate-transforms';

/** Ray-parallel-to-plane guard: |dir.y| below this → projection is ill-conditioned. */
const PARALLEL_EPSILON = 1e-8;

/**
 * Intersect a ray with the horizontal world plane `y = planeWorldY`. Returns the
 * world-space hit point, or null when the ray is (near-)parallel to the plane (a
 * grazing/edge-on view where the projection would be unstable).
 */
export function intersectRayHorizontalPlane(
  rayOrigin: THREE.Vector3,
  rayDir: THREE.Vector3,
  planeWorldY: number,
): THREE.Vector3 | null {
  const denom = rayDir.y;
  if (Math.abs(denom) < PARALLEL_EPSILON) return null;
  const t = (planeWorldY - rayOrigin.y) / denom;
  return rayOrigin.clone().addScaledVector(rayDir, t);
}

/**
 * Plan-mm delta between two world points (via the `worldToDxfPlan` SSoT). Both are
 * expected to lie on the same horizontal plane, so only the plan (x, y) components
 * matter; the elevation (z) is unchanged by a footprint reshape.
 */
export function planDeltaMm(fromWorld: THREE.Vector3, toWorld: THREE.Vector3): Point2D {
  const a = worldToDxfPlan(fromWorld);
  const b = worldToDxfPlan(toWorld);
  return { x: b.x - a.x, y: b.y - a.y };
}
