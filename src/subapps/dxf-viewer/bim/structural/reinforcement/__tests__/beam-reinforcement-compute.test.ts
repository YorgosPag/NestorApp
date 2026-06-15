/**
 * ADR-459 Phase 4a — beam reinforcement quantity compute.
 */

import {
  computeBeamReinforcementQuantities,
  formatBeamLongitudinalLabel,
  formatBeamStirrupsLabel,
} from '../beam-reinforcement-compute';
import type { BeamReinforcement } from '../beam-reinforcement-types';
import type { BeamSectionContext } from '../../codes/structural-code-types';

const ctx: BeamSectionContext = {
  widthMm: 250,
  depthMm: 500,
  spanMm: 5000,
  grossAreaMm2: 250 * 500,
  supportType: 'simple',
};

const reinf: BeamReinforcement = {
  bottom: { diameterMm: 16, count: 3 },
  top: { diameterMm: 14, count: 2 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, legs: 2 },
  coverMm: 30,
};

describe('computeBeamReinforcementQuantities', () => {
  const q = computeBeamReinforcementQuantities(ctx, reinf);

  it('bottom length = count·(span + lap) (lap = 50·Ø)', () => {
    // 3 × (5000 + 50·16) / 1000 = 3 × 5.8 = 17.4 m
    expect(q.bottomLengthM).toBeCloseTo(17.4, 3);
  });

  it('top length = count·(span + lap)', () => {
    // 2 × (5000 + 50·14) / 1000 = 2 × 5.7 = 11.4 m
    expect(q.topLengthM).toBeCloseTo(11.4, 3);
  });

  it('longitudinal totals = bottom + top', () => {
    expect(q.longitudinalLengthM).toBeCloseTo(28.8, 3);
    expect(q.longitudinalWeightKg).toBeCloseTo(q.bottomWeightKg + q.topWeightKg, 6);
  });

  it('produces a positive stirrup count + steel weight', () => {
    expect(q.stirrupCount).toBeGreaterThan(0);
    expect(q.stirrupSingleLengthM).toBeGreaterThan(0);
    expect(q.totalSteelWeightKg).toBeGreaterThan(0);
  });

  it('ratio ρ = As,bottom / (b·d), d = 0.9h', () => {
    // 3·π·8² / (250·450) = 603.19 / 112500 = 0.005362
    expect(q.ratio).toBeCloseTo(0.005362, 5);
  });

  it('cantilever has fewer critical zones than a simple beam', () => {
    const simple = computeBeamReinforcementQuantities(ctx, reinf).stirrupCount;
    const canti = computeBeamReinforcementQuantities({ ...ctx, supportType: 'cantilever' }, reinf).stirrupCount;
    expect(canti).toBeLessThanOrEqual(simple);
  });

  it('degenerate span → zero stirrups', () => {
    expect(computeBeamReinforcementQuantities({ ...ctx, spanMm: 0 }, reinf).stirrupCount).toBe(0);
  });

  it('labels', () => {
    expect(formatBeamLongitudinalLabel(reinf)).toBe('3Ø16 / 2Ø14');
    expect(formatBeamStirrupsLabel(reinf)).toBe('Ø8/100-200');
  });
});
