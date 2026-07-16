/**
 * section-clip-applicator — pure functions για ADR-366 §A.3 Phase 7.0 / ADR-665.
 *
 * Idempotent helpers που γράφουν `material.clippingPlanes` στα αντικείμενα ενός subtree,
 * δρομολογώντας το καθένα με βάση το CLIP SCOPE του. Δεν κρατούν κατάσταση — καλούνται κάθε
 * φορά που αλλάζει το set των clip planes (SectionSceneController).
 *
 * Δεν αγγίζουν `renderer.localClippingEnabled` — ευθύνη του SectionSceneController
 * (το ενεργοποιεί μία φορά στον constructor).
 *
 * @see ADR-366 §A.3 · ADR-452/455 (cut planes) · ADR-665 (per-scope routing)
 */

import * as THREE from 'three';

/**
 * ADR-665 — clip SCOPE. Το three.js clipping είναι PER-MATERIAL, οπότε δύο ομάδες αντικειμένων
 * που χρειάζονται ΔΙΑΦΟΡΕΤΙΚΑ planes πρέπει να έχουν διαφορετικά material instances ΚΑΙ να
 * δρομολογούνται χωριστά εδώ.
 *
 *  - `'topo'`    — οτιδήποτε κάτω από topo scene-layer root (σφραγισμένο `userData['topoClipScope']`
 *                  από το `seatTopoLayerRoot`). Παίρνει την κοπή στη στάθμη ενεργού ορόφου.
 *  - `'default'` — όλα τα υπόλοιπα, δηλαδή το ΚΤΙΡΙΟ, που **δεν** κόβεται από την κοπή του εδάφους.
 *
 * Το scope ΚΛΗΡΟΝΟΜΕΙΤΑΙ προς τα κάτω: ο marker κάθεται στο root, όχι στα φύλλα, ώστε ένα rebuild
 * του layer να μην μπορεί ποτέ να τον χάσει.
 */
export type ClipScope = 'default' | 'topo';

/** Planes ανά scope. `null` καθαρίζει· `[]` σημαίνει «ενεργό αλλά χωρίς κοπή». */
export type ScopeClipPlanes = Readonly<Record<ClipScope, THREE.Plane[] | null>>;

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
const MESH_CLIPPABLE_TYPES: ReadonlySet<string> = new Set([
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
  // ADR-452 — `LineMaterial` (fat-line edge overlays) is DELIBERATELY excluded.
  // Despite r0.170 shipping clipping chunks, injecting clip planes into it throws
  // `THREE.WebGLProgram: Shader Error … Fragment shader is not compiled` on this
  // build (confirmed at runtime, v2.4). The edge overlay above the cut is instead
  // suppressed geometrically by `SectionSceneController` (hide overlays whose top
  // sits above the cut plane) — no shader injection, no compile error.
]);

/**
 * ADR-665 — the `'topo'` scope additionally clips THIN lines, because the draped contour lines
 * (`TerrainContourLayer` → `THREE.LineSegments` + `LineBasicMaterial`) must stop at the terrain's
 * cut instead of floating unclipped in mid-air. `LineBasicMaterial`/`LineDashedMaterial` are
 * built-in and DO ship the clipping chunks (unlike the fat-line `LineMaterial`, still excluded).
 *
 * ⚠️ This is deliberately NOT added to the `'default'` scope. `bim-3d/` has ~20 other
 * `LineBasicMaterial` users — gizmo handles, `Dimension3DRenderer`, `FocusOutlineRenderer`,
 * `TempAlignmentLineOverlay`, `DxfToThreeConverter`, diagrams — and a global allowlist would
 * silently start clipping every one of them. Scoping the widening to `'topo'` fixes the contour
 * bug exactly where it exists and touches nothing else.
 */
const TOPO_CLIPPABLE_TYPES: ReadonlySet<string> = new Set([
  ...MESH_CLIPPABLE_TYPES,
  'LineBasicMaterial',
  'LineDashedMaterial',
]);

function clippableTypesFor(scope: ClipScope): ReadonlySet<string> {
  return scope === 'topo' ? TOPO_CLIPPABLE_TYPES : MESH_CLIPPABLE_TYPES;
}

/**
 * True when the material type is a built-in material that supports clipping planes in `scope`.
 * Defaults to the `'default'` (BIM) scope — the pre-ADR-665 behaviour.
 */
export function isClippableMaterial(material: THREE.Material, scope: ClipScope = 'default'): boolean {
  return clippableTypesFor(scope).has(material.type);
}

function writeClippingPlanes(
  material: THREE.Material,
  planes: THREE.Plane[] | null,
  scope: ClipScope,
): void {
  if (!isClippableMaterial(material, scope)) return;
  // Built-in material — `clippingPlanes` is a supported, type-safe field.
  (material as THREE.Material & { clippingPlanes: THREE.Plane[] | null }).clippingPlanes = planes;
  material.needsUpdate = true;
}

function applyToObject(obj: THREE.Object3D, planes: THREE.Plane[] | null, scope: ClipScope): void {
  const material = (obj as THREE.Mesh | THREE.Line).material;
  if (Array.isArray(material)) {
    for (const m of material) writeClippingPlanes(m, planes, scope);
  } else if (material) {
    writeClippingPlanes(material, planes, scope);
  }
}

function isSectionBoxPart(obj: THREE.Object3D): boolean {
  return obj.userData['sectionBoxPart'] === true;
}

/** ADR-665 — a topo layer root re-scopes itself and its whole subtree. */
function scopeOf(obj: THREE.Object3D, inherited: ClipScope): ClipScope {
  return obj.userData['topoClipScope'] === true ? 'topo' : inherited;
}

/** Recursive walk carrying the inherited scope. O(n), no ancestor lookups per object. */
function walk(obj: THREE.Object3D, planes: ScopeClipPlanes, inherited: ClipScope): void {
  if (isSectionBoxPart(obj)) return; // the box must not clip itself (nor its children)
  const scope = scopeOf(obj, inherited);
  const isDrawable = (obj as THREE.Mesh).isMesh === true || (obj as THREE.Line).isLine === true;
  if (isDrawable) applyToObject(obj, planes[scope], scope);
  for (const child of obj.children) walk(child, planes, scope);
}

/**
 * ADR-665 — apply clip planes to a subtree, routing each object by its inherited {@link ClipScope}.
 *
 * `root` may be the whole scene (`SectionSceneController.applyState`) or a single layer root
 * (`reapplyClipPlanesUnder`, after a rebuild produced fresh materials).
 *
 * Idempotent — repeated calls with the same `planes` are safe. The section box is skipped
 * (otherwise its faces would clip themselves).
 */
export function applyClippingPlanes(root: THREE.Object3D, planes: ScopeClipPlanes): void {
  walk(root, planes, 'default');
}

/**
 * Καθαρίζει όλα τα clipping planes από όλα τα αντικείμενα του subtree, σε κάθε scope.
 * Καλείται όταν καμία πηγή κοπής δεν είναι ενεργή.
 */
export function clearClippingPlanes(root: THREE.Object3D): void {
  applyClippingPlanes(root, { default: null, topo: null });
}
