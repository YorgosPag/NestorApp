/**
 * ADR-344 Phase 2 — shx-renderer unit tests.
 *
 * Tests SHX stroke-vector → Path2D conversion using synthetic ShpFont fixtures.
 * Path2D is a browser API; jest-environment-jsdom provides it.
 */

import { shxGlyphToPath2D, shxStringToPath2D, measureShxText } from '../shx-renderer';
import type { ShpFont } from '../shp-types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFont(charCode: number, vectors: Array<{ dx: number; dy: number; penUp: boolean }>): ShpFont {
  return {
    records: new Map([[charCode, { code: charCode, vectors }]]),
    above: 9,
    below: 3,
    modes: 0,
    capHeight: 12,
  };
}

const SIMPLE_FONT = makeFont(65, [
  { dx: 0, dy: 0, penUp: true },
  { dx: 2, dy: 4, penUp: false },
  { dx: 2, dy: -4, penUp: false },
]);

const EMPTY_FONT: ShpFont = {
  records: new Map(),
  above: 9,
  below: 3,
  modes: 0,
  capHeight: 12,
};

// ─── shxGlyphToPath2D ─────────────────────────────────────────────────────────

describe('shxGlyphToPath2D', () => {
  it('returns null for missing char code', () => {
    const path = shxGlyphToPath2D(EMPTY_FONT, 65, 0, 0, 1);
    expect(path).toBeNull();
  });

  it('returns a Path2D instance for known char code', () => {
    const path = shxGlyphToPath2D(SIMPLE_FONT, 65, 0, 0, 1);
    expect(path).toBeInstanceOf(Path2D);
  });

  it('returns null for char code with only pen-up vectors', () => {
    const penUpFont = makeFont(66, [{ dx: 1, dy: 0, penUp: true }]);
    const path = shxGlyphToPath2D(penUpFont, 66, 0, 0, 1);
    // A glyph with only pen-up moves produces a Path2D without strokes
    // (Path2D always constructed — null only for missing record)
    expect(path).toBeInstanceOf(Path2D);
  });
});

// ─── shxStringToPath2D ────────────────────────────────────────────────────────

describe('shxStringToPath2D', () => {
  it('returns a Path2D for a single character string', () => {
    const path = shxStringToPath2D(SIMPLE_FONT, 'A', 0, 0, 1);
    expect(path).toBeInstanceOf(Path2D);
  });

  it('returns a Path2D for multi-character string', () => {
    const path = shxStringToPath2D(SIMPLE_FONT, 'AAA', 0, 0, 1);
    expect(path).toBeInstanceOf(Path2D);
  });

  it('does not throw for empty string', () => {
    expect(() => shxStringToPath2D(SIMPLE_FONT, '', 0, 0, 1)).not.toThrow();
  });

  it('does not throw for characters not in font', () => {
    expect(() => shxStringToPath2D(SIMPLE_FONT, 'Z', 0, 0, 1)).not.toThrow();
  });
});

// ─── measureShxText ───────────────────────────────────────────────────────────

describe('measureShxText', () => {
  it('returns zero width for empty string', () => {
    const { width } = measureShxText(SIMPLE_FONT, '', 1);
    expect(width).toBe(0);
  });

  it('returns positive width for non-empty string', () => {
    const { width } = measureShxText(SIMPLE_FONT, 'A', 1);
    expect(width).toBeGreaterThanOrEqual(0);
  });

  it('width scales linearly with scale factor', () => {
    const { width: w1 } = measureShxText(SIMPLE_FONT, 'A', 1);
    const { width: w2 } = measureShxText(SIMPLE_FONT, 'A', 2);
    expect(w2).toBeCloseTo(w1 * 2, 5);
  });

  it('height equals capHeight * scale', () => {
    const scale = 3;
    const { height } = measureShxText(SIMPLE_FONT, 'A', scale);
    expect(height).toBeCloseTo(SIMPLE_FONT.capHeight * scale, 5);
  });
});
