/**
 * ADR-375 — View Range resolveCutState tests.
 * 8 scenarios covering all 5 display rules.
 */
import { describe, it, expect } from '@jest/globals';
import { resolveCutState, DEFAULT_VIEW_RANGE } from '../bim-view-range';

describe('resolveCutState', () => {
  it('returns "cut" when entity intersects cut plane (wall 0-3000, cut=1200)', () => {
    expect(resolveCutState(
      { zBottomMm: 0, zTopMm: 3000, category: 'wall' },
      DEFAULT_VIEW_RANGE,
    )).toBe('cut');
  });

  it('returns "cut" when bottom exactly at cut plane', () => {
    expect(resolveCutState(
      { zBottomMm: 1200, zTopMm: 2000, category: 'column' },
      DEFAULT_VIEW_RANGE,
    )).toBe('cut');
  });

  it('returns "projection" for element above bottom but below cut plane (beam at -200 to 0)', () => {
    expect(resolveCutState(
      { zBottomMm: -200, zTopMm: 0, category: 'beam' },
      DEFAULT_VIEW_RANGE,
    )).toBe('projection');
  });

  it('returns "projection" for slab at ground level (-200 to 0)', () => {
    expect(resolveCutState(
      { zBottomMm: -200, zTopMm: 0, category: 'slab' },
      DEFAULT_VIEW_RANGE,
    )).toBe('projection');
  });

  it('returns "hidden" for element completely above top plane', () => {
    expect(resolveCutState(
      { zBottomMm: 2400, zTopMm: 5000, category: 'wall' },
      DEFAULT_VIEW_RANGE,
    )).toBe('hidden');
  });

  it('returns "beyond" for non-floor element below bottom within view depth', () => {
    expect(resolveCutState(
      { zBottomMm: -400, zTopMm: -150, category: 'beam' },
      DEFAULT_VIEW_RANGE,
    )).toBe('beyond');
  });

  it('returns "projection" for slab/stair within floor-adjusted range below bottom', () => {
    // slab at -1000 to -1200 — within 1220mm floor-adjusted range below bottom=0
    expect(resolveCutState(
      { zBottomMm: -1200, zTopMm: -1000, category: 'slab' },
      DEFAULT_VIEW_RANGE,
    )).toBe('projection');
  });

  it('returns "hidden" for element below view depth', () => {
    expect(resolveCutState(
      { zBottomMm: -2000, zTopMm: -500, category: 'wall' },
      DEFAULT_VIEW_RANGE,
    )).toBe('hidden');
  });
});
