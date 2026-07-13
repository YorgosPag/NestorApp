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

/**
 * Our BIM texture slugs (directory + registry keys). The first 8 are the ADR-413
 * starter sets; the `+10` block (ADR-653 Φ7) enriches the 2D hatch image-fill
 * library with photographic CC0 builtins (Poly Haven). Adding a slug here + its
 * `TEXTURE_SET_DEFS` entry + a `material-image-catalog.ts` façade row is all the
 * code a new builtin needs — the file just has to land at `<slug>/albedo.jpg`.
 */
export type PbrTextureSlug =
  | 'concrete'
  | 'brick'
  | 'plaster'
  | 'wood'
  | 'tile'
  | 'stone'
  | 'metal'
  | 'roof-tiles'
  // ADR-653 Φ7 — photographic builtin enrichment (albedo-only, CC0 Poly Haven).
  | 'granite'
  | 'asphalt'
  | 'gravel'
  | 'plywood'
  | 'osb'
  | 'laminate'
  | 'wood-floor'
  | 'smooth-concrete'
  | 'cobblestone'
  | 'parquet';

/**
 * PBR texture map channels. The SSoT union — `texture-source.ts` re-exports it as
 * `TextureMap` (that module cannot own it: it imports `firebase/storage`, so a
 * plain-node script such as `scripts/download-bim-textures.ts` could not read it).
 */
export type PbrTextureMapName = 'albedo' | 'normal' | 'roughness' | 'ao' | 'displacement';

/**
 * Upstream provider of every builtin texture set. All CC0 — see ADR-409.
 * `sourceAsset` below is an asset id in THIS provider's catalog.
 */
export const TEXTURE_PROVIDER = 'Poly Haven' as const;

/** Resolution the library is authored at (Poly Haven serves 1k/2k/4k/8k). */
export const TEXTURE_RESOLUTION = '2k' as const;

