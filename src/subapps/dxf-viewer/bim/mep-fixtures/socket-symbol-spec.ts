/**
 * Socket (πρίζα / power outlet) SSoT — kind guard, tool id, authored dimensions &
 * 2D drawer (ADR-430 Slice 0).
 *
 * Revit-true electrical "Device": a power outlet is a connectable `mep-fixture`
 * whose single power-in connector is classified `'power'` (a general-purpose
 * receptacle / ρευματοδότης), distinct from a luminaire's `'lighting'` connector.
 * The auto-design engine (ADR-430) recognizes it as a `'power'` terminal and groups
 * it into 16A socket circuits, while a light fixture goes onto 10A lighting circuits.
 *
 * This is the single source of truth for everything a socket shares across the
 * fixture pipeline: the kind literal + guard, its placement tool id (`mep-socket`),
 * its authored footprint / wall-mount elevation, and its pure 2D plan glyph (a round
 * receptacle face with two contact pins — the architectural socket convention). The
 * 2D drawer is a pure `footprint → strokes` function on the shared
 * `symbol-vector-helpers`, so it follows rotation/scale automatically.
 *
 * Mirror of `sanitary-symbol-spec.ts` (the sanitary terminal SSoT), scoped to the
 * single electrical socket kind.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-430-electrical-strong-auto-design.md
 * @see ../sanitary/sanitary-symbol-spec.ts (the sanitary counterpart / template)
 */

import {
  ellipse,
  line,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';

// ─── Kind discriminator ───────────────────────────────────────────────────────

/** The electrical socket / power-outlet fixture kind literal. */
export const SOCKET_KIND = 'socket' as const;

/** A socket fixture kind. */
export type SocketKind = typeof SOCKET_KIND;

/** Type-guard: is the given kind the electrical socket? */
export function isSocketKind(kind: string): kind is SocketKind {
  return kind === SOCKET_KIND;
}

/** Placement tool id for the socket — `mep-socket` (the per-kind tool convention). */
export const SOCKET_TOOL_ID = 'mep-socket';

/**
 * SSoT — map a placement tool id back to the socket kind (or `null` for any other
 * tool). Mirrors `sanitaryFixtureToolKind`; the shared fixture tool reads this to set
 * its `kind` preset.
 */
export function socketFixtureToolKind(toolId: string): SocketKind | null {
  return toolId === SOCKET_TOOL_ID ? SOCKET_KIND : null;
}

// ─── Authored spec (dimensions, wall-mount elevation) — SSoT ──────────────────

/** mm. Authored socket footprint side — a typical flush wall box (~80×80). */
export const DEFAULT_SOCKET_SIZE_MM = 80;

/** mm. Socket body thickness (the wall-box depth proud of the wall). */
export const DEFAULT_SOCKET_BODY_HEIGHT_MM = 40;

/** mm. Socket mounting elevation above FFL — wall-mounted (general outlet ≈ 300). */
export const SOCKET_MOUNTING_ELEVATION_MM = 300;

// ─── Pure 2D drawer (footprint → identifying strokes) — SSoT ──────────────────

/**
 * Socket plan glyph: a round receptacle face with two contact pins — the
 * architectural / IEC convention for a power outlet. Pure, rotation/scale-aware via
 * the shared normalized-coord helpers. Consumed by `mep-fixture-symbol.ts`.
 */
export function socketDrawer(fp: FootprintBasis): SymbolStroke[] {
  return [
    ellipse(fp, 0.5, 0.5, 0.42, 0.42),
    line(fp, 0.38, 0.34, 0.38, 0.66),
    line(fp, 0.62, 0.34, 0.62, 0.66),
  ];
}
