/**
 * Air terminal (στόμιο προσαγωγής / supply diffuser) SSoT — kind guard, tool id,
 * authored dimensions, duct-connector Ø & 2D drawer (ADR-432 Slice 0b).
 *
 * Revit-true HVAC "Air Terminal": a supply diffuser is a connectable `mep-fixture`
 * whose single DUCT connector is classified `'supply-air'` (it receives conditioned
 * air from the supply duct and blows it into the room), distinct from a luminaire's
 * `'lighting'` electrical connector or a sanitary terminal's `'pipe'` water inlet.
 * The HVAC auto-design engine (ADR-432) recognizes it as a supply-air terminal and
 * routes the supply-air duct network to it from the AHU — exactly as a sanitary
 * terminal is fed cold/hot water from a manifold, but with air (`domain: 'duct'`)
 * and ASHRAE duct sizing instead of water and DN sizing.
 *
 * This is the single source of truth for everything an air terminal shares across the
 * fixture pipeline: the kind literal + guard, its placement tool id (`mep-air-terminal`),
 * its authored ceiling footprint / mounting elevation / duct-connector diameter, and
 * its pure 2D plan glyph (a concentric-square ceiling diffuser with corner louvres —
 * the architectural supply-diffuser convention). The 2D drawer is a pure
 * `footprint → strokes` function on the shared `symbol-vector-helpers`, so it follows
 * rotation/scale automatically.
 *
 * Mirror of `socket-symbol-spec.ts` (the electrical-device SSoT), scoped to the single
 * HVAC supply-air terminal kind — only the glyph + connector domain/classification differ.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-432-hvac-auto-design.md
 * @see ./socket-symbol-spec.ts (the electrical-device counterpart / template)
 */

import {
  line,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';

// ─── Kind discriminator ───────────────────────────────────────────────────────

/** The HVAC supply-air terminal (diffuser) fixture kind literal. */
export const AIR_TERMINAL_KIND = 'air-terminal' as const;

/** An air-terminal fixture kind. */
export type AirTerminalKind = typeof AIR_TERMINAL_KIND;

/** Type-guard: is the given kind the air terminal? */
export function isAirTerminalKind(kind: string): kind is AirTerminalKind {
  return kind === AIR_TERMINAL_KIND;
}

/** Placement tool id for the air terminal — `mep-air-terminal` (per-kind tool convention). */
export const AIR_TERMINAL_TOOL_ID = 'mep-air-terminal';

/**
 * SSoT — map a placement tool id back to the air-terminal kind (or `null` for any
 * other tool). Mirrors `socketFixtureToolKind`; the shared fixture tool reads this to
 * set its `kind` preset.
 */
export function airTerminalFixtureToolKind(toolId: string): AirTerminalKind | null {
  return toolId === AIR_TERMINAL_TOOL_ID ? AIR_TERMINAL_KIND : null;
}

// ─── Authored spec (dimensions, mounting elevation, duct Ø) — SSoT ────────────

/** mm. Authored air-terminal footprint side — a typical 300×300 ceiling diffuser. */
export const DEFAULT_AIR_TERMINAL_SIZE_MM = 300;

/** mm. Air-terminal body thickness (the diffuser neck proud of the ceiling). */
export const DEFAULT_AIR_TERMINAL_BODY_HEIGHT_MM = 120;

/** mm. Air-terminal mounting elevation above FFL — ceiling-mounted (≈ luminaire). */
export const AIR_TERMINAL_MOUNTING_ELEVATION_MM = 2700;

/** mm. Default supply-air duct connector diameter (typical residential branch Ø125). */
export const DEFAULT_AIR_TERMINAL_DUCT_DIAMETER_MM = 125;

// ─── Pure 2D drawer (footprint → identifying strokes) — SSoT ──────────────────

/**
 * Air-terminal plan glyph: a concentric inner square with four corner louvre lines —
 * the architectural convention for a ceiling supply diffuser, visually distinct from
 * the socket's round receptacle and the luminaire's "X". Pure, rotation/scale-aware
 * via the shared normalized-coord helpers. Consumed by `mep-fixture-symbol.ts`.
 */
export function airTerminalDrawer(fp: FootprintBasis): SymbolStroke[] {
  return [
    // Inner concentric square.
    line(fp, 0.28, 0.28, 0.72, 0.28),
    line(fp, 0.72, 0.28, 0.72, 0.72),
    line(fp, 0.72, 0.72, 0.28, 0.72),
    line(fp, 0.28, 0.72, 0.28, 0.28),
    // Corner louvres (outer corner → inner-square corner).
    line(fp, 0.0, 0.0, 0.28, 0.28),
    line(fp, 1.0, 0.0, 0.72, 0.28),
    line(fp, 1.0, 1.0, 0.72, 0.72),
    line(fp, 0.0, 1.0, 0.28, 0.72),
  ];
}
