/**
 * ADR-656 M12 — North-arrow configuration (data only, no logic).
 *
 * The North arrow every topographic sheet carries (ΤΕΕ/Κτηματολόγιο· Civil 3D / Trimble). Two
 * modes, user-selectable (Giorgio 2026-07-15): **Grid North** (parallel to the ΕΓΣΑ87 grid's
 * +Northing axis) or **True North** (Grid North + meridian convergence γ). Default = True.
 *
 * Layer NAME is a structural DXF identifier (like the grid/contour layers), so it lives as a
 * config constant — NOT a `t()` key (N.11). The «Β» glyph is the Greek survey convention for
 * North (Βορράς). Units: screen sizes in px (HUD), drawing sizes in canonical mm (ADR-462).
 */

/** DXF layer name for the baked north-arrow entities — structural id, not UI copy. */
export const TOPO_NORTH_LAYER_NAME = 'TOPO-NORTH' as const;

/** Which north the arrow points to. */
export type NorthMode = 'grid' | 'true';

/** Arrow + glyph colour (near-black — the readable sheet default). */
export const TOPO_NORTH_COLOR = '#1A1A1A' as const;

/** The North glyph — Greek survey convention (Βορράς). */
export const TOPO_NORTH_GLYPH = 'Β' as const;

/**
 * Unit arrow outline in the arrow's own frame: tip up (+Y = north), concave base — the classic
 * surveyor arrowhead. Scaled by the screen/world size at draw/bake time. Height spans y∈[-0.5, 0.5].
 */
export const NORTH_ARROW_UNIT_OUTLINE: readonly { readonly x: number; readonly y: number }[] = [
  { x: 0, y: 0.5 },      // tip (north)
  { x: 0.2, y: -0.5 },   // right base
  { x: 0, y: -0.28 },    // concave notch
  { x: -0.2, y: -0.5 },  // left base
] as const;

// ── Screen HUD sizing ─────────────────────────────────────────────────────────
/** On-screen box side (px) of the HUD arrow (a square SVG at the top-right corner). */
export const TOPO_NORTH_SCREEN_BOX_PX = 56 as const;
/** SVG viewBox side — the arrow/glyph geometry below is expressed in these units. */
export const TOPO_NORTH_SVG_VIEWBOX = 100 as const;
/** Arrow height in viewBox units (spans the unit outline's y∈[-0.5,0.5]). */
export const TOPO_NORTH_SVG_ARROW_SIZE = 62 as const;
/** «Β» glyph size in viewBox units. */
export const TOPO_NORTH_SVG_GLYPH_SIZE = 22 as const;

// ── Baked drawing sizing (canonical mm) ───────────────────────────────────────
/** Arrow height in the drawing (mm) — the baked export entity size. */
export const TOPO_NORTH_WORLD_HEIGHT_MM = 4_000 as const;
/** Glyph text height in the drawing (mm). */
export const TOPO_NORTH_GLYPH_HEIGHT_MM = 900 as const;

/** WHAT the store owns: whether the arrow is shown, and which north it points to. */
export interface NorthArrowOptions {
  readonly visible: boolean;
  readonly mode: NorthMode;
}

/** Default = arrow hidden (opt-in, like the grid), pointing True North (geodetically correct). */
export const DEFAULT_NORTH_ARROW_OPTS: NorthArrowOptions = {
  visible: false,
  mode: 'true',
};
