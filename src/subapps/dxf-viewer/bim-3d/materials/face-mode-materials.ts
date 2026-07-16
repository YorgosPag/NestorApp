/**
 * face-mode-materials — ADR-446 Visual Style FACES axis (face mode variants).
 *
 * The realistic↔shaded split is handled in `MaterialCatalog3D` (textured vs flat, gated by the
 * derived `realisticMaterials`). The THREE extra Revit face modes — consistent (unlit),
 * hidden-line (white occluder), none (faces hidden) — are applied here as a post-transform on
 * the resolved lit/flat material, so EVERY entry point inherits them through `withFaceMode`.
 * SSoT: this is the SOLE place face mode is applied.
 *
 * N.7.1 size split (ADR-665): extracted verbatim from `MaterialCatalog3D` (499/500 lines) so the
 * terrain catalog can reach the face-mode BUILDERS without an import cycle.
 *
 * ⚠️ ADR-665 — `getInvisibleFaceMaterial()` / `getHiddenLineFaceMaterial()` return APP-WIDE
 * SINGLETONS that every BIM mesh shares. three.js clipping is PER-MATERIAL, so anything that
 * needs its OWN `material.clippingPlanes` must NOT be handed one of these — it would clip the
 * entire building. That is why the `build*` variants exist and are exported: the terrain calls
 * them through `withTerrainFaceMode` to get pixel-identical but EXCLUSIVE instances.
 *
 * @module bim-3d/materials/face-mode-materials
 */

import * as THREE from 'three';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { FACE_POLYGON_OFFSET_FACTOR, FACE_POLYGON_OFFSET_UNITS } from './material-depth-priority';

/**
 * ADR-665 — build (do NOT memoise) the faces-hidden material (Wireframe): edges (mesh children)
 * still render. Callers needing an exclusive instance for their own clipping planes use this;
 * BIM callers use the shared {@link getInvisibleFaceMaterial}.
 */
export function buildInvisibleFaceMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ visible: false });
}

/**
 * ADR-665 — build (do NOT memoise) the Hidden-Line material: a uniform opaque WHITE occluder
 * (Revit «Hidden Line»). The faces write depth so the back edges are hidden, but read as flat
 * white regardless of lighting (emissive white). Keeps the face-side polygonOffset so the
 * depth-tested model edges still win against their own coplanar faces.
 */
export function buildHiddenLineFaceMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: FACE_POLYGON_OFFSET_FACTOR,
    polygonOffsetUnits: FACE_POLYGON_OFFSET_UNITS,
  });
}

/** Faces-hidden singleton (Wireframe) — SHARED by every BIM mesh. See the ADR-665 warning above. */
let INVISIBLE_FACE_MATERIAL: THREE.MeshStandardMaterial | null = null;
export function getInvisibleFaceMaterial(): THREE.MeshStandardMaterial {
  if (!INVISIBLE_FACE_MATERIAL) {
    INVISIBLE_FACE_MATERIAL = buildInvisibleFaceMaterial();
  }
  return INVISIBLE_FACE_MATERIAL;
}

/** Hidden-Line singleton — SHARED by every BIM mesh. See the ADR-665 warning above. */
let HIDDEN_LINE_FACE_MATERIAL: THREE.MeshStandardMaterial | null = null;
export function getHiddenLineFaceMaterial(): THREE.MeshStandardMaterial {
  if (!HIDDEN_LINE_FACE_MATERIAL) {
    HIDDEN_LINE_FACE_MATERIAL = buildHiddenLineFaceMaterial();
  }
  return HIDDEN_LINE_FACE_MATERIAL;
}

/**
 * Consistent-Colors variant (Revit «Consistent Colors») — the SAME base colour rendered UNLIT
 * (emissive=base colour, base colour→black) so it reads uniformly regardless of
 * orientation/lighting. Cached per SOURCE-material uuid.
 *
 * ADR-665 — this is clip-SAFE by construction: an exclusive base (e.g. the terrain's
 * `elem-terrain:shaded`) yields an exclusive variant, because the cache key is that base's uuid.
 */
const CONSISTENT_CACHE = new Map<string, THREE.MeshStandardMaterial>();
export function getConsistentVariant(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  let mat = CONSISTENT_CACHE.get(base.uuid);
  if (!mat) {
    mat = base.clone();
    mat.emissive = base.color.clone();
    mat.emissiveIntensity = 1;
    mat.color.set(0x000000);
    mat.needsUpdate = true;
    CONSISTENT_CACHE.set(base.uuid, mat);
  }
  return mat;
}

/**
 * ADR-446 — apply the current Visual Style FACES axis to a resolved face material.
 * `realistic`/`shaded` pass through (the textured-vs-flat split already happened via the derived
 * `realisticMaterials` read). Idempotent for the singleton modes.
 *
 * ⚠️ ADR-665 — returns SHARED singletons for `'none'`/`'hidden-line'`. Do not use this for a
 * material that needs its own clipping planes; see `withTerrainFaceMode` in `terrain-materials-3d`.
 */
export function withFaceMode(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  switch (useBimRenderSettingsStore.getState().faceMode) {
    case 'none': return getInvisibleFaceMaterial();
    case 'hidden-line': return getHiddenLineFaceMaterial();
    case 'consistent': return getConsistentVariant(base);
    default: return base; // 'realistic' | 'shaded'
  }
}

/** ADR-446 — dispose the FACES variants (consistent clones + mode singletons). Full teardown only. */
export function disposeFaceModeMaterials(): void {
  for (const mat of CONSISTENT_CACHE.values()) mat.dispose();
  CONSISTENT_CACHE.clear();
  INVISIBLE_FACE_MATERIAL?.dispose();
  INVISIBLE_FACE_MATERIAL = null;
  HIDDEN_LINE_FACE_MATERIAL?.dispose();
  HIDDEN_LINE_FACE_MATERIAL = null;
}
