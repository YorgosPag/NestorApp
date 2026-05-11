/**
 * GlyphRenderer — opentype.Font → Canvas 2D Path2D (ADR-344 Phase 2).
 *
 * Converts opentype.js PathCommand arrays into browser Path2D objects
 * for resolution-independent rendering via ctx.fill() / ctx.stroke().
 *
 * The DXF canvas stack uses these Path2D objects directly; they are cached
 * by the caller (text-renderer, Phase 3) to avoid re-building per frame.
 *
 * @module text-engine/fonts/glyph-renderer
 */

import type { Font, Path as OtPath } from 'opentype.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Convert an opentype.js Path to a browser Path2D. */
function otPathToPath2D(otPath: OtPath): Path2D {
  const p = new Path2D();
  for (const cmd of otPath.commands) {
    switch (cmd.type) {
      case 'M':
        p.moveTo(cmd.x, cmd.y);
        break;
      case 'L':
        p.lineTo(cmd.x, cmd.y);
        break;
      case 'Q':
        p.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
        break;
      case 'C':
        p.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        break;
      case 'Z':
        p.closePath();
        break;
    }
  }
  return p;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a Path2D for a single character at (x, y) at the given point size.
 * Returns null if the font has no glyph for the character (notdef is skipped).
 */
export function glyphToPath2D(
  font: Font,
  char: string,
  x: number,
  y: number,
  size: number,
): Path2D | null {
  const glyph = font.charToGlyph(char);
  if (!glyph || glyph.index === 0) return null; // .notdef
  const otPath = glyph.getPath(x, y, size);
  return otPathToPath2D(otPath);
}

/**
 * Build a single Path2D for an entire string at (x, y).
 * Glyphs are laid out left-to-right; use measureText for advance width.
 */
export function stringToPath2D(
  font: Font,
  text: string,
  x: number,
  y: number,
  size: number,
): Path2D {
  const otPath = font.getPath(text, x, y, size);
  return otPathToPath2D(otPath);
}

export interface TextMetrics {
  width: number;
  ascent: number;
  descent: number;
}

/**
 * Measure the advance width and font metrics for a string at given size.
 * ascent/descent are in the same coordinate space as the size parameter.
 */
export function measureText(font: Font, text: string, size: number): TextMetrics {
  const scale = size / (font.unitsPerEm || 1000);
  const width = font.getAdvanceWidth(text, size);
  const ascent = (font.ascender ?? 0) * scale;
  const descent = Math.abs((font.descender ?? 0) * scale);
  return { width, ascent, descent };
}
