/**
 * ADR-422 L7 — tests για τον aggregator ετήσιας ενεργειακής ζήτησης (pure).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Worked example (ΤΟΤΕΕ 20701-3 degree-day): χώρος 4×4 m (A=16 m²),
 * H=(transmission 600 + ventilation 200)/ΔΤ 20 = 40 W/K, ζώνη Β (HDD 1300)
 * → Q=40·1300·24/1000 = 1248 kWh/έτος · q=1248/16 = 78 kWh/m²·έτος → κατηγορία Β.
 * Επιβεβαιώνει επίσης: το reheat ΕΞΑΙΡΕΙΤΑΙ, area από geometry, guards, totals.
 */

import { createThermalSpace } from '@/services/factories/thermal-space.factory';
import {
  computeThermalSpaceGeometry,
  type ThermalSpaceEntity,
  type ThermalSpaceGeometry,
} from '../../../types/thermal-space-types';
import { deriveAnnualHeating } from '../derive-annual-energy';
import type { SpaceHeatLoadResult } from '../heat-load-types';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeSpace(id: string, geometry?: ThermalSpaceGeometry): ThermalSpaceEntity {
  const params = {
    footprint: {
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
    },
    useType: 'living-room' as const,
    ceilingHeightMm: 3000,
    sceneUnits: 'm' as const,
  };
  return createThermalSpace({
    id,
    params,
    geometry: geometry ?? computeThermalSpaceGeometry(params),
    layerId: 'layer-0',
  });
}

const ZERO_GEOMETRY: ThermalSpaceGeometry = {
  bbox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
  area: 0,
  perimeter: 0,
  volume: 0,
};

function makeResult(
  spaceId: string,
  over: Partial<SpaceHeatLoadResult> = {},
): SpaceHeatLoadResult {
  return {
    spaceId,
    deltaTC: 20,
    transmissionW: 600,
    ventilationW: 200,
    thermalBridgeW: 0,
    reheatW: 0,
    totalW: 800,
    specificLoadWperM2: 50,
    boundaries: [],
    ...over,
  };
}

function resultsOf(...results: SpaceHeatLoadResult[]): Map<string, SpaceHeatLoadResult> {
  return new Map(results.map((r) => [r.spaceId, r]));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('deriveAnnualHeating', () => {
  it('υπολογίζει ζήτηση με τη μέθοδο βαθμοημερών (worked example, ζώνη Β)', () => {
    const space = makeSpace('sp-1');
    const result = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [space], 'B');

    expect(result.zone).toBe('B');
    expect(result.hdd).toBe(1300);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.lossCoefficientWperK).toBeCloseTo(40); // (600+200)/20
    expect(row.floorAreaM2).toBeCloseTo(16);
    expect(row.annualDemandKWh).toBeCloseTo(1248); // 40·1300·24/1000
    expect(row.specificDemandKWhM2).toBeCloseTo(78); // 1248/16

    expect(result.totalAnnualKWh).toBeCloseTo(1248);
    expect(result.totalAreaM2).toBeCloseTo(16);
    expect(result.specificDemandKWhM2).toBeCloseTo(78);
    expect(result.energyClass).toBe('B');
  });

  it('ΕΞΑΙΡΕΙ το reheat από τον συντελεστή απωλειών (συνεχής vs επανέναρξη)', () => {
    const space = makeSpace('sp-1');
    const withReheat = makeResult('sp-1', { reheatW: 5000, totalW: 5800 });
    const result = deriveAnnualHeating(resultsOf(withReheat), [space], 'B');
    // Το reheat δεν μετράει στο H → η ζήτηση παραμένει 1248 kWh.
    expect(result.rows[0].lossCoefficientWperK).toBeCloseTo(40);
    expect(result.rows[0].annualDemandKWh).toBeCloseTo(1248);
  });

  it('παίρνει το θερμαινόμενο εμβαδό από το geometry του χώρου', () => {
    const big = makeSpace('sp-1', { ...ZERO_GEOMETRY, area: 32 });
    const result = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [big], 'B');
    expect(result.rows[0].floorAreaM2).toBe(32);
    expect(result.rows[0].specificDemandKWhM2).toBeCloseTo(39); // 1248/32
  });

  it('παραλείπει χώρους με μη-θετικό εμβαδό (guard)', () => {
    const degenerate = makeSpace('sp-1', ZERO_GEOMETRY);
    const result = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [degenerate], 'B');
    expect(result.rows).toHaveLength(0);
    expect(result.totalAnnualKWh).toBe(0);
    expect(result.specificDemandKWhM2).toBe(0);
    expect(result.energyClass).toBe('A+'); // 0 ζήτηση → καλύτερη κατηγορία
  });

  it('παραλείπει χώρους χωρίς αντίστοιχο L1 result', () => {
    const space = makeSpace('sp-1');
    const result = deriveAnnualHeating(new Map(), [space], 'C');
    expect(result.rows).toHaveLength(0);
    expect(result.hdd).toBe(1800);
  });

  it('επιστρέφει μηδενική ζήτηση όταν ΔΤ ≤ 0 (guard)', () => {
    const space = makeSpace('sp-1');
    const noDelta = makeResult('sp-1', { deltaTC: 0 });
    const result = deriveAnnualHeating(resultsOf(noDelta), [space], 'B');
    expect(result.rows[0].lossCoefficientWperK).toBe(0);
    expect(result.rows[0].annualDemandKWh).toBe(0);
  });

  it('αθροίζει πολλούς χώρους και υπολογίζει συνολική ειδική ζήτηση + κατηγορία', () => {
    const spaces = [makeSpace('sp-1'), makeSpace('sp-2')];
    const results = resultsOf(
      makeResult('sp-1'),
      makeResult('sp-2', { transmissionW: 1000, ventilationW: 200, totalW: 1200 }),
    );
    const result = deriveAnnualHeating(results, spaces, 'B');

    // sp-1: H=40 → 1248 kWh · sp-2: H=(1000+200)/20=60 → 60·1300·24/1000=1872 kWh.
    expect(result.totalAnnualKWh).toBeCloseTo(3120); // 1248 + 1872
    expect(result.totalAreaM2).toBeCloseTo(32); // 16 + 16
    expect(result.specificDemandKWhM2).toBeCloseTo(97.5); // 3120/32
    expect(result.energyClass).toBe('C'); // 95 < 97.5 ≤ 120
  });

  it('επιστρέφει κενό αποτέλεσμα για όροφο χωρίς χώρους', () => {
    const result = deriveAnnualHeating(new Map(), [], 'A');
    expect(result.rows).toHaveLength(0);
    expect(result.totalAnnualKWh).toBe(0);
    expect(result.totalAreaM2).toBe(0);
    expect(result.specificDemandKWhM2).toBe(0);
    expect(result.hdd).toBe(900);
  });
});
