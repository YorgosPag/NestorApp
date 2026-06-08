/**
 * Appliance-fixture mesh catalog presets (SSoT) — ADR-408 Δρόμος B (appliance category).
 *
 * The shippable mesh library for connectable appliance `mep-fixture` terminals
 * (washing machine, …). Each entry's `id` doubles as the Firebase Storage object
 * name (`bim-mesh-library/appliance/<id>.glb`) and carries authored footprint/height
 * defaults (so the 2D footprint + 3D bbox placeholder work WITHOUT loading the
 * glTF). Floor-standing appliances → mounting elevation 0 (FFL).
 *
 * Mirror of `sanitary-fixture-mesh-catalog.ts` (different Storage category +
 * `ApplianceKind` gate). Like a Revit content library entry: geometry lives in the
 * mesh, metadata lives here. The picker options are GENERATED from
 * `APPLIANCE_MESH_CATALOG` — never hand-maintain a parallel list.
 *
 * Legality (ADR-409): the washing-machine mesh is CC-BY 4.0 (Sketchfab) → MANDATORY
 * creator attribution, kept in `source` and surfaced by the in-app Credits screen
 * (`asset-credits.ts`).
 *
 * NOTE: an appliance fixture WITHOUT an `assetId` stays the parametric box. This
 * catalog only lists the optional realistic-mesh upgrades.
 *
 * @see ./sanitary-fixture-mesh-catalog.ts — the mirrored sanitary catalog
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-409-third-party-bim-library-licensing-policy.md
 */

import type { ApplianceKind } from '../appliances/appliance-symbol-spec';

export interface ApplianceFixtureMeshPreset {
  /**
   * Catalog id — persisted in `MepFixtureParams.assetId` AND used as the Storage
   * object name (`bim-mesh-library/appliance/<id>.glb`). Stable, lowercase-kebab.
   */
  readonly id: string;
  /** Appliance kind this mesh represents (gates which fixture can pick it). */
  readonly kind: ApplianceKind;
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

/** The shippable appliance-fixture mesh library. Opening slice = a CC-BY washing machine. */
export const APPLIANCE_MESH_CATALOG: readonly ApplianceFixtureMeshPreset[] = [
  {
    id: 'washing_machine_01',
    kind: 'washing-machine',
    labelKey: 'mepFixture.catalog.washingMachine01',
    // Measured from the real glTF world bbox after asset surgery (gltf-transform:
    // dedup/flatten/join/weld/simplify 0.18 + centre + scale→850 mm height):
    // X=597, Y(up)=850, Z=587 mm, min.y=0 (base on the floor), X/Z centred.
    // 105.389 triangles. Real-world front-loader footprint.
    widthMm: 597,
    depthMm: 587,
    heightMm: 850,
    mountingElevationMm: 0,
    source: 'Washing Machine (new) by nikita.bulgakov (CC-BY) — sketchfab.com/3d-models/washing-machine-new-82c91049303f4664a56cc0eaffa8d662',
  },
] as const;

/** Resolve a catalog preset by id. Returns `undefined` for an unknown asset. */
export function resolveApplianceFixtureAsset(
  assetId: string,
): ApplianceFixtureMeshPreset | undefined {
  return APPLIANCE_MESH_CATALOG.find((p) => p.id === assetId);
}

/** All mesh presets available for a given appliance kind (picker option source). */
export function applianceMeshPresetsForKind(
  kind: ApplianceKind,
): readonly ApplianceFixtureMeshPreset[] {
  return APPLIANCE_MESH_CATALOG.filter((p) => p.kind === kind);
}
