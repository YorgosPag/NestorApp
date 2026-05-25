/**
 * ADR-375 — Line Weight Resolver pipeline tests.
 */
import { describe, it, expect } from '@jest/globals';
import { resolveLineWeightPx, closestScaleColumn } from '../bim-line-weight-resolver';

describe('closestScaleColumn', () => {
  it('exact match 1:100 → index 3', () => {
    expect(closestScaleColumn(100)).toBe(3);
  });

  it('exact match 1:50 → index 2', () => {
    expect(closestScaleColumn(50)).toBe(2);
  });

  it('exact match 1:10 → index 0', () => {
    expect(closestScaleColumn(10)).toBe(0);
  });

  it('exact match 1:500 → index 5', () => {
    expect(closestScaleColumn(500)).toBe(5);
  });

  it('75 snaps to 1:50 (index 2) — closest', () => {
    expect(closestScaleColumn(75)).toBe(2);
  });

  it('150 snaps to 1:100 (index 3) — equidistant, first-match wins', () => {
    expect(closestScaleColumn(150)).toBe(3);
  });
});

describe('resolveLineWeightPx', () => {
  it('returns 0 for hidden state', () => {
    expect(resolveLineWeightPx({
      category: 'wall',
      cutState: 'hidden',
      scaleDenominator: 100,
    })).toBe(0);
  });

  it('cut wall at 1:100 is heavier than projection wall', () => {
    const cut = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100 });
    const proj = resolveLineWeightPx({ category: 'wall', cutState: 'projection', scaleDenominator: 100 });
    expect(cut).toBeGreaterThan(proj);
  });

  it('cut column > cut wall (structural hierarchy)', () => {
    const col = resolveLineWeightPx({ category: 'column', cutState: 'cut', scaleDenominator: 100 });
    const wall = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100 });
    expect(col).toBeGreaterThan(wall);
  });

  it('beyond returns thinner than projection', () => {
    const beyond = resolveLineWeightPx({ category: 'wall', cutState: 'beyond', scaleDenominator: 100 });
    const proj = resolveLineWeightPx({ category: 'wall', cutState: 'projection', scaleDenominator: 100 });
    expect(beyond).toBeLessThanOrEqual(proj);
  });

  it('larger scale (1:10) produces thicker px than smaller scale (1:500)', () => {
    const large = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 10 });
    const small = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 500 });
    expect(large).toBeGreaterThan(small);
  });

  it('returns positive px for wall cut at 1:100', () => {
    const px = resolveLineWeightPx({ category: 'wall', cutState: 'cut', scaleDenominator: 100, dpi: 96 });
    expect(px).toBeGreaterThan(0);
  });

  it('dpi 144 produces 1.5x more px than dpi 96', () => {
    const px96 = resolveLineWeightPx({ category: 'column', cutState: 'cut', scaleDenominator: 100, dpi: 96 });
    const px144 = resolveLineWeightPx({ category: 'column', cutState: 'cut', scaleDenominator: 100, dpi: 144 });
    expect(px144).toBeCloseTo(px96 * 1.5, 5);
  });
});
