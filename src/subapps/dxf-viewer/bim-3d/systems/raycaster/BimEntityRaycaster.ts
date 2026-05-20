/**
 * BimEntityRaycaster — THREE.Raycaster wrapper for BIM entity picking.
 *
 * Casts a ray from the camera through the cursor NDC point and returns the
 * first BimSceneLayer mesh hit (identified by userData.bimId + userData.bimType).
 *
 * Module-level singleton raycaster avoids per-call allocation.
 * ADR-366 B.2.Q1.
 */

import * as THREE from 'three';

export interface RaycastHit {
  readonly bimId: string;
  readonly bimType: string;
}

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

/**
 * Raycast against all direct children of `group` (BimSceneLayer meshes).
 * Uses the renderer domElement bounding rect for client → NDC conversion.
 */
export function raycastBimGroup(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
): RaycastHit | null {
  const rect = domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  _ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );

  _raycaster.setFromCamera(_ndc, camera);
  const hits = _raycaster.intersectObjects(group.children, true);

  for (const hit of hits) {
    // Walk up to the mesh that was tagged by BimToThreeConverter.tagMesh()
    let obj: THREE.Object3D | null = hit.object;
    while (obj) {
      const bimId = obj.userData['bimId'] as string | undefined;
      const bimType = obj.userData['bimType'] as string | undefined;
      if (bimId && bimType) return { bimId, bimType };
      obj = obj.parent;
    }
  }
  return null;
}
