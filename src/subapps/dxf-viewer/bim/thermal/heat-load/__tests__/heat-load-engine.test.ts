/**
 * ADR-422 L1 — tests για το heat-load engine (EN 12831 / ΤΟΤΕΕ 20701-1).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 */

import { computeSpaceHeatLoad } from '../heat-load-engine';
import {
  BOUNDARY_TEMPERATURE_FACTOR,
  AIR_VENTILATION_FACTOR,
  getBoundaryTemperatureFactor,
} from '../heat-load-config';
import type { HeatLoadBoundary, SpaceHeatLoadInput } from '../heat-load-types';

function input(overrides: Partial<SpaceHeatLoadInput> = {}): SpaceHeatLoadInput {
  return {
    spaceId: 'tsp-1',
    indoorTempC: 20,
    outdoorTempC: -5,
    airChangesPerHour: 0.75,
    volume: 50,
    floorArea: 20,
    boundaries: [],
    ...overrides,
  };
}

describe('heat-load-config b-factors', () => {
  it('external-air=1, ground=0.5, unheated=0.5, adjacent-heated=0', () => {
    expect(getBoundaryTemperatureFactor('external-air')).toBe(1);
    expect(getBoundaryTemperatureFactor('ground')).toBe(0.5);
    expect(getBoundaryTemperatureFactor('unheated')).toBe(0.5);
    expect(getBoundaryTemperatureFactor('adjacent-heated')).toBe(0);
    expect(AIR_VENTILATION_FACTOR).toBeCloseTo(0.34, 5);
  });
});

describe('computeSpaceHeatLoad — ΤΟΤΕΕ worked example', () => {
  // Ti=20, Te=-5 → ΔΤ=25K. Τοίχος 0.4·10·1·25=100· παράθυρο 2.8·2·1·25=140·
  // δάπεδο επί εδάφους 0.5·20·0.5·25=125 → Φ_T=365. Αερισμός 0.34·0.75·50·25=318.75.
  // Φ=683.75 W· ειδικό 683.75/20=34.1875 W/m².
  const boundaries: HeatLoadBoundary[] = [
    { kind: 'wall', condition: 'external-air', uValue: 0.4, area: 10 },
    { kind: 'window', condition: 'external-air', uValue: 2.8, area: 2 },
    { kind: 'floor', condition: 'ground', uValue: 0.5, area: 20 },
  ];

  it('ΔΤ = Ti − Te', () => {
    expect(computeSpaceHeatLoad(input({ boundaries })).deltaTC).toBe(25);
  });

  it('απώλειες αγωγής Σ U·A·b·ΔΤ', () => {
    expect(computeSpaceHeatLoad(input({ boundaries })).transmissionW).toBeCloseTo(365, 5);
  });

  it('απώλειες αερισμού 0.34·n·V·ΔΤ', () => {
    expect(computeSpaceHeatLoad(input({ boundaries })).ventilationW).toBeCloseTo(318.75, 5);
  });

  it('συνολικό Φ = αγωγή + αερισμός', () => {
    expect(computeSpaceHeatLoad(input({ boundaries })).totalW).toBeCloseTo(683.75, 5);
  });

  it('ειδικό φορτίο = Φ / εμβαδό δαπέδου', () => {
    expect(computeSpaceHeatLoad(input({ boundaries })).specificLoadWperM2).toBeCloseTo(34.1875, 4);
  });

  it('per-boundary breakdown με σωστό factor + loss', () => {
    const res = computeSpaceHeatLoad(input({ boundaries }));
    const floor = res.boundaries.find((b) => b.kind === 'floor')!;
    expect(floor.factor).toBe(BOUNDARY_TEMPERATURE_FACTOR.ground);
    expect(floor.lossW).toBeCloseTo(125, 5);
  });
});

describe('computeSpaceHeatLoad — edge cases', () => {
  const boundaries: HeatLoadBoundary[] = [
    { kind: 'wall', condition: 'external-air', uValue: 0.4, area: 10 },
  ];

  it('adjacent-heated (b=0) δεν συνεισφέρει', () => {
    const res = computeSpaceHeatLoad(
      input({ boundaries: [{ kind: 'wall', condition: 'adjacent-heated', uValue: 1.5, area: 12 }] }),
    );
    expect(res.transmissionW).toBe(0);
  });

  it('ΔΤ ≤ 0 (Ti ≤ Te) → μη-θετικό φορτίο', () => {
    const res = computeSpaceHeatLoad(
      input({
        indoorTempC: 18,
        outdoorTempC: 20,
        boundaries: [{ kind: 'wall', condition: 'external-air', uValue: 0.5, area: 10 }],
      }),
    );
    expect(res.deltaTC).toBe(-2);
    expect(res.totalW).toBeLessThan(0);
  });

  it('μηδενικό εμβαδό δαπέδου → ειδικό φορτίο 0 (όχι NaN/Infinity)', () => {
    const res = computeSpaceHeatLoad(input({ floorArea: 0, boundaries }));
    expect(res.specificLoadWperM2).toBe(0);
  });

  it('αγνοεί degenerate boundary (αρνητικό area / μη-πεπερασμένο U)', () => {
    const res = computeSpaceHeatLoad(
      input({
        airChangesPerHour: 0,
        boundaries: [
          { kind: 'wall', condition: 'external-air', uValue: 0.4, area: -5 },
          { kind: 'window', condition: 'external-air', uValue: Number.NaN, area: 2 },
        ],
      }),
    );
    expect(res.transmissionW).toBe(0);
    expect(res.ventilationW).toBe(0);
  });
});
