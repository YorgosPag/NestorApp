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
const _planeNormal = new THREE.Vector3();
const _plane = new THREE.Plane();

/**
 * SSoT client (px) → NDC [-1,1] conversion against a dom element rect.
 * Writes into the module-level `_ndc` and returns it, or null when the rect
 * has zero area (element not laid out yet).
 *
 * Exported (ADR-403) so the 3D placement floor-plane raycaster reuses the ONE
 * client→NDC math instead of re-deriving the rect arithmetic. The returned
 * vector is the shared module singleton — consume it immediately (e.g. pass to
 * `raycaster.setFromCamera`, which copies it) before the next call.
 */
export function clientToNdc(domElement: HTMLElement, clientX: number, clientY: number): THREE.Vector2 | null {
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

/**
 * Like `raycastWorldPoint`, but on a geometry MISS falls back to a camera-facing
 * plane through `fallbackThrough` (the current orbit target). So Alt+click on
 * empty space — or on the DXF overlay / ground rather than a BIM mesh — still
 * yields a sensible pivot at the cursor location instead of a no-op (ADR-366
 * §A.6.Q5 v3: «δεν γυρίζει γύρω από το σημείο» όταν αστοχούσε το pick). Mirrors
 * the preview's `resolvePreviewPivot` fallback so the two viewports behave alike.
 */
export function raycastWorldPointOrPlane(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
  fallbackThrough: THREE.Vector3,
): THREE.Vector3 | null {
  const ndc = clientToNdc(domElement, clientX, clientY);
  if (!ndc) return null;

  _raycaster.setFromCamera(ndc, camera);
  const hits = _raycaster.intersectObjects(group.children, true);
  if (hits.length > 0) return hits[0].point.clone();

  camera.getWorldDirection(_planeNormal);
  _plane.setFromNormalAndCoplanarPoint(_planeNormal, fallbackThrough);
  const point = new THREE.Vector3();
  return _raycaster.ray.intersectPlane(_plane, point) ? point : null;
}
