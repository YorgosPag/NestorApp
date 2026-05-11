/**
 * ADR-344 Phase 3 — line-breaker unit tests.
 *
 * Uses a predictable mock Font where getAdvanceWidth returns text.length × size,
 * giving integer widths easy to reason about.
 */

import { breakLines, type TextLine } from '../line-breaker';
import type { Font } from 'opentype.js';
import type { TextRun } from '../../types/text-ast.types';
import type { DxfColor } from '../../types/text-toolbar.types';

// ── Mock font: each character = 1 drawing unit at size=1 ─────────────────────

function makeMockFont(): Font {
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    charToGlyph: jest.fn(),
    getPath: jest.fn().mockReturnValue({ commands: [] }),
    getAdvanceWidth: jest.fn().mockImplementation((text: string, size: number) => text.length * size),
  } as unknown as Font;
}

const COLOR_BY_LAYER: DxfColor = { kind: 'ByLayer' };

function makeRun(text: string, height = 1): TextRun {
  return {
    text,
    style: {
      fontFamily: 'Test',
      bold: false,
      italic: false,
      underline: false,
      overline: false,
      strikethrough: false,
      height,
      widthFactor: 1,
      obliqueAngle: 0,
      tracking: 1,
      color: COLOR_BY_LAYER,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lineTexts(lines: TextLine[]): string[] {
  return lines.map(l => l.runs.map(r => r.text).join(''));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('breakLines — basic cases', () => {
  let font: Font;

  beforeEach(() => { font = makeMockFont(); });

  it('returns one line when content fits within maxWidth', () => {
    const lines = breakLines([makeRun('Hello', 1)], 100, font);
    expect(lines).toHaveLength(1);
    expect(lineTexts(lines)[0]).toBe('Hello');
  });

  it('returns one empty line when runs array is empty', () => {
    const lines = breakLines([], 100, font);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.runs).toHaveLength(0);
  });

  it('accumulates width across tokens on the same line', () => {
    // "Hello " (6) + "world" (5) = 11 — fits in 20
    const lines = breakLines([makeRun('Hello world', 1)], 20, font);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.width).toBeGreaterThan(0);
  });
});

describe('breakLines — word-wrap overflow', () => {
  let font: Font;

  beforeEach(() => { font = makeMockFont(); });

  it('breaks at word boundary when line would overflow', () => {
    // maxWidth=6, "Hello " = 6 fits; "world" = 5 → would push to 11 → new line
    const lines = breakLines([makeRun('Hello world', 1)], 6, font);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lineTexts(lines)[0]).toContain('Hello');
    expect(lineTexts(lines)[1]).toContain('world');
  });

  it('places a single word longer than maxWidth on its own line', () => {
    // "superlongword" = 13 > maxWidth=5, but no break opportunity
    const lines = breakLines([makeRun('superlongword', 1)], 5, font);
    expect(lines).toHaveLength(1);
    expect(lineTexts(lines)[0]).toContain('superlongword');
  });

  it('breaks hyphenated words correctly', () => {
    // "self-" (5) fits in 6; "help" (4) overflows → new line
    const lines = breakLines([makeRun('self-help', 1)], 6, font);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lineTexts(lines)[0]).toContain('self-');
    expect(lineTexts(lines)[1]).toContain('help');
  });

  it('does not start a new line with a whitespace-only token', () => {
    // trailing space should not trigger a flush + new empty line
    const lines = breakLines([makeRun('Hi ', 1)], 100, font);
    expect(lines).toHaveLength(1);
  });
});

describe('breakLines — explicit newlines', () => {
  let font: Font;

  beforeEach(() => { font = makeMockFont(); });

  it('breaks at explicit \\n', () => {
    const lines = breakLines([makeRun('line1\nline2', 1)], 100, font);
    expect(lines).toHaveLength(2);
    expect(lineTexts(lines)[0]).toContain('line1');
    expect(lineTexts(lines)[1]).toContain('line2');
  });

  it('handles multiple consecutive \\n without creating extra empty lines', () => {
    const lines = breakLines([makeRun('a\n\nb', 1)], 100, font);
    expect(lines).toHaveLength(2);
  });

  it('handles trailing \\n without adding empty trailing line', () => {
    const lines = breakLines([makeRun('text\n', 1)], 100, font);
    expect(lines).toHaveLength(1);
    expect(lineTexts(lines)[0]).toContain('text');
  });
});

describe('breakLines — multiple runs', () => {
  let font: Font;

  beforeEach(() => { font = makeMockFont(); });

  it('places two short runs on the same line when they fit', () => {
    const runs = [makeRun('Hel', 1), makeRun('lo', 1)];
    const lines = breakLines(runs, 100, font);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.runs).toHaveLength(2);
  });

  it('records correct ascent/descent for the line', () => {
    const lines = breakLines([makeRun('A', 10)], 100, font);
    // ascent = 800 * (10/1000) = 8, descent = 200 * (10/1000) = 2
    expect(lines[0]!.ascent).toBeCloseTo(8);
    expect(lines[0]!.descent).toBeCloseTo(2);
  });

  it('uses the maximum ascent across runs with different heights', () => {
    const runs = [makeRun('small', 10), makeRun('BIG', 20)];
    const lines = breakLines(runs, 200, font);
    // BIG ascent = 800 * (20/1000) = 16 > small ascent = 8
    expect(lines[0]!.ascent).toBeCloseTo(16);
  });
});
