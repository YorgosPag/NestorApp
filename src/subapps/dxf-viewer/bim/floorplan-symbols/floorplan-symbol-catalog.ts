/**
 * Floorplan symbol catalog presets (SSoT) — ADR-415 Φ1 vertical slice.
 *
 * Single source of truth for every shippable 2D plan symbol: catalog id, category
 * (Revit family category), kind, authored footprint dimensions and provenance.
 * Unlike the mesh catalog (ADR-410), there is NO external asset — every symbol is
 * drawn parametrically from `floorplan-symbol-symbol.ts` (Δ1: we author our own
 * pure-vector symbols; simple architectural shapes are not copyrightable).
 *
 * The ribbon picker options (Φ2+) are GENERATED from this catalog — never
 * hand-maintain a parallel list.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import type {
  FloorplanSymbolCategory,
  FloorplanSymbolKind,
} from '../types/floorplan-symbol-types';

export interface FloorplanSymbolPreset {
  /** Catalog id — persisted in `FloorplanSymbolParams.assetId`. Stable, kebab. */
  readonly id: string;
  /** Revit-faithful category (drives discipline/IFC/BimCategory). */
  readonly category: FloorplanSymbolCategory;
  /** Symbol kind discriminator. */
  readonly kind: FloorplanSymbolKind;
  /** i18n label key (namespace: dxf-viewer-shell). */
  readonly labelKey: string;
  /** Authored footprint width (mm) — X before rotation. */
  readonly widthMm: number;
  /** Authored footprint depth (mm) — Y before rotation. */
  readonly depthMm: number;
  /** Provenance (Δ1 — own parametric authorship, no third-party licence). */
  readonly source: string;
}

/**
 * The shippable symbol library — all parametric, authored by us (Δ1). Footprint
 * dimensions are typical real-world plan sizes (mm). `source` = own authorship.
 */
const OWN = 'parametric (own)';

export const FLOORPLAN_SYMBOL_CATALOG: readonly FloorplanSymbolPreset[] = [
  // ── Sanitary (είδη υγιεινής) ────────────────────────────────────────────────
  { id: 'wc_standard_01', category: 'sanitary', kind: 'wc', labelKey: 'floorplanSymbol.catalog.wc', widthMm: 380, depthMm: 680, source: OWN },
  { id: 'washbasin_01', category: 'sanitary', kind: 'washbasin', labelKey: 'floorplanSymbol.catalog.washbasin', widthMm: 600, depthMm: 460, source: OWN },
  { id: 'shower_01', category: 'sanitary', kind: 'shower', labelKey: 'floorplanSymbol.catalog.shower', widthMm: 900, depthMm: 900, source: OWN },
  { id: 'bathtub_01', category: 'sanitary', kind: 'bathtub', labelKey: 'floorplanSymbol.catalog.bathtub', widthMm: 1700, depthMm: 750, source: OWN },
  { id: 'bidet_01', category: 'sanitary', kind: 'bidet', labelKey: 'floorplanSymbol.catalog.bidet', widthMm: 360, depthMm: 560, source: OWN },
  // ── Kitchen (κουζίνα) ───────────────────────────────────────────────────────
  { id: 'kitchen_sink_01', category: 'kitchen', kind: 'kitchen-sink', labelKey: 'floorplanSymbol.catalog.kitchenSink', widthMm: 800, depthMm: 500, source: OWN },
  { id: 'stove_01', category: 'kitchen', kind: 'stove', labelKey: 'floorplanSymbol.catalog.stove', widthMm: 600, depthMm: 600, source: OWN },
  { id: 'fridge_01', category: 'kitchen', kind: 'fridge', labelKey: 'floorplanSymbol.catalog.fridge', widthMm: 700, depthMm: 700, source: OWN },
  { id: 'counter_01', category: 'kitchen', kind: 'counter', labelKey: 'floorplanSymbol.catalog.counter', widthMm: 1200, depthMm: 600, source: OWN },
  // ── Furniture (έπιπλα — καθαρά 2D αποτυπώματα) ───────────────────────────────
  { id: 'bed_single_01', category: 'furniture', kind: 'bed-single', labelKey: 'floorplanSymbol.catalog.bedSingle', widthMm: 900, depthMm: 2000, source: OWN },
  { id: 'bed_double_01', category: 'furniture', kind: 'bed-double', labelKey: 'floorplanSymbol.catalog.bedDouble', widthMm: 1500, depthMm: 2000, source: OWN },
  { id: 'sofa_01', category: 'furniture', kind: 'sofa', labelKey: 'floorplanSymbol.catalog.sofa', widthMm: 2000, depthMm: 900, source: OWN },
  { id: 'armchair_01', category: 'furniture', kind: 'armchair', labelKey: 'floorplanSymbol.catalog.armchair', widthMm: 800, depthMm: 800, source: OWN },
  { id: 'dining_table_01', category: 'furniture', kind: 'dining-table', labelKey: 'floorplanSymbol.catalog.diningTable', widthMm: 1200, depthMm: 800, source: OWN },
  { id: 'chair_01', category: 'furniture', kind: 'chair', labelKey: 'floorplanSymbol.catalog.chair', widthMm: 450, depthMm: 450, source: OWN },
  { id: 'desk_01', category: 'furniture', kind: 'desk', labelKey: 'floorplanSymbol.catalog.desk', widthMm: 1200, depthMm: 600, source: OWN },
] as const;

/** Default asset id picked by the placement tool when none is chosen. */
export const DEFAULT_FLOORPLAN_SYMBOL_ASSET_ID = 'wc_standard_01';

/** Resolve a catalog preset by id. Returns `undefined` for an unknown asset. */
export function resolveFloorplanSymbolPreset(
  assetId: string,
): FloorplanSymbolPreset | undefined {
  return FLOORPLAN_SYMBOL_CATALOG.find((p) => p.id === assetId);
}
