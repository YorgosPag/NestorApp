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

function buildMat(def: PbrMaterialDef): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: def.roughness,
    metalness: def.metalness,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1,
    side: THREE.DoubleSide,
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
  if (materialId.startsWith(USER_MATERIAL_ID_PREFIX)) return resolveUserMaterial(materialId);
  return resolveTexturedMaterial(resolveMaterialKey(materialId));
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
  return mat;
}

/** Resolve MeshStandardMaterial for element types without DNA. */
export function getElementMaterial3D(
  type: 'column' | 'beam' | 'slab' | 'roof' | 'envelope' | 'mep-fixture' | 'electrical-panel' | 'railing' | 'mep-wire' | 'furniture' | 'mep-duct' | 'mep-pipe' | 'mep-fitting' | 'mep-manifold' | 'mep-radiator' | 'mep-boiler' | 'mep-water-heater' | Stair3DComponent,
): THREE.MeshStandardMaterial {
  return resolveTexturedMaterial(`elem-${type}`);
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
  return mat;
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
}
