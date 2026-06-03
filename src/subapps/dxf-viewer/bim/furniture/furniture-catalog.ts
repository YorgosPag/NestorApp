/**
 * Furniture catalog presets (SSoT) — ADR-410 vertical slice.
 *
 * The single source of truth for every shippable furniture asset: its catalog
 * id (which doubles as the Firebase Storage filename `furniture-library/<id>.glb`),
 * authored footprint dimensions (so the 2D footprint + 3D bbox placeholder work
 * WITHOUT loading the glTF), ΑΤΟΕ code and IFC class.
 *
 * Like a Revit content library entry: geometry lives in the mesh, metadata lives
 * here. The ribbon picker options are GENERATED from `FURNITURE_CATALOG` — never
 * hand-maintain a parallel list.
 *
 * Legality (ADR-409 §B-θετικό + §D.1): all assets are CC0 (Poly Haven, verified)
 * → we redistribute + enrich freely; the BIM metadata below is ours.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 * @see docs/centralized-systems/reference/adrs/ADR-409-third-party-bim-library-licensing-policy.md §D.1
 */

import type { AtoeCategoryCode } from '../types/bim-base';
import type { FurnitureKind } from '../types/furniture-types';

export interface FurnitureCatalogPreset {
  /**
   * Catalog id — persisted in `FurnitureParams.assetId` AND used as the Storage
   * object name (`furniture-library/<id>.glb`). Stable, lowercase-kebab.
   */
  readonly id: string;
  /** Furniture kind discriminator. */
  readonly kind: FurnitureKind;
  /** i18n label key (namespace: dxf-viewer-shell). */
  readonly labelKey: string;
  /** Authored footprint width (mm) — X before rotation. */
  readonly widthMm: number;
  /** Authored footprint depth (mm) — Y before rotation. */
  readonly depthMm: number;
  /** Authored overall height (mm) — bbox Z. */
  readonly heightMm: number;
  /** ΑΤΟΕ category code for the BOQ feed (unit = 'pcs'). */
  readonly atoeCode: AtoeCategoryCode;
  /** Source attribution (CC0 — no obligation, kept for provenance only). */
  readonly source: string;
}

/**
 * The shippable furniture library. Opening slice = a single CC0 chair.
 * `chair_01` ↔ Firebase Storage `furniture-library/chair_01.glb`.
 */
export const FURNITURE_CATALOG: readonly FurnitureCatalogPreset[] = [
  {
    id: 'chair_01',
    kind: 'chair',
    labelKey: 'furniture.catalog.chair01',
    widthMm: 500,
    depthMm: 520,
    heightMm: 900,
    atoeCode: 'ΟΙΚ-12',
    source: 'Poly Haven (CC0)',
  },
] as const;

/** Default asset id picked by the placement tool when none is chosen. */
export const DEFAULT_FURNITURE_ASSET_ID = 'chair_01';

/** Resolve a catalog preset by id. Returns `undefined` for an unknown asset. */
export function resolveFurnitureAsset(assetId: string): FurnitureCatalogPreset | undefined {
  return FURNITURE_CATALOG.find((p) => p.id === assetId);
}
