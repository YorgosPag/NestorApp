/**
 * Gas cooker / hob (εστία αερίου) SSoT — kind guard, tool id, authored dimensions,
 * fuel-connector Ø & 2D drawer (ADR-434 Slice 0b).
 *
 * Revit-true gas "Appliance": a gas cooker is a connectable `mep-fixture` whose single FUEL
 * connector is classified `'fuel-gas'` (it burns the supplied gas), distinct from an electrical
 * device's `'electrical'` connector or a sanitary terminal's water inlet. The gas auto-design
 * engine (ADR-434) recognizes it as a gas terminal and routes the fuel network to it from the
 * meter — exactly as the air terminal is fed supply air from the AHU (ADR-432), but with gas
 * (`domain: 'fuel'`) and DVGW/EN 1775 sizing. The gas-fuelled boiler is ALSO a gas terminal
 * (via its existing fuel inlet), so the recognizer feeds both.
 *
 * Single source of truth for everything a gas cooker shares across the fixture pipeline: the
 * kind literal + guard, its placement tool id (`mep-gas-cooker`), its authored counter footprint
 * / mounting elevation / fuel-connector diameter, and its pure 2D plan glyph (a four-burner hob).
 * The 2D drawer is a pure `footprint → strokes` function on the shared `symbol-vector-helpers`,
 * so it follows rotation/scale automatically.
 *
 * Mirror of `air-terminal-symbol-spec.ts` (the network-terminal fixture-kind SSoT), scoped to
 * the gas cooker.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-434-gas-auto-design.md
 * @see ./air-terminal-symbol-spec.ts (the HVAC terminal counterpart / template)
 */

import {
  ellipse,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';

// ─── Kind discriminator ───────────────────────────────────────────────────────

/** The gas cooker / hob (εστία αερίου) fixture kind literal. */
export const GAS_COOKER_KIND = 'gas-cooker' as const;

/** A gas-cooker fixture kind. */
export type GasCookerKind = typeof GAS_COOKER_KIND;

/** Type-guard: is the given kind the gas cooker? */
export function isGasCookerKind(kind: string): kind is GasCookerKind {
  return kind === GAS_COOKER_KIND;
}

/** Placement tool id for the gas cooker — `mep-gas-cooker` (per-kind tool convention). */
export const GAS_COOKER_TOOL_ID = 'mep-gas-cooker';

/**
 * SSoT — map a placement tool id back to the gas-cooker kind (or `null` for any other tool).
 * Mirrors `airTerminalFixtureToolKind`; the shared fixture tool reads this to set its `kind`.
 */
export function gasCookerFixtureToolKind(toolId: string): GasCookerKind | null {
  return toolId === GAS_COOKER_TOOL_ID ? GAS_COOKER_KIND : null;
}

// ─── Authored spec (dimensions, mounting elevation, fuel Ø) — SSoT ────────────

/** mm. Authored gas-cooker footprint side — a typical 600×600 hob. */
export const DEFAULT_GAS_COOKER_SIZE_MM = 600;

/** mm. Gas-cooker body height (the hob proud of the counter). */
export const DEFAULT_GAS_COOKER_BODY_HEIGHT_MM = 100;

/** mm. Gas-cooker mounting elevation above FFL — counter height. */
export const GAS_COOKER_MOUNTING_ELEVATION_MM = 900;

/** mm. Default fuel-gas inlet diameter (typical appliance connection DN15). */
export const DEFAULT_GAS_COOKER_FUEL_DIAMETER_MM = 15;

// ─── Pure 2D drawer (footprint → identifying strokes) — SSoT ──────────────────

/**
 * Gas-cooker plan glyph: four burner circles (a 2×2 hob) — the architectural convention for a
 * cooktop, visually distinct from the air terminal's concentric square and the gas meter's
 * single dial. Pure, rotation/scale-aware via the shared normalized-coord helpers. Consumed by
 * `mep-fixture-symbol.ts`.
 */
export function gasCookerDrawer(fp: FootprintBasis): SymbolStroke[] {
  return [
    ellipse(fp, 0.3, 0.3, 0.14, 0.14),
    ellipse(fp, 0.7, 0.3, 0.14, 0.14),
    ellipse(fp, 0.3, 0.7, 0.14, 0.14),
    ellipse(fp, 0.7, 0.7, 0.14, 0.14),
  ];
}
