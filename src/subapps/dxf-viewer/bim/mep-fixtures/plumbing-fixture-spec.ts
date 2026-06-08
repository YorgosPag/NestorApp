/**
 * Plumbing fixture SSoT — unifying dispatch over the two connectable `mep-fixture`
 * families: sanitary terminals (WC/basin/shower/bath/bidet) ∪ appliances (washing
 * machine, …) — ADR-408 Δρόμος B.
 *
 * Both families are Revit "plumbing fixtures" in the mechanical sense (cold-water
 * inlet + sanitary-drainage outlet, same connector builders, same 2D symbol
 * pipeline), but they are DISTINCT family categories: a sanitary terminal is an
 * `IfcSanitaryTerminal` («Είδη Υγιεινής»), an appliance an `IfcElectricAppliance`
 * («Συσκευές»). This module is the single place that says "a plumbing fixture is a
 * sanitary kind OR an appliance kind" and dispatches the shared lookups (spec,
 * drawer, tool-id, mesh presets) to the correct family registry — so callers never
 * branch on `isSanitaryKind`/`isApplianceKind` by hand.
 *
 * No import cycle: `appliance-symbol-spec` imports type-only from `sanitary-symbol-spec`;
 * this module imports values from both plus the two mesh catalogs; none import back.
 *
 * @see ../sanitary/sanitary-symbol-spec.ts — sanitary family
 * @see ../appliances/appliance-symbol-spec.ts — appliance family
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { FootprintBasis, SymbolStroke } from '../floorplan-symbols/symbol-vector-helpers';
import type { MepFixtureKind } from '../types/mep-fixture-types';
import {
  SANITARY_SPEC,
  SANITARY_DRAWERS,
  sanitaryFixtureToolKind,
  isSanitaryKind,
  type SanitaryKind,
  type SanitaryFixtureSpec,
} from '../sanitary/sanitary-symbol-spec';
import {
  APPLIANCE_SPEC,
  APPLIANCE_DRAWERS,
  applianceFixtureToolKind,
  isApplianceKind,
  type ApplianceKind,
} from '../appliances/appliance-symbol-spec';
import {
  sanitaryMeshPresetsForKind,
  resolveSanitaryFixtureAsset,
  type SanitaryFixtureMeshPreset,
} from './sanitary-fixture-mesh-catalog';
import {
  applianceMeshPresetsForKind,
  resolveApplianceFixtureAsset,
  type ApplianceFixtureMeshPreset,
} from './appliance-fixture-mesh-catalog';

/** A connectable plumbing fixture kind — sanitary terminal OR appliance. */
export type PlumbingFixtureKind = SanitaryKind | ApplianceKind;

/** Any catalog mesh preset (sanitary OR appliance) — same structural shape. */
export type FixtureMeshPreset = SanitaryFixtureMeshPreset | ApplianceFixtureMeshPreset;

/** Type-guard: is the given kind a connectable plumbing fixture (sanitary ∪ appliance)? */
export function isPlumbingFixtureKind(kind: string): kind is PlumbingFixtureKind {
  return isSanitaryKind(kind) || isApplianceKind(kind);
}

/**
 * SSoT — the authored mechanical spec (dims + drain Ø + water supply + label) of a
 * plumbing fixture, dispatched to its family registry.
 */
export function resolvePlumbingFixtureSpec(kind: PlumbingFixtureKind): SanitaryFixtureSpec {
  return isApplianceKind(kind) ? APPLIANCE_SPEC[kind] : SANITARY_SPEC[kind];
}

/**
 * SSoT — the pure 2D drawer (footprint → identifying strokes) of a plumbing
 * fixture, dispatched to its family registry.
 */
export function resolvePlumbingFixtureDrawer(
  kind: PlumbingFixtureKind,
): (fp: FootprintBasis) => SymbolStroke[] {
  return isApplianceKind(kind) ? APPLIANCE_DRAWERS[kind] : SANITARY_DRAWERS[kind];
}

/**
 * SSoT — map a placement tool id (`mep-<kind>`) back to its plumbing fixture kind,
 * trying the sanitary family first then the appliance family (or `null`).
 */
export function plumbingFixtureToolKind(toolId: string): PlumbingFixtureKind | null {
  return sanitaryFixtureToolKind(toolId) ?? applianceFixtureToolKind(toolId);
}

/**
 * SSoT — the mesh presets a fixture of `kind` may pick (Revit "Type" list),
 * dispatched to its family catalog. Returns `[]` for non-plumbing kinds (light
 * fixture / floor drain → parametric only).
 */
export function fixtureMeshPresetsForKind(kind: MepFixtureKind): readonly FixtureMeshPreset[] {
  if (isApplianceKind(kind)) return applianceMeshPresetsForKind(kind);
  if (isSanitaryKind(kind)) return sanitaryMeshPresetsForKind(kind);
  return [];
}

/** SSoT — resolve a mesh preset by id across BOTH family catalogs (or `undefined`). */
export function resolveFixtureMeshPreset(assetId: string): FixtureMeshPreset | undefined {
  return resolveSanitaryFixtureAsset(assetId) ?? resolveApplianceFixtureAsset(assetId);
}
