// ============================================================================
// FOCUS ORDER — pure helpers for keyboard-focus traversal (ADR-366 Phase 4.5).
// Extracted from ThreeJsSceneManager to keep that class under the 500-line cap.
// ============================================================================

import * as THREE from 'three';
import type { FocusEntityLabelData } from './FocusIndicator3D';

/**
 * Frustum-culled, distance-sorted, deduped focus order over a BIM group.
 * Hidden floors/buildings are skipped — `obj.visible=false` on any ancestor.
 */
export function computeFocusOrder(
  bimGroup: THREE.Object3D,
  camera: THREE.Camera,
): string[] {
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  const visible: { bimId: string; distance: number }[] = [];
  const reuseCenter = new THREE.Vector3();
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
    const distance = camera.position.distanceTo(reuseCenter);
    visible.push({ bimId, distance });
  });
  visible.sort((a, b) => a.distance - b.distance);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const { bimId } of visible) {
    if (seen.has(bimId)) continue;
    seen.add(bimId);
    result.push(bimId);
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
