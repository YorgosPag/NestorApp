/**
 * Light-fixture mesh catalog presets (SSoT) — ADR-411.
 *
 * The shippable CC0 light-fixture library. Each entry's `id` doubles as the
 * Firebase Storage object name (`bim-mesh-library/light-fixture/<id>.glb`) and
 * carries authored footprint/height defaults (so the 2D footprint + 3D bbox
 * placeholder work WITHOUT loading the glTF), plus ceiling-relative mounting.
 *
 * Like a Revit content library entry: geometry lives in the mesh, metadata lives
 * here. The picker options are GENERATED from `LIGHT_FIXTURE_CATALOG` — never
 * hand-maintain a parallel list.
 *
 * Legality (ADR-409 §B-θετικό + §D.1): all assets are CC0 (Poly Haven, verified)
 * → we redistribute + enrich freely; the BIM metadata below is ours.
 *
 * NOTE: a light fixture WITHOUT an `assetId` stays the parametric family-symbol
 * (ADR-406). This catalog only lists the optional mesh upgrades.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

export interface LightFixtureCatalogPreset {
  /**
   * Catalog id — persisted in `MepFixtureParams.assetId` AND used as the Storage
   * object name (`bim-mesh-library/light-fixture/<id>.glb`). Stable, lowercase-kebab.
   */
  readonly id: string;
  /** i18n label key (namespace: dxf-viewer-shell). */
  readonly labelKey: string;
  /** Authored footprint width (mm) — X before rotation. */
  readonly widthMm: number;
  /** Authored footprint depth (mm) — Y before rotation. */
  readonly depthMm: number;
  /** Authored overall height (mm) — bbox Z (drop length of the fixture). */
  readonly heightMm: number;
  /** Default ceiling-relative mounting elevation (mm). Top of the fixture. */
  readonly mountingElevationMm: number;
  /** Source attribution (CC0 — no obligation, kept for provenance only). */
  readonly source: string;
}

/** The shippable light-fixture mesh library. Opening slice = a CC0 pendant lamp. */
export const LIGHT_FIXTURE_CATALOG: readonly LightFixtureCatalogPreset[] = [
  {
    id: 'pendant_lamp_01',
    labelKey: 'mepFixture.catalog.pendantLamp01',
    // Authored from the real glTF POSITION bbox (Poly Haven modern_ceiling_lamp_01,
    // 1k): 432 × 432 footprint, 952mm drop (mesh top = ceiling mount).
    widthMm: 432,
    depthMm: 432,
    heightMm: 952,
    mountingElevationMm: 2700,
    source: 'Poly Haven (CC0)',
  },
] as const;

/** Resolve a catalog preset by id. Returns `undefined` for an unknown asset. */
export function resolveLightFixtureAsset(assetId: string): LightFixtureCatalogPreset | undefined {
  return LIGHT_FIXTURE_CATALOG.find((p) => p.id === assetId);
}
