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
// N.7.1 size split — coplanar-face depth-bias SSoT (ADR-375 offsets + ADR-366 §B.5 per-category priority).
import { withDepthPriority } from './material-depth-priority';
// N.7.1 size split (ADR-665) — the sole PBR face factory, shared with `terrain-materials-3d`.
// applyTextureSet — SSoT texture-apply, shared with the ADR-687 Φ7 offscreen thumbnail sphere.
import { buildMat, applyTextureSet } from './pbr-material-builder';
// N.18 SSoT — η ΜΟΝΑΔΙΚΗ «κάνε double-sided χωρίς να μολύνεις την πηγή» (WeakMap-cached).
import { ensureDoubleSided } from './ensure-double-sided';
// N.7.1 size split (ADR-665) — ADR-446 Visual Style FACES axis.
import { withFaceMode, disposeFaceModeMaterials } from './face-mode-materials';
// ADR-665 — terrain materials live in their own module (exclusivity is a load-bearing invariant
// for per-material clipping). Imported ONLY for teardown; N.18 — do not re-export them from here.
import { disposeTerrainMaterials3D } from './terrain-materials-3d';

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

/** The flat (non-textured) singleton for a resolved key — cached for app lifetime. */
function getFlatMaterial(key: string): THREE.MeshStandardMaterial {
  let mat = CACHE.get(key);
  if (!mat) {
    mat = buildMat(MATERIAL_DEFS[key] ?? MATERIAL_DEFS['mat-concrete']!);
    CACHE.set(key, mat);
  }
  return mat;
}

// applyTextureSet moved to `pbr-material-builder.ts` (ADR-687 Φ7 SSoT) — shared with the
// offscreen material-thumbnail sphere. Imported above; behaviour identical.

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

// ── ADR-539 Φ4d / ADR-679 Φ2b — per-face PBR material («Paint on face» με ΥΦΗ) ────
// Μια βαμμένη όψη επαναχρησιμοποιεί ΑΚΡΙΒΩΣ το ίδιο texture-aware, cached resolution με
// κάθε άλλο 3D υλικό (`getMaterial3D`) — μηδέν δεύτερος PBR builder, μηδέν δεύτερο texture
// cache (N.18 / ADR-584). Το μόνο per-face-specific είναι το `THREE.DoubleSide`: μια βαμμένη
// όψη μπορεί να είναι τοίχωμα ανοίγματος (slab hole) με flat normal προς το κενό, άρα πρέπει
// να render-άρει + raycast-άρει από μέσα (ADR-539 Φ2). Το `getMaterial3D` επιστρέφει FrontSide
// singletons (backface culling κλειστού solid), οπότε τυλίγουμε με το `ensureDoubleSided` SSoT
// (WeakMap-cached clone, N.18 — κοινό με prism + imported-mesh enhancer).

/**
 * ADR-539 Φ4d — έχει το υλικό όψης ΠΡΑΓΜΑΤΙΚΗ υφή σε αυτό το μονοπάτι; ΜΟΝΟ τα library
 * `bmat_*` υλικά κουβαλούν υφή ως `FaceAppearance.materialId` (τα wall-covering/floor-finish
 * είναι flat-χρώμα κατάλογοι). Κρίσιμο: αποτρέπει το `getMaterial3D('paint-red')` → concrete
 * fallback (foreign id → `resolveMaterialKey` default `mat-concrete`) — ξένο id ΔΕΝ γίνεται υφή.
 */
function hasFaceTexture(materialId: string): boolean {
  // Library `bmat_*` υλικό → υφή μόνο όταν έχει ανεβασμένο albedo.
  if (materialId.startsWith(USER_MATERIAL_ID_PREFIX)) {
    return !!getUserMaterialAppearance(materialId)?.textures?.albedoUrl;
  }
  // Catalog DNA/element υλικό (`mat-*`/`elem-*`) με χαρτογραφημένο texture slug (brick/wood/
  // stone/tile/concrete/metal/plaster/roof-tiles). Ξένα wall-covering/finish paint ids (π.χ.
  // 'paint-red') ΔΕΝ ξεκινούν με `mat-`/`elem-` → εξαιρούνται → legacy flat χρώμα (κανένα
  // concrete fallback). ADR-539 Φ4d — «ντύσιμο» όψης με catalog υλικό (brick/wood/stone/…).
  if (materialId.startsWith('mat-') || materialId.startsWith('elem-')) {
    return textureSlugForKey(resolveMaterialKey(materialId)) !== null;
  }
  return false;
}

