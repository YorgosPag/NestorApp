/**
 * MaterialCatalog3D — PBR material lookup for BIM 3D entities.
 *
 * Maps materialId (from WallDna layers) and element types → MeshStandardMaterial.
 * Materials are cached singletons (module lifetime) — safe to share across meshes.
 *
 * ADR-366 Phase 3 (SPEC-3D-003). ADR-363 Phase 6.x will extend with texture maps.
 */

import * as THREE from 'three';
import { textureSlugForKey } from '../../bim/materials/bim-texture-registry';
import {
  MATERIAL_DEFS,
  DEFAULT_MATERIAL_KEY,
  resolveMaterialKey,
  type PbrMaterialDef,
} from '../../bim/materials/material-catalog-defs';
import { getTextureSet, preloadTextureSet, type LoadedTextureSet } from './bim-texture-cache';
import {
  getUserMaterialAppearance,
  getUserMaterialTextureSet,
  preloadUserMaterialTextures,
  getUserMaterialSetVersion,
} from './user-material-registry';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';

/** ADR-363 — prefix of `bim_materials` library document ids (enterprise id). */
const USER_MATERIAL_ID_PREFIX = 'bmat_';

export type Stair3DComponent =
  | 'stair-tread'
  | 'stair-riser'
  | 'stair-stringer'
  | 'stair-landing'
  | 'stair-handrail';

const CACHE = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Colour-by-system "flat schematic" clamps (Revit look): a system-tinted surface is
 * pushed toward diffuse so the colour is orientation-independent (pipe = elbow = cap).
 * Min roughness floor + max metalness ceiling — only affect metallic/shiny bases.
 */
const SYSTEM_TINT_MIN_ROUGHNESS = 0.6;
const SYSTEM_TINT_MAX_METALNESS = 0.1;

/**
 * ADR-375 Phase C.7 — "Shaded with Edges" depth bias (Revit-grade visual style).
 *
 * The BIM 3D edge overlays (`bim-3d-edge-overlay-builder.ts`) are `LineSegments2`
 * geometrically COPLANAR with the solid faces at every hard corner, rendered with
 * `depthTest:true`. Without a face-side depth bias the coplanar faces win the depth
 * test and the dark "pencil" edges disappear (z-fighting) → flat-shaded look.
 *
 * Revit / ArchiCAD "Shaded with Edges" pushes the SHADED FACES slightly back in the
 * depth buffer so the depth-tested edges always win. A tiny positive offset is
 * uniform across all faces → the face-to-face relationship is untouched; only the
 * face-vs-edge contest changes. SSoT: applied here, in the SOLE face-material
 * factory — every material path (flat, textured, system-tinted, user, relief)
 * routes through `buildMat`, so all solids inherit it.
 */
const FACE_POLYGON_OFFSET_FACTOR = 1;
const FACE_POLYGON_OFFSET_UNITS = 1;

/**
 * Per-category DEPTH PRIORITY (polygonOffsetUnits) — coplanar-face z-fighting SSoT.
 *
 * Structural elements are modelled FLUSH: a beam embedded in a slab, a column
 * stopping at the floor level — their top faces are geometrically COPLANAR at the
 * storey elevation. With a single uniform `polygonOffsetUnits` (1) on every solid,
 * those coplanar faces share the exact same depth → the depth test has no
 * tie-breaker → they flicker between materials as the camera orbits (Giorgio:
 * «μίξη χρωμάτων στις πάνω παρειές που κινείται με το orbit», 2026-06-19).
 *
 * Fix: a deterministic per-category bias. LOWER units = nearer the camera = WINS.
 * The visually-dominant surface gets the smallest bias:
 *   - finish/plaster skin (1, default) → wins over its own structural core,
 *   - slab (floor/roof surface, 2) → wins over the beams/columns embedded in it,
 *   - beam (3), column (4), foundations (5-7, each distinct so coplanar footing
 *     tops don't fight each other either).
 * Edge overlays (`LineSegments2`, polygonOffset 0) stay nearest of all → still win
 * against every face, so the ADR-375 "Shaded with Edges" contract is preserved
 * (all biases are ≥ 1, i.e. still pushed back relative to the edges).
 */
