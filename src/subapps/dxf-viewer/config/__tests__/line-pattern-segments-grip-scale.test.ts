/**
 * Tests — ADR-642 Φ6-A (§6.7): the grip-editor scale helpers (pure model math).
 *
 * `scaleLayerSpread` opens/closes the band around its geometric centre; `scalePatternLength` scales
 * dash/gap lengths only (dot/text/symbol untouched). Both min-guard against collapse/sign-inversion.
 */

import { describe, it, expect } from '@jest/globals';
import {
  type LinePatternLayer,
  LINE_PATTERN_MIN_MM,
  bandCenterOffset,
  bandHalfExtentMm,
  patternTotalLengthMm,
  scaleLayerSpread,
  scalePatternLength,
} from '../line-pattern-segments';

const railway: LinePatternLayer[] = [
  { segments: [{ kind: 'dash', lengthMm: 4 }, { kind: 'gap', lengthMm: 2 }], offsetMm: 1 },
  { segments: [{ kind: 'dash', lengthMm: 4 }, { kind: 'gap', lengthMm: 2 }], offsetMm: -1 },
];

// Asymmetric band: rails at 0 and +1.5 → centre +0.75, half-extent 0.75.
const asymmetric: LinePatternLayer[] = [
  { segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: 0 },
  { segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: 1.5 },
];

describe('band geometry helpers', () => {
  it('bandCenterOffset = midpoint of min & max offsets', () => {
    expect(bandCenterOffset(railway)).toBe(0);
    expect(bandCenterOffset(asymmetric)).toBe(0.75);
    expect(bandCenterOffset([])).toBe(0);
  });

  it('bandHalfExtentMm = largest |offset − centre|', () => {
    expect(bandHalfExtentMm(railway)).toBe(1);
    expect(bandHalfExtentMm(asymmetric)).toBe(0.75);
    expect(bandHalfExtentMm([{ segments: [], offsetMm: 0 }])).toBe(0);
  });

  it('patternTotalLengthMm sums dash + gap only', () => {
    expect(patternTotalLengthMm(railway[0].segments)).toBe(6);
    expect(
      patternTotalLengthMm([
        { kind: 'dash', lengthMm: 4 },
        { kind: 'dot', lengthMm: 0 },
        { kind: 'symbol', glyphId: 'x', role: 'side', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
      ]),
    ).toBe(4);
  });
});

describe('scaleLayerSpread', () => {
  it('scales a symmetric band around centre 0', () => {
    const out = scaleLayerSpread(railway, 2);
    expect(out.map((l) => l.offsetMm)).toEqual([2, -2]);
  });

  it('scales an asymmetric band around its centre (not around 0)', () => {
    const out = scaleLayerSpread(asymmetric, 2);
    // centre 0.75 → 0 becomes 0.75 + (−0.75)*2 = −0.75 ; 1.5 becomes 0.75 + 0.75*2 = 2.25
    expect(out.map((l) => l.offsetMm)).toEqual([-0.75, 2.25]);
  });

  it('min-guards: no sign inversion or collapse below ε', () => {
    const out = scaleLayerSpread(railway, -3);
    const half = bandHalfExtentMm(out);
    expect(half).toBeGreaterThanOrEqual(LINE_PATTERN_MIN_MM);
    // both offsets stay on their original sides (no flip)
    expect(out[0].offsetMm).toBeGreaterThan(0);
    expect(out[1].offsetMm).toBeLessThan(0);
  });

  it('is a no-op when there is no spread (single/centred layers)', () => {
    const single: LinePatternLayer[] = [{ segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: 0 }];
    expect(scaleLayerSpread(single, 3).map((l) => l.offsetMm)).toEqual([0]);
  });
});

describe('scalePatternLength', () => {
  it('scales dash/gap lengths and leaves dot/text/symbol untouched', () => {
    const layers: LinePatternLayer[] = [
      {
        segments: [
          { kind: 'dash', lengthMm: 4 },
          { kind: 'gap', lengthMm: 2 },
          { kind: 'dot', lengthMm: 0 },
          { kind: 'symbol', glyphId: 'x', role: 'side', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
          { kind: 'text', value: 'GAS', styleId: 'arial', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0, followPath: true },
        ],
        offsetMm: 0,
      },
    ];
    const out = scalePatternLength(layers, 2)[0].segments;
    expect(out[0]).toMatchObject({ kind: 'dash', lengthMm: 8 });
    expect(out[1]).toMatchObject({ kind: 'gap', lengthMm: 4 });
    expect(out[2]).toMatchObject({ kind: 'dot', lengthMm: 0 });
    expect(out[3]).toMatchObject({ kind: 'symbol', scale: 1 });
    expect(out[4]).toMatchObject({ kind: 'text', value: 'GAS' });
  });

  it('preserves offsetMm while scaling lengths (multi-layer)', () => {
    const out = scalePatternLength(railway, 0.5);
    expect(out.map((l) => l.offsetMm)).toEqual([1, -1]);
    expect(out[0].segments).toEqual([
      { kind: 'dash', lengthMm: 2 },
      { kind: 'gap', lengthMm: 1 },
    ]);
  });

  it('min-guards: smallest dash/gap stays ≥ ε (no collapse)', () => {
    const out = scalePatternLength(railway, 0);
    const minLen = Math.min(
      ...out.flatMap((l) => l.segments.filter((s) => s.kind !== 'dot').map((s) => (s as { lengthMm: number }).lengthMm)),
    );
    expect(minLen).toBeGreaterThanOrEqual(LINE_PATTERN_MIN_MM);
  });

  it('is a no-op when there is no dash/gap to scale', () => {
    const dotsOnly: LinePatternLayer[] = [{ segments: [{ kind: 'dot', lengthMm: 0 }], offsetMm: 0 }];
    expect(scalePatternLength(dotsOnly, 5)[0].segments).toEqual([{ kind: 'dot', lengthMm: 0 }]);
  });
});
