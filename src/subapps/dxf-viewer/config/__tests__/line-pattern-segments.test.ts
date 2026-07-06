/**
 * Tests — ADR-362 Path B: line pattern segment ↔ DXF mm pattern SSoT.
 */

import { describe, it, expect } from '@jest/globals';
import {
  type LinePatternSegment,
  segmentsToDashPattern,
  dashPatternToSegments,
  describeSegments,
  validateLinePattern,
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
