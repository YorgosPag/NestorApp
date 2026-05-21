// ============================================================================
// FOCUS ORDER — pure helpers for keyboard-focus traversal (ADR-366 Phase 4.5).
// Extracted from ThreeJsSceneManager to keep that class under the 500-line cap.
//
// ADR-366 Polish Item #7: dense-scene overlap prevention.
// Sort by screen-space distance to viewport center (NDC origin) so the most
// prominent entity is always first. Entities whose NDC centers are closer than
// FOCUS_OVERLAP_NDC_THRESHOLD to an already-accepted entity are skipped — this
// prevents Tab from cycling through visually co-located entities in dense floors.
// ============================================================================

import * as THREE from 'three';
import type { FocusEntityLabelData } from './FocusIndicator3D';

/** NDC half-distance (range -1..1) below which two entities are considered overlapping. */
const FOCUS_OVERLAP_NDC_THRESHOLD = 0.12;

/**
 * Frustum-culled, screen-center-sorted, overlap-deduped focus order over a BIM group.
 *
 * Sort key: NDC distance from viewport center (0, 0).
 *   - Entities nearest to where the user is looking come first.
 *   - World-space camera distance is used as tiebreaker.
 * Overlap guard: if two entities project within FOCUS_OVERLAP_NDC_THRESHOLD of each
 *   other in screen space, only the closer one is included. Prevents Tab from
 *   bouncing between visually stacked entities in dense BIM scenes.
 *
 * Hidden floors/buildings are skipped — `obj.visible=false` on any ancestor.
 */
export function computeFocusOrder(
  bimGroup: THREE.Object3D,
  camera: THREE.Camera,
): string[] {
  const projMatrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  const frustum = new THREE.Frustum().setFromProjectionMatrix(projMatrix);
  const reuseCenter = new THREE.Vector3();
  const reuseNdc = new THREE.Vector3();

  const candidates: { bimId: string; ndcX: number; ndcY: number; ndcDist: number; worldDist: number }[] = [];

  bimGroup.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const bimId = obj.userData['bimId'] as string | undefined;
    if (!bimId) return;
    let parent: THREE.Object3D | null = obj;
    while (parent) {
      if (!parent.visible) return;
      parent = parent.parent;
    }
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    box.getCenter(reuseCenter);
    if (!frustum.containsPoint(reuseCenter)) return;

    reuseNdc.copy(reuseCenter).project(camera);
    // Skip entities projected behind camera (NDC z > 1) or exactly at clip plane.
    if (reuseNdc.z > 1.0) return;
    const ndcDist = Math.sqrt(reuseNdc.x * reuseNdc.x + reuseNdc.y * reuseNdc.y);
    const worldDist = camera.position.distanceTo(reuseCenter);
    candidates.push({ bimId, ndcX: reuseNdc.x, ndcY: reuseNdc.y, ndcDist, worldDist });
  });

  // Primary: screen-center proximity. Secondary: world distance.
  candidates.sort((a, b) => a.ndcDist - b.ndcDist || a.worldDist - b.worldDist);

  const seen = new Set<string>();
  // Each accepted entity's NDC center — for overlap detection.
  const acceptedNdc: Array<{ x: number; y: number }> = [];
  const result: string[] = [];

  for (const c of candidates) {
    if (seen.has(c.bimId)) continue;

    // Overlap guard: skip if another accepted entity is within threshold in screen space.
    const isOverlap = acceptedNdc.some((a) => {
      const dx = a.x - c.ndcX;
      const dy = a.y - c.ndcY;
      return Math.sqrt(dx * dx + dy * dy) < FOCUS_OVERLAP_NDC_THRESHOLD;
    });
    if (isOverlap) continue;

    seen.add(c.bimId);
    acceptedNdc.push({ x: c.ndcX, y: c.ndcY });
    result.push(c.bimId);
  }

  // Append skipped (overlapping) entities at the end so they remain reachable.
  for (const c of candidates) {
    if (!seen.has(c.bimId)) {
      seen.add(c.bimId);
      result.push(c.bimId);
    }
  }

  return result;
}

/** Resolve label data (type + name + world center) for the focus indicator. */
export function findFocusedEntityData(
  bimGroup: THREE.Object3D,
  bimId: string,
): FocusEntityLabelData | null {
  let result: FocusEntityLabelData | null = null;
  bimGroup.traverse((obj) => {
    if (result) return;
    if (!(obj instanceof THREE.Mesh)) return;
    if ((obj.userData['bimId'] as string | undefined) !== bimId) return;
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const bimType = (obj.userData['bimType'] as string | undefined) ?? '';
    const entityName = (obj.userData['bimName'] as string | undefined) ?? bimId;
    result = {
      bimType,
      entityName,
      worldCenter: box.getCenter(new THREE.Vector3()),
    };
  });
  return result;
}