const STRUCTURAL_DEPTH_OFFSET_UNITS: Readonly<Record<string, number>> = {
  'elem-slab': 2,
  'elem-beam': 3,
  'elem-column': 4,
  'elem-foundation': 5,
  'elem-foundation-pad': 5,
  'elem-foundation-strip': 6,
  'elem-foundation-tie-beam': 7,
};

/** Depth-priority bias for a resolved material key (default = finish/skin tier). */
function depthOffsetUnitsForKey(key: string): number {
  return STRUCTURAL_DEPTH_OFFSET_UNITS[key] ?? FACE_POLYGON_OFFSET_UNITS;
}

/** Apply the per-category depth bias to a resolved (cached) material. Idempotent. */
function withDepthPriority(mat: THREE.MeshStandardMaterial, key: string): THREE.MeshStandardMaterial {
  mat.polygonOffsetUnits = depthOffsetUnitsForKey(key);
  return mat;
}

function buildMat(def: PbrMaterialDef): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: def.roughness,
    metalness: def.metalness,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1,
    // ADR-366 §B.5 perf — FrontSide (backface culling) on the SOLE face factory. BIM
    // solids (walls/columns/slabs/beams/roofs/mep) are CLOSED extrusions with outward
    // CCW winding, so the inner faces are never seen from outside; DoubleSide doubled
    // the fragment-shader work and disabled culling → ~2× overdraw on a fill-rate-bound
    // GPU (browser-verified «3D βαρύ»). Section-cut interiors stay solid via the stencil
    // cap pipeline (section-stencil-renderer), and the hidden-line / occluder variants
    // keep their explicit DoubleSide where both faces must write depth. Like Revit /
    // Cinema4D realtime viewports (single-sided shading + caps for cuts).
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: FACE_POLYGON_OFFSET_FACTOR,
    polygonOffsetUnits: FACE_POLYGON_OFFSET_UNITS,
  });
}

/** The flat (non-textured) singleton for a resolved key — cached for app lifetime. */
function getFlatMaterial(key: string): THREE.MeshStandardMaterial {
  let mat = CACHE.get(key);
  if (!mat) {
    mat = buildMat(MATERIAL_DEFS[key] ?? MATERIAL_DEFS['mat-concrete']!);
    CACHE.set(key, mat);
  }
  return mat;
}

// ── ADR-446 — Visual Style FACES axis (face mode variants) ───────────────────
// The realistic↔shaded split is already handled below (textured vs flat, gated by
// the derived `realisticMaterials`). The THREE extra Revit face modes — consistent
// (unlit), hidden-line (white occluder), none (faces hidden) — are applied here as
// a post-transform on the resolved lit/flat material, so EVERY entry point inherits
// them through `withFaceMode`. SSoT: this is the SOLE place face mode is applied.

/** Faces-hidden singleton (Wireframe) — edges (mesh children) still render. */
let INVISIBLE_FACE_MATERIAL: THREE.MeshStandardMaterial | null = null;
function getInvisibleFaceMaterial(): THREE.MeshStandardMaterial {
  if (!INVISIBLE_FACE_MATERIAL) {
    INVISIBLE_FACE_MATERIAL = new THREE.MeshStandardMaterial({ visible: false });
  }
  return INVISIBLE_FACE_MATERIAL;
}

/**
 * Hidden-Line singleton — uniform opaque WHITE occluder (Revit «Hidden Line»). The
 * faces write depth so the back edges are hidden, but read as flat white regardless
 * of lighting (emissive white). Keeps the face-side polygonOffset so the depth-tested
 * model edges still win against their own coplanar faces.
 */
