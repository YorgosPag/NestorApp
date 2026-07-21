/**
 * polygon-material-swatches — ADR-539 Φ4d / ADR-679 Φ2b. Pure data + descriptor builder for
 * the BODY layer's TEXTURED swatches (catalog + user library) in `PolygonMaterialPanel`
 * (Cinema 4D Material Manager parity — a face painted with one of these ids renders its REAL
 * texture, not just a flat colour; see `../materials/face-appearance-material.ts` →
 * `resolveFaceMaterial` → `MaterialCatalog3D.getFaceMaterial3D`).
 *
 * Pure module — no React, no three.js, no Firestore. The panel wires rendering/drag/apply.
 *
 * @see ./PolygonMaterialPanel.tsx — consumer (BODY layer swatch groups)
 * @see ../../bim/materials/bim-texture-registry.ts — MATERIAL_TEXTURE_MAP (catalog textures)
 * @see ../../bim/types/bim-material-types.ts — BimMaterial (user library doc shape)
 * @see docs/centralized-systems/reference/adrs/ADR-679-pbr-material-full-parity.md
 */

import type { BimMaterial, BimMaterialCategory } from '../../bim/types/bim-material-types';

/**
 * Curated textured "cladding" materials for face paint — the `mat-*` keys of
 * `MATERIAL_TEXTURE_MAP` (`bim/materials/bim-texture-registry.ts`) that read as a real face
 * FINISH (brick / stone / wood / tile / concrete / metal / plaster / roof-tile). Build-up-layer
 * DNA materials (`mat-screed`, `mat-insulation`, `mat-membrane`, `mat-gravel`, `mat-finish`) are
 * deliberately EXCLUDED — those are Revit Floor-Type layers, not a paintable face finish.
 */
export const FACE_TEXTURE_MATERIAL_IDS = [
  'mat-brick',
  'mat-stone',
  'mat-wood',
  'mat-tile',
  'mat-concrete',
  'mat-metal',
  'mat-plaster',
  'mat-roof-tile',
] as const;

export type FaceTextureMaterialId = (typeof FACE_TEXTURE_MATERIAL_IDS)[number];

/** Lightweight render descriptor for a user-library (`bmat_*`) swatch — no Firestore/React types. */
export interface LibraryMaterialSwatchDescriptor {
  readonly id: string;
  readonly label: string;
  readonly category: BimMaterialCategory;
  readonly thumbnailUrl: string | null;
  readonly albedoUrl: string | null;
}

/**
 * Maps the live material library (`useMaterialLibrary().materials`) into render descriptors for
 * the BODY layer's user-library swatch group. No filtering by texture: a library material with
 * no uploaded albedo still paints (its flat category colour via `MaterialSwatch`'s existing
 * fallback) — the same behaviour the Materials Library panel already gives every material.
 */
export function buildLibraryMaterialSwatches(
  materials: readonly BimMaterial[],
): readonly LibraryMaterialSwatchDescriptor[] {
  return materials.map((m) => ({
    id: m.id,
    label: m.nameEl || m.nameEn || m.id,
    category: m.category,
    thumbnailUrl: m.thumbnailUrl,
    albedoUrl: m.pbrTextures?.albedoUrl ?? null,
  }));
}
