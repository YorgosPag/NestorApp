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
};

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
export function getElementMaterial3D(type: 'column' | 'beam' | 'slab'): THREE.MeshStandardMaterial {
  const key = `elem-${type}`;
  let mat = CACHE.get(key);
  if (!mat) {
    mat = buildMat(MAT_DEFS[key] ?? MAT_DEFS['mat-concrete']!);
    CACHE.set(key, mat);
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
