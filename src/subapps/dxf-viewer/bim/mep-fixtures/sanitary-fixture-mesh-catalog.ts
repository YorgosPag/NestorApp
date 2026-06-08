/**
 * Sanitary-fixture mesh catalog presets (SSoT) — ADR-411 (sanitary category).
 *
 * The shippable mesh library for connectable sanitary `mep-fixture` terminals
 * (shower / bathtub / …). Each entry's `id` doubles as the Firebase Storage object
 * name (`bim-mesh-library/sanitary/<id>.glb`) and carries authored footprint/height
 * defaults (so the 2D footprint + 3D bbox placeholder work WITHOUT loading the
 * glTF). Floor-standing fixtures → mounting elevation 0 (FFL).
 *
 * Like a Revit content library entry: geometry lives in the mesh, metadata lives
 * here. The picker options are GENERATED from `SANITARY_MESH_CATALOG` — never
 * hand-maintain a parallel list.
 *
 * Legality (ADR-409 §B-θετικό.2 + §D.1): the opening shower mesh is CC-BY 4.0
 * (Sketchfab) → MANDATORY creator attribution, kept in `source` (name + CC-BY +
 * URL) and surfaced by the in-app Credits screen (`asset-credits.ts`). Both CC0 and
 * CC-BY allow commercial redistribution + enrichment; the BIM metadata below is ours.
 *
 * NOTE: a sanitary fixture WITHOUT an `assetId` stays the parametric box (ADR-408
 * Φ14). This catalog only lists the optional realistic-mesh upgrades.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-409-third-party-bim-library-licensing-policy.md §B-θετικό.2
 */

import type { SanitaryKind } from '../sanitary/sanitary-symbol-spec';

export interface SanitaryFixtureMeshPreset {
  /**
   * Catalog id — persisted in `MepFixtureParams.assetId` AND used as the Storage
   * object name (`bim-mesh-library/sanitary/<id>.glb`). Stable, lowercase-kebab.
   */
  readonly id: string;
  /** Sanitary kind this mesh represents (gates which fixture can pick it). */
  readonly kind: SanitaryKind;
  /** i18n label key (namespace: dxf-viewer-shell). */
  readonly labelKey: string;
  /** Authored footprint width (mm) — X before rotation. */
  readonly widthMm: number;
  /** Authored footprint depth (mm) — Y before rotation. */
  readonly depthMm: number;
  /** Authored overall height (mm) — bbox Z for the placeholder before the glTF loads. */
  readonly heightMm: number;
  /** Default floor-relative mounting elevation (mm). 0 = floor-standing (FFL). */
  readonly mountingElevationMm: number;
  /** Source attribution. CC-BY → MANDATORY creator name + URL (legal, surfaced in Credits). */
  readonly source: string;
}

/** The shippable sanitary-fixture mesh library. Opening slice = a CC-BY shower. */
export const SANITARY_MESH_CATALOG: readonly SanitaryFixtureMeshPreset[] = [
  {
    id: 'shower_realistic_01',
    kind: 'shower',
    labelKey: 'mepFixture.catalog.showerRealistic01',
    // Measured from the real glTF world bbox (walk-in shower cabin, already in
    // real-world meters — no scale normalization): X=1304, Y=2263, Z=1049 mm.
    // These exact dims size the selection box / footprint to coincide with the
    // recentred mesh silhouette (ADR-411 2D polish #1). The mesh's local origin is
    // off-centre (X bbox-centre +347 mm) → `recentreMeshFootprint` re-centres it.
    widthMm: 1304,
    depthMm: 1049,
    heightMm: 2263,
    mountingElevationMm: 0,
    source: 'Shower Cabin by Heliona (CC-BY) — sketchfab.com/3d-models/shower-cabin-e2c6a8dd490e4e4398378e1f6c9121a8',
  },
  {
    id: 'shower_tray_01',
    kind: 'shower',
    labelKey: 'mepFixture.catalog.showerTray01',
    // Measured from the real glTF world bbox (square shower tray, real-world
    // meters): X=1254, Y=300, Z=1254 mm. Centred origin.
    widthMm: 1254,
    depthMm: 1254,
    heightMm: 300,
    mountingElevationMm: 0,
    source: 'Shower tray 90x90cm by Ivan.Ivanov (CC-BY) — sketchfab.com/3d-models/shower-tray-90x90cm-3c6a1278fce94bd3b4948baeb8907e21',
  },
  {
    id: 'shower_tray_02',
    kind: 'shower',
    labelKey: 'mepFixture.catalog.showerTray02',
    // Measured from the real glTF world bbox (slim shower tray, real-world
    // meters): X=900, Y=45, Z=900 mm. Local origin at a corner (+450 mm X) →
    // `recentreMeshFootprint` re-centres it onto the insertion point.
    widthMm: 900,
    depthMm: 900,
    heightMm: 45,
    mountingElevationMm: 0,
    source: 'FREE Shower Tray 90cm x 90cm by marcin_malcherek (CC-BY) — sketchfab.com/3d-models/free-shower-tray-90cm-x-90cm-a055f0ffe03d4a1e822e6f52fe79c49d',
  },
  {
    id: 'wc_realistic_01',
    kind: 'wc',
    labelKey: 'mepFixture.catalog.wcRealistic01',
    // Measured from the real glTF world bbox (close-coupled WC with cistern, already
    // real-world meters): X=805, Y(up)=1052, Z=450 mm. The pan+cistern run along X →
    // footprint width=805, depth=450; overall height (incl. cistern) 1052. The local
    // origin is near-centred in X/Z (centre +4 mm X) → `recentreMeshFootprint` trims
    // it; the vertical base anchor lands the real bbox min on the floor (mesh-to-
    // object3d), so the off-zero Y origin needs no catalog correction.
    widthMm: 805,
    depthMm: 450,
    heightMm: 1052,
    mountingElevationMm: 0,
    source: 'Curved Modern WC CC Open by attilakozma (CC-BY) — sketchfab.com/3d-models/curved-modern-wc-cc-open-de07cccdb657428cadc06f6bb96a551d',
  },
] as const;

/** Resolve a catalog preset by id. Returns `undefined` for an unknown asset. */
export function resolveSanitaryFixtureAsset(
  assetId: string,
): SanitaryFixtureMeshPreset | undefined {
  return SANITARY_MESH_CATALOG.find((p) => p.id === assetId);
}

/** All mesh presets available for a given sanitary kind (picker option source). */
export function sanitaryMeshPresetsForKind(
  kind: SanitaryKind,
): readonly SanitaryFixtureMeshPreset[] {
  return SANITARY_MESH_CATALOG.filter((p) => p.kind === kind);
}
