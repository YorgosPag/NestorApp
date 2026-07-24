/**
 * material-thumbnail-spec — ADR-687 Φ7. Resolves the renderable «material spec»
 * (a flat `PbrMaterialDef` + an optional loaded PBR texture set) for a swatch, so the
 * offscreen sphere can show EVERY material kind on a sphere — full C4D/Revit parity:
 *   - user-library material with an `appearance`  → its own PBR appearance;
 *   - catalog cladding id (`mat-*`/`elem-*`)       → the catalog def + its slug texture set;
 *   - user-library id (`bmat_*`) with textures     → the registry's loaded texture set;
 *   - legacy flat wall-covering paint (`color`)    → a flat colour def, no texture.
 *
 * Def resolution is PURE (no three.js, testable). Texture-set resolution READS the existing
 * caches (`bim-texture-cache` / `user-material-registry`) and never re-loads — the textures
 * are already loaded for the 3D viewport; the offscreen sphere reuses the same `THREE.Texture`
 * objects (cross-context). `preloadThumbnailTextures` fires the async load when a set is
 * missing; the caches bump `textureAssetVersion`, which the swatch watches to re-resolve.
 *
 * @see ./material-appearance-thumbnail-store.ts — the reactive cache + hook
 * @see ../materials/bim-texture-cache.ts / ../materials/user-material-registry.ts — the sets
 */

import {
  appearanceToDef,
  catalogDefForMaterialId,
  flatColorDef,
  getCategoryMaterialDef,
  resolveMaterialKey,
  type PbrMaterialDef,
} from '../../bim/materials/material-catalog-defs';
import { textureSlugForKey } from '../../bim/materials/bim-texture-registry';
import type { BimMaterialAppearance, BimMaterialCategory } from '../../bim/types/bim-material-types';
import { getTextureSet, preloadTextureSet, type LoadedTextureSet } from '../materials/bim-texture-cache';
import { getUserMaterialTextureSet, preloadUserMaterialTextures } from '../materials/user-material-registry';

/** ADR-363 — prefix of `bim_materials` library document ids (mirror MaterialCatalog3D). */
const USER_MATERIAL_ID_PREFIX = 'bmat_';

export interface ThumbnailSpecInput {
  readonly appearance?: BimMaterialAppearance | null;
  readonly materialId?: string;
  readonly category?: BimMaterialCategory;
  readonly color?: string;
}

/**
 * The flat `PbrMaterialDef` a swatch's sphere renders with, or `null` when nothing resolves
 * (→ the swatch keeps its non-sphere fallback). Pure — precedence: explicit appearance →
 * catalog/library id → category → flat colour.
 */
export function resolveThumbnailDef(input: ThumbnailSpecInput): PbrMaterialDef | null {
  const { appearance, materialId, category, color } = input;
  if (appearance) return appearanceToDef(appearance);
  if (materialId && !materialId.startsWith(USER_MATERIAL_ID_PREFIX)) return catalogDefForMaterialId(materialId);
  if (category) return getCategoryMaterialDef(category);
  if (color) return flatColorDef(color);
  return null;
}

/**
 * The ALREADY-loaded PBR texture set for a swatch's material, or `null` (flat sphere). Reads
 * the caches synchronously; `version` (the store's `textureAssetVersion`) is only a
 * recompute trigger. Catalog ids read the slug cache; `bmat_*` ids read the user registry.
 */
export function resolveThumbnailTextureSet(materialId: string | undefined, _version: number): LoadedTextureSet | null {
  if (!materialId) return null;
  if (materialId.startsWith(USER_MATERIAL_ID_PREFIX)) return getUserMaterialTextureSet(materialId);
  const slug = textureSlugForKey(resolveMaterialKey(materialId));
  return slug ? getTextureSet(slug) : null;
}

/** Fire the async texture load for a swatch's material when its set is not yet cached. */
export function preloadThumbnailTextures(materialId: string | undefined): void {
  if (!materialId) return;
  if (materialId.startsWith(USER_MATERIAL_ID_PREFIX)) {
    preloadUserMaterialTextures(materialId);
    return;
  }
  const slug = textureSlugForKey(resolveMaterialKey(materialId));
  if (slug) preloadTextureSet(slug);
}
