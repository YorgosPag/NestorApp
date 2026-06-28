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
 * Roots whose every indexed mesh already has a `boundsTree` (built since the last scene rebuild).
 * A clean root lets {@link ensureBoundsTrees} skip the per-pick `traverse()` entirely — the walk
 * itself, not the (already-skipped) tree builds, was the residual ~20fps cost on dense scenes.
 * `markBvhDirty(root)` re-arms the walk after the scene layer adds/replaces meshes.
 */
const cleanRoots = new WeakSet<THREE.Object3D>();

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
 * every pick: a `root` clean since its last scene rebuild skips the whole `traverse()`; otherwise
 * meshes that already have a tree are skipped, non-indexed geometry is skipped (the BVH builder
 * requires an index buffer; such meshes keep the default raycast). After a full pass the root is
 * marked clean so subsequent picks are O(1) until {@link markBvhDirty} re-arms it.
 */
export function ensureBoundsTrees(root: THREE.Object3D): void {
  installBvh();
  if (cleanRoots.has(root)) return; // every indexed mesh already has a tree — no walk needed
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geom = obj.geometry;
    if (!geom || geom.boundsTree || !geom.index) return;
    geom.computeBoundsTree();
  });
  cleanRoots.add(root);
}

/**
 * Re-arm the per-pick BVH walk for `root` — call AFTER the scene layer adds or replaces meshes
 * (`BimSceneLayer.sync*`), so the next pick rebuilds trees for the fresh geometry. Idempotent.
 * A missed call only degrades the new meshes to the (correct) default raycast, never a wrong hit.
 */
export function markBvhDirty(root: THREE.Object3D): void {
  cleanRoots.delete(root);
}