let HIDDEN_LINE_FACE_MATERIAL: THREE.MeshStandardMaterial | null = null;
function getHiddenLineFaceMaterial(): THREE.MeshStandardMaterial {
  if (!HIDDEN_LINE_FACE_MATERIAL) {
    HIDDEN_LINE_FACE_MATERIAL = new THREE.MeshStandardMaterial({
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
  return HIDDEN_LINE_FACE_MATERIAL;
}

/**
 * Consistent-Colors variant (Revit «Consistent Colors») — the SAME base colour
 * rendered UNLIT (emissive=base colour, base colour→black) so it reads uniformly
 * regardless of orientation/lighting. Cached per source-material uuid.
 */
const CONSISTENT_CACHE = new Map<string, THREE.MeshStandardMaterial>();
function getConsistentVariant(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
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
 * `realistic`/`shaded` pass through (the textured-vs-flat split already happened via
 * the derived `realisticMaterials` read). Idempotent for the singleton modes.
 */
function withFaceMode(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  switch (useBimRenderSettingsStore.getState().faceMode) {
    case 'none': return getInvisibleFaceMaterial();
    case 'hidden-line': return getHiddenLineFaceMaterial();
    case 'consistent': return getConsistentVariant(base);
    default: return base; // 'realistic' | 'shaded'
  }
}

/** Attach a loaded PBR texture set onto a flat material def → textured material. */
function applyTextureSet(def: PbrMaterialDef, set: LoadedTextureSet): THREE.MeshStandardMaterial {
  const mat = buildMat(def);
  mat.map = set.map;
  // PBR contract: when an albedo map is present the base color must be white so
  // the texture shows its natural colour (no double-tinting). The def.color is the
  // flat-mode colour; with a texture it would multiply and incorrectly darken.
  mat.color.set(0xffffff);
  if (set.normalMap) mat.normalMap = set.normalMap;
  if (set.roughnessMap) mat.roughnessMap = set.roughnessMap;
  // aoMap needs uv2 — the geometry layer ensures one; three ignores it gracefully
  // when absent (ADR-413 contract).
  // aoMapIntensity < 1 because our gradient env has no bounce light; full
  // intensity (1.0) creates pitch-black crevices without a real HDRI fill.
  if (set.aoMap) { mat.aoMap = set.aoMap; mat.aoMapIntensity = 0.5; }
  mat.needsUpdate = true;
  return mat;
}

/** Build a textured clone of a key's flat material, attaching the loaded PBR maps. */
function buildTexturedMaterial(key: string, set: LoadedTextureSet): THREE.MeshStandardMaterial {
  return applyTextureSet(MATERIAL_DEFS[key] ?? MATERIAL_DEFS['mat-concrete']!, set);
}

/**
 * ADR-413 — texture-aware resolution for a resolved material key. When realistic
 * materials are ON and the key maps to a texture slug:
 *   - set loaded  → return a cached textured variant (`${key}::tex`);
 *   - set missing → fire `preloadTextureSet` + return the flat material for now
 *     (the resync swaps it in once the load resolves).
 * Otherwise (toggle off / unmapped key) → the flat singleton, unchanged.
 */
function resolveTexturedMaterial(key: string): THREE.MeshStandardMaterial {
  if (!useBimRenderSettingsStore.getState().realisticMaterials) return getFlatMaterial(key);
  const slug = textureSlugForKey(key);
  if (!slug) return getFlatMaterial(key);

  const set = getTextureSet(slug);
  if (!set) {
    preloadTextureSet(slug);
    return getFlatMaterial(key);
  }
  const texKey = `${key}::tex`;
  let mat = CACHE.get(texKey);
  if (!mat) {
    mat = buildTexturedMaterial(key, set);
    CACHE.set(texKey, mat);
  }
  return mat;
}

/**
 * ADR-413 — the resolved MaterialCatalog3D key behind a DNA materialId (e.g.
 * 'mat-concrete-c25' → 'mat-concrete'). Exposed for downstream geometry/UI agents
 * that need the texture-slug mapping for the same key the material uses.
 */
export function getResolvedTextureKeyForMaterialId(materialId: string): string {
  return resolveMaterialKey(materialId);
}

/**
 * ADR-413 §2D Phase 3 — textured/flat resolution for a `bim_materials` library
 * material (`bmat_*`), reading the reactive `userMaterialRegistry` (NOT the
 * prefix collapse, which would render every library material as concrete).
 *
 * Precedence (Revit «Appearance asset»):
 *   1. unknown id (registry not fed yet) → default concrete flat;
 *   2. realistic OFF / no textures uploaded → flat by category;
 *   3. textures uploaded but not loaded → preload + flat (resync swaps it in);
 *   4. textures loaded → textured `MeshStandardMaterial` (per-material tileSize).
 *
 * Cached per id WITH the registry's change-version, so a re-upload / category
 * change / deletion rebuilds the material (and disposes the stale one).
 */
const USER_TEX_CACHE = new Map<string, { mat: THREE.MeshStandardMaterial; version: number }>();

function commitUserMaterial(
  id: string,
  version: number,
  mat: THREE.MeshStandardMaterial,
): THREE.MeshStandardMaterial {
  const prev = USER_TEX_CACHE.get(id);
  if (prev && prev.mat !== mat) prev.mat.dispose();
  USER_TEX_CACHE.set(id, { mat, version });
  return mat;
}

function resolveUserMaterial(id: string): THREE.MeshStandardMaterial {
  const appearance = getUserMaterialAppearance(id);
  if (!appearance) {
    // Registry not fed yet / removed — drop any stale cache + show default flat.
    const stale = USER_TEX_CACHE.get(id);
    if (stale) {
      stale.mat.dispose();
      USER_TEX_CACHE.delete(id);
    }
    return getFlatMaterial(DEFAULT_MATERIAL_KEY);
  }

  const version = getUserMaterialSetVersion(id);
  const cached = USER_TEX_CACHE.get(id);
  if (cached && cached.version === version) return cached.mat;

  const realistic = useBimRenderSettingsStore.getState().realisticMaterials;
  const wantTextured = realistic && !!appearance.textures?.albedoUrl;
  if (!wantTextured) {
    return commitUserMaterial(id, version, buildMat(appearance.def));
  }

  const set = getUserMaterialTextureSet(id);
  if (!set) {
    preloadUserMaterialTextures(id);
    return commitUserMaterial(id, version, buildMat(appearance.def));
  }
  return commitUserMaterial(id, version, applyTextureSet(appearance.def, set));
}

/** Resolve MeshStandardMaterial from a DNA materialId (e.g. 'mat-concrete-c25'). */
export function getMaterial3D(materialId: string): THREE.MeshStandardMaterial {
  if (materialId.startsWith(USER_MATERIAL_ID_PREFIX)) return withFaceMode(resolveUserMaterial(materialId));
  const key = resolveMaterialKey(materialId);
  return withFaceMode(withDepthPriority(resolveTexturedMaterial(key), key));
}

// ── ADR-417 #6 — Roof tile displacement relief cache ─────────────────────────
// Separate from CACHE because displacement variants are keyed by reliefMm, not
// just materialKey. Only roof-tiles slug carries hasDisplacement=true.
const RELIEF_CACHE = new Map<string, THREE.MeshStandardMaterial>();

/**
 * ADR-417 #6 — Resolve a MeshStandardMaterial WITH displacement map for roof
 * tile geometry. Only applies when `realisticMaterials` is ON AND the slug has a
 * loaded displacement map; otherwise falls back to the standard `getMaterial3D`.
 *
 * Cache key: `${key}::disp${reliefMm_rounded}` — one variant per relief depth.
 * The displacement map is shared (singleton from bim-texture-cache); only the
 * MeshStandardMaterial wrapper (with displacementScale/Bias) is per-variant.
 *
 * @param materialId  The DNA material id (e.g. 'mat-roof-tile')
 * @param reliefMm    Displacement wave amplitude in mm (from RoofTypeParams.tileReliefMm)
 */
export function getRoofTileMaterial3D(materialId: string, reliefMm: number): THREE.MeshStandardMaterial {
  if (!useBimRenderSettingsStore.getState().realisticMaterials) return getMaterial3D(materialId);
  const key = resolveMaterialKey(materialId);
  const slug = textureSlugForKey(key);
  if (!slug) return getMaterial3D(materialId);
  const set = getTextureSet(slug);
  if (!set) { preloadTextureSet(slug); return getMaterial3D(materialId); }
  if (!set.displacementMap) return getMaterial3D(materialId); // asset not uploaded yet — graceful flat

  const reliefM = reliefMm / 1000;
  const cacheKey = `${key}::disp${Math.round(reliefMm)}`;
  let mat = RELIEF_CACHE.get(cacheKey);
  if (!mat) {
    mat = buildTexturedMaterial(key, set);
    mat.displacementMap = set.displacementMap;
    mat.displacementScale = reliefM;
    mat.displacementBias = -reliefM / 2; // center the wave around the surface
    RELIEF_CACHE.set(cacheKey, mat);
  }
  return withFaceMode(mat);
}

/** Resolve MeshStandardMaterial for element types without DNA. */
export function getElementMaterial3D(
  type: 'column' | 'beam' | 'slab' | 'foundation' | 'foundation-pad' | 'foundation-strip' | 'foundation-tie-beam' | 'roof' | 'envelope' | 'mep-fixture' | 'electrical-panel' | 'railing' | 'mep-wire' | 'furniture' | 'mep-duct' | 'mep-pipe' | 'mep-fitting' | 'mep-manifold' | 'mep-radiator' | 'mep-boiler' | 'mep-water-heater' | Stair3DComponent,
): THREE.MeshStandardMaterial {
  const key = `elem-${type}`;
  return withFaceMode(withDepthPriority(resolveTexturedMaterial(key), key));
}

/**
 * ADR-408 Φ5 — colour-by-system material: the System's colour applied as a FLAT
 * schematic surface (Revit "Color by system"). The base PBR's transparency is kept
 * (e.g. translucent luminaires), but the surface is clamped toward DIFFUSE — low
 * metalness, higher roughness — so the colour reads UNIFORMLY across every element
 * and orientation. Without this clamp a metallic base (e.g. `elem-mep-pipe`,
 * metalness 0.75) catches direct light differently on a straight pipe vs a curved
 * elbow / cap / coupling, so the SAME colour looks like several different shades.
 * Cached per `${type}:${colorInt}` — never mutates the shared element singleton.
 */
export function getSystemTintedMaterial3D(
  type: 'mep-fixture' | 'electrical-panel' | 'mep-wire' | 'mep-duct' | 'mep-pipe' | 'mep-manifold',
  colorInt: number,
): THREE.MeshStandardMaterial {
  const baseKey = `elem-${type}`;
  const cacheKey = `${baseKey}:${colorInt}`;
  let mat = CACHE.get(cacheKey);
  if (!mat) {
    const def = MATERIAL_DEFS[baseKey] ?? MATERIAL_DEFS['mat-concrete']!;
    mat = buildMat({
      ...def,
      color: colorInt,
      roughness: Math.max(def.roughness, SYSTEM_TINT_MIN_ROUGHNESS),
      metalness: Math.min(def.metalness, SYSTEM_TINT_MAX_METALNESS),
    });
    CACHE.set(cacheKey, mat);
  }
  return withFaceMode(mat);
}

/**
 * Dispose all cached materials. Call only on full app teardown —
 * NOT on 3D→2D mode toggle (ThreeJsSceneManager.dispose only disposes geometries).
 */
export function disposeMaterialCatalog3D(): void {
  for (const mat of CACHE.values()) mat.dispose();
  CACHE.clear();
  // ADR-413 §2D Phase 3 — per-material user variants (textures owned/disposed by
  // the registry; here we only dispose the MeshStandardMaterial wrappers).
  for (const { mat } of USER_TEX_CACHE.values()) mat.dispose();
  USER_TEX_CACHE.clear();
  // ADR-417 #6 — displacement relief variants.
  for (const mat of RELIEF_CACHE.values()) mat.dispose();
  RELIEF_CACHE.clear();
  // ADR-446 — Visual Style FACES variants (consistent clones + mode singletons).
  for (const mat of CONSISTENT_CACHE.values()) mat.dispose();
  CONSISTENT_CACHE.clear();
  INVISIBLE_FACE_MATERIAL?.dispose();
  INVISIBLE_FACE_MATERIAL = null;
  HIDDEN_LINE_FACE_MATERIAL?.dispose();
  HIDDEN_LINE_FACE_MATERIAL = null;
}
