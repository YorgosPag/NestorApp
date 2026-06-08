/**
 * gizmo-hit-test.ts — raycaster hit testing against gizmo hitbox meshes.
 *
 * PORTED from GenArc ADR-022 (Gizmo System).
 * @related ADR-402 (3D Viewport BIM Element Editing) — GenArc gizmo port.
 *
 * Handle priority (high → low):
 *   rotate-* (5) > resize-* (4) > center (3) > plane-* (2) > axis-* (1)
 *
 * Resize squares live at the midpoint of axis cylinder hitboxes, so without
 * priority the cylinder would always win on distance. Priority ensures the
 * most semantically specific handle wins regardless of ray entry order.
 */

import * as THREE from 'three';
import type { GizmoHandleId } from './gizmo-types';

/**
 * Minimal view needed for hit testing. The full `GizmoMeshSet` satisfies it, and
 * so does a filtered view exposing only a subset of hitboxes (Phase A visibility).
 */
export interface GizmoHitTestSet {
  readonly hitboxes: readonly THREE.Mesh[];
  readonly hitboxToId: ReadonlyMap<THREE.Mesh, GizmoHandleId>;
}

export interface GizmoHitResult {
  /** Which handle was hit */
  readonly handleId: GizmoHandleId;
  /** Optional resize-corner id when hovering a corner hitbox. */
  readonly cornerId: string | null;
  /** World-space intersection point */
  readonly point: THREE.Vector3;
  /** Distance from camera */
  readonly distance: number;
}

// Higher number = wins over lower when multiple handles are hit simultaneously.
const HANDLE_PRIORITY: Readonly<Record<GizmoHandleId, number>> = {
  'resize-x': 4, 'resize-y': 4, 'resize-z': 4,
  'resize-m-x': 4, 'resize-m-y': 4, 'resize-m-z': 4,
  // ADR-408 Φ-D — endpoint shape handles win over plane/axis like resize squares.
  'endpoint-start': 4, 'endpoint-end': 4,
  'rotate-x':  5,
  'rotate-y':  5,
  'rotate-z':  5,
  'center':    3,
  'plane-xy':  2, 'plane-xz': 2, 'plane-yz': 2,
  'axis-x':    1, 'axis-y':   1, 'axis-z':   1,
};

/**
 * Test the raycaster against all gizmo hitbox meshes.
 * Returns the highest-priority hit (among distance-sorted intersections),
 * or null if nothing was hit.
 */
export function testGizmoHit(
  raycaster: THREE.Raycaster,
  meshSet: GizmoHitTestSet,
): GizmoHitResult | null {
  // Spread the readonly view into a fresh array — `intersectObjects` wants a
  // mutable `Object3D[]` (it never mutates the input; the copy is type-only).
  const intersections = raycaster.intersectObjects([...meshSet.hitboxes], false);

  if (intersections.length === 0) return null;

  let bestIx = intersections[0];
  let bestId = meshSet.hitboxToId.get(bestIx.object as THREE.Mesh);
  let bestPriority = bestId !== undefined ? (HANDLE_PRIORITY[bestId] ?? 0) : -1;
  let bestCorner = ((bestIx.object as THREE.Mesh).userData['cornerId'] as string | undefined) ?? null;

  for (let i = 1; i < intersections.length; i++) {
    const ix = intersections[i];
    const id = meshSet.hitboxToId.get(ix.object as THREE.Mesh);
    const priority = id !== undefined ? (HANDLE_PRIORITY[id] ?? 0) : -1;
    const corner = ((ix.object as THREE.Mesh).userData['cornerId'] as string | undefined) ?? null;

    // Higher handle priority always wins.
    if (priority > bestPriority) {
      bestIx = ix;
      bestId = id;
      bestPriority = priority;
      bestCorner = corner;
      continue;
    }

    // For equal-priority resize hits, prefer concrete corner hitboxes over center hitbox.
    if (priority === bestPriority) {
      const bestIsCorner = bestCorner !== null;
      const candidateIsCorner = corner !== null;
      if (candidateIsCorner && !bestIsCorner) {
        bestIx = ix;
        bestId = id;
        bestCorner = corner;
        continue;
      }

      // If both are same corner-kind, keep nearest by distance.
      if (candidateIsCorner === bestIsCorner && ix.distance < bestIx.distance) {
        bestIx = ix;
        bestId = id;
        bestCorner = corner;
      }
    }
  }

  if (bestId === undefined) return null;

  return {
    handleId: bestId,
    cornerId: (bestIx.object as THREE.Mesh).userData['cornerId'] ?? null,
    point: bestIx.point.clone(),
    distance: bestIx.distance,
  };
}
