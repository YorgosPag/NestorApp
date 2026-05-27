/**
 * ADR-366 §C.6.Q4 — Crop region frustum plane builder.
 *
 * Pure function: normalized viewport rectangle + camera →
 * 4 or 6 Three.js clipping planes (left/right/top/bottom + optional near/far).
 *
 * Algorithm:
 *  1. Unproject the 4 rect corners from NDC to world space at z=-1 (near plane).
 *  2. Build frustum wall planes from camera origin + corner pairs.
 *  3. Plane normals point INWARD so geometry inside rect passes the clip test.
 *
 * Three.js Plane convention: Plane normal points toward geometry that PASSES.
 * A point `p` passes if `dot(normal, p) + constant >= 0`.
 */

import * as THREE from 'three';
import type { CropRegionRect } from '../../stores/ViewMode3DStore';

const _v = new THREE.Vector3();

/**
 * Unprojects a normalized viewport point to a world-space direction from the camera.
 * normX/normY in [0, 1] viewport space → converts to NDC [-1, 1].
 */
function viewportToWorldDir(
  normX: number,
  normY: number,
  camera: THREE.Camera,
): THREE.Vector3 {
  _v.set(normX * 2 - 1, -(normY * 2 - 1), -1);
  _v.unproject(camera);
  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  return _v.clone().sub(camPos).normalize();
}

/**
 * Builds 4-6 clipping planes from a normalized crop rectangle.
 *
 * @param rect       Crop rectangle, coordinates normalized 0-1.
 * @param camera     Three.js camera (perspective or orthographic).
 * @param depthRange Optional near/far in normalized [0,1]; mapped to camera near/far.
 */
export function buildCropPlanes(
  rect: CropRegionRect,
  camera: THREE.Camera,
  depthRange?: { near: number; far: number },
): THREE.Plane[] {
  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);

  const { x, y, w, h } = rect;
  const right = x + w;
  const bottom = y + h;

  const tl = viewportToWorldDir(x, y, camera);
  const tr = viewportToWorldDir(right, y, camera);
  const bl = viewportToWorldDir(x, bottom, camera);
  const br = viewportToWorldDir(right, bottom, camera);

  const planes: THREE.Plane[] = [];

  function wallPlane(dirA: THREE.Vector3, dirB: THREE.Vector3): THREE.Plane {
    const edgeA = dirA.clone().multiplyScalar(10);
    const edgeB = dirB.clone().multiplyScalar(10);
    const normal = new THREE.Vector3()
      .crossVectors(edgeA, edgeB)
      .normalize();
    const plane = new THREE.Plane(normal);
    plane.setFromNormalAndCoplanarPoint(normal, camPos);
    return plane;
  }

  planes.push(wallPlane(tl, bl));
  planes.push(wallPlane(br, tr));
  planes.push(wallPlane(tr, tl));
  planes.push(wallPlane(bl, br));

  if (depthRange && camera instanceof THREE.PerspectiveCamera) {
    const near = camera.near + depthRange.near * (camera.far - camera.near);
    const far = camera.near + depthRange.far * (camera.far - camera.near);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const nearPoint = camPos.clone().addScaledVector(forward, near);
    const farPoint = camPos.clone().addScaledVector(forward, far);
    planes.push(new THREE.Plane(forward.clone(), -forward.dot(nearPoint)));
    planes.push(new THREE.Plane(forward.clone().negate(), forward.dot(farPoint)));
  }

  return planes;
}