/** Per-slug texture-set definition: physical tile size + capability flags. */
export interface PbrTextureSetDef {
  readonly slug: PbrTextureSlug;
  /**
   * ADR-653 — the upstream `TEXTURE_PROVIDER` asset id this set is downloaded
   * from. THE reproducibility key: `*.jpg` is `.gitignore`d, so the binaries never
   * enter git; this id is what lets `npm run download:textures` rebuild the whole
   * library from scratch on any machine. One slug = one asset (never share an id
   * across slugs — that would ship two identical library materials).
   */
  readonly sourceAsset: string;
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
 *
 * ADR-653: this table IS the download manifest. The `hasX` flags declare exactly
 * which maps a slug ships, so `scripts/download-bim-textures.ts` derives the file
 * list from them (see `mapsForTextureSet`) — there is no second list to keep in
 * sync. Adding a slug = one row here + one `material-image-catalog.ts` façade row.
 */
export const TEXTURE_SET_DEFS: Record<PbrTextureSlug, PbrTextureSetDef> = {
  // ao.jpg not downloaded locally (storage mode has them); hasAo: false avoids 404s in public mode.
  concrete: { slug: 'concrete', sourceAsset: 'concrete_floor_02', tileSizeM: 2.0, hasNormal: true, hasRoughness: true, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  brick:    { slug: 'brick',    sourceAsset: 'red_brick_03',      tileSizeM: 1.0, hasNormal: true, hasRoughness: true, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  plaster:  { slug: 'plaster',  sourceAsset: 'beige_wall_001',    tileSizeM: 2.0, hasNormal: true, hasRoughness: true, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  wood:     { slug: 'wood',     sourceAsset: 'wood_planks_grey',  tileSizeM: 1.5, hasNormal: true, hasRoughness: true, hasAo: true, license: 'CC0', attribution: 'Poly Haven' },
  tile:     { slug: 'tile',     sourceAsset: 'floor_tiles_06',    tileSizeM: 0.6, hasNormal: true, hasRoughness: true, hasAo: true, license: 'CC0', attribution: 'Poly Haven' },
  // ADR-653: was `cobblestone_floor_04` — the SAME asset the new `cobblestone` slug
  // uses, i.e. two identical library materials. Retargeted to a real stone masonry
  // wall (Revit «Stone, Stacked» equivalent), which is also what `mat-stone` means.
  stone:    { slug: 'stone',    sourceAsset: 'stacked_stone_wall', tileSizeM: 1.5, hasNormal: true, hasRoughness: true, hasAo: true, license: 'CC0', attribution: 'Poly Haven' },
  metal:    { slug: 'metal',    sourceAsset: 'metal_plate',        tileSizeM: 1.0, hasNormal: true, hasRoughness: true, hasAo: true, license: 'CC0', attribution: 'Poly Haven' },
  // ADR-417 — clay roof-tile set (Poly Haven «roof_tiles_14», CC0). One tile row
  // band ≈ 1 m of roof, so `repeat = 1/1` lays physically-sized κεραμίδια.
  'roof-tiles': { slug: 'roof-tiles', sourceAsset: 'roof_tiles_14', tileSizeM: 1.0, hasNormal: true, hasRoughness: true, hasAo: true, hasDisplacement: true, license: 'CC0', attribution: 'Poly Haven' },
  // ── ADR-653 Φ7 — photographic builtin enrichment (Poly Haven CC0). ──────────
  // Albedo-only (hasNormal/Roughness/Ao=false → zero 404s in public mode; the 2D
  // hatch fill uses only albedo). Flip a flag to also fetch that map next run.
  // tileSizeM = real-world repeat of one tile (meters).
  granite:           { slug: 'granite',          sourceAsset: 'granite_tile',          tileSizeM: 0.6, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  asphalt:           { slug: 'asphalt',          sourceAsset: 'clean_asphalt',         tileSizeM: 2.0, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  gravel:            { slug: 'gravel',           sourceAsset: 'gravel_floor',          tileSizeM: 1.0, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  plywood:           { slug: 'plywood',          sourceAsset: 'plywood',               tileSizeM: 1.2, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  osb:               { slug: 'osb',              sourceAsset: 'oriented_strand_board', tileSizeM: 1.2, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  laminate:          { slug: 'laminate',         sourceAsset: 'laminate_floor',        tileSizeM: 1.2, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  'wood-floor':      { slug: 'wood-floor',       sourceAsset: 'wood_floor',            tileSizeM: 1.5, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  'smooth-concrete': { slug: 'smooth-concrete',  sourceAsset: 'smooth_concrete_floor', tileSizeM: 2.0, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  cobblestone:       { slug: 'cobblestone',      sourceAsset: 'cobblestone_floor_04',  tileSizeM: 2.0, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
  parquet:           { slug: 'parquet',          sourceAsset: 'diagonal_parquet',      tileSizeM: 1.0, hasNormal: false, hasRoughness: false, hasAo: false, license: 'CC0', attribution: 'Poly Haven' },
};

/**
 * The map files a texture set ships, derived from its capability flags — the SSoT
 * the downloader walks. `albedo` is mandatory (a set with no colour map is not a
 * texture); the rest are opt-in per slug.
 */
export function mapsForTextureSet(def: PbrTextureSetDef): readonly PbrTextureMapName[] {
  const maps: PbrTextureMapName[] = ['albedo'];
  if (def.hasNormal) maps.push('normal');
  if (def.hasRoughness) maps.push('roughness');
  if (def.hasAo) maps.push('ao');
  if (def.hasDisplacement) maps.push('displacement');
  return maps;
}

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
  // ADR-447 — δομικά/θεμελίωση = οπλισμένο σκυρόδεμα → concrete υφή by default
  // (όπως ήδη οι κολόνες), ώστε στο realistic να μη χρειάζεται ο χρήστης να δηλώνει
  // υλικό. Το beam ΔΙΟΡΘΩΘΗΚΕ από 'wood' (λάθος για RC δοκάρι) → 'concrete'.
  'elem-column': 'concrete',
  'elem-beam':   'concrete',
  'elem-slab':   'concrete',
  // ADR-447 — θεμελίωση (πέδιλα/πεδιλοδοκοί/συνδετήριες + fallback): below-grade RC
  // → concrete υφή (η εδαφόπλακα render-άρεται ως slab → elem-slab, ADR-436).
  'elem-foundation':          'concrete',
  'elem-foundation-pad':      'concrete',
  'elem-foundation-strip':    'concrete',
  'elem-foundation-tie-beam': 'concrete',
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
