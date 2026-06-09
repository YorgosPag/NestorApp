/**
 * ADR-422 L7/L7.1 — tests για τον aggregator ετήσιας ενεργειακής ζήτησης (pure).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Worked example (ΤΟΤΕΕ 20701-3 degree-day + EN ISO 13790 gain utilisation):
 * χώρος 4×4 m (A=16 m²), H=(transmission 600 + ventilation 200)/ΔΤ 20 = 40 W/K, ζώνη Β
 * (HDD 1300, hours 3600, living-room q_int=6 W/m²):
 *   - **Μεικτή** (L7): Q_loss = 40·1300·24/1000 = 1248 kWh (κέρδη αμελημένα — zero-regression).
 *   - **Κέρδη** (L7.1): Q_int = 6·16·3600/1000 = 345.6 kWh · Q_sol = 0 (χωρίς υαλοπίνακα).
 *   - γ = 345.6/1248 = 0.2769 → η = 1/(1+γ) = 0.7831.
 *   - **Καθαρή**: Q_net = 1248 − 0.7831·345.6 = 977.3 kWh · q_net = 61.1 → κατηγορία Β+.
 * Επιβεβαιώνει επίσης: reheat ΕΞΑΙΡΕΙΤΑΙ, area από geometry, ηλιακά από εξωτ. υαλοπίνακες, guards, totals.
 */

import { createThermalSpace } from '@/services/factories/thermal-space.factory';
import {
  computeThermalSpaceGeometry,
  type ThermalSpaceEntity,
  type ThermalSpaceGeometry,
} from '../../../types/thermal-space-types';
import { deriveAnnualHeating } from '../derive-annual-energy';
import type { BoundaryHeatLoss, SpaceHeatLoadResult } from '../heat-load-types';

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

function boundary(over: Partial<BoundaryHeatLoss>): BoundaryHeatLoss {
  return {
    kind: 'window',
    condition: 'external-air',
    uValue: 2.5,
    area: 2,
    factor: 1,
    lossW: 0,
    thermalBridgeW: 0,
    ...over,
  };
}

