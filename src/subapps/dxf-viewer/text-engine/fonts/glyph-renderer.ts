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

/** Append an opentype.js Path's commands into an existing Path2D (no addPath — jsdom-safe). */
function appendOtPath(p: Path2D, otPath: OtPath): void {
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
}

/** Convert an opentype.js Path to a browser Path2D. */
function otPathToPath2D(otPath: OtPath): Path2D {
  const p = new Path2D();
  appendOtPath(p, otPath);
  return p;
}

/**
 * 🏢 AutoCAD MTEXT `\T` character tracking — a SPACING FACTOR (1.0 = normal). Applied as a
 * per-glyph pen-advance multiplier: `penX += glyphAdvance × tracking`, so glyph SHAPES stay
 * intact and only the gaps grow/shrink (≠ `widthFactor`, which X-scales the shapes). Kerning
 * is intentionally dropped in the tracked path — the letters are deliberately re-spaced, so the
 * sub-unit kern adjustments are irrelevant (mirrors CSS `letter-spacing`). The `tracking === 1`
 * fast paths in `stringToPath2D` / `measureText` keep `font.getPath` / `getAdvanceWidth` (kerned,
 * byte-identical) so every existing TEXT/MTEXT is unaffected.
 */
function trackedAdvanceWidth(font: Font, text: string, size: number, tracking: number): number {
  let x = 0;
  // Per-character advance (no cross-glyph kerning — deliberate for re-spaced text) × tracking.
  for (const ch of text) x += font.getAdvanceWidth(ch, size) * tracking;
  return x;
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
 *
 * `tracking` (AutoCAD `\T`, default 1 = normal) scales the inter-glyph pen advance. At the
 * default the ORIGINAL `font.getPath` path (kerned) is returned byte-for-byte; a non-1 value
 * takes the per-glyph tracked layout. Pair with `measureText(..., tracking)` for parity.
 */
export function stringToPath2D(
  font: Font,
  text: string,
  x: number,
  y: number,
  size: number,
  tracking = 1,
): Path2D {
  if (tracking === 1) return otPathToPath2D(font.getPath(text, x, y, size));

  // Tracked: place each glyph at the running pen X (advance × tracking); shapes untouched.
  const p = new Path2D();
  let penX = x;
  for (const ch of text) {
    appendOtPath(p, font.getPath(ch, penX, y, size));
    penX += font.getAdvanceWidth(ch, size) * tracking;
  }
  return p;
}

export interface TextMetrics {
  width: number;
  ascent: number;
  descent: number;
}

/**
 * Measure the advance width and font metrics for a string at given size.
 * ascent/descent are in the same coordinate space as the size parameter.
 *
 * `tracking` (AutoCAD `\T`, default 1) scales the inter-glyph advance, matching
 * `stringToPath2D(..., tracking)` exactly so a box measured here coincides with the drawn
 * glyphs. At the default, the ORIGINAL `font.getAdvanceWidth` (kerned) is used byte-for-byte.
 */
export function measureText(font: Font, text: string, size: number, tracking = 1): TextMetrics {
  const scale = size / (font.unitsPerEm || 1000);
  const width = tracking === 1
    ? font.getAdvanceWidth(text, size)
    : trackedAdvanceWidth(font, text, size, tracking);
  const ascent = (font.ascender ?? 0) * scale;
  const descent = Math.abs((font.descender ?? 0) * scale);
  return { width, ascent, descent };
}
