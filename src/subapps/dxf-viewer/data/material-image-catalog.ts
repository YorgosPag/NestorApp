/**
 * ADR-643 Φ2 — Material Image Catalog SSoT (hatch `fillType:'image'` starter library).
 *
 * Curated **façade** πάνω στο υπάρχον CC0 PBR texture library (ADR-413): κάθε
 * υλικό της βιβλιοθήκης εικόνων αναφέρεται σε ΕΝΑ `PbrTextureSlug` (η `albedo.jpg`
 * του γίνεται το tiled fill image) + i18n όνομα + κατηγορία. Το «πραγματικό
 * μέγεθος tile» (mm, Revit/ArchiCAD μοντέλο) **παράγεται** από το `TEXTURE_SET_DEFS`
 * (μέτρα → mm) — ΔΕΝ ξαναγράφεται εδώ (μηδέν διπλότυπο δεδομένο διάστασης).
 *
 * Big-player SSoT: μία texture library, αναφορά ΚΑΙ από 2D image-fill ΚΑΙ από 3D
 * render appearance (ακριβώς Revit/ArchiCAD/C4D) — ίδιο idiom με το 2D swatch
 * `material-thumbnail-resolver.ts`. Το `assetId` του `HatchImageFill` = ένα `id`
 * αυτού του καταλόγου· ο `material-image-resolver` το μεταφράζει σε URL.
 *
 * Prefix `matimg-*` = curated builtins (σταθερά ids) — διακριτό από τα generated
 * `bmat_*` (bim_materials) και τα μελλοντικά Φ4 uploads, ώστε ΠΟΤΕ σύγκρουση id.
 *
 * Types/data file (size-exempt): pure lookups, καμία runtime λογική.
 *
 * @see ../rendering/entities/shared/material-image-resolver.ts — assetId → URL (καλεί resolveTextureUrl)
 * @see ../bim/materials/bim-texture-registry.ts — TEXTURE_SET_DEFS (tile size + licence CC0)
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §4, §8 Φ2
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures.md
 */

import {
  TEXTURE_SET_DEFS,
  type PbrTextureSlug,
} from '../bim/materials/bim-texture-registry';

// ─── Catalog entry ────────────────────────────────────────────────────────────

/** Ομαδοποίηση για τον picker (Φ3). */
export type MaterialImageCategory =
  | 'tile'
  | 'wood'
  | 'stone'
  | 'concrete'
  | 'masonry'
  | 'plaster'
  | 'metal';

export interface MaterialImageDef {
  /** Σταθερό curated id (= `HatchImageFill.assetId`). */
  readonly id: string;
  /** ADR-413 texture set — η `albedo.jpg` του γίνεται το fill image (SSoT source). */
  readonly textureSlug: PbrTextureSlug;
  /** Κατηγορία (picker grouping). */
  readonly category: MaterialImageCategory;
  /** i18n suffix κάτω από `hatchImageFill.materials.<suffix>`. */
  readonly labelKeySuffix: string;
}

// ─── Catalog data ─────────────────────────────────────────────────────────────

const CATALOG: readonly MaterialImageDef[] = [
  { id: 'matimg-ceramic-tile', textureSlug: 'tile',       category: 'tile',     labelKeySuffix: 'ceramicTile' },
  { id: 'matimg-wood',         textureSlug: 'wood',       category: 'wood',     labelKeySuffix: 'wood' },
  { id: 'matimg-marble',       textureSlug: 'stone',      category: 'stone',    labelKeySuffix: 'marble' },
  { id: 'matimg-concrete',     textureSlug: 'concrete',   category: 'concrete', labelKeySuffix: 'concrete' },
  { id: 'matimg-brick',        textureSlug: 'brick',      category: 'masonry',  labelKeySuffix: 'brick' },
  { id: 'matimg-plaster',      textureSlug: 'plaster',    category: 'plaster',  labelKeySuffix: 'plaster' },
  { id: 'matimg-metal',        textureSlug: 'metal',      category: 'metal',    labelKeySuffix: 'metal' },
  { id: 'matimg-roof-tiles',   textureSlug: 'roof-tiles', category: 'tile',     labelKeySuffix: 'roofTiles' },
];

// ─── Lookup map ───────────────────────────────────────────────────────────────

const CATALOG_MAP: ReadonlyMap<string, MaterialImageDef> = new Map(
  CATALOG.map((def) => [def.id, def]),
);

// ─── Public accessors ─────────────────────────────────────────────────────────

/** Όλα τα builtin υλικά εικόνας (starter library) — για τον picker (Φ3). */
export function listMaterialImages(): readonly MaterialImageDef[] {
  return CATALOG;
}

/** Ορισμός για ένα asset id, ή `undefined` για άγνωστα/user ids. */
export function getMaterialImage(id: string | undefined): MaterialImageDef | undefined {
  if (!id) return undefined;
  return CATALOG_MAP.get(id);
}

/**
 * Προεπιλεγμένο πραγματικό μέγεθος tile (mm) — **παράγεται** από το `TEXTURE_SET_DEFS`
 * (real-world repeat size σε μέτρα → mm). Τετράγωνο default (ο χρήστης το ρυθμίζει
 * per-axis στη Φ3). Άγνωστο id → 1000×1000 mm ασφαλές fallback.
 */
export function getMaterialImageDefaultTileMm(
  id: string | undefined,
): { readonly width: number; readonly height: number } {
  const def = getMaterialImage(id);
  const sizeM = def ? TEXTURE_SET_DEFS[def.textureSlug].tileSizeM : 1;
  const mm = sizeM * 1000;
  return { width: mm, height: mm };
}

/** Πλήρες i18n key για το όνομα υλικού. */
export function materialImageLabelKey(def: MaterialImageDef): string {
  return `hatchImageFill.materials.${def.labelKeySuffix}`;
}
