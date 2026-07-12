/**
 * Tests — ADR-642 Φ3 (#3): the symbol variant of the line-pattern-segments bridge.
 *
 * A symbol-carrying segment list is not expressible as a `number[]` mm pattern; it lifts
 * to a `ComplexLinetypeDef` (and back) losslessly. Also asserts the `hasComplex`/validate
 * gates treat a symbol as a visible mark that needs complex storage.
 */

import { describe, it, expect } from '@jest/globals';
import {
  type LinePatternSegment,
  defaultSymbolSegment,
  hasSymbolSegments,
  hasComplexSegments,
  hasTextSegments,
  segmentsToComplex,
  complexToSegments,
  segmentsToDashPattern,
  validateLinePattern,
} from '../line-pattern-segments';

const fence: LinePatternSegment[] = [
  { kind: 'dash', lengthMm: 5 },
  { kind: 'gap', lengthMm: 3 },
  { kind: 'symbol', glyphId: 'cross', role: 'side', scale: 1.2, rotationDeg: 15, offsetXMm: 0.5, offsetYMm: -0.5 },
];

describe('line-pattern-segments — symbol gates', () => {
  it('defaultSymbolSegment seeds the fence × glyph, side role', () => {
    const s = defaultSymbolSegment();
    expect(s).toMatchObject({ kind: 'symbol', glyphId: 'cross', role: 'side', scale: 1 });
  });

  it('hasSymbolSegments / hasComplexSegments detect the symbol row', () => {
    expect(hasSymbolSegments(fence)).toBe(true);
    expect(hasComplexSegments(fence)).toBe(true);
    expect(hasTextSegments(fence)).toBe(false); // symbol ≠ text
  });

  it('symbol is not expressible in the mm pattern (geometry-only fallback)', () => {
    expect(segmentsToDashPattern(fence)).toEqual([5, -3]);
  });

  it('validate: a symbol counts as a visible mark', () => {
    const v = validateLinePattern('Fence-X', fence, []);
    expect(v.ok).toBe(true);
  });
});

describe('line-pattern-segments — symbol round-trip', () => {
  it('segments → complex → segments preserves the symbol element', () => {
    const def = segmentsToComplex('Fence-X', fence, 'fence');
    const sym = def.layers[0].elements.find((e) => e.kind === 'symbol');
    expect(sym).toMatchObject({
      kind: 'symbol', glyphId: 'cross', role: 'side', scale: 1.2,
      rotationDeg: 15, offsetXMm: 0.5, offsetYMm: -0.5,
    });

    const back = complexToSegments(def);
    expect(back).toEqual(fence);
  });

  it('preserves a corner-role symbol through the complex bridge (ADR-642 Φ4)', () => {
    const withCorner: LinePatternSegment[] = [
      { kind: 'dash', lengthMm: 5 },
      { kind: 'symbol', glyphId: 'square', role: 'innerCorner', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 },
    ];
    const def = segmentsToComplex('Corner', withCorner, 'corner');
    expect(def.layers[0].elements.find((e) => e.kind === 'symbol')).toMatchObject({
      role: 'innerCorner',
      glyphId: 'square',
    });
    expect(complexToSegments(def)).toEqual(withCorner);
  });
});
