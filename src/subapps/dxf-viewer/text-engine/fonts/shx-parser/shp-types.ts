/**
 * SHP/SHX type definitions (ADR-344 Phase 2, Q3).
 *
 * AutoCAD SHX fonts are compiled from SHP (shape definition) source files.
 * Each character code maps to a ShpRecord containing stroke vectors.
 * Vector encoding: byte pairs (dx, dy); high bit of dx = pen-up flag.
 *
 * @module text-engine/fonts/shx-parser/shp-types
 */

/** A single stroke vector in an SHP glyph record. */
export interface ShpVector {
  /** Horizontal displacement (signed, in shape units). */
  dx: number;
  /** Vertical displacement (signed, in shape units). */
  dy: number;
  /** true = move without drawing (pen up); false = draw stroke. */
  penUp: boolean;
}

/** One glyph record: a character code → stroke vector list. */
export interface ShpRecord {
  /** Character code (Unicode codepoint for Unicode SHX fonts). */
  code: number;
  /** Ordered list of stroke vectors defining the glyph outline. */
  vectors: ShpVector[];
}

/**
 * A fully parsed SHP/SHX font.
 * `above` and `below` are the font-level ascender/descender in shape units.
 */
export interface ShpFont {
  /** Map from character code to glyph record. */
  records: Map<number, ShpRecord>;
  /** Units above baseline (ascender). */
  above: number;
  /** Units below baseline (descender, positive = downward). */
  below: number;
  /** Font mode flags from the SHX header (bit field). */
  modes: number;
  /** Total cap-height in shape units (above + below). */
  capHeight: number;
}
