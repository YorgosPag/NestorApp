/**
 * material-library-index — ADR-687 Φ8 SSoT. ΜΙΑ ένωση «όλα τα υλικά που μπορεί να διαλέξει ο
 * χρήστης», δύο προβολές. Big-player: το Revit *Material Browser* / Cinema 4D *Content Browser* /
 * ArchiCAD *Attribute Manager* δείχνουν ΟΛΑ τα υλικά (built-in catalog + system/company/project
 * library + μπογιές) σε μία λίστα με πηγή/badge — ξεχωριστά από τα «υλικά σε χρήση» της σκηνής.
 *
 * ΠΡΙΝ: η ένωση αυτή ζούσε inline μέσα στο `buildBodySwatches` (`polygon-material-swatches.ts`) και
 * τροφοδοτούσε ΜΟΝΟ τη μπάρα. Τώρα είναι εδώ, SSoT, και την καταναλώνουν:
 *   - το αριστερό panel «Διαχείριση Υλικών» (Ν.1, `MaterialsLibraryPanel`) — cards με badge/source·
 *   - το popover «Βιβλιοθήκη» της κάτω μπάρας (Ν.2, apply-on-click)·
 *   - το ίδιο το `buildBodySwatches` (projection → `SwatchItem`, για το `ImportedMeshMaterialMapDialog`).
 *
 * Pure module — no React, no three.js, no Firestore. Reuse των υπαρχόντων catalog/paints SSoT.
 *
 * @see ./polygon-material-swatches.ts — projection σε `SwatchItem` (`entryToSwatchItem`)
 * @see ./useSceneMaterials.ts — φιλτράρει αυτόν τον index με ό,τι περιέχει η σκηνή (Ν.2 μπάρα)
 * @see docs/centralized-systems/reference/adrs/ADR-687-material-editor-visual-appearance.md
 */

import type { TFunction } from 'i18next';
import type {
  BimMaterial,
  BimMaterialAppearance,
  BimMaterialCategory,
  BimMaterialScope,
} from '../../bim/types/bim-material-types';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import { constructionMaterialLabelKey } from '../../bim/materials/construction-materials';
import { listWallCoveringMaterials } from '../../bim/wall-coverings/wall-covering-material-catalog';

/**
 * Curated textured "cladding" materials for face paint — the `mat-*` keys of
 * `MATERIAL_TEXTURE_MAP` (`bim/materials/bim-texture-registry.ts`) that read as a real face
 * FINISH (brick / stone / wood / tile / concrete / metal / plaster / roof-tile). Build-up-layer
 * DNA materials (`mat-screed`, `mat-insulation`, `mat-membrane`, `mat-gravel`, `mat-finish`) are
 * deliberately EXCLUDED — those are Revit Floor-Type layers, not a paintable face finish. Owned
 * here (the catalog side of the library); `polygon-material-swatches.ts` re-exports for back-compat.
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

/** Η πηγή ενός υλικού της βιβλιοθήκης — οδηγεί badge + δικαιώματα (edit/delete/duplicate). */
export type MaterialLibrarySource = 'catalog' | 'paint' | 'user';

/**
 * Ενοποιημένη εγγραφή βιβλιοθήκης — ό,τι χρειάζεται και για render (label + σφαίρα-swatch) και για
 * apply (`apply` = `FaceAppearance`) και για διαχείριση (source/scope/editable/deletable/bimMaterial).
 * Επίπεδο (όχι discriminated union) ώστε ο κατάλογος cards να διαβάζει ομοιόμορφα label/source.
 */
export interface LibraryEntry {
  readonly id: string;
  readonly label: string;
  readonly source: MaterialLibrarySource;
  /** Το appearance που εφαρμόζεται στην όψη (κλικ/drag) — SSoT apply value. */
  readonly apply: FaceAppearance;
  /** Firestore scope (μόνο για `source: 'user'`). */
  readonly scope?: BimMaterialScope;
  readonly category?: BimMaterialCategory;
  readonly thumbnailUrl?: string | null;
  readonly albedoUrl?: string | null;
  /** Per-material PBR appearance (user) → rendered sphere thumbnail (Φ6). */
  readonly appearance?: BimMaterialAppearance | null;
  /** Flat χρώμα μπογιάς (`source: 'paint'`) → coloured sphere. */
  readonly color?: string;
  /** Catalog/user materialId → sphere thumbnail (textured). */
  readonly materialId?: string;
  /** Το Firestore doc (μόνο user) — για edit/delete. */
  readonly bimMaterial?: BimMaterial;
  readonly editable: boolean;
  readonly deletable: boolean;
}

/**
 * Ο scope-filter κλειδί για το `LibraryFilterBar`: user → το Firestore scope· catalog/paint → η
 * ίδια η πηγή (ψευδο-scope, ώστε να φιλτράρονται χωρίς άγγιγμα του shared `library-filter.ts`).
 */
export function entryFilterScope(entry: LibraryEntry): string {
  return entry.source === 'user' ? (entry.scope ?? 'company') : entry.source;
}

/**
 * ADR-687 Φ8 — ΜΙΑ ένωση, σειρά Cinema 4D Material Manager:
 *   1. textured catalog cladding (`FACE_TEXTURE_MATERIAL_IDS`) — Τούβλο/Πέτρα/Ξύλο/…
 *   2. η βιβλιοθήκη του χρήστη (`bmat_*`, system/company/project)
 *   3. legacy flat μπογιές (`listWallCoveringMaterials`)
 * Ο `t` χρειάζεται μόνο για τις catalog/paint ετικέτες (explicit `dxf-viewer-shell:` ns → δουλεύει από
 * οποιοδήποτε `t`). Τα user υλικά φέρουν το δικό τους όνομα.
 */
export function buildMaterialLibraryEntries(
  library: readonly BimMaterial[],
  t: TFunction,
): LibraryEntry[] {
  const catalog: LibraryEntry[] = FACE_TEXTURE_MATERIAL_IDS.map((id) => ({
    id,
    label: t(`dxf-viewer-shell:${constructionMaterialLabelKey(id)}`),
    source: 'catalog',
    apply: { materialId: id },
    materialId: id,
    editable: false,
    deletable: false,
  }));
  const user: LibraryEntry[] = library.map((m) => ({
    id: m.id,
    label: m.nameEl || m.nameEn || m.id,
    source: 'user',
    apply: { materialId: m.id },
    scope: m.scope,
    category: m.category,
    thumbnailUrl: m.thumbnailUrl,
    albedoUrl: m.pbrTextures?.albedoUrl ?? null,
    appearance: m.appearance,
    materialId: m.id,
    bimMaterial: m,
    // System seeds (builtin) = read-only client-side (ADR-363).
    editable: !m.builtin,
    deletable: !m.builtin,
  }));
  const paints: LibraryEntry[] = listWallCoveringMaterials().map((p) => ({
    id: p.id,
    label: t(`dxf-viewer-shell:wallCovering.materials.${p.labelKeySuffix}`),
    source: 'paint',
    apply: { materialId: p.id },
    color: p.color,
    editable: false,
    deletable: false,
  }));
  return [...catalog, ...user, ...paints];
}
