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
  /**
   * ADR-539 — present only on a faced-prism hit (Polygon Mode): the `FaceKey`
   * of the picked όψη, resolved from `hit.face.materialIndex` via the mesh's
   * `userData.faceKeyByMaterialIndex`. Absent on legacy single-material meshes.
   */
  readonly faceKey?: string;
}

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _planeNormal = new THREE.Vector3();
const _plane = new THREE.Plane();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _groundPlane = new THREE.Plane();
const _groundCoplanar = new THREE.Vector3();
const _groundPoint = new THREE.Vector3();

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
 * ADR-539 — face-level raycast for Cinema 4D «Polygon Mode». Like `raycastBimGroup`
 * but ALSO resolves the picked `FaceKey` from `hit.face.materialIndex` against the
 * mesh's `userData.faceKeyByMaterialIndex` (set by the faced-prism converter).
 *
 * Φ2 — a FACED face wins over any non-faced hit in front of it: the invisible slab-opening
 * pick-mesh (no `faceKeyByMaterialIndex`) sits over each opening, so a naive «first hit»
 * would let it steal the click on a hole wall and return no faceKey. We therefore iterate
 * the depth-sorted hits and return the FIRST one carrying a faceKey; only if none is faced
 * do we fall back to the first plain entity hit (so a click on a non-faced solid still
 * selects the entity). Active ONLY in Polygon mode (`use-bim3d-pointer-handlers`).
 */
export function raycastBimFace(
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

  let entityFallback: RaycastHit | null = null;
  for (const hit of hits) {
    // Walk up to the tagged mesh (mirror raycastBimGroup) to resolve bimId/bimType.
    let obj: THREE.Object3D | null = hit.object;
    let bimId: string | undefined;
    let bimType: string | undefined;
    while (obj) {
      const id = obj.userData['bimId'] as string | undefined;
      const type = obj.userData['bimType'] as string | undefined;
      if (id && type) { bimId = id; bimType = type; break; }
      obj = obj.parent;
    }
    if (!bimId || !bimType) continue;
    // ADR-539 — faceKey from the hit mesh's group→materialIndex map (faced prism only).
    const faceKeys = hit.object.userData['faceKeyByMaterialIndex'] as readonly string[] | undefined;
    const matIndex = hit.face?.materialIndex;
    const faceKey = faceKeys && matIndex !== undefined ? faceKeys[matIndex] : undefined;
    if (faceKey !== undefined) return { bimId, bimType, faceKey }; // faced face wins immediately
    entityFallback ??= { bimId, bimType }; // remember the nearest non-faced hit
  }
  return entityFallback;
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
 * Like `raycastWorldPoint`, but on a geometry MISS falls back — in order — to:
 *   1. the horizontal floor plane at `groundY` (when provided), where the DXF
 *      overlay lives (`DxfToThreeConverter` maps DXF → Y-up floor plane at Y=0),
 *      so a click on the DXF wireframe / empty floor yields the REAL point under
 *      the cursor at floor depth — not a point at the wrong depth;
 *   2. a camera-facing plane through `fallbackThrough` (the current orbit target)
 *      for upward / "sky" clicks that never meet the floor in front of the camera.
 *
 * Without (1), Alt+drag on a DXF object orbited around the wrong-depth fallback
 * point → «σε αντικείμενο DXF η περιστροφή έφευγε στο κέντρο» (a BIM mesh hit was
 * fine because it returns the true surface point). ADR-366 §A.6.Q5 v5.
 */
export function raycastWorldPointOrPlane(
  group: THREE.Group,
  camera: THREE.Camera,
  domElement: HTMLElement,
  clientX: number,
  clientY: number,
  fallbackThrough: THREE.Vector3,
  groundY: number | null = null,
): THREE.Vector3 | null {
  const ndc = clientToNdc(domElement, clientX, clientY);
  if (!ndc) return null;

  _raycaster.setFromCamera(ndc, camera);
  const hits = _raycaster.intersectObjects(group.children, true);
  if (hits.length > 0) return hits[0].point.clone();

  // (1) DXF / floor-plan click → intersect the real horizontal floor plane.
  if (groundY !== null) {
    _groundCoplanar.set(0, groundY, 0);
    _groundPlane.setFromNormalAndCoplanarPoint(_worldUp, _groundCoplanar);
    if (_raycaster.ray.intersectPlane(_groundPlane, _groundPoint)) return _groundPoint.clone();
  }

  // (2) Upward / empty-sky click → camera-facing plane through the look target.
  camera.getWorldDirection(_planeNormal);
  _plane.setFromNormalAndCoplanarPoint(_planeNormal, fallbackThrough);
  const point = new THREE.Vector3();
  return _raycaster.ray.intersectPlane(_plane, point) ? point : null;
}
