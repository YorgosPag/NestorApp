/**
 * section-cap-geometry — pure sizing/positioning helpers for the section cut caps.
 *
 * Extracted from `section-stencil-renderer.ts` (Google file-size SSoT, N.7.1). The cap quad is
 * a single large plane laid ON a cut/section plane and masked by the stencil parity to the
 * cross-section. Its SIZE comes from the scene bounds; its ANCHOR is the scene CENTRE projected
 * onto the plane (ADR-452 v2.22 — NOT the world-origin projection, which missed geo-referenced /
 * far-from-origin plans, leaving the cut hollow «φέτες»).
 *
 * @see ADR-452 — cut-plane caps
 */

import * as THREE from 'three';

const CAP_QUAD_SCALE_FACTOR = 4;
const FALLBACK_CAP_SIZE = 100;

/**
 * The effective scene bounds for cap sizing/centring: the caller's bounds when present, else the
 * BIM group + DXF overlay union. null when the scene is empty.
 */
export function resolveEffectiveBounds(
  sceneBounds: THREE.Box3 | null,
  getBimGroup: () => THREE.Object3D,
  getDxfBounds: () => THREE.Box3 | null,
): THREE.Box3 | null {
  if (sceneBounds && !sceneBounds.isEmpty()) return sceneBounds;
  const bimBox = new THREE.Box3().setFromObject(getBimGroup());
  const dxfBox = getDxfBounds();
  const combined = new THREE.Box3();
  if (!bimBox.isEmpty()) combined.union(bimBox);
  if (dxfBox && !dxfBox.isEmpty()) combined.union(dxfBox);
  return combined.isEmpty() ? null : combined;
}

/** Cap quad half-extent: 4× the bounding-sphere radius (covers the scene from any centre). */
export function computeCapSize(bounds: THREE.Box3 | null): number {
  if (!bounds) return FALLBACK_CAP_SIZE;
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  return Math.max(sphere.radius * CAP_QUAD_SCALE_FACTOR, FALLBACK_CAP_SIZE);
}

/** World-space centre of the scene, used to anchor the cap quad over the geometry. null if empty. */
export function computeCapCenter(bounds: THREE.Box3 | null): THREE.Vector3 | null {
  return bounds ? bounds.getCenter(new THREE.Vector3()) : null;
}

/**
 * Lay `mesh` (a unit plane) ON `plane`, oriented to its normal and scaled to `size`, anchored at
 * `center` PROJECTED onto the plane. ADR-452 v2.22 — the scene-centre anchor (vs the old world-
 * origin projection) is what keeps the finite quad over the geometry on a geo-referenced / offset
 * plan. Falls back to the origin projection only when `center` is null (empty scene).
 */
export function positionCapMesh(
  mesh: THREE.Mesh,
  plane: THREE.Plane,
  size: number,
  center: THREE.Vector3 | null,
): void {
  const normal = plane.normal;
  const anchor = center
    ? center.clone().addScaledVector(normal, -(normal.dot(center) + plane.constant))
    : normal.clone().multiplyScalar(-plane.constant);
  mesh.position.copy(anchor);
  const defaultNormal = new THREE.Vector3(0, 0, 1);
  mesh.quaternion.setFromUnitVectors(defaultNormal, normal);
  mesh.scale.set(size, size, 1);
  mesh.updateMatrix();
  mesh.updateMatrixWorld(true);
}
