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
import type { TerrainSurfaceStyle } from '../../systems/topography/topo-types'; // ADR-650 M4 (types only)
import { TOPO_MAJOR_COLOR, TOPO_MINOR_COLOR } from '../../systems/topography/contour-config'; // ADR-650 M10d
// N.7.1 size split — coplanar-face depth-bias SSoT (ADR-375 offsets + ADR-366 §B.5 per-category priority).
import { FACE_POLYGON_OFFSET_FACTOR, FACE_POLYGON_OFFSET_UNITS, withDepthPriority } from './material-depth-priority';

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

/** ADR-650 M10c — unlit analysis-style terrain materials (hypsometric / cut-fill), cached per style. */
const TERRAIN_ANALYSIS_CACHE = new Map<string, THREE.MeshBasicMaterial>();

/**
 * ADR-650 M10d — apply a 0..1 transparency to a terrain-exclusive material IN PLACE (Civil 3D
 * «Surface Style transparency»). A transparent surface also stops writing depth so the BIM / ground
 * behind it shows through (standard see-through compositing). Mutating in place is safe: these
 * materials belong to the single terrain / contour layer and are never shared with a BIM entity.
 */
function applyTerrainOpacity(mat: THREE.Material, opacity: number): void {
  const transparent = opacity < 1;
  if (mat.opacity === opacity && mat.transparent === transparent) return;
  mat.opacity = opacity;
  mat.transparent = transparent;
  mat.depthWrite = !transparent;
  mat.needsUpdate = true;
}

/**
 * ADR-650 M4/M10c — topographic terrain surface material.
 *
 * DoubleSide for every style: every other BIM solid is a CLOSED extrusion whose inner faces are
 * unreachable, but a TIN is an OPEN surface. A camera that drops below the hill (or inside a cut)
 * would look straight through a back-face-culled terrain and see the void — so it renders
 * `DoubleSide`, exactly as Civil 3D 3D-faces and a Revit Toposolid do. The cost is bounded: one
 * surface, not the whole model, so the ADR-366 §B.5 overdraw argument does not apply.
 *
 * `shaded` (earth) is LIT: there the lighting IS the read — hillshade gives the surface its 3D
 * form — so it belongs in the PBR pipeline like every other solid, and honours the Visual Style
 * FACES axis via `withFaceMode`.
 *
 * The ANALYSIS styles (`hypsometric` elevation banding, `cutfill`, ADR-650 M6) are UNLIT
 * (`MeshBasicMaterial` + per-vertex colours). Civil 3D / Revit render an analysis style as a DATA
 * visualisation, never a lit surface: the banding colours must read TRUE regardless of scene
 * lighting or shadow. Crucially this is also the M10c FIX — a lit `MeshStandardMaterial` (white
 * base + vertex colours + `receiveShadow`) rendered fully BLACK, hence invisible, whenever the
 * survey surface fell outside the directional light's shadow/light frustum (it floats at the real
 * survey elevation, far above the building). An unlit material cannot be darkened into oblivion.
 * Cached per style; the `shaded` PBR singleton is never mutated into a vertex-colour material.
 */
export function getTerrainMaterial3D(style: TerrainSurfaceStyle, opacity = 1): THREE.Material {
  if (style !== 'shaded') {
    let analysis = TERRAIN_ANALYSIS_CACHE.get(style);
    if (!analysis) {
      // No polygonOffset: an isolated survey surface has no coplanar geometry to z-fight, and a
      // positive offset at the surface's floating far-distance depth slope pushed it out of the
      // depth range → invisible (M10c regression). Kept identical to the verified live-fix config.
      analysis = new THREE.MeshBasicMaterial({
        vertexColors: true, // the per-vertex banding / cut-fill colours the converter baked in
        side: THREE.DoubleSide,
      });
      TERRAIN_ANALYSIS_CACHE.set(style, analysis);
    }
    applyTerrainOpacity(analysis, opacity); // ADR-650 M10d — per-style surface transparency
    return analysis;
  }

  const cacheKey = `elem-terrain:${style}`;
  let mat = CACHE.get(cacheKey);
  if (!mat) {
    mat = buildMat(MATERIAL_DEFS['elem-terrain']!);
    mat.side = THREE.DoubleSide;
    CACHE.set(cacheKey, mat);
  }
  // ADR-650 M10d — applied to the terrain-exclusive base before `withFaceMode`; the shaded/realistic
  // default returns that base, so the transparency shows (the none/hidden-line BIM face modes swap in
  // SHARED singletons and deliberately do not carry terrain opacity — a data surface, not a solid).
  applyTerrainOpacity(mat, opacity);
  return withFaceMode(mat);
}

