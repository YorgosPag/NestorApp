/**
 * ADR-435 Slice 1b — clash point → Three.js world mapping (pure, THREE-free).
 *
 * The clash engine emits points in **plan-space metres**: `x = planX`, `y = planY`
 * (north), `z = elevation`. The Three.js world used by all of `bim-3d/` is Y-up
 * with north along −Z. So the mapping is exactly the one `segmentAxisEndpointsWorld`
 * applies (planX→x, elevation→y, planY→−z):
 *
 *   worldX = point.x,  worldY = point.z,  worldZ = −point.y
 *
 * Kept as a 3-number tuple (not a THREE.Vector3) so it is trivially unit-testable
 * without importing three. `ClashMarkers3DOverlay` lifts it into a Vector3.
 *
 * NOTE (v1 limitation): the engine elevation is floor-relative — building-base
 * stacking (multi-building) is not added here, matching the active-floor (base 0)
 * assumption of the 2D overlay. Multi-building offset is deferred.
 *
 * @see ../converters/mep-segment-to-mesh.ts (segmentAxisEndpointsWorld — same axes)
 * @see ../../systems/coordination/clash-types.ts (Vec3)
 */

import type { Vec3 } from '../../systems/coordination/clash-types';
import { planMetresToWorld, type WorldTriple } from '../viewport/plan-to-world-math';

/** A clash point (plan-space metres) → Three.js world coordinates (Y-up). */
export function clashPointToWorld(point: Vec3): WorldTriple {
  // The axis swap itself is the shared (THREE-free) convention — never re-inlined here.
  return planMetresToWorld(point.x, point.y, point.z);
}
