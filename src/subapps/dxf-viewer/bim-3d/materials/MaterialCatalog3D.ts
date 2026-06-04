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
import { getTextureSet, preloadTextureSet, type LoadedTextureSet } from './bim-texture-cache';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';

interface PbrDef {
  color: number;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
}

// ADR-366 §7.1 material definitions.
const MAT_DEFS: Record<string, PbrDef> = {
  // Keyed by materialId prefix — matches wall-dna-types.ts materialId conventions.
  'mat-concrete': { color: 0xb0b0b0, roughness: 0.80, metalness: 0.00 },
  'mat-plaster':  { color: 0xe8e0d0, roughness: 0.90, metalness: 0.00 },
  'mat-brick':    { color: 0xb05030, roughness: 0.85, metalness: 0.00 },
  'mat-stone':    { color: 0x907060, roughness: 0.95, metalness: 0.00 },
  'mat-tile':     { color: 0xf0ece0, roughness: 0.30, metalness: 0.00 },
  'mat-wood':     { color: 0x8b5e3c, roughness: 0.70, metalness: 0.00 },
  'mat-glass':    { color: 0x88ccff, roughness: 0.10, metalness: 0.00, transparent: true, opacity: 0.35 },
  'mat-metal':    { color: 0x888888, roughness: 0.30, metalness: 0.90 },
  // Element-type fallbacks (when no DNA is present).
  'elem-column':  { color: 0x8a8a8a, roughness: 0.75, metalness: 0.05 },
  'elem-beam':    { color: 0x6d4c3d, roughness: 0.75, metalness: 0.05 },
  'elem-slab':    { color: 0xbdbdbd, roughness: 0.80, metalness: 0.00 },
  // ADR-370 Phase 5 — stair element-type defaults (Revit-aligned: wood treads,
  // concrete risers/landings, metal stringers/handrails).
  'elem-stair-tread':    { color: 0x8b5e3c, roughness: 0.70, metalness: 0.00 },
  'elem-stair-riser':    { color: 0xbdbdbd, roughness: 0.85, metalness: 0.00 },
  'elem-stair-stringer': { color: 0x6b6b6b, roughness: 0.40, metalness: 0.80 },
  'elem-stair-landing':  { color: 0xbdbdbd, roughness: 0.80, metalness: 0.00 },
  'elem-stair-handrail': { color: 0x999999, roughness: 0.25, metalness: 0.90 },
  // ADR-396 Phase P5 — envelope (ETICS) shell default. Insulation-board tint:
  // warm light grey (graphite EPS / XPS boards), matte non-metallic surface.
  'elem-envelope':       { color: 0xe6ddcf, roughness: 0.92, metalness: 0.00 },
  // ADR-406 — MEP light fixture default: bright diffuser white, low roughness
  // (frosted panel), slightly translucent so it reads as a luminaire.
  'elem-mep-fixture':    { color: 0xfff4d6, roughness: 0.35, metalness: 0.00, transparent: true, opacity: 0.85 },
  // ADR-408 Φ3 — electrical panel default: painted steel enclosure — grey-green
  // (RAL 7035-ish equipment grey), matte, low metalness (powder-coated box).
  'elem-electrical-panel': { color: 0x6b7280, roughness: 0.55, metalness: 0.30 },
  // ADR-407 — railing (guardrail) default: brushed metal — mid grey, low
  // roughness, high metalness (steel/aluminium posts, balusters, top rail).
  'elem-railing':        { color: 0x999999, roughness: 0.30, metalness: 0.85 },
  // ADR-408 Φ7 — home-run conduit/wire default. Always tinted by the circuit's
  // system colour (via getSystemTintedMaterial3D), so this base colour is only a
  // fallback; matte plastic-insulation look (low metalness, mid roughness).
  'elem-mep-wire':       { color: 0xb45309, roughness: 0.60, metalness: 0.00 },
  // ADR-410 — furniture fallback (used for the bbox placeholder + when a loaded
  // glTF carries no own materials). Warm wood-tan, matte. The real CC0 mesh keeps
  // its own glTF materials; this only paints the placeholder box.
  'elem-furniture':      { color: 0xb48250, roughness: 0.65, metalness: 0.05 },
  // ADR-408 Φ8 — MEP duct (rectangular/round HVAC duct): galvanised sheet-steel
  // grey (similar to RAL 9006 / zinc-coated surface). Low roughness (smooth
  // sheet metal), mid metalness.
  'elem-mep-duct':       { color: 0xb0b4b8, roughness: 0.35, metalness: 0.60 },
  // ADR-408 Φ8 — MEP pipe (plumbing / hydronic pipe): copper/brass tone.
  // Low roughness (polished pipe), high metalness.
  'elem-mep-pipe':       { color: 0xb87333, roughness: 0.30, metalness: 0.75 },
  // ADR-408 Φ11 — MEP fitting (auto pipe junction element): metallic grey
  // (cast/forged fitting body), mid roughness, high metalness.
  'elem-mep-fitting':    { color: 0x8a8f94, roughness: 0.40, metalness: 0.70 },
  // ADR-408 Φ12 — MEP plumbing manifold (συλλέκτης): cyan-teal (plumbing
  // equipment — distinguishable from copper pipe 0xb87333 and duct 0xb0b4b8).
  // Matte-ish plastic/composite housing, low metalness.
  'elem-mep-manifold':   { color: 0x0891b2, roughness: 0.50, metalness: 0.20 },
};

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

