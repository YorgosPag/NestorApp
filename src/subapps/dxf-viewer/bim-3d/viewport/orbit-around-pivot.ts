/**
 * orbit-around-pivot — SSoT rigid turntable orbit around an arbitrary world point.
 *
 * Shared by the main viewport tumble (`tumble-rotation.ts`) AND the «Edit Type»
 * preview (`preview-orbit-controls.ts`) so Alt+drag behaves identically in both
 * (Giorgio: «θέλω SSOT, το σχέδιο να μένει στη θέση του»).
 *
 * The naïve approach (`controls.target = pivot; camera.lookAt(target)`) SNAPS the
 * picked point to screen centre — a jump on every Alt+drag. Instead this rotates
 * the camera POSITION, the camera ORIENTATION, and the `target` by the SAME
 * world-space rotation about `pivot`. Because the whole rig turns rigidly about
 * `pivot`, that point stays FIXED on screen (no jump) and `target` stays on the
 * camera's forward axis — so a subsequent `OrbitControls.update()` `lookAt(target)`
 * is a no-op and never fights the orbit.
 *
 * Turntable, not trackball: yaw about WORLD up + pitch about the camera's current
 * right axis → roll-free (camera-right stays horizontal across both rotations).
 */

import * as THREE from 'three';

const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _right = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();

/**
 * Rigidly orbit `camera` about `pivot` by screen-pixel deltas, mutating
 * `camera.position`, `camera.quaternion` AND `target` (in place). `pivot` is left
 * untouched. Pass `pivot === target` for a plain orbit about the look point.
 *
 * @param dxPx  horizontal drag (px) → yaw about world up
 * @param dyPx  vertical drag (px)   → pitch about camera right
 * @param speed radians per pixel
 */
export function orbitCameraAroundPivot(
  camera: THREE.Camera,
  pivot: THREE.Vector3,
  target: THREE.Vector3,
  dxPx: number,
  dyPx: number,
  speed: number,
): void {
  _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _qYaw.setFromAxisAngle(_worldUp, -dxPx * speed);
  _qPitch.setFromAxisAngle(_right, -dyPx * speed);
  _q.multiplyQuaternions(_qYaw, _qPitch); // combined world-space rotation

  // Camera position: rotate its offset from the pivot.
  _v.subVectors(camera.position, pivot).applyQuaternion(_q);
  camera.position.copy(pivot).add(_v);

  // Look target: rotate its offset too (keeps it on the new forward axis).
  _v.subVectors(target, pivot).applyQuaternion(_q);
  target.copy(pivot).add(_v);

  // Orientation: same rotation → the picked point stays put on screen.
  camera.quaternion.premultiply(_q).normalize();
}
