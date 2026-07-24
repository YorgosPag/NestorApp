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

import type { BimMaterial, BimMaterialAppearance, BimMaterialCategory } from '../../bim/types/bim-material-types';
// ADR-687 Φ8 — η ένωση catalog+library+μπογιές είναι SSoT στο `material-library-index`. Το
// `buildBodySwatches` είναι πλέον projection του (μηδέν δεύτερη ένωση, N.18). Ο κατάλογος
// `FACE_TEXTURE_MATERIAL_IDS` ζει εκεί (catalog side)· εδώ re-exported για back-compat.
import type { TFunction } from 'i18next';
import {
  FACE_TEXTURE_MATERIAL_IDS,
  buildMaterialLibraryEntries,
  type FaceTextureMaterialId,
  type LibraryEntry,
} from './material-library-index';

export { FACE_TEXTURE_MATERIAL_IDS };
export type { FaceTextureMaterialId };

/** Lightweight render descriptor for a user-library (`bmat_*`) swatch — no Firestore/React types. */
export interface LibraryMaterialSwatchDescriptor {
  readonly id: string;
  readonly label: string;
  readonly category: BimMaterialCategory;
  readonly thumbnailUrl: string | null;
  readonly albedoUrl: string | null;
  /** ADR-687 Φ6 — per-material appearance → rendered sphere thumbnail in the swatch. */
  readonly appearance: BimMaterialAppearance | null;
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
    appearance: m.appearance,
  }));
}

/**
 * Textured swatch reference (ADR-679 Φ2b) — catalog `mat-*` id OR user-library `bmat_*`
 * category+urls. Rendered via the shared `<MaterialSwatch>` (real photo/albedo), not a flat span.
 */
export interface SwatchTextureRef {
  readonly materialId?: string;
  readonly category?: BimMaterialCategory;
  readonly thumbnailUrl?: string | null;
  readonly albedoUrl?: string | null;
  /** ADR-687 Φ6 — per-material appearance → rendered sphere thumbnail (user-library swatches). */
  readonly appearance?: BimMaterialAppearance | null;
}

/**
 * Ένα swatch υλικού «σώματος» (layer-agnostic: label + id), σε ΔΥΟ σχήματα:
 *   - flat χρώμα (legacy wall-covering paints) → `color` hex, καμία υφή·
 *   - textured (catalog cladding + user library) → `swatch` ref, render μέσω `<MaterialSwatch>`.
 * Discriminated ώστε το render branch να είναι type-safe (όχι optional-both, όχι `!`).
 */
export type SwatchItem =
  | {
      readonly id: string;
      readonly label: string;
      /** Body swatches είναι draggable (drag-drop 539)· finish = click-only. */
      readonly draggable: boolean;
      readonly color: string;
      readonly swatch?: undefined;
    }
  | {
      readonly id: string;
      readonly label: string;
      readonly draggable: boolean;
      readonly swatch: SwatchTextureRef;
      readonly color?: undefined;
    };

/**
 * ADR-687 Φ8 — projection ενός `LibraryEntry` (γενική βιβλιοθήκη SSoT) → `SwatchItem`. Μπογιά (flat
 * `color`) → `color` branch· catalog/user (materialId) → `swatch` ref (textured σφαίρα). Το
 * `color !== undefined` discriminant είναι type-safe (χωρίς `!`/`as`).
 */
export function entryToSwatchItem(entry: LibraryEntry): SwatchItem {
  if (entry.color !== undefined) {
    return { id: entry.id, label: entry.label, draggable: true, color: entry.color };
  }
  return {
    id: entry.id,
    label: entry.label,
    draggable: true,
    swatch: {
      materialId: entry.materialId,
      category: entry.category,
      thumbnailUrl: entry.thumbnailUrl,
      albedoUrl: entry.albedoUrl,
      appearance: entry.appearance,
    },
  };
}

/**
 * ADR-679 Φ2b / ADR-687 Φ8 — «τι υλικά μπορεί να διαλέξει ο χρήστης για σώμα» = projection της
 * γενικής βιβλιοθήκης (`buildMaterialLibraryEntries`) σε `SwatchItem[]`, Cinema 4D Material Manager
 * order (catalog → user library → μπογιές). ΜΙΑ ένωση (SSoT στο `material-library-index`), μηδέν
 * διπλότυπο (N.18). Consumer: `ImportedMeshMaterialMapDialog` (dropdown, ADR-686 Φ5) + το popover
 * «Βιβλιοθήκη» της κάτω μπάρας (ADR-687 Φ8).
 */
export function buildBodySwatches(library: readonly BimMaterial[], t: TFunction): SwatchItem[] {
  return buildMaterialLibraryEntries(library, t).map(entryToSwatchItem);
}
