/**
 * Tests — ADR-642 Φ5 (#9): the compound (multi-layer) bridge + presets.
 *
 * A compound pattern (≥2 parallel layers, each with its own `offsetMm`) lifts to a
 * `ComplexLinetypeDef.layers[]` and back losslessly. The presets (road / railway) build valid,
 * self-consistent layer lists (solid rails allowed; each layer a valid sub-pattern).
 */

import { describe, it, expect } from '@jest/globals';
import {
  type LinePatternLayer,
  singleLayer,
  defaultCompoundLayer,
  isCompound,
  layersToComplex,
  complexToLayers,
  describeLayers,
  validateLinePatternLayers,
  centerOffsetForLayer,
  suggestCopyName,
} from '../line-pattern-segments';
import { COMPOUND_PRESETS, listCompoundPresets } from '../linetype-compound-presets';

const compound: LinePatternLayer[] = [
  { segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: 0.75 },
  { segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: -0.75 },
  { segments: [{ kind: 'gap', lengthMm: 3 }, { kind: 'symbol', glyphId: 'tick', role: 'side', scale: 1, rotationDeg: 0, offsetXMm: 0, offsetYMm: 0 }], offsetMm: 0 },
];

describe('compound-layer helpers', () => {
  it('singleLayer wraps a segment list as one centre layer (offset 0)', () => {
    const l = singleLayer([{ kind: 'dash', lengthMm: 5 }, { kind: 'gap', lengthMm: 2 }]);
    expect(l).toHaveLength(1);
    expect(l[0].offsetMm).toBe(0);
  });

  it('defaultCompoundLayer seeds a dash+gap run at the given offset', () => {
    const l = defaultCompoundLayer(1.5);
    expect(l.offsetMm).toBe(1.5);
    expect(l.segments.map((s) => s.kind)).toEqual(['dash', 'gap']);
  });

  it('centerOffsetForLayer puts a tie at the midpoint of the two rails (symmetric ±0.75 → 0)', () => {
    // The tie is layer index 2; the rails are at ±0.75 → centre = 0.
    expect(centerOffsetForLayer(compound, 2)).toBe(0);
  });

  it('centerOffsetForLayer centres between asymmetric rails (rails 0 and +1.5 → +0.75)', () => {
    // The eccentric case Giorgio hit: base rail at 0, second rail at +1.5, tie authored at 0.
    const eccentric: LinePatternLayer[] = [
      { segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: 0 },
      { segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: 1.5 },
      { segments: [{ kind: 'gap', lengthMm: 3 }], offsetMm: 0 },
    ];
    expect(centerOffsetForLayer(eccentric, 2)).toBe(0.75);
  });

  it('centerOffsetForLayer ignores the layer itself (its own offset never skews the midpoint)', () => {
    const layers: LinePatternLayer[] = [
      { segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: -2 },
      { segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: 4 },
      { segments: [{ kind: 'dash', lengthMm: 4 }], offsetMm: 99 }, // self — must be excluded
    ];
    expect(centerOffsetForLayer(layers, 2)).toBe(1); // midpoint of -2 and 4
  });

  it('centerOffsetForLayer keeps a lone layer put (nothing to centre against)', () => {
    expect(centerOffsetForLayer([{ segments: [{ kind: 'dash', lengthMm: 5 }], offsetMm: 2 }], 0)).toBe(2);
  });

  it('isCompound: true for ≥2 layers OR any non-zero offset', () => {
    expect(isCompound(singleLayer([{ kind: 'dash', lengthMm: 5 }]))).toBe(false);
    expect(isCompound([{ segments: [{ kind: 'dash', lengthMm: 5 }], offsetMm: 1 }])).toBe(true);
    expect(isCompound(compound)).toBe(true);
  });

  it('describeLayers joins multi-layer glyphs with the parallel bar', () => {
    expect(describeLayers(compound)).toContain('∥');
    expect(describeLayers(singleLayer([{ kind: 'dash', lengthMm: 5 }]))).not.toContain('∥');
  });
});

describe('compound bridge round-trip', () => {
  it('layers → complex preserves offset + widths, and back', () => {
    const def = layersToComplex('Rail', compound, 'railway');
    expect(def.layers).toHaveLength(3);
    expect(def.layers[0].offsetMm).toBe(0.75);
    expect(def.layers[1].offsetMm).toBe(-0.75);
    expect(def.layers[2].offsetMm).toBeUndefined(); // 0 offset omitted (byte-identical to single-layer)

    const back = complexToLayers(def);
    expect(back).toEqual(compound);
  });

  it('a single centre layer round-trips identically to the non-compound shape', () => {
    const single = singleLayer([{ kind: 'dash', lengthMm: 5 }, { kind: 'gap', lengthMm: 2 }]);
    const def = layersToComplex('D', single);
    expect(def.layers).toHaveLength(1);
    expect(def.layers[0].offsetMm).toBeUndefined();
    expect(complexToLayers(def)).toEqual(single);
  });
});

describe('validateLinePatternLayers', () => {
  it('accepts a compound with SOLID rails (no gap allowed in sub-layers)', () => {
    expect(validateLinePatternLayers('Road', COMPOUND_PRESETS[0].build(), []).ok).toBe(true);
  });

  it('still requires a gap for a standalone single layer', () => {
    const v = validateLinePatternLayers('Solid', [{ segments: [{ kind: 'dash', lengthMm: 5 }], offsetMm: 0 }], []);
    expect(v.ok).toBe(false);
    expect(v.patternError).toBe('pattern.needsGap');
  });

  it('rejects a taken name and an empty sub-layer', () => {
    expect(validateLinePatternLayers('X', compound, ['X']).nameError).toBe('name.taken');
    const withEmpty: LinePatternLayer[] = [...compound, { segments: [], offsetMm: 2 }];
    expect(validateLinePatternLayers('OK', withEmpty, []).patternError).toBe('pattern.empty');
  });
});

describe('compound presets', () => {
  it('road = two parallel solid rails at ± offset', () => {
    const road = COMPOUND_PRESETS.find((p) => p.id === 'road')!.build();
    expect(road).toHaveLength(2);
    expect(road[0].offsetMm).toBeCloseTo(-road[1].offsetMm, 6);
    expect(road.every((l) => l.offsetMm !== 0)).toBe(true);
  });

  it('railway = two rails + a centre tie line, all valid', () => {
    const railway = COMPOUND_PRESETS.find((p) => p.id === 'railway')!.build();
    expect(railway).toHaveLength(3);
    expect(railway.some((l) => l.segments.some((s) => s.kind === 'symbol'))).toBe(true);
    expect(validateLinePatternLayers('Rail', railway, []).ok).toBe(true);
  });

  it('every preset builds fresh (non-shared) layer arrays', () => {
    const a = listCompoundPresets()[0].build();
    const b = listCompoundPresets()[0].build();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('suggestCopyName (Duplicate & edit)', () => {
  it('appends the smallest free numeric suffix', () => {
    expect(suggestCopyName('Dashed', ['ByLayer', 'Dashed'])).toBe('Dashed 2');
    expect(suggestCopyName('Dashed', ['Dashed', 'Dashed 2'])).toBe('Dashed 3');
  });

  it('returns the base itself when it is free', () => {
    expect(suggestCopyName('MyType', ['ByLayer', 'Other'])).toBe('MyType');
  });
});
