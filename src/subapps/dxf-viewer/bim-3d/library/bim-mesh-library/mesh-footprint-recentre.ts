/**
 * mesh-footprint-recentre — pure glTF footprint recentring (ADR-411 2D polish).
 *
 * A loaded glTF often carries an artist-chosen origin that is NOT at the centre
 * of the model's plan footprint (off-centre in X/Z). Placed verbatim, the mesh
 * sits offset from its insertion point — and the 2D silhouette derived from the
 * same template inherits the identical offset.
 *
 * This helper wraps the scene so its footprint (X/Z) bounding-box centre lands on
 * the local origin, leaving Y untouched (the vertical anchor in
 * `mesh-to-object3d.ts` owns the up-axis). The SAME recentred template feeds BOTH
 * the 3D placement (`bimMeshCache.getInstance` clone) and the 2D silhouette
 * (`computeTopSilhouette`/`computeTopEdges`), so the two views can never desync.
 *
 * Pure (three-only) → deterministic + unit-testable, no Storage / store deps.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import * as THREE from 'three';

/**
 * Wrap `scene` so its X/Z footprint centre sits on the local origin (Y unchanged).
 * Returns a parent Group holding the offset scene, so a clone's `position`
 * (overwritten by the 3D placement) cannot lose the recentring. Idempotent for an
 * already-centred mesh (offset ≈ 0). Empty / geometry-less scenes pass through
 * unchanged (the placement falls back to the origin-anchored placeholder).
 */
export function recentreMeshFootprint(scene: THREE.Group): THREE.Group {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) return scene;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  scene.position.set(-cx, 0, -cz);
  const wrapper = new THREE.Group();
  wrapper.add(scene);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}
