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
 * Only SOLID meshes occlude — edge/wireframe lines (`LineSegments2` etc.) are ignored:
 * a vertex grip sits exactly ON a corner where edge lines meet, so counting lines would
 * falsely hide it. (Fat lines also require `Raycaster.camera`, which we set defensively
 * since the group is traversed even though line hits are discarded.)
 *
 * The EDITED entity's OWN mesh never occludes its own grips (`selfIds`, matched on
 * `userData.bimId` up the hit's ancestry) — Revit «Edit Sketch»: the sketch handles show
 * THROUGH the element you are editing (a ceiling slab seen from below would otherwise hide
 * all its top-face grips behind its own body). Only OTHER entities hide grips.
 *
 * Pure of React/store. Module-level scratch vectors + raycaster (reused on the main thread,
 * sync) avoid per-call allocation.
 */

import * as THREE from 'three';

/** Self-surface tolerance (world metres): the grip sits on a face — ignore hits this near it. */
const OCCLUSION_EPS_M = 0.01;

const RAY = new THREE.Raycaster();
const DIR = new THREE.Vector3();

/** The `bimId` of a hit object, searching up its ancestry (the tag may sit on a parent). */
function hitBimId(obj: THREE.Object3D): string | undefined {
  let o: THREE.Object3D | null = obj;
  while (o) {
    const id = o.userData?.['bimId'] as string | undefined;
    if (id) return id;
    o = o.parent;
  }
  return undefined;
}

/**
 * True when scene geometry hides `worldPoint` from the camera (a SOLID mesh NEARER than the
 * grip, beyond the self-surface epsilon, NOT belonging to the edited entity). False when
 * `occluders` is null, the point is essentially at the camera, or nothing qualifying is hit.
 * Perspective camera (the 3D viewport): the ray origin is the camera position for every pixel.
 *
 * `selfIds` — `bimId`s whose meshes must NOT occlude (the edited entity + e.g. a slab-opening's
 * host slab, whose top the opening grips sit on).
 */
export function isGripOccluded(
  worldPoint: THREE.Vector3,
  camera: THREE.Camera,
  occluders: THREE.Object3D | null,
  selfIds?: ReadonlySet<string>,
): boolean {
  if (!occluders) return false;
  DIR.subVectors(worldPoint, camera.position);
  const dist = DIR.length();
  if (dist <= OCCLUSION_EPS_M) return false;
  DIR.multiplyScalar(1 / dist);
  RAY.set(camera.position, DIR);
  RAY.near = 0;
  RAY.far = dist - OCCLUSION_EPS_M; // only geometry IN FRONT of the grip counts
  // Fat lines (LineSegments2) in the group need the camera to raycast at all.
  RAY.camera = camera;
  // Occluded only by a SOLID mesh of ANOTHER entity. Lines never occlude (the grip sits on
  // its own corner); the edited entity's own mesh never occludes its own grips.
  return RAY.intersectObject(occluders, true).some((h) => {
    if (!(h.object instanceof THREE.Mesh)) return false;
    const id = hitBimId(h.object);
    return !(id !== undefined && selfIds?.has(id));
  });
}
