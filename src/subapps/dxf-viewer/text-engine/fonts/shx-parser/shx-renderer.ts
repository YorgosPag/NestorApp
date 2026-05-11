/**
 * SHX stroke-vector renderer → Path2D (ADR-344 Phase 2, Q3).
 *
 * Converts ShpFont glyph vectors into browser Path2D objects for
 * Canvas 2D rendering. The coordinate system matches the glyph-renderer
 * convention: x increases right, y increases down (canvas default).
 *
 * @module text-engine/fonts/shx-parser/shx-renderer
 */

import type { ShpFont } from './shp-types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Compute the scale factor to render a ShpFont at a target size in pixels. */
function computeScale(font: ShpFont, targetSize: number): number {
  if (font.capHeight === 0) return 1;
  return targetSize / font.capHeight;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a Path2D for a single SHX character at canvas position (x, y).
 * Returns null if the font has no glyph for the given char code.
 */
export function shxGlyphToPath2D(
  font: ShpFont,
  charCode: number,
  x: number,
  y: number,
  scale: number,
): Path2D | null {
  const record = font.records.get(charCode);
  if (!record || record.vectors.length === 0) return null;

  const path = new Path2D();
  let cx = x;
  let cy = y;
  let started = false;

  for (const vec of record.vectors) {
    const nx = cx + vec.dx * scale;
    const ny = cy - vec.dy * scale; // SHP y-axis is up; canvas y-axis is down

    if (vec.penUp) {
      cx = nx;
      cy = ny;
      started = false;
    } else {
      if (!started) {
        path.moveTo(cx, cy);
        started = true;
      }
      path.lineTo(nx, ny);
      cx = nx;
      cy = ny;
    }
  }

  return path;
}

/**
 * Build a single Path2D for a full SHX text string, laying out glyphs
 * left-to-right using the font's advance width.
 */
export function shxStringToPath2D(
  font: ShpFont,
  text: string,
  x: number,
  y: number,
  scale: number,
): Path2D {
  const combined = new Path2D();
  let cursor = x;

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const glyph = shxGlyphToPath2D(font, code, cursor, y, scale);
    if (glyph) combined.addPath(glyph);
    // Advance by the glyph's bounding box width (approximated from vectors)
    cursor += shxGlyphAdvance(font, code, scale);
  }

  return combined;
}

export interface ShxTextMetrics {
  width: number;
  height: number;
}

/** Measure the total advance width and cap height for an SHX string. */
export function measureShxText(
  font: ShpFont,
  text: string,
  scale: number,
): ShxTextMetrics {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    width += shxGlyphAdvance(font, code, scale);
  }
  return { width, height: font.capHeight * scale };
}

// ─── Internal advance helper ─────────────────────────────────────────────────

/** Compute the advance width for one SHX glyph (sum of dx vectors). */
function shxGlyphAdvance(
  font: ShpFont,
  charCode: number,
  scale: number,
): number {
  const record = font.records.get(charCode);
  if (!record) return font.above * scale * 0.6; // fallback: ~60% of cap height
  let total = 0;
  for (const v of record.vectors) {
    if (v.dx > 0) total += v.dx;
  }
  return total * scale;
}
