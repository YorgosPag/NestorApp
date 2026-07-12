/**
 * Tests — ADR-362 Path B: line pattern segment ↔ DXF mm pattern SSoT.
 */

import { describe, it, expect } from '@jest/globals';
import {
  type LinePatternSegment,
  type LinePatternTextSegment,
  segmentsToDashPattern,
  dashPatternToSegments,
  describeSegments,
  validateLinePattern,
  segmentsToComplex,
  complexToSegments,
  hasTextSegments,
  defaultTextSegment,
} from '../line-pattern-segments';

describe('segmentsToDashPattern', () => {
  it('maps dash→positive, gap→negative, dot→0', () => {
    const segs: LinePatternSegment[] = [
      { kind: 'dash', lengthMm: 5 },
      { kind: 'gap', lengthMm: 2 },
      { kind: 'dot', lengthMm: 0 },
      { kind: 'gap', lengthMm: 2 },
    ];
    expect(segmentsToDashPattern(segs)).toEqual([5, -2, 0, -2]);
  });

  it('drops non-positive / non-finite dash & gap lengths (dots survive)', () => {
    const segs: LinePatternSegment[] = [
      { kind: 'dash', lengthMm: 0 },
      { kind: 'gap', lengthMm: Number.NaN },
      { kind: 'dot', lengthMm: 0 },
    ];
    expect(segmentsToDashPattern(segs)).toEqual([0]);
  });
});

describe('dashPatternToSegments — roundtrip', () => {
  it('inverts segmentsToDashPattern for a valid pattern', () => {
    const pattern = [5, -2, 0, -2];
    const segs = dashPatternToSegments(pattern);
    expect(segs.map((s) => s.kind)).toEqual(['dash', 'gap', 'dot', 'gap']);
    expect(segmentsToDashPattern(segs)).toEqual(pattern);
  });
});

describe('describeSegments', () => {
  it('produces a compact glyph preview, never empty', () => {
    expect(describeSegments([{ kind: 'dash', lengthMm: 5 }, { kind: 'dot', lengthMm: 0 }])).toContain('▬');
    expect(describeSegments([])).toBe('—');
  });
});

describe('validateLinePattern', () => {
  const dashGap: LinePatternSegment[] = [
    { kind: 'dash', lengthMm: 5 },
    { kind: 'gap', lengthMm: 2 },
  ];

  it('accepts a valid dash+gap pattern with a fresh name', () => {
    expect(validateLinePattern('MyDash', dashGap, ['ByLayer', 'Continuous'])).toEqual({ ok: true });
  });

  it('rejects empty / reserved / taken names', () => {
    expect(validateLinePattern('   ', dashGap, []).nameError).toBe('name.empty');
    expect(validateLinePattern('ByLayer', dashGap, []).nameError).toBe('name.reserved');
    expect(validateLinePattern('Dashed', dashGap, ['Dashed']).nameError).toBe('name.taken');
  });

  it('rejects patterns with no gap, no visible mark, or bad lengths', () => {
    expect(validateLinePattern('X', [{ kind: 'dash', lengthMm: 5 }], []).patternError).toBe('pattern.needsGap');
    expect(validateLinePattern('X', [{ kind: 'gap', lengthMm: 2 }], []).patternError).toBe('pattern.needsVisible');
    expect(validateLinePattern('X', [{ kind: 'dash', lengthMm: -5 }, { kind: 'gap', lengthMm: 2 }], []).patternError).toBe('pattern.badLength');
    expect(validateLinePattern('X', [], []).patternError).toBe('pattern.empty');
  });
});

// ── ADR-642 Φ2 — embedded text (#2) ──────────────────────────────────────────

const gasText: LinePatternTextSegment = {
  kind: 'text', value: 'GAS', styleId: 'arial', scale: 1,
  rotationDeg: 0, offsetXMm: -0.1, offsetYMm: -0.05, followPath: true,
};

const gasPattern: LinePatternSegment[] = [
  { kind: 'dash', lengthMm: 5 },
  { kind: 'gap', lengthMm: 2 },
  gasText,
  { kind: 'gap', lengthMm: 5 },
];

describe('text segments — geometry projection', () => {
  it('segmentsToDashPattern SKIPS text (not expressible as a mm value)', () => {
    expect(segmentsToDashPattern(gasPattern)).toEqual([5, -2, -5]);
  });

  it('hasTextSegments detects a text row', () => {
    expect(hasTextSegments(gasPattern)).toBe(true);
    expect(hasTextSegments([{ kind: 'dash', lengthMm: 5 }, { kind: 'gap', lengthMm: 2 }])).toBe(false);
  });

  it('describeSegments includes the text value', () => {
    expect(describeSegments(gasPattern)).toContain('GAS');
  });
});

describe('segmentsToComplex ⇄ complexToSegments', () => {
  it('lifts a text-carrying list into a single-layer complex def', () => {
    const def = segmentsToComplex('GAS-LINE', gasPattern, 'desc');
    expect(def.name).toBe('GAS-LINE');
    expect(def.origin).toBe('user-created');
    expect(def.layers).toHaveLength(1);
    const kinds = def.layers[0].elements.map((el) => el.kind);
    expect(kinds).toEqual(['dash', 'gap', 'text', 'gap']);
    const textEl = def.layers[0].elements.find((el) => el.kind === 'text');
    expect(textEl).toMatchObject({ value: 'GAS', styleId: 'arial', followPath: true, offsetXMm: -0.1 });
  });

  it('round-trips the segment list through the complex def', () => {
    const def = segmentsToComplex('GAS-LINE', gasPattern);
    const back = complexToSegments(def);
    expect(back).toEqual(gasPattern);
  });

  it('drops symbol elements (Φ3) it cannot yet author', () => {
    const withSymbol = segmentsToComplex('S', [{ kind: 'dash', lengthMm: 5 }, { kind: 'gap', lengthMm: 2 }]);
    const layered = {
      ...withSymbol,
      layers: [{ elements: [...withSymbol.layers[0].elements, { kind: 'symbol' as const, glyphId: 'x', role: 'side' as const, scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 }] }],
    };
    expect(complexToSegments(layered).map((s) => s.kind)).toEqual(['dash', 'gap']);
  });
});

describe('validateLinePattern — text rows', () => {
  it('accepts ──GAS── (text counts as a visible mark)', () => {
    expect(validateLinePattern('GAS', gasPattern, [])).toEqual({ ok: true });
  });

  it('accepts a text+gap pattern with no dash/dot (text is the visible mark)', () => {
    expect(validateLinePattern('T', [gasText, { kind: 'gap', lengthMm: 5 }], [])).toEqual({ ok: true });
  });

  it('rejects an empty text value with pattern.textEmpty', () => {
    const empty = [defaultTextSegment(), { kind: 'gap' as const, lengthMm: 5 }];
    expect(validateLinePattern('T', empty, []).patternError).toBe('pattern.textEmpty');
  });
});