/**
 * ADR-539 Φ4d — textured double-sided υλικό όψης, ή `null` όταν το υλικό ΔΕΝ έχει υφή σε
 * αυτό το μονοπάτι (wall-covering/floor-finish flat κατάλογοι, χωρίς uploaded texture, ή
 * realistic OFF) ώστε ο caller να κρατά το legacy flat-χρώμα path — ΠΟΤΕ concrete fallback
 * για ξένο id. Όταν επιστρέφει υλικό: reuse `getMaterial3D` (texture-aware, cached, preload→
 * resync wired) + DoubleSide variant (hole-wall visibility). Cached — ΠΟΤΕ dispose το result.
 */
export function getFaceMaterial3D(materialId: string): THREE.MeshStandardMaterial | null {
  if (!useBimRenderSettingsStore.getState().realisticMaterials) return null;
  if (!hasFaceTexture(materialId)) return null;
  const mat = ensureDoubleSided(getMaterial3D(materialId));
  // ADR-678 Φ2 (round-trip identity): σφραγίζει το Nestor material id ώστε το export να ονομάζει το
  // per-face υλικό με ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΤΟΥ (`bmat_*`/`mat-*`) — όχι texture-derived `tex_*` — για να το
  // αναγνωρίζει το re-import. Σταθερό ανά `bmat_*` (μοναδικό source→clone)· catalog `mat-*` που
  // μοιράζονται texture key κρατούν το τελευταίο id (αποδεκτό: ίδια εμφάνιση· Βήμα 2 το ακριβοποιεί).
  mat.userData['nestorMaterialId'] = materialId;
  return mat;
}

/**
 * ADR-539 — flat-χρώμα υλικό όψης βαμμένης με σκέτο CSS hex (`colorHex` override, χωρίς
 * ταυτότητα υλικού). Matte look (roughness 0.92, metalness 0), DoubleSide (hole-wall).
 * Cached ανά hex — ΕΝΑ shared singleton, μηδέν per-rebuild leak (πριν χτιζόταν fresh material
 * ανά βαμμένη όψη σε ΚΑΘΕ resync). Invalid hex → μαύρο (THREE default), όπως το legacy path.
 */
const FACE_COLOR_CACHE = new Map<string, THREE.MeshStandardMaterial>();

export function getFaceColorMaterial3D(colorHex: string): THREE.MeshStandardMaterial {
  let mat = FACE_COLOR_CACHE.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.92,
      metalness: 0,
      // ADR-539 Φ2 — double-sided so a painted hole-wall renders + raycasts from inside the void.
      side: THREE.DoubleSide,
    });
    FACE_COLOR_CACHE.set(colorHex, mat);
  }
  return mat;
}

/**
 * Dispose all cached materials. Call only on full app teardown —
 * NOT on 3D→2D mode toggle (ThreeJsSceneManager.dispose only disposes geometries).
 */
export function disposeMaterialCatalog3D(): void {
  // ADR-539 Φ4d — per-face flat-colour singletons (the double-sided textured variants live
  // in a WeakMap → GC'd with their source; their shared textures are freed by the caches below).
  for (const mat of FACE_COLOR_CACHE.values()) mat.dispose();
  FACE_COLOR_CACHE.clear();
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
  disposeFaceModeMaterials();
  // ADR-650 M10c/M10d + ADR-665 — terrain-exclusive materials (shaded base, analysis styles,
  // contour lines, terrain face-mode variants).
  disposeTerrainMaterials3D();
}
