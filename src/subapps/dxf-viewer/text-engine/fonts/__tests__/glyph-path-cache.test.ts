/**
 * ADR-530 — glyph-path-cache unit tests.
 *
 * Verifies that Path2D runs are built once per (fontName, text) at the reference
 * em size and reused on subsequent calls (zoom-stable cache).
 */

jest.mock('../glyph-renderer', () => ({
  stringToPath2D: jest.fn(() => new Path2D()),
  measureText: jest.fn(() => ({ width: 60, ascent: 80, descent: 20 })),
}));

import { getGlyphRun, clearGlyphPathCache, GLYPH_REFERENCE_SIZE } from '../glyph-path-cache';
import { stringToPath2D, measureText } from '../glyph-renderer';
import type { Font } from 'opentype.js';

const font = {} as Font;
const buildMock = stringToPath2D as jest.Mock;
const measureMock = measureText as jest.Mock;

describe('glyph-path-cache (ADR-530)', () => {
  beforeEach(() => {
    clearGlyphPathCache();
    buildMock.mockClear();
    measureMock.mockClear();
  });

  it('builds a run once and reuses it for the same (fontName, text)', () => {
    const a = getGlyphRun(font, 'Liberation Sans', 'HELLO');
    const b = getGlyphRun(font, 'Liberation Sans', 'HELLO');
    expect(a).toBe(b);
    expect(buildMock).toHaveBeenCalledTimes(1);
    expect(measureMock).toHaveBeenCalledTimes(1);
  });

  it('builds separate runs for different text', () => {
    getGlyphRun(font, 'Liberation Sans', 'A');
    getGlyphRun(font, 'Liberation Sans', 'B');
    expect(buildMock).toHaveBeenCalledTimes(2);
  });

  it('builds separate runs for different fonts', () => {
    getGlyphRun(font, 'Liberation Sans', 'A');
    getGlyphRun(font, 'Liberation Mono', 'A');
    expect(buildMock).toHaveBeenCalledTimes(2);
  });

  it('builds the path at the reference em size (tracking 1 by default)', () => {
    getGlyphRun(font, 'Liberation Sans', 'X');
    expect(buildMock).toHaveBeenCalledWith(font, 'X', 0, 0, GLYPH_REFERENCE_SIZE, 1);
  });

  it('keys on tracking — a different factor rebuilds a distinct run', () => {
    getGlyphRun(font, 'Liberation Sans', 'A', 1);
    getGlyphRun(font, 'Liberation Sans', 'A', 2);
    expect(buildMock).toHaveBeenCalledWith(font, 'A', 0, 0, GLYPH_REFERENCE_SIZE, 2);
    expect(buildMock).toHaveBeenCalledTimes(2);
  });

  it('clearGlyphPathCache forces a rebuild', () => {
    getGlyphRun(font, 'Liberation Sans', 'A');
    clearGlyphPathCache();
    getGlyphRun(font, 'Liberation Sans', 'A');
    expect(buildMock).toHaveBeenCalledTimes(2);
  });
});