/** ADR-650 M10d — unlit contour-line materials (major / minor), cached per class. */
const TERRAIN_CONTOUR_CACHE = new Map<string, THREE.LineBasicMaterial>();

/**
 * ADR-650 M10d — the 3D topographic CONTOUR line material (major index vs minor intermediate).
 *
 * Unlit `LineBasicMaterial` in the AutoCAD/Civil 3D brown family (the SAME palette the 2D plan
 * contours use, `contour-config`), so the hill you orbit and the lines in plan read as one product.
 * Lit shading is meaningless for a 1-px line and would let the survey surface's floating far-depth
 * darken them into oblivion (the same trap that made the analysis mesh vanish, M10c). Cached per
 * class for the app lifetime — the geometry is rebuilt on every survey edit, the material is not.
 */
export function getTopoContourMaterial3D(isMajor: boolean, opacity = 1): THREE.LineBasicMaterial {
  const key = isMajor ? 'major' : 'minor';
  let mat = TERRAIN_CONTOUR_CACHE.get(key);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(isMajor ? TOPO_MAJOR_COLOR : TOPO_MINOR_COLOR).getHex(),
    });
    TERRAIN_CONTOUR_CACHE.set(key, mat);
  }
  applyTerrainOpacity(mat, opacity); // ADR-650 M10d — contour-line transparency
  return mat;
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
 * ADR-449 PART B Slice B — per-face colour-override material for the structural finish
 * skin (Revit «Paint»). Keeps the plaster PBR base (roughness/matte of `mat-plaster`) but
 * paints a custom base colour, so a painted face reads as **tinted plaster** rather than a
 * foreign material — the geometry/BOQ still belong to the finish. Cached per `finish-color:
 * ${hex}` (never mutates a shared singleton). Honours the Visual Style FACES axis + the
 * finish depth tier (default units, ≥ its own structural core). Invalid hex → plaster flat.
 */
export function getFinishColorOverrideMaterial3D(colorHex: string): THREE.MeshStandardMaterial {
  const cacheKey = `finish-color:${colorHex}`;
  let mat = CACHE.get(cacheKey);
  if (!mat) {
    const def = MATERIAL_DEFS['mat-plaster']!;
    // THREE.Color parses '#rrggbb'/'rgb(...)'/named CSS; getHex() → the def's numeric colour.
    mat = buildMat({ ...def, color: new THREE.Color(colorHex).getHex() });
    CACHE.set(cacheKey, mat);
  }
  return withFaceMode(withDepthPriority(mat, 'mat-plaster'));
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
  // ADR-650 M10c/M10d — terrain analysis (hypsometric/cutfill) + contour-line singletons.
  for (const mat of TERRAIN_ANALYSIS_CACHE.values()) mat.dispose();
  TERRAIN_ANALYSIS_CACHE.clear();
  for (const mat of TERRAIN_CONTOUR_CACHE.values()) mat.dispose();
  TERRAIN_CONTOUR_CACHE.clear();
  INVISIBLE_FACE_MATERIAL?.dispose();
  INVISIBLE_FACE_MATERIAL = null;
  HIDDEN_LINE_FACE_MATERIAL?.dispose();
  HIDDEN_LINE_FACE_MATERIAL = null;
}
