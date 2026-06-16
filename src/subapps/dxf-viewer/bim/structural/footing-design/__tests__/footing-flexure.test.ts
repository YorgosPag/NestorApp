/**
 * ADR-464 Slice 2 — flexure engine (EC2 §9.8.2) + padEccentricHogging diagnostic.
 *
 * Πιστοποιεί: (α) απαιτούμενο κάτω οπλισμό από ανοδική πίεση εδάφους (πρόβολος στην
 * παρειά κολώνας, As=M/(z·fyd)), (β) ενεργοποίηση hogging σε αποκόλληση (e>kern),
 * (γ) μηδέν hogging για κεντρικό φορτίο, (δ) τον runner `padEccentricHogging` warning.
 */

import { rebarFydMpa } from '../../rebar-catalog';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import { computeFootingFlexure } from '../footing-flexure';
import { runFootingDesignChecks } from '../footing-design-checks';
import type { FootingDesignInput } from '../footing-design-types';
import type { Entity } from '../../../types/entities';

function input(overrides: Partial<FootingDesignInput> = {}): FootingDesignInput {
  return {
    widthMm: 2000,
    lengthMm: 2000,
    thicknessMm: 500,
    columnWidthMm: 400,
    columnDepthMm: 400,
    serviceLoad: { axialKn: 800, momentXKnm: 0, momentYKnm: 0 },
    ulsLoad: { axialKn: 1080, momentXKnm: 0, momentYKnm: 0 },
    soilBearingCapacityKpa: 300,
    footingSelfWeightKn: 0,
    coverMm: 50,
    ...overrides,
  };
}

describe('computeFootingFlexure', () => {
  it('κεντρικό φορτίο → κάτω οπλισμός από πρόβολο, μηδέν hogging', () => {
    const f = computeFootingFlexure(input());
    // p = 1080/4 = 270 kPa· a = (2−0.4)/2 = 0.8m· M = 270·0.8²/2 = 86.4 kNm/m
    // d = 500−50 = 450· z = 405· fyd = 500/1.15· As = 86.4e6/(405·fyd)
    const expected = (86.4e6) / (405 * rebarFydMpa());
    expect(f.asBottomXMm2PerM).toBeCloseTo(expected, 0);
    expect(f.asBottomYMm2PerM).toBeCloseTo(expected, 0);
    expect(f.hoggingGoverns).toBe(false);
    expect(f.asTopMm2PerM).toBe(0);
  });

  it('μεγαλύτερος πρόβολος (μικρότερη κολώνα) → περισσότερος οπλισμός', () => {
    const small = computeFootingFlexure(input({ columnWidthMm: 200, columnDepthMm: 200 }));
    const big = computeFootingFlexure(input({ columnWidthMm: 800, columnDepthMm: 800 }));
    expect(small.asBottomXMm2PerM).toBeGreaterThan(big.asBottomXMm2PerM);
  });

  it('έκκεντρο φορτίο εκτός πυρήνα (ULS) → hogging governs + άνω οπλισμός > 0', () => {
    const f = computeFootingFlexure(input({ ulsLoad: { axialKn: 800, momentXKnm: 400, momentYKnm: 0 } }));
    // e_x = 400/800 = 0.5m· e/W = 0.25 > 1/6 → αποκόλληση
    expect(f.hoggingGoverns).toBe(true);
    expect(f.asTopMm2PerM).toBeGreaterThan(0);
    expect(f.eccentricityRatioX).toBeCloseTo(0.25, 3);
  });

  it('εκκεντρότητα εντός πυρήνα → καμία αποκόλληση, μηδέν hogging', () => {
    const f = computeFootingFlexure(input({ ulsLoad: { axialKn: 1080, momentXKnm: 100, momentYKnm: 0 } }));
    // e_x = 100/1080 ≈ 0.093m· e/W ≈ 0.046 < 1/6
    expect(f.hoggingGoverns).toBe(false);
    expect(f.asTopMm2PerM).toBe(0);
  });

  it('μηδενικό αξονικό → μηδέν οπλισμός, μηδέν hogging', () => {
    const f = computeFootingFlexure(input({ ulsLoad: { axialKn: 0, momentXKnm: 0, momentYKnm: 0 } }));
    expect(f.asBottomXMm2PerM).toBe(0);
    expect(f.hoggingGoverns).toBe(false);
  });
});

// ─── runFootingDesignChecks — padEccentricHogging warning ────────────────────

function padFooting(id: string, appliedLoad: Record<string, number>): Entity {
  return {
    id,
    type: 'foundation',
    params: {
      kind: 'pad',
      topElevationMm: -1000,
      thicknessMm: 500,
      width: 2000,
      length: 2000,
      position: { x: 0, y: 0, z: 0 },
      appliedLoad,
    },
    geometry: { volume: 2, footprint: { vertices: [] } },
  } as unknown as Entity;
}

describe('runFootingDesignChecks — padEccentricHogging', () => {
  it('έκκεντρο πέδιλο → warning padEccentricHogging', () => {
    const footing = padFooting('F1', { deadAxialKn: 800, liveAxialKn: 0, deadMomentXKnm: 400 });
    const diags = runFootingDesignChecks([footing], EUROCODE_PROVIDER, 600);
    const hogging = diags.find((d) => d.code === 'padEccentricHogging');
    expect(hogging).toBeDefined();
    expect(hogging?.severity).toBe('warning');
    expect(hogging?.primaryEntityId).toBe('F1');
  });

  it('κεντρικό επαρκές πέδιλο → κανένα εύρημα', () => {
    const footing = padFooting('F2', { deadAxialKn: 800, liveAxialKn: 0 });
    const diags = runFootingDesignChecks([footing], EUROCODE_PROVIDER, 600);
    expect(diags).toHaveLength(0);
  });

  it('χωρίς σ_allow → engine αδρανές (advisory)', () => {
    const footing = padFooting('F3', { deadAxialKn: 800, liveAxialKn: 0, deadMomentXKnm: 400 });
    expect(runFootingDesignChecks([footing], EUROCODE_PROVIDER, undefined)).toHaveLength(0);
  });
});
