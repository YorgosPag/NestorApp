/**
 * BIM PBR texture registry — ADR-413.
 *
 * The SSoT mapping of our OWN texture slugs (directory + registry keys, decoupled
 * from Poly Haven internal asset ids) → physical real-world tile size + capability
 * flags + licence, and a `MaterialCatalog3D` material-key → slug map.
 *
 * A "slug" names a texture *set* (albedo + optional normal/roughness/ao). Files
 * live under `<slug>/<map>.jpg` (see `texture-source.ts` for where exactly). Tile
 * sizes are in METERS (the real-world repeat size of one tile of the texture), so
 * the cache can set `texture.repeat = 1 / tileSizeM` and have geometry whose UVs
 * are authored in world meters tile physically across any mesh size.
 *
 * Types/data file (size-exempt): no runtime logic beyond a pure lookup.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import { resolveMaterialKey } from './material-catalog-defs';

/** Our 8 BIM texture slugs (directory + registry keys). */
export type PbrTextureSlug =
  | 'concrete'
  | 'brick'
  | 'plaster'
  | 'wood'
  | 'tile'
  | 'stone'
  | 'metal'
  | 'roof-tiles';

/** Per-slug texture-set definition: physical tile size + capability flags. */
export interface PbrTextureSetDef {
  readonly slug: PbrTextureSlug;
  /** Real-world repeat size of one texture tile, in METERS. */
  readonly tileSizeM: number;
  readonly hasNormal: boolean;
  readonly hasRoughness: boolean;
  readonly hasAo: boolean;
  /** True when this slug ships a displacement (height) map for 3D relief. */
  readonly hasDisplacement?: boolean;
  readonly license: 'CC0' | 'CC-BY';
  readonly attribution?: string;
}

/**
 * Texture-set catalog — all CC0 (Poly Haven). Tile sizes per ADR-413 contract.
 * Every set ships albedo + normal + roughness + ao maps.
 */
export const TEXTURE_SET_DEFS: Record<PbrTextureSlug, PbrTextureSetDef> = {
  // ao.jpg not downloaded locally (storage mode has them); hasAo: false avoids 404s in public mode.
  concrete: { slug: 'concrete', tileSizeM: 2.0, hasNormal: true, hasRoughness: true, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  brick:    { slug: 'brick',    tileSizeM: 1.0, hasNormal: true, hasRoughness: true, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  plaster:  { slug: 'plaster',  tileSizeM: 2.0, hasNormal: true, hasRoughness: true, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  wood:     { slug: 'wood',     tileSizeM: 1.5, hasNormal: true, hasRoughness: true, hasAo: true, license: 'CC0', attribution: 'Poly Haven' },
  tile:     { slug: 'tile',     tileSizeM: 0.6, hasNormal: true, hasRoughness: true, hasAo: true, license: 'CC0', attribution: 'Poly Haven' },
  stone:    { slug: 'stone',    tileSizeM: 1.5, hasNormal: true, hasRoughness: true, hasAo: true, license: 'CC0', attribution: 'Poly Haven' },
  metal:    { slug: 'metal',    tileSizeM: 1.0, hasNormal: true, hasRoughness: true, hasAo: true, license: 'CC0', attribution: 'Poly Haven' },
  // ADR-417 — clay roof-tile set (Poly Haven «roof_tiles_14», CC0). One tile row
  // band ≈ 1 m of roof, so `repeat = 1/1` lays physically-sized κεραμίδια.
  // hasDisplacement: Giorgio → κατέβασε roof_tiles_14_disp_2k.jpg →
  //   public/textures/roof-tiles/displacement.jpg  (Poly Haven CC0, gratis)
  'roof-tiles': { slug: 'roof-tiles', tileSizeM: 1.0, hasNormal: true, hasRoughness: true, hasAo: true, hasDisplacement: true, license: 'CC0', attribution: 'Poly Haven' },
};

/**
 * MaterialCatalog3D key → texture slug. Keys mirror `MAT_DEFS` in
 * `MaterialCatalog3D.ts` (DNA material prefixes `mat-*` + element fallbacks
 * `elem-*`). Unmapped keys (e.g. `mat-glass`, MEP/colour-by-system) have no
 * textured variant and stay flat.
 */
export const MATERIAL_TEXTURE_MAP: Record<string, PbrTextureSlug> = {
  // DNA material prefixes.
  'mat-concrete': 'concrete',
  'mat-plaster':  'plaster',
  'mat-brick':    'brick',
  'mat-stone':    'stone',
  'mat-tile':     'tile',
  'mat-wood':     'wood',
  'mat-metal':    'metal',
  // ADR-416 — composite slab build-up layers. Mapped to the closest existing CC0
  // slug until dedicated screed/insulation/membrane/gravel textures ship.
  'mat-screed':     'plaster',
  'mat-insulation': 'plaster',
  'mat-membrane':   'stone',
  'mat-gravel':     'stone',
  'mat-finish':     'tile',
  // ADR-417 — clay roof tile DNA material (κεραμίδι) → CC0 roof-tile PBR set.
  'mat-roof-tile':  'roof-tiles',
  // Element-type fallbacks.
  'elem-column': 'concrete',
  'elem-beam':   'wood',
  'elem-slab':   'concrete',
  // ADR-417 — pitched roof «νερά» render with clay roof tiles.
  'elem-roof':   'roof-tiles',
  // Stair components.
  'elem-stair-tread':    'wood',
  'elem-stair-riser':    'concrete',
  'elem-stair-landing':  'concrete',
  'elem-stair-stringer': 'metal',
  'elem-stair-handrail': 'metal',
  // Envelope (ETICS) shell.
  'elem-envelope': 'plaster',
};

/** Look up the texture slug for a resolved MaterialCatalog3D key; null if unmapped. */
export function textureSlugForKey(materialKey: string): PbrTextureSlug | null {
  return MATERIAL_TEXTURE_MAP[materialKey] ?? null;
}

/**
 * ADR-417 #5 — the physical tile size (METERS) of a material's PBR texture set, or
 * `null` when the material has no textured variant. Resolves the materialId via the
 * SAME prefix path the 3D catalog uses (`resolveMaterialKey` → `textureSlugForKey`
 * → `TEXTURE_SET_DEFS[slug].tileSizeM`). Pure (no React/three) so the roof converter
 * can read the base tile size to derive slope-aligned UV scales for absolute
 * (cm-accurate) tile dimensions without touching the shared texture singleton.
 */
export function tileSizeMForMaterialId(materialId: string): number | null {
  const slug = textureSlugForKey(resolveMaterialKey(materialId));
  return slug ? TEXTURE_SET_DEFS[slug].tileSizeM : null;
}