function resultsOf(...results: SpaceHeatLoadResult[]): Map<string, SpaceHeatLoadResult> {
  return new Map(results.map((r) => [r.spaceId, r]));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('deriveAnnualHeating', () => {
  it('υπολογίζει μεικτή + καθαρή ζήτηση με αξιοποίηση κερδών (worked example, ζώνη Β)', () => {
    const space = makeSpace('sp-1');
    const result = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [space], 'B');

    expect(result.zone).toBe('B');
    expect(result.hdd).toBe(1300);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.lossCoefficientWperK).toBeCloseTo(40); // (600+200)/20
    expect(row.floorAreaM2).toBeCloseTo(16);
    expect(row.grossDemandKWh).toBeCloseTo(1248); // 40·1300·24/1000 (zero-regression vs L7)
    expect(row.internalGainKWh).toBeCloseTo(345.6); // 6·16·3600/1000
    expect(row.solarGainKWh).toBe(0); // χωρίς υαλοπίνακα
    expect(row.utilisation).toBeCloseTo(0.783114); // 1/(1+0.276923)
    expect(row.netDemandKWh).toBeCloseTo(977.349); // 1248 − η·345.6
    expect(row.annualDemandKWh).toBeCloseTo(977.349); // headline = καθαρή
    expect(row.specificDemandKWhM2).toBeCloseTo(61.084); // 977.349/16

    expect(result.totalAnnualKWh).toBeCloseTo(977.349);
    expect(result.totalGrossKWh).toBeCloseTo(1248);
    expect(result.totalInternalGainKWh).toBeCloseTo(345.6);
    expect(result.totalSolarGainKWh).toBe(0);
    expect(result.totalAreaM2).toBeCloseTo(16);
    expect(result.specificDemandKWhM2).toBeCloseTo(61.082);
    expect(result.energyClass).toBe('B+'); // 50 < 61.08 ≤ 70 → B+
  });

  it('η καθαρή ζήτηση είναι μικρότερη από τη μεικτή (κέρδη μειώνουν τη ζήτηση)', () => {
    const result = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [makeSpace('sp-1')], 'B');
    const row = result.rows[0];
    expect(row.netDemandKWh).toBeLessThan(row.grossDemandKWh);
  });

  it('προσθέτει ηλιακά κέρδη από εξωτ. υαλοπίνακες (window + external-air)', () => {
    const withWindow = makeResult('sp-1', { boundaries: [boundary({ area: 2 })] });
    const result = deriveAnnualHeating(resultsOf(withWindow), [makeSpace('sp-1')], 'B');
    // Q_sol = 2 · 0.6 · 0.7 · 0.9 · 300 = 226.8 kWh.
    expect(result.rows[0].solarGainKWh).toBeCloseTo(226.8);
    expect(result.rows[0].netDemandKWh).toBeCloseTo(855.58); // 1248 − η(γ=0.4587)·572.4
  });

  it('μετράει μόνο τους εξωτ. υαλοπίνακες στα ηλιακά κέρδη (φιλτράρει τοίχο/εσωτ.)', () => {
    const mixed = makeResult('sp-1', {
      boundaries: [
        boundary({ kind: 'window', condition: 'external-air', area: 2 }), // μετράει
        boundary({ kind: 'wall', condition: 'external-air', area: 12 }), // όχι (τοίχος)
        boundary({ kind: 'window', condition: 'adjacent-heated', area: 3 }), // όχι (εσωτ.)
      ],
    });
    const result = deriveAnnualHeating(resultsOf(mixed), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(226.8); // μόνο τα 2 m² εξωτ. υαλοπίνακα
  });

  it('ΕΞΑΙΡΕΙ το reheat από τον συντελεστή απωλειών (συνεχής vs επανέναρξη)', () => {
    const withReheat = makeResult('sp-1', { reheatW: 5000, totalW: 5800 });
    const result = deriveAnnualHeating(resultsOf(withReheat), [makeSpace('sp-1')], 'B');
    // Το reheat δεν μετράει στο H → η μεικτή παραμένει 1248 kWh.
    expect(result.rows[0].lossCoefficientWperK).toBeCloseTo(40);
    expect(result.rows[0].grossDemandKWh).toBeCloseTo(1248);
  });

  it('παίρνει το θερμαινόμενο εμβαδό από το geometry του χώρου', () => {
    const big = makeSpace('sp-1', { ...ZERO_GEOMETRY, area: 32 });
    const result = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [big], 'B');
    expect(result.rows[0].floorAreaM2).toBe(32);
    expect(result.rows[0].grossDemandKWh).toBeCloseTo(1248); // H ανεξάρτητο εμβαδού
    expect(result.rows[0].internalGainKWh).toBeCloseTo(691.2); // 6·32·3600/1000
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
    const result = deriveAnnualHeating(new Map(), [makeSpace('sp-1')], 'C');
    expect(result.rows).toHaveLength(0);
    expect(result.hdd).toBe(1800);
  });

  it('επιστρέφει μηδενική ζήτηση όταν ΔΤ ≤ 0 (guard: gross=0 ⇒ net=0)', () => {
    const noDelta = makeResult('sp-1', { deltaTC: 0 });
    const result = deriveAnnualHeating(resultsOf(noDelta), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].lossCoefficientWperK).toBe(0);
    expect(result.rows[0].grossDemandKWh).toBe(0);
    expect(result.rows[0].netDemandKWh).toBe(0); // max(0, 0 − η·gains)
    expect(result.rows[0].annualDemandKWh).toBe(0);
  });

  it('αθροίζει πολλούς χώρους και υπολογίζει συνολική ειδική καθαρή ζήτηση + κατηγορία', () => {
    const spaces = [makeSpace('sp-1'), makeSpace('sp-2')];
    const results = resultsOf(
      makeResult('sp-1'),
      makeResult('sp-2', { transmissionW: 1000, ventilationW: 200, totalW: 1200 }),
    );
    const result = deriveAnnualHeating(results, spaces, 'B');

    // sp-1: gross 1248, net 977.3 · sp-2: H=60 → gross 1872, γ=345.6/1872=0.1846,
    // η=0.8442, net=1872−0.8442·345.6=1580.3.
    expect(result.totalGrossKWh).toBeCloseTo(3120); // 1248 + 1872
    expect(result.totalAnnualKWh).toBeCloseTo(2557.61); // 977.3 + 1580.3
    expect(result.totalAreaM2).toBeCloseTo(32);
    expect(result.specificDemandKWhM2).toBeCloseTo(79.925); // 2557.61/32
    expect(result.energyClass).toBe('B'); // 70 < 79.9 ≤ 95
  });

  it('επιστρέφει κενό αποτέλεσμα για όροφο χωρίς χώρους', () => {
    const result = deriveAnnualHeating(new Map(), [], 'A');
    expect(result.rows).toHaveLength(0);
    expect(result.totalAnnualKWh).toBe(0);
    expect(result.totalGrossKWh).toBe(0);
    expect(result.totalAreaM2).toBe(0);
    expect(result.specificDemandKWhM2).toBe(0);
    expect(result.hdd).toBe(900);
  });
});
