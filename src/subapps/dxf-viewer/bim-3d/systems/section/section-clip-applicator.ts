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
import { noteClipScopeLeak, readClipScopeLock } from './clip-scope-guard';

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

/**
 * ADR-665 — a topo layer root re-scopes itself and its whole subtree.
 *
 * ADR-665 M2 — ο marker είναι **τρικατάστατος**, όχι boolean flag:
 *   `true`      → `'topo'`   (ανάγλυφο + ισοϋψείς: παίρνουν την κοπή στη στάθμη ορόφου)
 *   `false`     → `'default'` (ΡΗΤΗ επαναφορά)
 *   `undefined` → κληρονομιά από τον γονέα
 *
 * Το ρητό `false` υπάρχει για τον **cap χώματος**: είναι η επιφάνεια που *παρήγαγε* η κοπή του
 * εδάφους, οπότε η κοπή που τον έφτιαξε δεν επιτρέπεται να τον φάει (κάθεται πάνω στο επίπεδο ⇒
 * `dot ≈ 0` ⇒ θα αυτοεξαφανιζόταν), ενώ **κάθε** τομή του κτιρίου (section box / axis cut / crop)
 * πρέπει να τον κόβει — δηλαδή ακριβώς το σύνολο `'default'`.
 *
 * Γιατί ρητό `false` και όχι «απλώς μη σφραγίσεις»: το «χωρίς marker» δίνει σήμερα το ίδιο
 * αποτέλεσμα μόνο επειδή τα topo roots κρέμονται απευθείας στο `scene`. Αν κάποιος αύριο
 * ξανα-κρεμάσει τον cap κάτω από topo root, η δρομολόγηση θα άλλαζε **σιωπηλά** — και η σιωπή
 * είναι το πρόβλημα, όχι η θέση.
 */
function scopeOf(obj: THREE.Object3D, inherited: ClipScope): ClipScope {
  const marker = obj.userData['topoClipScope'];
  if (marker === true) return 'topo';
  if (marker === false) return 'default';
  return inherited;
}

/**
 * Recursive walk carrying the inherited scope. O(n), no ancestor lookups per object.
 *
 * ADR-665 Φ2 — carries a SECOND inherited value next to the scope: the {@link readClipScopeLock}
 * of the nearest ancestor that declared one. A subtree that locked `'default'` but resolved to
 * `'topo'` has been re-parented under a terrain root and is now silently clipped by the terrain's
 * cut — the failure mode the DXF underlay is exposed to (see `clip-scope-guard.ts`). Observed and
 * recorded ONLY: the resolved scope still governs, so behaviour is byte-for-byte unchanged.
 */
function walk(
  obj: THREE.Object3D,
  planes: ScopeClipPlanes,
  inherited: ClipScope,
  inheritedLock: ClipScope | null,
): void {
  if (isSectionBoxPart(obj)) return; // the box must not clip itself (nor its children)
  const scope = scopeOf(obj, inherited);
  const lock = readClipScopeLock(obj) ?? inheritedLock;
  const isDrawable = (obj as THREE.Mesh).isMesh === true || (obj as THREE.Line).isLine === true;
  if (isDrawable) {
    if (lock !== null && lock !== scope) noteClipScopeLeak(obj, lock, scope, planes[scope]);
    applyToObject(obj, planes[scope], scope);
  }
  for (const child of obj.children) walk(child, planes, scope, lock);
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
  walk(root, planes, 'default', null);
}

/**
 * Καθαρίζει όλα τα clipping planes από όλα τα αντικείμενα του subtree, σε κάθε scope.
 * Καλείται όταν καμία πηγή κοπής δεν είναι ενεργή.
 */
export function clearClippingPlanes(root: THREE.Object3D): void {
  applyClippingPlanes(root, { default: null, topo: null });
}
