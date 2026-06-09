/**
 * Fire sprinkler head (κεφαλή καταιονητήρα) SSoT — kind guard, tool id, authored
 * dimensions, fire-pipe connector Ø & 2D drawer (ADR-433 Slice 0b).
 *
 * Revit-true Fire Protection "Sprinkler" (`IfcFireSuppressionTerminal`): a sprinkler
 * head is a connectable `mep-fixture` whose single PIPE connector is classified
 * `'fire-sprinkler'` with `flow: 'in'` (pressurised fire water ENTERS the head from
 * the wet-pipe network and is discharged onto the fire), distinct from a sanitary
 * terminal's `'domestic-cold-water'` inlet or an air diffuser's `'duct'` connector.
 * The fire-protection auto-design engine (ADR-433) recognizes it as a fire-sprinkler
 * terminal and routes the wet-pipe network to it from the fire riser — exactly as a
 * sanitary terminal is fed cold water from a manifold, but with fire water and
 * NFPA 13 / EN 12845 sizing instead of domestic demand.
 *
 * This is the single source of truth for everything a sprinkler head shares across the
 * fixture pipeline: the kind literal + guard, its placement tool id (`mep-sprinkler`),
 * its authored ceiling footprint / mounting elevation / pipe-connector diameter, and
 * its pure 2D plan glyph (a round head with a deflector cross — the fire-protection
 * sprinkler convention). The 2D drawer is a pure `footprint → strokes` function on the
 * shared `symbol-vector-helpers`, so it follows rotation/scale automatically.
 *
 * Mirror of `air-terminal-symbol-spec.ts` (the HVAC terminal SSoT), scoped to the single
 * fire-protection terminal kind — only the glyph + connector domain/classification differ.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-433-fire-protection-auto-design.md
 * @see ./air-terminal-symbol-spec.ts (the HVAC terminal counterpart / template)
 */

import {
  ellipse,
  line,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';

// ─── Kind discriminator ───────────────────────────────────────────────────────

/** The fire sprinkler head (καταιονητήρας) fixture kind literal. */
export const SPRINKLER_KIND = 'sprinkler' as const;

/** A sprinkler-head fixture kind. */
export type SprinklerKind = typeof SPRINKLER_KIND;

/** Type-guard: is the given kind the sprinkler head? */
export function isSprinklerKind(kind: string): kind is SprinklerKind {
  return kind === SPRINKLER_KIND;
}

/** Placement tool id for the sprinkler head — `mep-sprinkler` (per-kind tool convention). */
export const SPRINKLER_TOOL_ID = 'mep-sprinkler';

/**
 * SSoT — map a placement tool id back to the sprinkler kind (or `null` for any other
 * tool). Mirrors `airTerminalFixtureToolKind`; the shared fixture tool reads this to set
 * its `kind` preset.
 */
export function sprinklerFixtureToolKind(toolId: string): SprinklerKind | null {
  return toolId === SPRINKLER_TOOL_ID ? SPRINKLER_KIND : null;
}

// ─── Authored spec (dimensions, mounting elevation, pipe Ø) — SSoT ────────────

/** mm. Authored sprinkler-head footprint diameter — a compact ceiling head (≈ Ø150). */
export const DEFAULT_SPRINKLER_SIZE_MM = 150;

/** mm. Sprinkler-head body thickness (the head proud of the ceiling). */
export const DEFAULT_SPRINKLER_BODY_HEIGHT_MM = 60;

/** mm. Sprinkler mounting elevation above FFL — ceiling-mounted (pendant head). */
export const SPRINKLER_MOUNTING_ELEVATION_MM = 2700;

/**
 * mm. Default fire-sprinkler pipe connector diameter (typical ¾" branch drop, Ø20). The
 * auto-design engine sizes the distribution mains by cumulative flow; this is the head's
 * own nominal stub size.
 */
export const DEFAULT_SPRINKLER_PIPE_DIAMETER_MM = 20;

// ─── Pure 2D drawer (footprint → identifying strokes) — SSoT ──────────────────

/**
 * Sprinkler-head plan glyph: a round head circle with a full deflector cross — the
 * architectural / fire-protection convention for a sprinkler (visually distinct from the
 * air diffuser's concentric square + louvres and the socket's round receptacle). Pure,
 * rotation/scale-aware via the shared normalized-coord helpers. Consumed by
 * `mep-fixture-symbol.ts`.
 */
export function sprinklerDrawer(fp: FootprintBasis): SymbolStroke[] {
  return [
    // Head body circle.
    ellipse(fp, 0.5, 0.5, 0.26, 0.26),
    // Deflector cross (the sprinkler "+" through the head).
    line(fp, 0.5, 0.16, 0.5, 0.84),
    line(fp, 0.16, 0.5, 0.84, 0.5),
  ];
}
