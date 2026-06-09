/**
 * Gas meter (μετρητής αερίου) SSoT — kind guard, tool id, authored dimensions,
 * fuel-connector Ø & 2D drawer (ADR-434 Slice 0b).
 *
 * Revit-true gas "Mechanical Equipment": a gas meter is the SOURCE of the fuel-gas supply
 * network (opposite of a gas appliance). It is modelled here as a connectable `mep-fixture`
 * whose single FUEL connector is classified `'fuel-gas'` with `flow: 'out'` — metered gas
 * LEAVES the unit into the fuel network. This mirrors how the AHU sources the supply-air duct
 * network (ADR-432), but on the `'fuel'` domain (disjoint from water/air): the gas meter rides
 * the lightweight `mep-fixture` rails (placement / persistence / 3D / tool for free) and the gas
 * source resolver finds it by its fuel-gas OUT connector (connector-driven, entity-agnostic).
 * Promoting it to a full Mechanical-Equipment entity is a future refinement.
 *
 * Single source of truth for everything a gas meter shares across the fixture pipeline: the
 * kind literal + guard, its placement tool id (`mep-gas-meter`), its authored wall-mounted
 * footprint / mounting elevation / fuel-connector diameter, and its pure 2D plan glyph (a meter
 * dial circle with a gauge needle). The 2D drawer is a pure `footprint → strokes` function on
 * the shared `symbol-vector-helpers`, so it follows rotation/scale automatically.
 *
 * Mirror of `ahu-symbol-spec.ts` (the network-source fixture-kind SSoT), scoped to the gas meter.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-434-gas-auto-design.md
 * @see ./ahu-symbol-spec.ts (the HVAC source counterpart / template)
 */

import {
  ellipse,
  line,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';

// ─── Kind discriminator ───────────────────────────────────────────────────────

/** The gas meter (μετρητής αερίου) fixture kind literal. */
export const GAS_METER_KIND = 'gas-meter' as const;

/** A gas-meter fixture kind. */
export type GasMeterKind = typeof GAS_METER_KIND;

/** Type-guard: is the given kind the gas meter? */
export function isGasMeterKind(kind: string): kind is GasMeterKind {
  return kind === GAS_METER_KIND;
}

/** Placement tool id for the gas meter — `mep-gas-meter` (per-kind tool convention). */
export const GAS_METER_TOOL_ID = 'mep-gas-meter';

/**
 * SSoT — map a placement tool id back to the gas-meter kind (or `null` for any other tool).
 * Mirrors `ahuFixtureToolKind`; the shared fixture tool reads this to set its `kind`.
 */
export function gasMeterFixtureToolKind(toolId: string): GasMeterKind | null {
  return toolId === GAS_METER_TOOL_ID ? GAS_METER_KIND : null;
}

// ─── Authored spec (dimensions, mounting elevation, fuel Ø) — SSoT ────────────

/** mm. Authored gas-meter footprint width — a compact wall-mounted unit. */
export const DEFAULT_GAS_METER_WIDTH_MM = 300;

/** mm. Authored gas-meter footprint length (depth). */
export const DEFAULT_GAS_METER_LENGTH_MM = 200;

/** mm. Gas-meter body height (the unit casing). */
export const DEFAULT_GAS_METER_BODY_HEIGHT_MM = 150;

/** mm. Gas-meter mounting elevation above FFL — wall-mounted at a readable height. */
export const GAS_METER_MOUNTING_ELEVATION_MM = 1400;

/** mm. Default fuel-gas OUTLET diameter (typical domestic meter outlet DN20). */
export const DEFAULT_GAS_METER_FUEL_DIAMETER_MM = 20;

// ─── Pure 2D drawer (footprint → identifying strokes) — SSoT ──────────────────

/**
 * Gas-meter plan glyph: a meter dial circle with a gauge needle — the architectural
 * convention for a measuring/metering device, visually distinct from the AHU's fan circle
 * (no blades) and any pipe symbol. Pure, rotation/scale-aware via the shared normalized-coord
 * helpers. Consumed by `mep-fixture-symbol.ts`.
 */
export function gasMeterDrawer(fp: FootprintBasis): SymbolStroke[] {
  return [
    // Dial circle.
    ellipse(fp, 0.5, 0.5, 0.3, 0.42),
    // Gauge needle (centre → upper-right, reading position).
    line(fp, 0.5, 0.5, 0.7, 0.28),
    // Tick at the needle origin.
    line(fp, 0.5, 0.5, 0.5, 0.34),
  ];
}
