/**
 * ADR-344 Phase 2 — glyph-renderer unit tests.
 *
 * Tests the opentype.js → Path2D bridge using a minimal mock Font object
 * so we don't need to load a real TTF in the test suite.
 */

import { glyphToPath2D, stringToPath2D, measureText } from '../glyph-renderer';
import type { Font } from 'opentype.js';

// ─── Mock Font ────────────────────────────────────────────────────────────────

function makeOtPath(hasCommands: boolean) {
  return {
    commands: hasCommands
      ? [
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 10, y: 0 },
          { type: 'L', x: 5, y: 10 },
          { type: 'Z' },
        ]
      : [],
  };
}

function makeMockFont(glyphIndex: number): Font {
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    charToGlyph: jest.fn().mockReturnValue({ index: glyphIndex, getPath: jest.fn().mockReturnValue(makeOtPath(glyphIndex !== 0)) }),
    getPath: jest.fn().mockReturnValue(makeOtPath(true)),
    getAdvanceWidth: jest.fn().mockReturnValue(600),
  } as unknown as Font;
}

// ─── glyphToPath2D ────────────────────────────────────────────────────────────

describe('glyphToPath2D', () => {
  it('returns null for .notdef glyph (index 0)', () => {
    const font = makeMockFont(0);
    const result = glyphToPath2D(font, 'A', 0, 0, 12);
    expect(result).toBeNull();
  });

  it('returns a Path2D for a known glyph', () => {
    const font = makeMockFont(65);
    const result = glyphToPath2D(font, 'A', 0, 0, 12);
    expect(result).toBeInstanceOf(Path2D);
  });

  it('calls font.charToGlyph with the correct character', () => {
    const font = makeMockFont(66);
    glyphToPath2D(font, 'B', 10, 20, 14);
    expect(font.charToGlyph).toHaveBeenCalledWith('B');
  });
});

// ─── stringToPath2D ───────────────────────────────────────────────────────────

describe('stringToPath2D', () => {
  it('returns a Path2D instance', () => {
    const font = makeMockFont(65);
    const result = stringToPath2D(font, 'Hello', 0, 0, 12);
    expect(result).toBeInstanceOf(Path2D);
  });

  it('calls font.getPath with the full string', () => {
    const font = makeMockFont(65);
    stringToPath2D(font, 'TEST', 5, 10, 16);
    expect(font.getPath).toHaveBeenCalledWith('TEST', 5, 10, 16);
  });
});

// ─── measureText ─────────────────────────────────────────────────────────────

describe('measureText', () => {
  it('returns correct width from getAdvanceWidth', () => {
    const font = makeMockFont(65);
    const metrics = measureText(font, 'A', 12);
    expect(metrics.width).toBe(600);
  });

  it('ascent scales with size/unitsPerEm', () => {
    const font = makeMockFont(65);
    const size = 20;
    const metrics = measureText(font, 'A', size);
    const expectedAscent = 800 * (size / 1000);
    expect(metrics.ascent).toBeCloseTo(expectedAscent, 5);
  });

  it('descent is positive (absolute value)', () => {
    const font = makeMockFont(65);
    const metrics = measureText(font, 'A', 12);
    expect(metrics.descent).toBeGreaterThanOrEqual(0);
  });
});
