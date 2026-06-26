/**
 * grip-3d-occlusion.ts — depth occlusion test for the 3D reshape-grip overlay (ADR-535 Φ5).
 *
 * The grips are a Canvas2D overlay drawn ON TOP of the WebGL viewport, so by default they
 * float above ALL geometry (the 2D-canvas look). Giorgio wants Revit behaviour instead:
 * a grip HIDDEN behind another entity must not show — only the front-most grips are drawn
 * and pickable. We restore depth by raycasting from the (perspective) camera toward each
 * grip's world point: if scene geometry sits NEARER than the grip, the grip is occluded.
 *
 * The grip rests ON a face, so the ray would hit that very face at ~the grip distance; a
 * small self-surface epsilon (`OCCLUSION_EPS_M`) pulls the ray's far plane just short of
 * the grip so its own surface never counts as an occluder — only genuinely nearer geometry
 * does. ONE helper shared by the overlay draw (visibility) and the controller hit-test
 * (pickability) so a hidden grip is neither seen nor clickable.
 *
 * Pure of React/store. Module-level scratch vectors + raycaster (reused on the main thread,
 * sync) avoid per-call allocation.
 */

import * as THREE from 'three';

/** Self-surface tolerance (world metres): the grip sits on a face — ignore hits this near it. */
const OCCLUSION_EPS_M = 0.01;

const RAY = new THREE.Raycaster();
const DIR = new THREE.Vector3();

/**
 * True when scene geometry hides `worldPoint` from the camera (an opaque hit NEARER than
 * the grip, beyond the self-surface epsilon). False when `occluders` is null, the point is
 * essentially at the camera, or nothing nearer is hit. Perspective camera (the 3D viewport):
 * the ray origin is the camera position for every pixel.
 */
export function isGripOccluded(
  worldPoint: THREE.Vector3,
  camera: THREE.Camera,
  occluders: THREE.Object3D | null,
): boolean {
  if (!occluders) return false;
  DIR.subVectors(worldPoint, camera.position);
  const dist = DIR.length();
  if (dist <= OCCLUSION_EPS_M) return false;
  DIR.multiplyScalar(1 / dist);
  RAY.set(camera.position, DIR);
  RAY.near = 0;
  RAY.far = dist - OCCLUSION_EPS_M; // only geometry IN FRONT of the grip counts
  return RAY.intersectObject(occluders, true).length > 0;
}