function buildMat(def: PbrDef): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: def.roughness,
    metalness: def.metalness,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1,
    side: THREE.DoubleSide,
  });
}

function resolveKey(materialId: string): string {
  for (const prefix of Object.keys(MAT_DEFS)) {
    if (materialId.startsWith(prefix)) return prefix;
  }
  return 'mat-concrete';
}

/** The flat (non-textured) singleton for a resolved key — cached for app lifetime. */
function getFlatMaterial(key: string): THREE.MeshStandardMaterial {
  let mat = CACHE.get(key);
  if (!mat) {
    mat = buildMat(MAT_DEFS[key] ?? MAT_DEFS['mat-concrete']!);
    CACHE.set(key, mat);
  }
  return mat;
}

/** Build a textured clone of a key's flat material, attaching the loaded PBR maps. */
function buildTexturedMaterial(key: string, set: LoadedTextureSet): THREE.MeshStandardMaterial {
  const def = MAT_DEFS[key] ?? MAT_DEFS['mat-concrete']!;
  const mat = buildMat(def);
  mat.map = set.map;
  if (set.normalMap) mat.normalMap = set.normalMap;
  if (set.roughnessMap) mat.roughnessMap = set.roughnessMap;
  // aoMap needs uv2 — the geometry layer ensures one; three ignores it gracefully
  // when absent (ADR-413 contract).
  if (set.aoMap) mat.aoMap = set.aoMap;
  mat.needsUpdate = true;
  return mat;
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
  return resolveKey(materialId);
}

/** Resolve MeshStandardMaterial from a DNA materialId (e.g. 'mat-concrete-c25'). */
export function getMaterial3D(materialId: string): THREE.MeshStandardMaterial {
  return resolveTexturedMaterial(resolveKey(materialId));
}

/** Resolve MeshStandardMaterial for element types without DNA. */
export function getElementMaterial3D(
  type: 'column' | 'beam' | 'slab' | 'envelope' | 'mep-fixture' | 'electrical-panel' | 'railing' | 'mep-wire' | 'furniture' | 'mep-duct' | 'mep-pipe' | 'mep-fitting' | 'mep-manifold' | Stair3DComponent,
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
    const def = MAT_DEFS[baseKey] ?? MAT_DEFS['mat-concrete']!;
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
}
