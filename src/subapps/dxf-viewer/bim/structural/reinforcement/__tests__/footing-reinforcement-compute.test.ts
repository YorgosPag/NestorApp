/**
 * ADR-459 Phase 4b — footing reinforcement quantity compute (pad/strip/tie-beam).
 */

import {
  computeFootingReinforcementQuantities,
  formatFootingMainLabel,
} from '../footing-reinforcement-compute';
import { formatMeshLabel } from '../footing-reinforcement-types';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from '../footing-reinforcement-types';
import type {
  PadSectionContext,
  StripSectionContext,
  TieBeamSectionContext,
} from '../../codes/structural-code-types';

describe('computeFootingReinforcementQuantities — pad', () => {
  const ctx: PadSectionContext = {
    kind: 'pad',
    widthMm: 1500,
    lengthMm: 1500,
    thicknessMm: 500,
    grossAreaMm2: 1500 * 1500,
  };
  const r: PadReinforcement = {
    kind: 'pad',
    bottomMeshX: { diameterMm: 12, spacingMm: 200 },
    bottomMeshY: { diameterMm: 12, spacingMm: 200 },
    coverMm: 50,
  };
  const q = computeFootingReinforcementQuantities(ctx, r);

  it('main length = 2 διευθύνσεις × (count·(span−2cover+2·12Ø))', () => {
    // count = floor(1500/200)+1 = 8· single = (1500−100)+2·12·12 = 1688mm
    // ανά διεύθυνση 8·1.688 = 13.504 m· σύνολο 27.008 m
    expect(q.mainLengthM).toBeCloseTo(27.008, 3);
  });

  it('ρ = As(Ø)/(spacing·dEff), dEff = thickness−cover', () => {
    // π/4·12² / (200·450) = 113.097 / 90000 = 0.0012566
    expect(q.ratio).toBeCloseTo(0.0012566, 6);
  });

  it('pad δεν έχει συνδετήρες· βάρος > 0', () => {
    expect(q.stirrupCount).toBe(0);
    expect(q.secondaryLengthM).toBe(0);
    expect(q.mainWeightKg).toBeGreaterThan(0);
    expect(q.totalSteelWeightKg).toBeCloseTo(q.mainWeightKg, 6);
  });

  it('optional άνω σχάρα → secondary > 0', () => {
    const withTop = computeFootingReinforcementQuantities(ctx, {
      ...r,
      topMesh: { diameterMm: 10, spacingMm: 200 },
    });
    expect(withTop.secondaryLengthM).toBeGreaterThan(0);
    expect(withTop.totalSteelWeightKg).toBeGreaterThan(q.totalSteelWeightKg);
  });
});

describe('computeFootingReinforcementQuantities — strip', () => {
  const ctx: StripSectionContext = {
    kind: 'strip',
    widthMm: 600,
    thicknessMm: 400,
    spanMm: 4000,
  };
  const r: StripReinforcement = {
    kind: 'strip',
    transverse: { diameterMm: 12, spacingMm: 200 },
    longitudinal: { diameterMm: 12, count: 4 },
    coverMm: 50,
  };
  const q = computeFootingReinforcementQuantities(ctx, r);

  it('main (εγκάρσιες) = count·(width−2cover+2·12Ø)', () => {
    // count = floor(4000/200)+1 = 21· single = (600−100)+288 = 788mm → 16.548 m
    expect(q.mainLengthM).toBeCloseTo(16.548, 3);
  });

  it('secondary (διαμήκεις διανομής) = count·(span + 50·Ø)', () => {
    // 4 × (4000 + 50·12) / 1000 = 4 × 4.6 = 18.4 m
    expect(q.secondaryLengthM).toBeCloseTo(18.4, 3);
  });

  it('χωρίς συνδετήρες → stirrupCount 0· βάρος αθροίζει', () => {
    expect(q.stirrupCount).toBe(0);
    expect(q.totalSteelWeightKg).toBeCloseTo(q.mainWeightKg + q.secondaryWeightKg, 6);
  });

  it('με συνδετήρες → θετικό πλήθος + βάρος', () => {
    const withStirrups = computeFootingReinforcementQuantities(ctx, {
      ...r,
      stirrups: { diameterMm: 8, spacingMm: 250 },
    });
    expect(withStirrups.stirrupCount).toBeGreaterThan(0);
    expect(withStirrups.stirrupWeightKg).toBeGreaterThan(0);
  });
});

describe('computeFootingReinforcementQuantities — tie-beam (delegate σε beam compute)', () => {
  const ctx: TieBeamSectionContext = {
    kind: 'tie-beam',
    widthMm: 250,
    depthMm: 500,
    spanMm: 5000,
    grossAreaMm2: 250 * 500,
    supportType: 'simple',
  };
  const r: TieBeamReinforcement = {
    kind: 'tie-beam',
    bottom: { diameterMm: 16, count: 3 },
    top: { diameterMm: 14, count: 2 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, legs: 2 },
    coverMm: 30,
  };
  const q = computeFootingReinforcementQuantities(ctx, r);

  it('main = beam bottom length (3·(5000+50·16)) = 17.4 m', () => {
    expect(q.mainLengthM).toBeCloseTo(17.4, 3);
  });

  it('secondary = beam top length (2·(5000+50·14)) = 11.4 m', () => {
    expect(q.secondaryLengthM).toBeCloseTo(11.4, 3);
  });

  it('συνδετήρες + βάρος > 0', () => {
    expect(q.stirrupCount).toBeGreaterThan(0);
    expect(q.totalSteelWeightKg).toBeGreaterThan(0);
  });
});

describe('footing reinforcement labels + kind mismatch guard', () => {
  it('formatMeshLabel + formatFootingMainLabel', () => {
    expect(formatMeshLabel({ diameterMm: 12, spacingMm: 200 })).toBe('Ø12/200');
    expect(
      formatFootingMainLabel({
        kind: 'pad',
        bottomMeshX: { diameterMm: 12, spacingMm: 175 },
        bottomMeshY: { diameterMm: 12, spacingMm: 175 },
        coverMm: 50,
      }),
    ).toBe('Ø12/175');
  });

  it('ασύμβατο kind ctx vs reinforcement → throw', () => {
    const padCtx: PadSectionContext = {
      kind: 'pad', widthMm: 1500, lengthMm: 1500, thicknessMm: 500, grossAreaMm2: 2_250_000,
    };
    const stripR: StripReinforcement = {
      kind: 'strip',
      transverse: { diameterMm: 12, spacingMm: 200 },
      longitudinal: { diameterMm: 12, count: 4 },
      coverMm: 50,
    };
    expect(() => computeFootingReinforcementQuantities(padCtx, stripR)).toThrow();
  });
});
