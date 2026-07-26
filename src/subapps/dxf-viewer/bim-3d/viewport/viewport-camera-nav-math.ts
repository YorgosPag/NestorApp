/**
 * viewport-camera-nav-math — pure navigation math (zoom / screen-pan / roll) for the unified
 * viewport camera, extracted from `viewport-camera.ts` (N.7.1 SRP file-size split). These are the
 * moves that DON'T change the projection mode or re-frame to bounds — they only re-seat the camera.
 *
 * These are the two places where «zoom» and «pan» mean something DIFFERENT per projection:
 *   - ortho  → zoom is `camera.zoom`; a screen pixel is a fixed world distance (distance-free).
 *   - persp  → zoom is implied by the camera→target DISTANCE; a pixel scales with that distance.
 * Keeping both rules here (instead of inline in the closure factory) means the mode branch is
 * stated once and the camera factory keeps only its thin, stateful wrappers.
 *
 * Pure: no `controls`, no animation, no render callback — every function either reads the camera
 * or mutates its position/zoom exactly like the inline version it replaces.
 */

import * as THREE from 'three';
import { DEFAULT_CAMERA_DISTANCE, DEFAULT_ORTHO_SIZE } from './viewport-constants';
import { getPixelWorldSize } from './coordinate-transforms';

/**
 * Re-derive the ortho frustum for a viewport size at the camera's CURRENT zoom. Called on every
 * resize and after any write to `orthoCamera.zoom` — the frustum, not the zoom, is what an
 * OrthographicCamera actually renders with.
 */
export function applyOrthoFrustum(
  orthoCamera: THREE.OrthographicCamera,
  width: number,
  height: number,
): void {
  const a = width / Math.max(height, 1);
  const halfH = DEFAULT_ORTHO_SIZE / orthoCamera.zoom;
  orthoCamera.left = -halfH * a;
  orthoCamera.right = halfH * a;
  orthoCamera.top = halfH;
  orthoCamera.bottom = -halfH;
  orthoCamera.updateProjectionMatrix();
}

/** Current zoom factor: `camera.zoom` in ortho, distance-derived in perspective. */
export function readCameraZoom(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  target: THREE.Vector3,
): number {
  if (camera instanceof THREE.OrthographicCamera) return camera.zoom;
  const dist = camera.position.distanceTo(target);
  return dist > 0 ? DEFAULT_CAMERA_DISTANCE / dist : 1;
}

/**
 * Apply a zoom factor (clamped to a positive minimum). Ortho writes `camera.zoom` + refreshes the
 * projection matrix; perspective re-seats the camera along its CURRENT view direction at the
 * distance that factor implies. `scratchDir` is the caller's reusable vector (no per-call alloc).
 */
export function applyCameraZoom(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  target: THREE.Vector3,
  zoom: number,
  scratchDir: THREE.Vector3,
): void {
  const clamped = Math.max(zoom, 0.001);
  if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = clamped;
    camera.updateProjectionMatrix();
    return;
  }
  const newDist = DEFAULT_CAMERA_DISTANCE / clamped;
  scratchDir.subVectors(camera.position, target).normalize();
  camera.position.copy(target).addScaledVector(scratchDir, newDist);
}

/**
 * World-space offset for a screen-space pan of (`dxScreenPx`, `dyScreenPx`), where +x pans the view
 * RIGHT and +y pans it UP. Uses the camera's own basis vectors, scaled by the SSoT
 * `getPixelWorldSize` (mode-aware: ortho ignores distance, perspective scales by cam→target distance).
 */
export function computeScreenPanOffset(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  target: THREE.Vector3,
  domElement: HTMLElement,
  dxScreenPx: number,
  dyScreenPx: number,
): THREE.Vector3 {
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());

  const dist = camera instanceof THREE.PerspectiveCamera ? camera.position.distanceTo(target) : 0;
  const pxToWorld = getPixelWorldSize(dist, camera, domElement);

  return new THREE.Vector3()
    .addScaledVector(right, dxScreenPx * pxToWorld)
    .addScaledVector(up, dyScreenPx * pxToWorld);
}

/**
 * Roll the camera 90° around its own FORWARD axis (ViewCube roll arrows): rotates only the `up`
 * vector, so position and target are untouched and an ortho view stays flat — the reason this is
 * NOT `snapToViewDirection`, which forces perspective and moves the camera.
 *
 * `scratchDir` is the caller's reusable vector. Returns `false` (and touches nothing) on a
 * degenerate camera→target direction, so the caller can skip its `controls.update()` + redraw.
 */
export function applyRollAroundForward(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  target: THREE.Vector3,
  dirSign: 1 | -1,
  scratchDir: THREE.Vector3,
): boolean {
  const forward = scratchDir.subVectors(target, camera.position).normalize();
  if (forward.lengthSq() < 0.001) return false;
  const q = new THREE.Quaternion().setFromAxisAngle(forward, (dirSign * Math.PI) / 2);
  camera.up.applyQuaternion(q).normalize();
  camera.lookAt(target);
  return true;
}
