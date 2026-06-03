/**
 * MaterialCatalog3D — PBR material lookup for BIM 3D entities.
 *
 * Maps materialId (from WallDna layers) and element types → MeshStandardMaterial.
 * Materials are cached singletons (module lifetime) — safe to share across meshes.
 *
 * ADR-366 Phase 3 (SPEC-3D-003). ADR-363 Phase 6.x will extend with texture maps.
 */

import * as THREE from 'three';

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
};

export type Stair3DComponent =
  | 'stair-tread'
  | 'stair-riser'
  | 'stair-stringer'
  | 'stair-landing'
  | 'stair-handrail';

const CACHE = new Map<string, THREE.MeshStandardMaterial>();

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

/** Resolve MeshStandardMaterial from a DNA materialId (e.g. 'mat-concrete-c25'). */
export function getMaterial3D(materialId: string): THREE.MeshStandardMaterial {
  const key = resolveKey(materialId);
  let mat = CACHE.get(key);
  if (!mat) {
    mat = buildMat(MAT_DEFS[key] ?? MAT_DEFS['mat-concrete']!);
    CACHE.set(key, mat);
  }
  return mat;
}

/** Resolve MeshStandardMaterial for element types without DNA. */
export function getElementMaterial3D(
  type: 'column' | 'beam' | 'slab' | 'envelope' | 'mep-fixture' | 'electrical-panel' | 'railing' | 'mep-wire' | 'furniture' | Stair3DComponent,
): THREE.MeshStandardMaterial {
  const key = `elem-${type}`;
  let mat = CACHE.get(key);
  if (!mat) {
    mat = buildMat(MAT_DEFS[key] ?? MAT_DEFS['mat-concrete']!);
    CACHE.set(key, mat);
  }
  return mat;
}

/**
 * ADR-408 Φ5 — colour-by-system material: the element's base PBR (roughness /
 * metalness / transparency) tinted with the System's colour. Cached per
 * `${type}:${colorInt}` — never mutates the shared element singleton.
 */
export function getSystemTintedMaterial3D(
  type: 'mep-fixture' | 'electrical-panel' | 'mep-wire',
  colorInt: number,
): THREE.MeshStandardMaterial {
  const baseKey = `elem-${type}`;
  const cacheKey = `${baseKey}:${colorInt}`;
  let mat = CACHE.get(cacheKey);
  if (!mat) {
    const def = MAT_DEFS[baseKey] ?? MAT_DEFS['mat-concrete']!;
    mat = buildMat({ ...def, color: colorInt });
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
