/**
 * bvh-setup — spatial-acceleration SSoT for BIM raycasting (ADR-040 Φ-3D-pointer).
 *
 * THE PROBLEM: `THREE.Raycaster.intersectObjects(group.children, true)` tests every triangle of
 * every BIM mesh — O(N) per hover/snap pick, with no spatial index. On a dense model each pick
 * costs several ms on the main thread.
 *
 * THE FIX: `three-mesh-bvh` (MIT, already a dependency — used by the path tracer) builds a
 * bounding-volume hierarchy per geometry, turning ray↔mesh intersection into O(log N). We install
 * its prototype patches ONCE (`installBvh`) and lazily build a `boundsTree` per mesh
 * (`ensureBoundsTrees`) right before a pick — idempotent, so already-built meshes cost nothing and
 * freshly-synced meshes (after a scene rebuild via `BimSceneLayer.sync*`) get a tree on the next
 * pick. `acceleratedRaycast` transparently falls back to the default raycast for any mesh without a
 * tree, so the patch is safe app-wide.
 *
 * SSoT: this module is the SOLE owner of the BVH prototype install + the per-mesh tree lifecycle.
 *
 * @module bim-3d/systems/raycaster/bvh-setup
 */

import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

let installed = false;

/**
 * Install the three-mesh-bvh prototype extensions ONCE. The `BufferGeometry`/`Mesh` augmentations
 * ship with three-mesh-bvh's own d.ts (`boundsTree`/`computeBoundsTree`/`disposeBoundsTree`), so no
 * `any` / `@ts-ignore` is needed. Idempotent.
 */
export function installBvh(): void {
  if (installed) return;
  installed = true;
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

/**
 * Lazily build a BVH `boundsTree` for every indexed mesh under `root` that lacks one. Cheap to call
 * every pick: meshes that already have a tree are skipped, non-indexed geometry is skipped (the BVH
 * builder requires an index buffer; such meshes keep the default raycast).
 */
export function ensureBoundsTrees(root: THREE.Object3D): void {
  installBvh();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geom = obj.geometry;
    if (!geom || geom.boundsTree || !geom.index) return;
    geom.computeBoundsTree();
  });
}
