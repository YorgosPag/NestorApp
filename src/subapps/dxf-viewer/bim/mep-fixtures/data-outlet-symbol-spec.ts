/**
 * Data outlet (πρίζα δικτύου / RJ45 structured-cabling outlet) SSoT — kind guard,
 * tool id, authored dimensions & 2D drawer (ADR-431 Slice 0).
 *
 * Revit-true weak-current "Communication Device": a structured-cabling outlet is a
 * connectable `mep-fixture` whose single data-in connector is classified `'data'`
 * (a Cat6/Cat6A RJ45 keystone), distinct from a socket's `'power'` receptacle. The
 * weak-current auto-design engine (ADR-431) recognizes it as a `'data'` terminal and
 * groups it into structured-cabling channels homed at a comms-rack — exactly as a
 * socket goes onto a 16A power circuit at the panel, but with a port-budget +
 * 90 m channel-length rule instead of breaker / voltage-drop.
 *
 * This is the single source of truth for everything a data outlet shares across the
 * fixture pipeline: the kind literal + guard, its placement tool id (`mep-data-outlet`),
 * its authored footprint / wall-mount elevation, and its pure 2D plan glyph (the
 * downward-triangle low-voltage / telecom convention). The 2D drawer is a pure
 * `footprint → strokes` function on the shared `symbol-vector-helpers`, so it follows
 * rotation/scale automatically.
 *
 * Mirror of `socket-symbol-spec.ts` (the power-outlet SSoT), scoped to the single
 * data outlet kind — its wall-box geometry is identical (both small wall-mounted
 * electrical device boxes), only the glyph + connector classification differ.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-431-electrical-weak-auto-design.md
 * @see ./socket-symbol-spec.ts (the power-outlet counterpart / template)
 */

import {
  line,
  type FootprintBasis,
  type SymbolStroke,
} from '../floorplan-symbols/symbol-vector-helpers';

// ─── Kind discriminator ───────────────────────────────────────────────────────

/** The structured-cabling data outlet (RJ45) fixture kind literal. */
export const DATA_OUTLET_KIND = 'data-outlet' as const;

/** A data outlet fixture kind. */
export type DataOutletKind = typeof DATA_OUTLET_KIND;

/** Type-guard: is the given kind the data outlet? */
export function isDataOutletKind(kind: string): kind is DataOutletKind {
  return kind === DATA_OUTLET_KIND;
}

/** Placement tool id for the data outlet — `mep-data-outlet` (per-kind tool convention). */
export const DATA_OUTLET_TOOL_ID = 'mep-data-outlet';

/**
 * SSoT — map a placement tool id back to the data outlet kind (or `null` for any
 * other tool). Mirrors `socketFixtureToolKind`; the shared fixture tool reads this to
 * set its `kind` preset.
 */
export function dataOutletFixtureToolKind(toolId: string): DataOutletKind | null {
  return toolId === DATA_OUTLET_TOOL_ID ? DATA_OUTLET_KIND : null;
}

// ─── Authored spec (dimensions, wall-mount elevation) — SSoT ──────────────────

/** mm. Authored data-outlet footprint side — a typical flush wall box (~80×80). */
export const DEFAULT_DATA_OUTLET_SIZE_MM = 80;

/** mm. Data-outlet body thickness (the wall-box depth proud of the wall). */
export const DEFAULT_DATA_OUTLET_BODY_HEIGHT_MM = 40;

/** mm. Data-outlet mounting elevation above FFL — wall-mounted (general outlet ≈ 300). */
export const DATA_OUTLET_MOUNTING_ELEVATION_MM = 300;

// ─── Pure 2D drawer (footprint → identifying strokes) — SSoT ──────────────────

/**
 * Data-outlet plan glyph: a downward-pointing triangle — the architectural /
 * low-voltage convention for a telecom / structured-cabling outlet, visually
 * distinct from the socket's round receptacle face. Pure, rotation/scale-aware via
 * the shared normalized-coord helpers. Consumed by `mep-fixture-symbol.ts`.
 */
export function dataOutletDrawer(fp: FootprintBasis): SymbolStroke[] {
  return [
    line(fp, 0.3, 0.34, 0.7, 0.34),
    line(fp, 0.7, 0.34, 0.5, 0.7),
    line(fp, 0.5, 0.7, 0.3, 0.34),
  ];
}
