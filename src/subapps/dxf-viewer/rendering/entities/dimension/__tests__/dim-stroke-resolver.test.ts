/**
 * ADR-562 Φ2 — dim per-part stroke resolver.
 *
 * Locks the reuse contract: lineweight (mm, sentinels) → px, and linetype name →
 * dash px via the ADR-510 Unified Linetype catalog. The sentinel/solid paths are
 * regression-critical — every built-in template is ByLayer, so they MUST still
 * resolve to the pre-ADR-562 1px solid stroke.
 */

import { resolveDimStroke, DIM_SENTINEL_STROKE_PX } from '../dim-stroke-resolver';

const SCALE = 1;

describe('resolveDimStroke — lineweight → px', () => {
  it('sentinels (-3 Default / -2 ByLayer / -1 ByBlock) → baseline 1px (no regression)', () => {
    for (const lw of [-3, -2, -1] as const) {
      expect(resolveDimStroke(lw, 'ByLayer', SCALE).lineWidthPx).toBe(DIM_SENTINEL_STROKE_PX);
    }
  });

  it('concrete mm → px via AutoCAD LWT formula (mm × 96 / 25.4)', () => {
    expect(resolveDimStroke(0.5, 'ByLayer', SCALE).lineWidthPx).toBeCloseTo((0.5 * 96) / 25.4, 5);
    expect(resolveDimStroke(1.0, 'ByLayer', SCALE).lineWidthPx).toBeCloseTo((1.0 * 96) / 25.4, 5);
  });
});

describe('resolveDimStroke — linetype → dash', () => {
  it('ByLayer / Continuous / unknown → solid [] (regression-critical)', () => {
    expect(resolveDimStroke(-2, 'ByLayer', SCALE).dashPx).toEqual([]);
    expect(resolveDimStroke(-2, 'Continuous', SCALE).dashPx).toEqual([]);
    expect(resolveDimStroke(-2, 'NotARealLinetype', SCALE).dashPx).toEqual([]);
  });

  it('a real dashed catalog name → non-empty dash array', () => {
    const dashed = resolveDimStroke(-2, 'Dashed', SCALE).dashPx;
    expect(dashed.length).toBeGreaterThan(0);
    expect(dashed.every((v) => v > 0)).toBe(true); // canvas wants all-positive px
  });
});

describe('resolveDimStroke — per-style DIMLTSCALE density (ADR-362 Path A)', () => {
  it('scales every dash segment by the ltScale (celtscale slot)', () => {
    const base = resolveDimStroke(-2, 'Dashed', SCALE).dashPx;
    const dense = resolveDimStroke(-2, 'Dashed', SCALE, 0.5).dashPx;
    const sparse = resolveDimStroke(-2, 'Dashed', SCALE, 2).dashPx;
    expect(dense).toEqual(base.map((v) => v * 0.5));
    expect(sparse).toEqual(base.map((v) => v * 2));
  });

  it('absent / non-positive ltScale falls back to 1 (no density change)', () => {
    const base = resolveDimStroke(-2, 'Dashed', SCALE).dashPx;
    expect(resolveDimStroke(-2, 'Dashed', SCALE, 1).dashPx).toEqual(base);
    expect(resolveDimStroke(-2, 'Dashed', SCALE, 0).dashPx).toEqual(base);
    expect(resolveDimStroke(-2, 'Dashed', SCALE, -3).dashPx).toEqual(base);
    expect(resolveDimStroke(-2, 'Dashed', SCALE, Number.NaN).dashPx).toEqual(base);
  });
});
