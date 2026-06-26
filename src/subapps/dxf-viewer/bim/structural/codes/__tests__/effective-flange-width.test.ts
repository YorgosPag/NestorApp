/**
 * ADR-534 Φ3b — T-beam effective flange width `b_eff` (EC2 §5.3.2.1) tests.
 */

import {
  computeEffectiveFlangeWidthMm,
  zeroMomentSpanFactor,
} from '../effective-flange-width';

describe('zeroMomentSpanFactor (EC2 Σχ. 5.2)', () => {
  it('simple span → 1.0·l', () => {
    expect(zeroMomentSpanFactor('simple')).toBe(1.0);
  });
  it('continuous / fixed → 0.7·l', () => {
    expect(zeroMomentSpanFactor('continuous')).toBe(0.7);
    expect(zeroMomentSpanFactor('fixed')).toBe(0.7);
  });
  it('cantilever → 2.0·l', () => {
    expect(zeroMomentSpanFactor('cantilever')).toBe(2.0);
  });
});

describe('computeEffectiveFlangeWidthMm (EC2 §5.3.2.1)', () => {
  // Web 300mm, span 6000mm, simple → l_0 = 6000mm, 0.2·l_0 = 1200mm per side.
  it('two-sided T-beam, unknown overhang → b_w + 2·(0.2·l_0)', () => {
    const bEff = computeEffectiveFlangeWidthMm({ webWidthMm: 300, spanMm: 6000, supportType: 'simple' });
    // 300 + 2·1200 = 2700
    expect(bEff).toBeCloseTo(2700, 6);
  });

  it('one-sided L-beam (perimeter) → b_w + 1·(0.2·l_0)', () => {
    const bEff = computeEffectiveFlangeWidthMm({
      webWidthMm: 300, spanMm: 6000, supportType: 'simple', flangeSides: 1,
    });
    // 300 + 1200 = 1500
    expect(bEff).toBeCloseTo(1500, 6);
  });

  it('continuous span shortens l_0 (0.7·l) → smaller flange', () => {
    const bEff = computeEffectiveFlangeWidthMm({ webWidthMm: 300, spanMm: 6000, supportType: 'continuous' });
    // l_0 = 4200; 0.2·l_0 = 840; 300 + 2·840 = 1980
    expect(bEff).toBeCloseTo(1980, 6);
  });

  it('known overhang governs when smaller than 0.2·l_0', () => {
    // b_i = 500 < 0.2·l_0 = 1200. b_eff,i = min(0.2·500 + 0.1·6000, 1200, 500)
    //                                      = min(100 + 600, 1200, 500) = 500.
    const bEff = computeEffectiveFlangeWidthMm({
      webWidthMm: 300, spanMm: 6000, supportType: 'simple', slabOverhangEachSideMm: 500,
    });
    expect(bEff).toBeCloseTo(300 + 2 * 500, 6);
  });

  it('known overhang: 0.2·b_i + 0.1·l_0 governs when below cap and below b_i', () => {
    // b_i = 4000 (large). 0.2·b_i + 0.1·l_0 = 800 + 600 = 1400 > cap 1200 → cap wins.
    const bEff = computeEffectiveFlangeWidthMm({
      webWidthMm: 300, spanMm: 6000, supportType: 'simple', slabOverhangEachSideMm: 4000,
    });
    expect(bEff).toBeCloseTo(300 + 2 * 1200, 6); // capped at 0.2·l_0
  });

  it('b_eff is always ≥ b_w', () => {
    const bEff = computeEffectiveFlangeWidthMm({
      webWidthMm: 400, spanMm: 6000, supportType: 'simple', slabOverhangEachSideMm: 0,
    });
    expect(bEff).toBe(400); // zero overhang both sides → web only
  });

  it('degenerate input → max(0, b_w)', () => {
    expect(computeEffectiveFlangeWidthMm({ webWidthMm: 300, spanMm: 0, supportType: 'simple' })).toBe(300);
    expect(computeEffectiveFlangeWidthMm({ webWidthMm: -5, spanMm: 6000, supportType: 'simple' })).toBe(0);
  });
});
