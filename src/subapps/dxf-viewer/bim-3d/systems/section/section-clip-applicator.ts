/**
 * section-clip-applicator — pure functions για ADR-366 §A.3 Phase 7.0.
 *
 * Idempotent helpers που γράφουν `material.clippingPlanes` σε όλα τα Mesh
 * αντικείμενα του scene. Δεν κρατούν κατάσταση — καλούνται κάθε φορά που
 * αλλάζει το set των clip planes (SectionStore subscription).
 *
 * Δεν αγγίζουν `renderer.localClippingEnabled` — ευθύνη του ThreeJsSceneManager
 * (το ενεργοποιεί μία φορά στο constructor).
 *
 * @see ADR-366 §A.3
 */

import * as THREE from 'three';

function writeClippingPlanes(material: THREE.Material, planes: THREE.Plane[] | null): void {
  // ADR-452 — `LineMaterial` (fat lines, `Line2`/`LineSegments2` which extend `Mesh`,
  // so `isMesh` catches them) throws a fragment-shader compile error when clipping
  // planes are injected in this Three.js build. Skip it: the edge overlay stays
  // unclipped (cosmetic), while the solid faces (MeshStandard/Basic) still cut.
  if ((material as { isLineMaterial?: boolean }).isLineMaterial || material.type === 'LineMaterial') {
    return;
  }
  // Three.js Material exposes clippingPlanes via duck typing for materials that support it
  // (MeshStandardMaterial, MeshBasicMaterial, etc.). Direct assignment is safe.
  (material as THREE.Material & { clippingPlanes: THREE.Plane[] | null }).clippingPlanes = planes;
  material.needsUpdate = true;
}

function applyToMesh(mesh: THREE.Mesh, planes: THREE.Plane[] | null): void {
  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const m of material) writeClippingPlanes(m, planes);
  } else if (material) {
    writeClippingPlanes(material, planes);
  }
}

function isSectionBoxPart(obj: THREE.Object3D): boolean {
  return obj.userData['sectionBoxPart'] === true;
}

/**
 * Apply clipping planes σε όλα τα Mesh objects του scene εκτός από το ίδιο το
 * section box (αλλιώς οι faces του box θα clip τον εαυτό τους).
 * Idempotent — επανειλημμένες κλήσεις με ίδιο `planes` είναι ασφαλείς.
 */
export function applyClippingPlanes(scene: THREE.Object3D, planes: THREE.Plane[]): void {
  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    if (isSectionBoxPart(obj)) return;
    applyToMesh(obj as THREE.Mesh, planes);
  });
}

/**
 * Καθαρίζει όλα τα clipping planes από όλα τα Mesh objects του scene.
 * Καλείται όταν ο χρήστης απενεργοποιεί το section (enabled=false).
 */
export function clearClippingPlanes(scene: THREE.Object3D): void {
  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    if (isSectionBoxPart(obj)) return;
    applyToMesh(obj as THREE.Mesh, null);
  });
}
