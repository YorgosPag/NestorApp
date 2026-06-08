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

describe('computeSpaceHeatLoad — L1.5 θερμογέφυρες (ΔU_TB)', () => {
  // ΔΤ=25. Τοίχος 0.4·10 + ΔU_TB 0.10 → (0.4+0.10)·10·1·25 = 125· TB μέρος 0.10·10·1·25 = 25.
  // Παράθυρο 2.8·2·1·25 = 140 (ΔΕΝ παίρνει TB — αδιαφανή μόνο). Δάπεδο ground 0.5·20·0.5·25 = 125
  //   + ΔU_TB 0.10·20·0.5·25 = 25 → 150. Σύνολο TB = 25 (wall) + 25 (floor) = 50.
  const boundaries: HeatLoadBoundary[] = [
    { kind: 'wall', condition: 'external-air', uValue: 0.4, area: 10 },
    { kind: 'window', condition: 'external-air', uValue: 2.8, area: 2 },
    { kind: 'floor', condition: 'ground', uValue: 0.5, area: 20 },
  ];

  it('U_corr = U + ΔU_TB σε αδιαφανή στοιχεία προς έξω/έδαφος', () => {
    const res = computeSpaceHeatLoad(input({ boundaries, thermalBridgeSurchargeWperM2K: 0.1 }));
    const wall = res.boundaries.find((b) => b.kind === 'wall')!;
    const floor = res.boundaries.find((b) => b.kind === 'floor')!;
    expect(wall.lossW).toBeCloseTo(125, 5);
    expect(wall.thermalBridgeW).toBeCloseTo(25, 5);
    expect(floor.lossW).toBeCloseTo(150, 5);
    expect(floor.thermalBridgeW).toBeCloseTo(25, 5);
  });

  it('παράθυρα/πόρτες ΔΕΝ παίρνουν θερμογέφυρα (frame TB ήδη στο U_w)', () => {
    const res = computeSpaceHeatLoad(input({ boundaries, thermalBridgeSurchargeWperM2K: 0.1 }));
    const win = res.boundaries.find((b) => b.kind === 'window')!;
    expect(win.lossW).toBeCloseTo(140, 5);
    expect(win.thermalBridgeW).toBe(0);
  });

  it('adjacent-heated / unheated ΔΕΝ παίρνουν θερμογέφυρα (μόνο external/ground)', () => {
    const res = computeSpaceHeatLoad(
      input({
        boundaries: [
          { kind: 'wall', condition: 'adjacent-heated', uValue: 1.5, area: 12 },
          { kind: 'wall', condition: 'unheated', uValue: 1.0, area: 8 },
        ],
        thermalBridgeSurchargeWperM2K: 0.15,
      }),
    );
    expect(res.thermalBridgeW).toBe(0);
  });

  it('αθροιστικό thermalBridgeW στο result (υποσύνολο του transmissionW)', () => {
    const res = computeSpaceHeatLoad(input({ boundaries, thermalBridgeSurchargeWperM2K: 0.1 }));
    expect(res.thermalBridgeW).toBeCloseTo(50, 5);
    expect(res.thermalBridgeW).toBeLessThan(res.transmissionW);
  });
});

describe('computeSpaceHeatLoad — L1.5 επανέναρξη (Φ_RH)', () => {
  it('Φ_RH = A_floor · f_RH προστίθεται στο totalW', () => {
    // floorArea=20, f_RH=11 → reheatW=220. Χωρίς boundaries: total = vent + reheat.
    const res = computeSpaceHeatLoad(input({ floorArea: 20, reheatFactorWperM2: 11 }));
    expect(res.reheatW).toBeCloseTo(220, 5);
    expect(res.totalW).toBeCloseTo(res.transmissionW + res.ventilationW + 220, 5);
  });

  it('μηδενικό εμβαδό δαπέδου → reheatW 0 (όχι NaN)', () => {
    const res = computeSpaceHeatLoad(input({ floorArea: 0, reheatFactorWperM2: 22 }));
    expect(res.reheatW).toBe(0);
  });
});

describe('computeSpaceHeatLoad — L1.5 zero-regression', () => {
  const boundaries: HeatLoadBoundary[] = [
    { kind: 'wall', condition: 'external-air', uValue: 0.4, area: 10 },
    { kind: 'floor', condition: 'ground', uValue: 0.5, area: 20 },
  ];

  it('απουσία πεδίων TB/reheat ⇒ ίδιο με ΔU_TB=0 + f_RH=0', () => {
    const bare = computeSpaceHeatLoad(input({ boundaries }));
    const zeroed = computeSpaceHeatLoad(
      input({ boundaries, thermalBridgeSurchargeWperM2K: 0, reheatFactorWperM2: 0 }),
    );
    expect(bare.totalW).toBeCloseTo(zeroed.totalW, 9);
    expect(bare.thermalBridgeW).toBe(0);
    expect(bare.reheatW).toBe(0);
    expect(zeroed.thermalBridgeW).toBe(0);
    expect(zeroed.reheatW).toBe(0);
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
