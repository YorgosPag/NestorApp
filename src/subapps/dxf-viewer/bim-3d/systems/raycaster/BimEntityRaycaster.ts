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
 * SSoT client (px) → NDC [-1,1] conversion against a dom element rect.
 * Writes into the module-level `_ndc` and returns it, or null when the rect
 * has zero area (element not laid out yet).
 */
function clientToNdc(domElement: HTMLElement, clientX: number, clientY: number): THREE.Vector2 | null {
  const rect = domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  _ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  return _ndc;
}

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
  const ndc = clientToNdc(domElement, clientX, clientY);
  if (!ndc) return null;

  _raycaster.setFromCamera(ndc, camera);
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

/**
 * Raycast against `group` and return the WORLD-space intersection point of the
 * first surface hit (closest to camera), or null when the ray misses geometry.
 *
 * Used by the Alt+click orbit-pivot feature (ADR-366 §A.6.Q5): the picked point
 * becomes the new camera orbit center. Returns a fresh Vector3 (safe to retain).
 */
export function raycastWorldPoint(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
): THREE.Vector3 | null {
  const ndc = clientToNdc(domElement, clientX, clientY);
  if (!ndc) return null;

  _raycaster.setFromCamera(ndc, camera);
  const hits = _raycaster.intersectObjects(group.children, true);
  // intersectObjects returns hits sorted by distance ascending — first = closest.
  return hits.length > 0 ? hits[0].point.clone() : null;
}
