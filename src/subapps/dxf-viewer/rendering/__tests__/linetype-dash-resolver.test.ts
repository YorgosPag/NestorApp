/**
 * Tests — ADR-510 Φ2 linetype dash resolver.
 */

import {
  dashMmToScreenPx,
  isSolidPattern,
  resolveLinetypePatternMm,
  MIN_DOT_PX,
} from '../linetype-dash-resolver';
import {
  registerUserLinetype,
  __resetLinetypeRegistryForTesting,
} from '../../stores/LinetypeRegistry';

describe('dashMmToScreenPx', () => {
  it('returns [] for a solid (Continuous) pattern', () => {
    expect(dashMmToScreenPx([], 1, 1)).toEqual([]);
  });

  it('passes a simple dash through unchanged at scale 1 / ltscale 1', () => {
    // Dashed = [12.7, -6.35]; gap negative folds to positive.
    expect(dashMmToScreenPx([12.7, -6.35], 1, 1)).toEqual([12.7, 6.35]);
  });

  it('folds every gap (negative) to a positive length', () => {
    const out = dashMmToScreenPx([6.35, -3.175], 1, 1);
    expect(out.every((v) => v > 0)).toBe(true);
    expect(out).toEqual([6.35, 3.175]);
  });

  it('promotes a dot (0) to the minimum visible length', () => {
    // DashDot = [12.7, -6.35, 0, -6.35]; the 0 is a dot.
    const out = dashMmToScreenPx([12.7, -6.35, 0, -6.35], 1, 1);
    expect(out).toEqual([12.7, 6.35, MIN_DOT_PX, 6.35]);
  });

  it('scales WITH the zoom (world→screen factor)', () => {
    expect(dashMmToScreenPx([10, -5], 2, 1)).toEqual([20, 10]);
    expect(dashMmToScreenPx([10, -5], 0.5, 1)).toEqual([5, 2.5]);
  });

  it('applies the global LTSCALE multiplier on top of zoom', () => {
    expect(dashMmToScreenPx([10, -5], 2, 3)).toEqual([60, 30]);
  });

  it('applies CELTSCALE (per-object) on top of zoom × LTSCALE', () => {
    expect(dashMmToScreenPx([10, -5], 2, 3, 2)).toEqual([120, 60]);
  });

  it('defaults CELTSCALE to 1 when omitted', () => {
    expect(dashMmToScreenPx([10, -5], 2, 3)).toEqual(dashMmToScreenPx([10, -5], 2, 3, 1));
  });

  it('treats a degenerate CELTSCALE as solid', () => {
    expect(dashMmToScreenPx([10, -5], 2, 3, 0)).toEqual([]);
  });

  it('returns [] (solid fallback) for a degenerate scale', () => {
    expect(dashMmToScreenPx([10, -5], 0, 1)).toEqual([]);
    expect(dashMmToScreenPx([10, -5], -2, 1)).toEqual([]);
    expect(dashMmToScreenPx([10, -5], 1, 0)).toEqual([]);
    expect(dashMmToScreenPx([10, -5], Number.NaN, 1)).toEqual([]);
    expect(dashMmToScreenPx([10, -5], Number.POSITIVE_INFINITY, 1)).toEqual([]);
  });
});

describe('isSolidPattern', () => {
  it('is true only for an empty pattern', () => {
    expect(isSolidPattern([])).toBe(true);
    expect(isSolidPattern([12.7, -6.35])).toBe(false);
  });
});

describe('resolveLinetypePatternMm — catalog + registry SSoT (ADR-362)', () => {
  beforeEach(() => __resetLinetypeRegistryForTesting());

  it('resolves a built-in catalog name to its mm pattern', () => {
    expect(resolveLinetypePatternMm('Dashed')).toEqual([12.7, -6.35]);
  });

  it('resolves density variants + legacy enums via the aliases catalog', () => {
    expect(resolveLinetypePatternMm('DashedX2')).toEqual([25.4, -12.7]);
    expect(resolveLinetypePatternMm('dashed')).toEqual([12.7, -6.35]); // legacy enum
  });

  it('Continuous / ByLayer / unknown → [] (solid, no registry noise)', () => {
    expect(resolveLinetypePatternMm('Continuous')).toEqual([]);
    expect(resolveLinetypePatternMm('ByLayer')).toEqual([]);
    expect(resolveLinetypePatternMm('NopeNotReal')).toEqual([]);
    expect(resolveLinetypePatternMm(null)).toEqual([]);
  });

  it('falls back to a runtime user-created custom linetype', () => {
    registerUserLinetype('MyDots', [0, -3]);
    expect(resolveLinetypePatternMm('MyDots')).toEqual([0, -3]);
  });
});
