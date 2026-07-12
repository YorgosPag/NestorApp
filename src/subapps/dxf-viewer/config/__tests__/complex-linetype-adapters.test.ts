/**
 * Tests — ADR-642 §6.2 complex-linetype adapters (round-trip + fast-path guard).
 */

import {
  complexToPattern,
  dashPatternToElements,
  DEFAULT_SCALE_SPACE,
  effectiveScaleSpace,
  isSimpleExpressible,
  patternToComplex,
} from '../complex-linetype-adapters';
import type { ComplexLinetypeDef } from '../complex-linetype-types';
import type { LinetypeDef } from '../linetype-iso-catalog';

const dashed: LinetypeDef = {
  name: 'Dashed',
  description: '_ _ _',
  pattern: [12.7, -6.35],
  origin: 'iso-baseline',
};

describe('dashPatternToElements', () => {
  it('maps +dash / −gap / 0=dot to the discriminated union', () => {
    expect(dashPatternToElements([12.7, -6.35, 0])).toEqual([
      { kind: 'dash', lengthMm: 12.7 },
      { kind: 'gap', lengthMm: 6.35 },
      { kind: 'dot' },
    ]);
  });

  it('empty (solid) → no elements', () => {
    expect(dashPatternToElements([])).toEqual([]);
  });
});

describe('patternToComplex', () => {
  it('wraps a simple def in a single layer with model scale-space default', () => {
    const c = patternToComplex(dashed);
    expect(c.layers).toHaveLength(1);
    expect(c.layers[0].elements).toEqual([
      { kind: 'dash', lengthMm: 12.7 },
      { kind: 'gap', lengthMm: 6.35 },
    ]);
    expect(c.scaleSpace).toBe(DEFAULT_SCALE_SPACE);
    expect(c.name).toBe('Dashed');
  });

  it('preserves id/origin/sourceFile', () => {
    const c = patternToComplex({ ...dashed, id: 'ltp_x', origin: 'lin-import', sourceFile: 'a.lin' });
    expect(c.id).toBe('ltp_x');
    expect(c.origin).toBe('lin-import');
    expect(c.sourceFile).toBe('a.lin');
  });
});

describe('isSimpleExpressible', () => {
  it('true for a single-layer dash/gap/dot type', () => {
    expect(isSimpleExpressible(patternToComplex(dashed))).toBe(true);
    expect(isSimpleExpressible(patternToComplex({ ...dashed, pattern: [] }))).toBe(true);
  });

  it('false for compound (>1 layer)', () => {
    const c: ComplexLinetypeDef = {
      name: 'x', description: '', origin: 'user-created',
      layers: [{ elements: [{ kind: 'dash', lengthMm: 5 }] }, { elements: [], offsetMm: 2 }],
    };
    expect(isSimpleExpressible(c)).toBe(false);
  });

  it('false when an element carries a cap / width / profile', () => {
    const base = patternToComplex(dashed);
    const withCap: ComplexLinetypeDef = { ...base, layers: [{ elements: [{ kind: 'dash', lengthMm: 5, cap: 'round' }] }] };
    const withWidth: ComplexLinetypeDef = { ...base, layers: [{ elements: [{ kind: 'dash', lengthMm: 5, widthMm: 2 }] }] };
    expect(isSimpleExpressible(withCap)).toBe(false);
    expect(isSimpleExpressible(withWidth)).toBe(false);
  });

  it('false for text/symbol elements', () => {
    const c: ComplexLinetypeDef = {
      name: 'gas', description: '', origin: 'user-created',
      layers: [{ elements: [
        { kind: 'dash', lengthMm: 5 },
        { kind: 'text', value: 'GAS', styleId: 's', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0, followPath: true },
      ] }],
    };
    expect(isSimpleExpressible(c)).toBe(false);
  });

  it('false when corner policy needs the stroker (break / alignDash)', () => {
    const c = { ...patternToComplex(dashed), cornerPolicy: 'break' as const };
    expect(isSimpleExpressible(c)).toBe(false);
    expect(isSimpleExpressible({ ...patternToComplex(dashed), cornerPolicy: 'bypass' as const })).toBe(true);
  });
});

describe('complexToPattern — round-trip', () => {
  it('recovers the original number[] for a simple type', () => {
    expect(complexToPattern(patternToComplex(dashed))).toEqual([12.7, -6.35]);
    expect(complexToPattern(patternToComplex({ ...dashed, pattern: [12.7, -6.35, 0, -6.35] }))).toEqual([12.7, -6.35, 0, -6.35]);
  });

  it('returns null for a non-simple (complex) type', () => {
    const c: ComplexLinetypeDef = {
      name: 'x', description: '', origin: 'user-created',
      layers: [{ elements: [{ kind: 'dash', lengthMm: 5, cap: 'round' }] }],
    };
    expect(complexToPattern(c)).toBeNull();
  });

  it('solid ([]) round-trips through complex back to []', () => {
    expect(complexToPattern(patternToComplex({ ...dashed, pattern: [] }))).toEqual([]);
  });
});

describe('effectiveScaleSpace', () => {
  it('defaults to model, honours explicit paper', () => {
    expect(effectiveScaleSpace(patternToComplex(dashed))).toBe('model');
    expect(effectiveScaleSpace({ ...patternToComplex(dashed), scaleSpace: 'paper' })).toBe('paper');
  });
});
