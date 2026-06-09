/**
 * Fire riser (στήλη πυρόσβεσης / wet riser) SSoT — kind guard, tool id, authored
 * dimensions, fire-pipe connector Ø & 2D drawer (ADR-433 Slice 0b).
 *
 * Revit-true Fire Protection "Equipment": a fire riser is the SOURCE of the wet-pipe
 * sprinkler network (opposite of a sprinkler head). It is modelled here as a connectable
 * `mep-fixture` whose single PIPE connector is classified `'fire-sprinkler'` with
 * `flow: 'out'` — pressurised fire water LEAVES the riser into the distribution network.
 * This mirrors how a boiler/manifold sources a water network, but the riser rides the
 * lightweight `mep-fixture` rails (placement / persistence / 3D / tool for free) rather
 * than a bespoke standalone entity: a fixture is just a point host with connectors, and
 * the fire source resolver finds it by its fire-sprinkler OUT connector (connector-driven,
 * entity-agnostic). Promoting the riser to a full Fire-Pump / standpipe entity (gauges,
 * schedule) is a future refinement; the fixture-rail riser is complete for the pilot.
 *
 * This is the single source of truth for everything a fire riser shares across the fixture
 * pipeline: the kind literal + guard, its placement tool id (`mep-fire-riser`), its
 * authored plant footprint / mounting elevation / pipe-connector diameter, and its pure 2D
 * plan glyph (a riser-pipe circle with a fire-cross marker + a control-valve bow-tie). The
 * 2D drawer is a pure `footprint → strokes` function on the shared `symbol-vector-helpers`,
 * so it follows rotation/scale automatically.
 *
 * Mirror of `ahu-symbol-spec.ts` (the HVAC source SSoT pattern), scoped to the fire riser.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-433-fire-protection-auto-design.md
 * @see ./ahu-symbol-spec.ts (the HVAC source counterpart)
 */

import {
  ellipse,
  line,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';

// ─── Kind discriminator ───────────────────────────────────────────────────────

/** The fire riser (στήλη πυρόσβεσης / wet riser) fixture kind literal. */
export const FIRE_RISER_KIND = 'fire-riser' as const;

/** A fire-riser fixture kind. */
export type FireRiserKind = typeof FIRE_RISER_KIND;

/** Type-guard: is the given kind the fire riser? */
export function isFireRiserKind(kind: string): kind is FireRiserKind {
  return kind === FIRE_RISER_KIND;
}

/** Placement tool id for the fire riser — `mep-fire-riser` (per-kind tool convention). */
export const FIRE_RISER_TOOL_ID = 'mep-fire-riser';

/**
 * SSoT — map a placement tool id back to the fire-riser kind (or `null` for any other
 * tool). Mirrors `ahuFixtureToolKind`; the shared fixture tool reads this to set its `kind`.
 */
export function fireRiserFixtureToolKind(toolId: string): FireRiserKind | null {
  return toolId === FIRE_RISER_TOOL_ID ? FIRE_RISER_KIND : null;
}

// ─── Authored spec (dimensions, mounting elevation, pipe Ø) — SSoT ────────────

/** mm. Authored fire-riser footprint width — a compact riser + valve assembly (≈ 300). */
export const DEFAULT_FIRE_RISER_WIDTH_MM = 300;

/** mm. Authored fire-riser footprint length (depth). */
export const DEFAULT_FIRE_RISER_LENGTH_MM = 300;

/** mm. Fire-riser body height (the riser standpipe casing). */
export const DEFAULT_FIRE_RISER_BODY_HEIGHT_MM = 600;

/**
 * mm. Fire-riser mounting elevation above FFL — the distribution mains run at the ceiling
 * plenum, so the riser's pipe outlet (and thus the whole wet-pipe network) sits high.
 */
export const FIRE_RISER_MOUNTING_ELEVATION_MM = 2800;

/** mm. Default fire-sprinkler pipe OUTLET diameter (typical DN65 wet-riser main). */
export const DEFAULT_FIRE_RISER_PIPE_DIAMETER_MM = 65;

// ─── Pure 2D drawer (footprint → identifying strokes) — SSoT ──────────────────

/**
 * Fire-riser plan glyph: a riser-pipe circle with a fire-cross marker at the centre + a
 * control-valve bow-tie below — the fire-protection convention for a wet riser / standpipe
 * source, visually distinct from the AHU fan circle. Pure, rotation/scale-aware via the
 * shared normalized-coord helpers. Consumed by `mep-fixture-symbol.ts`.
 */
export function fireRiserDrawer(fp: FootprintBasis): SymbolStroke[] {
  return [
    // Riser pipe section circle.
    ellipse(fp, 0.5, 0.4, 0.24, 0.24),
    // Fire-cross marker through the riser.
    line(fp, 0.5, 0.22, 0.5, 0.58),
    line(fp, 0.32, 0.4, 0.68, 0.4),
    // Control-valve bow-tie below the riser (two apex-to-apex triangles).
    line(fp, 0.38, 0.72, 0.62, 0.86),
    line(fp, 0.62, 0.72, 0.38, 0.86),
    line(fp, 0.38, 0.72, 0.38, 0.86),
    line(fp, 0.62, 0.72, 0.62, 0.86),
  ];
}
