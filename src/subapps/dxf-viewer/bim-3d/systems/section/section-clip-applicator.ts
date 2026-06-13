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

/**
 * ADR-452 — allowlist of Three.js material types that ship clipping shader chunks
 * and accept `material.clippingPlanes` safely. Built-in mesh materials all include
 * `<clipping_planes_fragment>` in their fragment shader; non-mesh / custom-shader
 * materials (`LineMaterial` fat lines, `ShaderMaterial`, `SpriteMaterial`,
 * `PointsMaterial`, …) do NOT, so injecting clip planes there throws
 * `THREE.WebGLProgram: Shader Error … Fragment shader is not compiled`.
 *
 * Defensive SSoT: we apply clipping ONLY to known-clippable types and skip every
 * other material (future-proof — any new custom shader is skipped by default, not
 * broken). Supersedes the earlier `LineMaterial`-only skip. Solid BIM faces are
 * all `MeshStandardMaterial` (see ADR-452 material audit) → cut + capped; the fat-
 * line edge overlay stays unclipped (cosmetic, floats above the cut — DEFER).
 */
const CLIPPABLE_MATERIAL_TYPES: ReadonlySet<string> = new Set([
  'MeshStandardMaterial',
  'MeshPhysicalMaterial',
  'MeshBasicMaterial',
  'MeshLambertMaterial',
  'MeshPhongMaterial',
  'MeshToonMaterial',
  'MeshMatcapMaterial',
  'MeshDepthMaterial',
  'MeshNormalMaterial',
  'ShadowMaterial',
  // ADR-452 v2.4 — fat-line edge overlays (ADR-375, `LineSegments2` → `isMesh`).
  // Three r0.170 `LineMaterial` ships full clipping support: `clipping: true` plus
  // the `<clipping_planes_*>` chunks, and its vertex shader defines `mvPosition`
  // BEFORE `<clipping_planes_vertex>` (so `vClipPosition` is valid). The earlier
  // "Fragment shader is not compiled" report was a misdiagnosis. Clipping the edge
  // overlay is REQUIRED so the wireframe is cut at the plane too — otherwise the
  // edges of everything above the cut float as a phantom "cage" over the section.
  'LineMaterial',
]);

/** True when the material type is a built-in mesh material that supports clipping planes. */
export function isClippableMaterial(material: THREE.Material): boolean {
  return CLIPPABLE_MATERIAL_TYPES.has(material.type);
}

function writeClippingPlanes(material: THREE.Material, planes: THREE.Plane[] | null): void {
  if (!isClippableMaterial(material)) return;
  // Built-in mesh material — `clippingPlanes` is a supported, type-safe field.
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
