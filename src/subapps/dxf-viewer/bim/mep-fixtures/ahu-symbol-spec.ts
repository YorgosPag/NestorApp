/**
 * Air handling unit (ΚΚΜ / AHU) SSoT — kind guard, tool id, authored dimensions,
 * duct-connector Ø & 2D drawer (ADR-432 Slice 0b).
 *
 * Revit-true HVAC "Mechanical Equipment": an AHU is the SOURCE of the supply-air duct
 * network (opposite of an air terminal). It is modelled here as a connectable
 * `mep-fixture` whose single DUCT connector is classified `'supply-air'` with
 * `flow: 'out'` — conditioned air LEAVES the unit into the duct network. This mirrors
 * how a boiler/manifold sources a water network, but the AHU rides the lightweight
 * `mep-fixture` rails (placement / persistence / 3D / tool for free) rather than a
 * bespoke standalone entity: a fixture is just a point host with connectors, and the
 * HVAC source resolver finds it by its supply-air OUT connector (connector-driven,
 * entity-agnostic). Promoting the AHU to a full Mechanical-Equipment entity (grips,
 * schedule) is a future refinement; the fixture-rail AHU is complete for the pilot.
 *
 * This is the single source of truth for everything an AHU shares across the fixture
 * pipeline: the kind literal + guard, its placement tool id (`mep-ahu`), its authored
 * plant footprint / mounting elevation / duct-connector diameter, and its pure 2D plan
 * glyph (a unit box with a fan circle + airflow chevron). The 2D drawer is a pure
 * `footprint → strokes` function on the shared `symbol-vector-helpers`, so it follows
 * rotation/scale automatically.
 *
 * Mirror of `socket-symbol-spec.ts` (the fixture-kind SSoT pattern), scoped to the AHU.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-432-hvac-auto-design.md
 * @see ./air-terminal-symbol-spec.ts (the HVAC terminal counterpart)
 */

import {
  ellipse,
  line,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';

// ─── Kind discriminator ───────────────────────────────────────────────────────

/** The air handling unit (AHU / ΚΚΜ) fixture kind literal. */
export const AHU_KIND = 'ahu' as const;

/** An AHU fixture kind. */
export type AhuKind = typeof AHU_KIND;

/** Type-guard: is the given kind the air handling unit? */
export function isAhuKind(kind: string): kind is AhuKind {
  return kind === AHU_KIND;
}

/** Placement tool id for the AHU — `mep-ahu` (per-kind tool convention). */
export const AHU_TOOL_ID = 'mep-ahu';

/**
 * SSoT — map a placement tool id back to the AHU kind (or `null` for any other tool).
 * Mirrors `socketFixtureToolKind`; the shared fixture tool reads this to set its `kind`.
 */
export function ahuFixtureToolKind(toolId: string): AhuKind | null {
  return toolId === AHU_TOOL_ID ? AHU_KIND : null;
}

// ─── Authored spec (dimensions, mounting elevation, duct Ø) — SSoT ────────────

/** mm. Authored AHU footprint width — a compact plant unit (≈ 1200 long). */
export const DEFAULT_AHU_WIDTH_MM = 1200;

/** mm. Authored AHU footprint length (depth). */
export const DEFAULT_AHU_LENGTH_MM = 600;

/** mm. AHU body height (the unit casing). */
export const DEFAULT_AHU_BODY_HEIGHT_MM = 600;

/**
 * mm. AHU mounting elevation above FFL — the supply trunk runs at ceiling plenum
 * height, so the unit's duct outlet (and thus the whole supply network) sits high.
 */
export const AHU_MOUNTING_ELEVATION_MM = 2800;

/** mm. Default supply-air duct OUTLET diameter (typical AHU main Ø250). */
export const DEFAULT_AHU_DUCT_DIAMETER_MM = 250;

// ─── Pure 2D drawer (footprint → identifying strokes) — SSoT ──────────────────

/**
 * AHU plan glyph: a fan circle at the unit centre + an airflow chevron pointing to
 * the outlet edge — the architectural / Revit convention for an air handling / fan
 * unit. Pure, rotation/scale-aware via the shared normalized-coord helpers. Consumed
 * by `mep-fixture-symbol.ts`.
 */
export function ahuDrawer(fp: FootprintBasis): SymbolStroke[] {
  return [
    // Fan circle.
    ellipse(fp, 0.42, 0.5, 0.22, 0.32),
    // Fan blades (diagonal cross inside the circle).
    line(fp, 0.27, 0.32, 0.57, 0.68),
    line(fp, 0.57, 0.32, 0.27, 0.68),
    // Airflow chevron toward the outlet edge (supply air leaving).
    line(fp, 0.7, 0.34, 0.86, 0.5),
    line(fp, 0.86, 0.5, 0.7, 0.66),
  ];
}
