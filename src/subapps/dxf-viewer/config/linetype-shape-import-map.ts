/**
 * linetype-shape-import-map — ADR-642 §6.6.3 / Φ3-B Tier 2: best-effort recovery of a
 * FOREIGN (non-Nestor) complex linetype's embedded shape into one of OUR builtin glyphs.
 *
 * Context — the honest problem: a DXF complex linetype writes an embedded symbol as
 * `[shapeNumber, someFile.shx]` (group `74` bit `0x4` + `75` shape#). The shape's GEOMETRY
 * lives in that external `.shx` binary — it is NOT in the DXF. When the file was authored
 * elsewhere (real AutoCAD) it carries no Nestor XDATA (§6.6.3 Tier 1), and we do not ship
 * that `.shx` (§9.1 out of scope), so `shape#5` is an opaque index we cannot resolve
 * geometrically. Fabricating a `shape# → glyph` table would risk WRONG glyphs (another
 * file's `.shx` numbers its shapes differently) → banned.
 *
 * What we CAN do losslessly-by-recognition, exactly like a mature importer (Revit/ArchiCAD
 * recognise well-known DWG content): key on the **standard linetype NAME**. The AutoCAD
 * `acad.lin` standard complex linetypes are publicly documented and stable — their names AND
 * the shape each embeds are fixed. So a foreign linetype *named* `FENCELINE1` provably embeds
 * the `CIRC1` shape → we restore OUR `circle` glyph. This is verifiable (no invented shape
 * numbers), covers the common real-world topographic/utility content, and degrades to a
 * graceful skip (Tier 3) for any unrecognised name.
 *
 * Extension point: when a real `.shx` shape parser lands (§9.1) or a verified
 * `(shxFile, shape#) → glyph` table is sourced, resolution can layer UNDER this by-name map
 * with ZERO rework — the reader already calls `resolveWellKnownLinetypeSymbol` last, before
 * the skip.
 *
 * @see config/linetype-symbol-catalog.ts — the builtin glyph ids this maps onto
 * @see utils/dxf-linetype-table-parser.ts — Tier 1 (Nestor XDATA) → Tier 2 (this) → Tier 3 (skip)
 * @see AutoCAD `acad.lin` — FENCELINE1/2, TRACKS, BATTING, ZIGZAG standard definitions
 */

import type { SymbolRole } from './complex-linetype-types';
import { LINETYPE_SYMBOL_CATALOG } from './linetype-symbol-catalog';

/** How a recognised standard linetype name maps onto one of our builtin glyphs. */
export interface WellKnownLinetypeSymbol {
  /** Builtin glyph id in {@link LINETYPE_SYMBOL_CATALOG} the standard shape corresponds to. */
  readonly glyphId: string;
  /** Placement role (all standard `acad.lin` shapes sit along the line → `side`). */
  readonly role: SymbolRole;
}

/**
 * Standard `acad.lin` complex linetypes whose embedded shape maps cleanly onto a Nestor glyph.
 * Keyed by UPPER-CASE linetype name (DXF names are case-insensitive; we normalise on lookup).
 * Text-only standards (`GAS_LINE`→"GAS", `HOT_WATER_SUPPLY`→"HW") are NOT here — those round-trip
 * through the embedded-text path (Φ2-B), not the shape path.
 */
const WELL_KNOWN_LINETYPE_SYMBOLS: Readonly<Record<string, WellKnownLinetypeSymbol>> = Object.freeze({
  // FENCELINE1 — `[CIRC1,ltypeshp.shx]` hollow circle fence marker → our `circle`.
  FENCELINE1: { glyphId: 'circle', role: 'side' },
  // FENCELINE2 — `[BOX,ltypeshp.shx]` hollow square fence marker → our `square`.
  FENCELINE2: { glyphId: 'square', role: 'side' },
  // TRACKS — `[TRACK1,ltypeshp.shx]` perpendicular rail-tie tick → our `tick`.
  TRACKS: { glyphId: 'tick', role: 'side' },
  // BATTING — `[BAT,ltypeshp.shx]` thermal-insulation batting → our `insulation`.
  BATTING: { glyphId: 'insulation', role: 'side' },
  // ZIGZAG — `[ZIG,ltypeshp.shx]` angular zigzag → our `insulation` (closest angular glyph).
  ZIGZAG: { glyphId: 'insulation', role: 'side' },
});

/**
 * Resolve a FOREIGN linetype's embedded shape to a builtin glyph BY STANDARD NAME.
 * Returns the mapping when `name` is a recognised `acad.lin` standard whose glyph we ship
 * (and the target glyph actually exists in the catalog), else `null` → caller skips (Tier 3).
 */
export function resolveWellKnownLinetypeSymbol(name: string | undefined): WellKnownLinetypeSymbol | null {
  if (!name) return null;
  const hit = WELL_KNOWN_LINETYPE_SYMBOLS[name.trim().toUpperCase()];
  if (!hit) return null;
  // Guard: never emit a glyphId the catalog can't render (keeps this map honest if a glyph is renamed).
  return LINETYPE_SYMBOL_CATALOG[hit.glyphId] ? hit : null;
}

/** Every recognised standard linetype name (UPPER-CASE) — for tests/introspection. */
export function listWellKnownLinetypeNames(): readonly string[] {
  return Object.keys(WELL_KNOWN_LINETYPE_SYMBOLS);
}
