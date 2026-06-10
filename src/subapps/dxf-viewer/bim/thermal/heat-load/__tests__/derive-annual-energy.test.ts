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
  type ThermalSpaceParams,
} from '../../../types/thermal-space-types';
import { deriveAnnualHeating } from '../derive-annual-energy';
import {
  EXTERNAL_RADIATIVE_COEFFICIENT_H_R,
  EXTERNAL_SURFACE_RESISTANCE_R_SE,
  SKY_TEMP_DIFFERENCE_DELTA_THETA_ER,
  THERMAL_MASS_LEVELS,
  computeGainUtilisation,
  computeNumericParam,
  computeTimeConstantHours,
  getHeatingSeasonHours,
  getSkyViewFactor,
  getThermalMassCapacity,
} from '../annual-gains-config';
import type { BoundaryHeatLoss, SpaceHeatLoadResult } from '../heat-load-types';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeSpace(
  id: string,
  geometry?: ThermalSpaceGeometry,
  paramsOver: Partial<
    Pick<
      ThermalSpaceParams,
      'solarShadingLevel' | 'thermalMassLevel' | 'horizonShadingLevel' | 'finShadingLevel'
    >
  > = {},
): ThermalSpaceEntity {
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
    ...paramsOver,
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
    infiltrationW: 0,
    designedVentilationW: 200,
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
    // L7.8-B: το εξωτ. παράθυρο (U=2.5) χάνει long-wave 19.8 kWh → gains 552.6 (όχι 572.4).
    expect(result.rows[0].netDemandKWh).toBeCloseTo(864.99); // 1248 − η(γ=0.4428)·552.6
  });

  it('L7.2 — νότιος υαλοπίνακας κερδίζει περισσότερο από βόρειο (ίδιο εμβαδό)', () => {
    // GLAZING_OPTICAL = 0.6·0.7·0.9 = 0.378· ζώνη Β: I_S=510, I_N=120.
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const north = makeResult('sp-2', { boundaries: [boundary({ area: 2, azimuthDeg: 0 })] });
    const rs = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B').rows[0];
    const rn = deriveAnnualHeating(resultsOf(north), [makeSpace('sp-2')], 'B').rows[0];
    expect(rs.solarGainKWh).toBeCloseTo(385.56); // 2·0.378·510
    expect(rn.solarGainKWh).toBeCloseTo(90.72); // 2·0.378·120
    expect(rs.solarGainKWh).toBeGreaterThan(rn.solarGainKWh);
  });

  it('L7.2 — fallback χωρίς azimuthDeg == orientation-agnostic μέση (zero-regression L7.1)', () => {
    const noAzimuth = makeResult('sp-1', { boundaries: [boundary({ area: 2 })] });
    const result = deriveAnnualHeating(resultsOf(noAzimuth), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(226.8); // 2·0.378·300 (μέση)
  });

  it('L7.2 — αθροίζει per-window διαφορετικούς προσανατολισμούς', () => {
    const mixed = makeResult('sp-1', {
      boundaries: [
        boundary({ area: 2, azimuthDeg: 180 }), // νότιος → 385.56
        boundary({ area: 2, azimuthDeg: 0 }), // βόρειος → 90.72
      ],
    });
    const result = deriveAnnualHeating(resultsOf(mixed), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(476.28); // 385.56 + 90.72
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

  // ─── L7.3 — σκίαση εξωτ. εμποδίων (per-space obstruction factor) ───────────────

  it('L7.3 — απουσία solarShadingLevel == L7.2 (obstruction 1.0, zero-regression)', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const result = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56); // 2·0.378·510 (αμετάβλητο)
  });

  it('L7.3 — heavy σκίαση μειώνει τα ηλιακά κέρδη κατά τον λόγο obstruction (0.5)', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const shaded = makeSpace('sp-1', undefined, { solarShadingLevel: 'heavy' });
    const result = deriveAnnualHeating(resultsOf(south), [shaded], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(192.78); // 385.56 · 0.5
  });

  it('L7.3 — moderate σκίαση εφαρμόζει τον ενδιάμεσο πολλαπλασιαστή (0.7)', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const shaded = makeSpace('sp-1', undefined, { solarShadingLevel: 'moderate' });
    const result = deriveAnnualHeating(resultsOf(south), [shaded], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(269.892); // 385.56 · 0.7
  });

  it('L7.3 — περισσότερη σκίαση → λιγότερα κέρδη → μεγαλύτερη καθαρή ζήτηση', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const free = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B').rows[0];
    const heavy = deriveAnnualHeating(
      resultsOf(south),
      [makeSpace('sp-1', undefined, { solarShadingLevel: 'heavy' })],
      'B',
    ).rows[0];
    expect(heavy.solarGainKWh).toBeLessThan(free.solarGainKWh);
    expect(heavy.netDemandKWh).toBeGreaterThan(free.netDemandKWh);
  });

  // ─── L7.3 Slice B — geometry-derived overhang shading (per-window F_ov) ────────

  it('Slice B — απουσία overhangShadingFactor == L7.3 v1 (×1, zero-regression)', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const result = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56); // 2·0.378·510 (αμετάβλητο)
  });

  it('Slice B — overhangShadingFactor=0.5 μειώνει τα ηλιακά κατά τον λόγο (μισό)', () => {
    const south = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, overhangShadingFactor: 0.5 })],
    });
    const result = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(192.78); // 385.56 · 0.5
  });

  it('Slice B — geometry F_ov ΠΟΛΛΑΠΛΑΣΙΑΖΕΤΑΙ με το manual obstruction (0.5 × 0.5 = 0.25)', () => {
    const south = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, overhangShadingFactor: 0.5 })],
    });
    const heavy = makeSpace('sp-1', undefined, { solarShadingLevel: 'heavy' }); // obstruction 0.5
    const result = deriveAnnualHeating(resultsOf(south), [heavy], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(96.39); // 385.56 · 0.5 · 0.5
  });

  it('Slice B — βαθύτερος πρόβολος (μικρότερο F_ov) → λιγότερα κέρδη → μεγαλύτερη ζήτηση', () => {
    const shallow = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, overhangShadingFactor: 0.85 })],
    });
    const deep = makeResult('sp-2', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, overhangShadingFactor: 0.55 })],
    });
    const rs = deriveAnnualHeating(resultsOf(shallow), [makeSpace('sp-1')], 'B').rows[0];
    const rd = deriveAnnualHeating(resultsOf(deep), [makeSpace('sp-2')], 'B').rows[0];
    expect(rd.solarGainKWh).toBeLessThan(rs.solarGainKWh);
    expect(rd.netDemandKWh).toBeGreaterThan(rs.netDemandKWh);
  });

  // ─── L7.3 Slice C — ορίζοντας (F_hor) + πλευρικά πτερύγια (F_fin) ──────────────

  it('Slice C — απουσία horizon/fin levels == L7.3 (×1, zero-regression)', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const result = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56); // 2·0.378·510 (αμετάβλητο)
  });

  it('Slice C — horizon=high σε νότιο μειώνει τα ηλιακά κατά F_hor(high,S)=0.70', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const shaded = makeSpace('sp-1', undefined, { horizonShadingLevel: 'high' });
    const result = deriveAnnualHeating(resultsOf(south), [shaded], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56 * 0.7); // 269.892
  });

  it('Slice C — fin=heavy σε ανατολικό μειώνει περισσότερο από νότιο (πλάγιος ήλιος)', () => {
    const east = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 90 })] });
    const south = makeResult('sp-2', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const finnedE = makeSpace('sp-1', undefined, { finShadingLevel: 'heavy' });
    const finnedS = makeSpace('sp-2', undefined, { finShadingLevel: 'heavy' });
    const re = deriveAnnualHeating(resultsOf(east), [finnedE], 'B').rows[0];
    const rs = deriveAnnualHeating(resultsOf(south), [finnedS], 'B').rows[0];
    // ανατολή: I_E=285·0.378·2=215.46 ×0.62=133.585· νότος: 385.56 ×0.78=300.737
    expect(re.solarGainKWh).toBeCloseTo(2 * 0.378 * 285 * 0.62); // 133.585
    expect(rs.solarGainKWh).toBeCloseTo(385.56 * 0.78); // 300.737
    // ο fin κόβει μεγαλύτερο ΠΟΣΟΣΤΟ στην ανατολή (0.62) από τον νότο (0.78)
    expect(0.62).toBeLessThan(0.78);
  });

  it('Slice C — horizon × fin × obstruction × F_ov πολλαπλασιάζονται μαζί', () => {
    const south = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, overhangShadingFactor: 0.5 })],
    });
    const space = makeSpace('sp-1', undefined, {
      solarShadingLevel: 'heavy', // obstruction 0.5
      horizonShadingLevel: 'high', // F_hor(S)=0.70
      finShadingLevel: 'moderate', // F_fin(S)=0.88
    });
    const result = deriveAnnualHeating(resultsOf(south), [space], 'B');
    // 385.56 · 0.5(obstr) · 0.5(F_ov) · 0.70(F_hor) · 0.88(F_fin)
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56 * 0.5 * 0.5 * 0.7 * 0.88); // 59.376
  });

  it('Slice C — περισσότερη σκίαση ορίζοντα/πτερυγίων → μεγαλύτερη καθαρή ζήτηση', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const free = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B').rows[0];
    const shaded = deriveAnnualHeating(
      resultsOf(south),
      [makeSpace('sp-1', undefined, { horizonShadingLevel: 'high', finShadingLevel: 'heavy' })],
      'B',
    ).rows[0];
    expect(shaded.solarGainKWh).toBeLessThan(free.solarGainKWh);
    expect(shaded.netDemandKWh).toBeGreaterThan(free.netDemandKWh);
  });

  it('Slice C — fallback χωρίς azimuthDeg → orientation-agnostic μέσος F_hor/F_fin', () => {
    const noAzimuth = makeResult('sp-1', { boundaries: [boundary({ area: 2 })] });
    const shaded = makeSpace('sp-1', undefined, { horizonShadingLevel: 'medium' });
    const result = deriveAnnualHeating(resultsOf(noAzimuth), [shaded], 'B');
    // μέση I=300· F_hor(medium) agnostic μέσος = (0.98+0.96·2+0.93·2+0.89·2+0.86)/8
    const meanHor = (0.98 + 0.96 * 2 + 0.93 * 2 + 0.89 * 2 + 0.86) / 8;
    expect(result.rows[0].solarGainKWh).toBeCloseTo(2 * 0.378 * 300 * meanHor);
  });

  // ─── L7.3 Slice D — geometry-derived πλευρικό πτερύγιο (per-window F_fin) ───────

  it('Slice D — απουσία finShadingFactor == manual level (Slice C, zero-regression)', () => {
    // νότιο, manual finShadingLevel=heavy (F_fin S=0.78), ΧΩΡΙΣ per-window geometry.
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const space = makeSpace('sp-1', undefined, { finShadingLevel: 'heavy' });
    const result = deriveAnnualHeating(resultsOf(south), [space], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56 * 0.78); // 300.737 — αμετάβλητο
  });

  it('Slice D — per-window finShadingFactor ΥΠΕΡΙΣΧΥΕΙ του manual level (precedence)', () => {
    // geometry F_fin=0.5 πρέπει να αντικαταστήσει το manual heavy (0.78), ΟΧΙ να πολλαπλασιαστεί.
    const south = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, finShadingFactor: 0.5 })],
    });
    const space = makeSpace('sp-1', undefined, { finShadingLevel: 'heavy' });
    const result = deriveAnnualHeating(resultsOf(south), [space], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56 * 0.5); // 192.78 (0.5, ΟΧΙ 0.5·0.78)
  });

  it('Slice D — μικρότερο geometry F_fin → λιγότερα ηλιακά → μεγαλύτερη καθαρή ζήτηση', () => {
    const mild = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, finShadingFactor: 0.9 })],
    });
    const deep = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, finShadingFactor: 0.5 })],
    });
    const rm = deriveAnnualHeating(resultsOf(mild), [makeSpace('sp-1')], 'B').rows[0];
    const rd = deriveAnnualHeating(resultsOf(deep), [makeSpace('sp-1')], 'B').rows[0];
    expect(rd.solarGainKWh).toBeLessThan(rm.solarGainKWh);
    expect(rd.netDemandKWh).toBeGreaterThan(rm.netDemandKWh);
  });

  it('Slice D — geometry F_fin συνδυάζεται με obstruction/F_hor/F_ov (όχι με manual fin)', () => {
    const south = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, overhangShadingFactor: 0.5, finShadingFactor: 0.6 })],
    });
    const space = makeSpace('sp-1', undefined, {
      solarShadingLevel: 'heavy', // obstruction 0.5
      horizonShadingLevel: 'high', // F_hor(S)=0.70
      finShadingLevel: 'heavy', // αγνοείται (geometry υπερισχύει)
    });
    const result = deriveAnnualHeating(resultsOf(south), [space], 'B');
    // 385.56 · 0.5(obstr) · 0.5(F_ov) · 0.70(F_hor) · 0.6(geometry F_fin) — ΟΧΙ ×0.78
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56 * 0.5 * 0.5 * 0.7 * 0.6); // 40.4838
  });

  // ─── L7.3 Slice E — geometry-derived ορίζοντας (per-window F_hor) ──────────────

  it('Slice E — απουσία horizonShadingFactor == manual level (Slice C, zero-regression)', () => {
    // νότιο, manual horizonShadingLevel=high (F_hor S=0.70), ΧΩΡΙΣ per-window geometry.
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const space = makeSpace('sp-1', undefined, { horizonShadingLevel: 'high' });
    const result = deriveAnnualHeating(resultsOf(south), [space], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56 * 0.7); // 269.892 — αμετάβλητο
  });

  it('Slice E — per-window horizonShadingFactor ΥΠΕΡΙΣΧΥΕΙ του manual level (precedence)', () => {
    // geometry F_hor=0.5 αντικαθιστά το manual high (0.70), ΟΧΙ να πολλαπλασιαστεί.
    const south = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, horizonShadingFactor: 0.5 })],
    });
    const space = makeSpace('sp-1', undefined, { horizonShadingLevel: 'high' });
    const result = deriveAnnualHeating(resultsOf(south), [space], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56 * 0.5); // 192.78 (0.5, ΟΧΙ 0.5·0.70)
  });

  it('Slice E — μικρότερο geometry F_hor → λιγότερα ηλιακά → μεγαλύτερη καθαρή ζήτηση', () => {
    const mild = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, horizonShadingFactor: 0.9 })],
    });
    const heavy = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, horizonShadingFactor: 0.5 })],
    });
    const rm = deriveAnnualHeating(resultsOf(mild), [makeSpace('sp-1')], 'B').rows[0];
    const rh = deriveAnnualHeating(resultsOf(heavy), [makeSpace('sp-1')], 'B').rows[0];
    expect(rh.solarGainKWh).toBeLessThan(rm.solarGainKWh);
    expect(rh.netDemandKWh).toBeGreaterThan(rm.netDemandKWh);
  });

  it('Slice E — geometry F_hor συνδυάζεται με obstruction/F_ov/F_fin (όχι με manual horizon)', () => {
    const south = makeResult('sp-1', {
      boundaries: [
        boundary({
          area: 2,
          azimuthDeg: 180,
          overhangShadingFactor: 0.5,
          finShadingFactor: 0.6,
          horizonShadingFactor: 0.8,
        }),
      ],
    });
    const space = makeSpace('sp-1', undefined, {
      solarShadingLevel: 'heavy', // obstruction 0.5
      horizonShadingLevel: 'high', // αγνοείται (geometry υπερισχύει)
      finShadingLevel: 'heavy', // αγνοείται (geometry υπερισχύει)
    });
    const result = deriveAnnualHeating(resultsOf(south), [space], 'B');
    // 385.56 · 0.5(obstr) · 0.5(F_ov) · 0.8(geometry F_hor) · 0.6(geometry F_fin) — ΟΧΙ ×0.70
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56 * 0.5 * 0.5 * 0.8 * 0.6); // 46.2672
  });

  // ─── L7.4 — per-window g-value (SHGC) ανά τύπο υαλοπίνακα ──────────────────────

  it('L7.4 — απουσία solarFactorG == διπλό g=0.60 (zero-regression)', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const result = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56); // 2·0.60·0.63·510 (αμετάβλητο)
  });

  it('L7.4 — μονός υαλοπίνακας (g=0.80) κερδίζει περισσότερη ηλιακή', () => {
    const single = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, solarFactorG: 0.8 })],
    });
    const result = deriveAnnualHeating(resultsOf(single), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(514.08); // 385.56 · 0.80/0.60
  });

  it('L7.4 — τριπλός/low-E υαλοπίνακας (g=0.50) κερδίζει λιγότερη ηλιακή', () => {
    const triple = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, solarFactorG: 0.5 })],
    });
    const result = deriveAnnualHeating(resultsOf(triple), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(321.3); // 385.56 · 0.50/0.60
  });

  it('L7.4 — g × obstruction × F_ov πολλαπλασιάζονται μαζί', () => {
    const win = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, solarFactorG: 0.8, overhangShadingFactor: 0.5 })],
    });
    const heavy = makeSpace('sp-1', undefined, { solarShadingLevel: 'heavy' }); // obstruction 0.5
    const result = deriveAnnualHeating(resultsOf(win), [heavy], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(128.52); // 2·0.80·0.63·510·0.5·0.5
  });

  it('L7.4 — μεγαλύτερο g → περισσότερα κέρδη → μικρότερη καθαρή ζήτηση', () => {
    const single = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, solarFactorG: 0.8 })],
    });
    const triple = makeResult('sp-2', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, solarFactorG: 0.5 })],
    });
    const rs = deriveAnnualHeating(resultsOf(single), [makeSpace('sp-1')], 'B').rows[0];
    const rt = deriveAnnualHeating(resultsOf(triple), [makeSpace('sp-2')], 'B').rows[0];
    expect(rs.solarGainKWh).toBeGreaterThan(rt.solarGainKWh);
    expect(rs.netDemandKWh).toBeLessThan(rt.netDemandKWh);
  });

  // ─── L7.5 — per-window γεωμετρικός συντελεστής πλαισίου F_F ────────────────────

  it('L7.5 — απουσία frameFactorF == σταθερό F_F=0.70 (zero-regression)', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const result = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56); // 2·0.6·0.70·0.9·510 (αμετάβλητο)
  });

  it('L7.5 — λεπτή κάσα (F_F=0.84) κερδίζει περισσότερη ηλιακή', () => {
    const thinFrame = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, frameFactorF: 0.84 })],
    });
    const result = deriveAnnualHeating(resultsOf(thinFrame), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(462.672); // 385.56 · 0.84/0.70
  });

  it('L7.5 — φαρδιά κάσα (F_F=0.60) κερδίζει λιγότερη ηλιακή', () => {
    const wideFrame = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, frameFactorF: 0.6 })],
    });
    const result = deriveAnnualHeating(resultsOf(wideFrame), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(330.48); // 385.56 · 0.60/0.70
  });

  it('L7.5 — F_F × g × obstruction × F_ov πολλαπλασιάζονται μαζί', () => {
    const win = makeResult('sp-1', {
      boundaries: [
        boundary({ area: 2, azimuthDeg: 180, solarFactorG: 0.8, frameFactorF: 0.84, overhangShadingFactor: 0.5 }),
      ],
    });
    const heavy = makeSpace('sp-1', undefined, { solarShadingLevel: 'heavy' }); // obstruction 0.5
    const result = deriveAnnualHeating(resultsOf(win), [heavy], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(154.224); // 2·0.8·0.84·0.9·510·0.5·0.5
  });

  it('L7.5 — μεγαλύτερο F_F → περισσότερα κέρδη → μικρότερη καθαρή ζήτηση', () => {
    const thin = makeResult('sp-1', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, frameFactorF: 0.84 })],
    });
    const wide = makeResult('sp-2', {
      boundaries: [boundary({ area: 2, azimuthDeg: 180, frameFactorF: 0.6 })],
    });
    const rs = deriveAnnualHeating(resultsOf(thin), [makeSpace('sp-1')], 'B').rows[0];
    const rw = deriveAnnualHeating(resultsOf(wide), [makeSpace('sp-2')], 'B').rows[0];
    expect(rs.solarGainKWh).toBeGreaterThan(rw.solarGainKWh);
    expect(rs.netDemandKWh).toBeLessThan(rw.netDemandKWh);
  });

  // ─── L7.6 — ηλιακά κέρδη αδιαφανών εξωτ. τοίχων (opaque solar absorption) ──────

  it('L7.6 — window-only boundaries → opaqueSolarGainKWh=0 (zero-regression)', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const result = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56); // glazing αμετάβλητο
    expect(result.rows[0].opaqueSolarGainKWh).toBe(0);
    expect(result.totalOpaqueSolarGainKWh).toBe(0);
  });

  it('L7.6 — εξωτ. τοίχος απορροφά ηλιακή A_sol·I (default α=0.6, νότιος ζώνη Β)', () => {
    const wall = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180 })],
    });
    const result = deriveAnnualHeating(resultsOf(wall), [makeSpace('sp-1')], 'B');
    // A_sol = α·R_se·U·A = 0.6·0.04·0.4·12 = 0.1152 → Q = 0.1152·510 = 58.752
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(58.752);
    expect(result.rows[0].solarGainKWh).toBe(0); // καθόλου υαλοπίνακας
  });

  it('L7.6 — τοίχος χωρίς azimuthDeg → orientation-agnostic μέση ακτινοβολία', () => {
    const wall = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, solarAbsorptance: 0.6 })],
    });
    const result = deriveAnnualHeating(resultsOf(wall), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(34.56); // 0.1152·300 (μέση)
  });

  it('L7.6 — σκούρος τοίχος (α=0.9) απορροφά περισσότερο από ανοιχτό (α=0.3)', () => {
    const dark = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180, solarAbsorptance: 0.9 })],
    });
    const light = makeResult('sp-2', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180, solarAbsorptance: 0.3 })],
    });
    const rd = deriveAnnualHeating(resultsOf(dark), [makeSpace('sp-1')], 'B').rows[0];
    const rl = deriveAnnualHeating(resultsOf(light), [makeSpace('sp-2')], 'B').rows[0];
    expect(rd.opaqueSolarGainKWh).toBeCloseTo(88.128); // 0.9·0.04·0.4·12·510
    expect(rl.opaqueSolarGainKWh).toBeCloseTo(29.376); // 0.3·0.04·0.4·12·510
    expect(rd.opaqueSolarGainKWh).toBeGreaterThan(rl.opaqueSolarGainKWh);
  });

  it('L7.6 — εσωτ. τοίχος (adjacent-heated) δεν απορροφά ηλιακή (φιλτράρεται)', () => {
    const interior = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'adjacent-heated', uValue: 0.4, area: 12, azimuthDeg: 180, solarAbsorptance: 0.6 })],
    });
    const result = deriveAnnualHeating(resultsOf(interior), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].opaqueSolarGainKWh).toBe(0);
  });

  it('L7.6 — opaque ΠΟΛΛΑΠΛΑΣΙΑΖΕΤΑΙ με το obstruction του χώρου (heavy → ×0.5)', () => {
    const wall = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180, solarAbsorptance: 0.6 })],
    });
    const heavy = makeSpace('sp-1', undefined, { solarShadingLevel: 'heavy' }); // obstruction 0.5
    const result = deriveAnnualHeating(resultsOf(wall), [heavy], 'B');
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(29.376); // 58.752 · 0.5
  });

  it('L7.6 — συνδυασμός υαλοπίνακα + τοίχου: glazing & opaque ξεχωριστά, μειώνουν τη ζήτηση', () => {
    const combo = makeResult('sp-1', {
      boundaries: [
        boundary({ kind: 'window', condition: 'external-air', area: 2, azimuthDeg: 180 }), // glazing 385.56
        boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180, solarAbsorptance: 0.6 }), // opaque 58.752
      ],
    });
    const result = deriveAnnualHeating(resultsOf(combo), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56);
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(58.752);
    // glazing + opaque μαζί ⇒ μικρότερη καθαρή ζήτηση από glazing-only
    const glazingOnly = deriveAnnualHeating(
      resultsOf(makeResult('sp-2', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] })),
      [makeSpace('sp-2')],
      'B',
    ).rows[0];
    expect(result.rows[0].netDemandKWh).toBeLessThan(glazingOnly.netDemandKWh);
  });

  // ─── L7.7 — ηλιακά κέρδη ΣΤΕΓΗΣ / οριζόντιων αδιαφανών (roof opaque solar) ──────

  it('L7.7 — χωρίς roof external-air → opaqueSolarGainKWh αμετάβλητο (zero-regression)', () => {
    // window + wall (L7.6) χωρίς στέγη: ο roof όρος = 0 ⇒ ίδιο με L7.6.
    const noRoof = makeResult('sp-1', {
      boundaries: [
        boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180, solarAbsorptance: 0.6 }),
      ],
    });
    const result = deriveAnnualHeating(resultsOf(noRoof), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(58.752); // μόνο ο τοίχος (αμετάβλητο L7.6)
  });

  it('L7.7 — εξωτ. στέγη απορροφά οριζόντια ηλιακή A_sol·I_horiz (default α=0.6, ζώνη Β)', () => {
    const roof = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16 })],
    });
    const result = deriveAnnualHeating(resultsOf(roof), [makeSpace('sp-1')], 'B');
    // A_sol = 0.6·0.04·0.4·16 = 0.1536 → Q = 0.1536·I_horiz(B)=360 = 55.296
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(55.296);
    expect(result.rows[0].solarGainKWh).toBe(0); // καθόλου υαλοπίνακας
  });

  it('L7.7 — η στέγη χρησιμοποιεί οριζόντια (ΟΧΙ προσανατολισμένη) ακτινοβολία', () => {
    // Ακόμη κι αν (λανθασμένα) υπάρχει azimuth, η στέγη μένει horizontal (kind branch).
    const roof = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16, azimuthDeg: 180 })],
    });
    const result = deriveAnnualHeating(resultsOf(roof), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(55.296); // 0.1536·360 (όχι 510 του νότου)
  });

  it('L7.7 — σκούρα στέγη (α=0.9) απορροφά περισσότερο από ανοιχτή (α=0.3)', () => {
    const dark = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16, solarAbsorptance: 0.9 })],
    });
    const light = makeResult('sp-2', {
      boundaries: [boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16, solarAbsorptance: 0.3 })],
    });
    const rd = deriveAnnualHeating(resultsOf(dark), [makeSpace('sp-1')], 'B').rows[0];
    const rl = deriveAnnualHeating(resultsOf(light), [makeSpace('sp-2')], 'B').rows[0];
    expect(rd.opaqueSolarGainKWh).toBeCloseTo(82.944); // 0.9·0.04·0.4·16·360
    expect(rl.opaqueSolarGainKWh).toBeCloseTo(27.648); // 0.3·0.04·0.4·16·360
    expect(rd.opaqueSolarGainKWh).toBeGreaterThan(rl.opaqueSolarGainKWh);
  });

  it('L7.7 — εσωτ. οροφή (ceiling / adjacent-heated) δεν απορροφά ηλιακή (φιλτράρεται)', () => {
    const interior = makeResult('sp-1', {
      boundaries: [
        boundary({ kind: 'ceiling', condition: 'adjacent-heated', uValue: 0.4, area: 16, solarAbsorptance: 0.6 }),
        boundary({ kind: 'roof', condition: 'adjacent-heated', uValue: 0.4, area: 16, solarAbsorptance: 0.6 }),
      ],
    });
    const result = deriveAnnualHeating(resultsOf(interior), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].opaqueSolarGainKWh).toBe(0);
  });

  it('L7.7 — roof opaque ΠΟΛΛΑΠΛΑΣΙΑΖΕΤΑΙ με το obstruction του χώρου (heavy → ×0.5)', () => {
    const roof = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16, solarAbsorptance: 0.6 })],
    });
    const heavy = makeSpace('sp-1', undefined, { solarShadingLevel: 'heavy' }); // obstruction 0.5
    const result = deriveAnnualHeating(resultsOf(roof), [heavy], 'B');
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(27.648); // 55.296 · 0.5
  });

  it('L7.7 — συνδυασμός υαλοπίνακα + τοίχου + στέγης: glazing & opaque(τοίχος+στέγη) ξεχωριστά', () => {
    const combo = makeResult('sp-1', {
      boundaries: [
        boundary({ kind: 'window', condition: 'external-air', area: 2, azimuthDeg: 180 }), // glazing 385.56
        boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180, solarAbsorptance: 0.6 }), // opaque τοίχος 58.752
        boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16, solarAbsorptance: 0.6 }), // opaque στέγη 55.296
      ],
    });
    const result = deriveAnnualHeating(resultsOf(combo), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56);
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(114.048); // 58.752 + 55.296
    // στέγη + τοίχος μαζί ⇒ μικρότερη καθαρή ζήτηση από τοίχο-μόνο
    const wallOnly = deriveAnnualHeating(
      resultsOf(makeResult('sp-2', {
        boundaries: [
          boundary({ kind: 'window', condition: 'external-air', area: 2, azimuthDeg: 180 }),
          boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180, solarAbsorptance: 0.6 }),
        ],
      })),
      [makeSpace('sp-2')],
      'B',
    ).rows[0];
    expect(result.rows[0].netDemandKWh).toBeLessThan(wallOnly.netDemandKWh);
  });

  // ─── L7.8 — sky-radiation correction αδιαφανών (long-wave απώλεια προς ουρανό) ─

  it('L7.8 — window-only boundaries → skyRadiationLossKWh=0 (zero-regression)', () => {
    const south = makeResult('sp-1', { boundaries: [boundary({ area: 2, azimuthDeg: 180 })] });
    const result = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].skyRadiationLossKWh).toBe(0);
    expect(result.totalSkyRadiationLossKWh).toBe(0);
  });

  it('L7.8 — στέγη εκπέμπει long-wave στον ουρανό F_r·R_se·U·A·h_r·Δθ_er·h (F_r=1.0)', () => {
    const roof = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16 })],
    });
    const result = deriveAnnualHeating(resultsOf(roof), [makeSpace('sp-1')], 'B');
    // Q_sky = 1.0·0.04·0.4·16·5·11·3600/1000 = 50.688
    expect(result.rows[0].skyRadiationLossKWh).toBeCloseTo(50.688);
    // absorption (L7.7) byte-identical: 0.6·0.04·0.4·16·360 = 55.296
    expect(result.rows[0].opaqueSolarGainKWh).toBeCloseTo(55.296);
  });

  it('L7.8 — τοίχος έχει τον μισό F_r (0.5) από ίδια-U/A στέγη', () => {
    const wall = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 16, azimuthDeg: 180 })],
    });
    const roof = makeResult('sp-2', {
      boundaries: [boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16 })],
    });
    const rw = deriveAnnualHeating(resultsOf(wall), [makeSpace('sp-1')], 'B').rows[0];
    const rr = deriveAnnualHeating(resultsOf(roof), [makeSpace('sp-2')], 'B').rows[0];
    expect(rw.skyRadiationLossKWh).toBeCloseTo(25.344); // 0.5·0.04·0.4·16·5·11·3600/1000
    expect(rw.skyRadiationLossKWh).toBeCloseTo(rr.skyRadiationLossKWh / 2); // τοίχος = μισό στέγης
  });

  it('L7.8 — sky-loss ΑΝΕΞΑΡΤΗΤΟ από α/azimuth/obstruction (μη-ηλιακός όρος)', () => {
    // Δύο τοίχοι ίδιου U/A αλλά διαφορετική απόχρωση/προσανατολισμό/σκίαση → ίδιο sky-loss.
    const a = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180, solarAbsorptance: 0.9 })],
    });
    const b = makeResult('sp-2', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 0, solarAbsorptance: 0.3 })],
    });
    const ra = deriveAnnualHeating(resultsOf(a), [makeSpace('sp-1')], 'B').rows[0];
    const rb = deriveAnnualHeating(
      resultsOf(b),
      [makeSpace('sp-2', undefined, { solarShadingLevel: 'heavy' })], // obstruction 0.5
      'B',
    ).rows[0];
    expect(ra.skyRadiationLossKWh).toBeCloseTo(19.008); // 0.5·0.04·0.4·12·5·11·3600/1000
    expect(rb.skyRadiationLossKWh).toBeCloseTo(19.008); // αμετάβλητο παρά α/azimuth/σκίαση
    expect(ra.opaqueSolarGainKWh).not.toBeCloseTo(rb.opaqueSolarGainKWh); // ΟΧΙ όμως το absorption
  });

  it('L7.8 — εσωτ. (adjacent-heated) τοίχος/στέγη δεν εκπέμπει στον ουρανό (φιλτράρεται)', () => {
    const interior = makeResult('sp-1', {
      boundaries: [
        boundary({ kind: 'wall', condition: 'adjacent-heated', uValue: 0.4, area: 12, azimuthDeg: 180 }),
        boundary({ kind: 'roof', condition: 'adjacent-heated', uValue: 0.4, area: 16 }),
      ],
    });
    const result = deriveAnnualHeating(resultsOf(interior), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].skyRadiationLossKWh).toBe(0);
  });

  it('L7.8 — net opaque στέγης οριακά θετικό (absorption 55.296 > sky 50.688)', () => {
    const roof = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16 })],
    });
    const row = deriveAnnualHeating(resultsOf(roof), [makeSpace('sp-1')], 'B').rows[0];
    expect(row.opaqueSolarGainKWh).toBeGreaterThan(row.skyRadiationLossKWh); // net +4.608
  });

  it('L7.8 — βόρειος ανοιχτός τοίχος: sky-loss υπερβαίνει το absorption (net αρνητικό, Revit-faithful)', () => {
    const wall = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 0, solarAbsorptance: 0.3 })],
    });
    const row = deriveAnnualHeating(resultsOf(wall), [makeSpace('sp-1')], 'B').rows[0];
    expect(row.opaqueSolarGainKWh).toBeCloseTo(6.912); // 0.3·0.04·0.4·12·120 (βόρειος)
    expect(row.skyRadiationLossKWh).toBeCloseTo(19.008);
    expect(row.skyRadiationLossKWh).toBeGreaterThan(row.opaqueSolarGainKWh); // net = −12.096
  });

  it('L7.8 — η απώλεια ουρανού μειώνει τα κέρδη → αυξάνει την καθαρή ζήτηση', () => {
    // Ίδιος βόρειος ανοιχτός τοίχος ως external-air (net opaque −12.096) vs adjacent-heated
    // (μηδέν ανταλλαγή) → ο external έχει λιγότερα κέρδη → μεγαλύτερη καθαρή ζήτηση.
    const exterior = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 0, solarAbsorptance: 0.3 })],
    });
    const interior = makeResult('sp-2', {
      boundaries: [boundary({ kind: 'wall', condition: 'adjacent-heated', uValue: 0.4, area: 12, azimuthDeg: 0, solarAbsorptance: 0.3 })],
    });
    const re = deriveAnnualHeating(resultsOf(exterior), [makeSpace('sp-1')], 'B').rows[0];
    const ri = deriveAnnualHeating(resultsOf(interior), [makeSpace('sp-2')], 'B').rows[0];
    expect(re.netDemandKWh).toBeGreaterThan(ri.netDemandKWh);
  });

  it('L7.8 — totalSkyRadiationLossKWh αθροίζει όλα τα στοιχεία (τοίχος + στέγη)', () => {
    const combo = makeResult('sp-1', {
      boundaries: [
        boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180 }), // sky 19.008
        boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16 }), // sky 50.688
      ],
    });
    const result = deriveAnnualHeating(resultsOf(combo), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].skyRadiationLossKWh).toBeCloseTo(69.696); // 19.008 + 50.688
    expect(result.totalSkyRadiationLossKWh).toBeCloseTo(69.696);
  });

  // ─── L7.8-B — sky-radiation correction ΥΑΛΟΠΙΝΑΚΩΝ (long-wave απώλεια προς ουρανό) ─

  // Αναμενόμενη απώλεια ουρανού εξωτ. υαλοπίνακα ζώνης Β — παραγόμενη από τα ΙΔΙΑ
  // constants του config (ΟΧΙ hardcoded magic): F_r,window·R_se·U·A·h_r·Δθ_er·hours/1000.
  const glazingSkyLossB = (uValue: number, area: number): number =>
    (getSkyViewFactor('window') *
      EXTERNAL_SURFACE_RESISTANCE_R_SE *
      uValue *
      area *
      EXTERNAL_RADIATIVE_COEFFICIENT_H_R *
      SKY_TEMP_DIFFERENCE_DELTA_THETA_ER *
      getHeatingSeasonHours('B')) /
    1000;

  it('L7.8-B — χωρίς εξωτ. παράθυρα → glazingSkyRadiationLossKWh=0 (αδιαφανή ανέγγιχτα)', () => {
    const opaque = makeResult('sp-1', {
      boundaries: [
        boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, azimuthDeg: 180 }),
        boundary({ kind: 'roof', condition: 'external-air', uValue: 0.4, area: 16 }),
      ],
    });
    const result = deriveAnnualHeating(resultsOf(opaque), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].glazingSkyRadiationLossKWh).toBe(0);
    expect(result.totalGlazingSkyRadiationLossKWh).toBe(0);
    expect(result.rows[0].skyRadiationLossKWh).toBeCloseTo(69.696); // αδιαφανή L7.8 αμετάβλητα
  });

  it('L7.8-B — εξωτ. παράθυρο εκπέμπει long-wave F_r·R_se·U·A·h_r·Δθ_er·h (F_r=0.5, από τύπο)', () => {
    const south = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'window', condition: 'external-air', uValue: 2.8, area: 2, azimuthDeg: 180 })],
    });
    const result = deriveAnnualHeating(resultsOf(south), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].glazingSkyRadiationLossKWh).toBeCloseTo(glazingSkyLossB(2.8, 2)); // 22.176
    expect(result.rows[0].solarGainKWh).toBeCloseTo(385.56); // ηλιακά κέρδη ΑΜΕΤΑΒΛΗΤΑ
  });

  it('L7.8-B — το παράθυρο έχει ίδιο F_r (0.5) με τοίχο ίδιου U/A', () => {
    const window = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'window', condition: 'external-air', uValue: 0.4, area: 16 })],
    });
    const wall = makeResult('sp-2', {
      boundaries: [boundary({ kind: 'wall', condition: 'external-air', uValue: 0.4, area: 16, azimuthDeg: 180 })],
    });
    const rWin = deriveAnnualHeating(resultsOf(window), [makeSpace('sp-1')], 'B').rows[0];
    const rWall = deriveAnnualHeating(resultsOf(wall), [makeSpace('sp-2')], 'B').rows[0];
    expect(rWin.glazingSkyRadiationLossKWh).toBeCloseTo(25.344); // 0.5·0.04·0.4·16·5·11·3600/1000
    expect(rWin.glazingSkyRadiationLossKWh).toBeCloseTo(rWall.skyRadiationLossKWh); // ίδια γεωμετρία θέασης
  });

  it('L7.8-B — glazing sky-loss ΑΝΕΞΑΡΤΗΤΟ από g/frame/azimuth (μη-ηλιακός όρος)', () => {
    // Δύο παράθυρα ίδιου U/A αλλά διαφορετικό g/πλαίσιο/προσανατολισμό → ίδια απώλεια ουρανού.
    const a = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'window', condition: 'external-air', uValue: 2.8, area: 2, azimuthDeg: 180, solarFactorG: 0.8, frameFactorF: 0.84 })],
    });
    const b = makeResult('sp-2', {
      boundaries: [boundary({ kind: 'window', condition: 'external-air', uValue: 2.8, area: 2, azimuthDeg: 0, solarFactorG: 0.5, frameFactorF: 0.6 })],
    });
    const ra = deriveAnnualHeating(resultsOf(a), [makeSpace('sp-1')], 'B').rows[0];
    const rb = deriveAnnualHeating(resultsOf(b), [makeSpace('sp-2')], 'B').rows[0];
    expect(ra.glazingSkyRadiationLossKWh).toBeCloseTo(glazingSkyLossB(2.8, 2)); // 22.176
    expect(rb.glazingSkyRadiationLossKWh).toBeCloseTo(glazingSkyLossB(2.8, 2)); // αμετάβλητο
    expect(ra.solarGainKWh).not.toBeCloseTo(rb.solarGainKWh); // ΟΧΙ όμως τα ηλιακά κέρδη
  });

  it('L7.8-B — εσωτ. παράθυρο (adjacent-heated) δεν εκπέμπει στον ουρανό (φιλτράρεται)', () => {
    const interior = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'window', condition: 'adjacent-heated', uValue: 2.8, area: 2, azimuthDeg: 180 })],
    });
    const result = deriveAnnualHeating(resultsOf(interior), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].glazingSkyRadiationLossKWh).toBe(0);
  });

  it('L7.8-B — μεγαλύτερο U (ίδιο εμβαδό/ηλιακά) → περισσότερη απώλεια → μεγαλύτερη καθαρή ζήτηση', () => {
    // Ίδια ηλιακά κέρδη (το U δεν επηρεάζει το solarGainKWh) → απομονώνει την επίδραση του sky-loss.
    const hiU = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'window', condition: 'external-air', uValue: 2.8, area: 2, azimuthDeg: 180 })],
    });
    const loU = makeResult('sp-2', {
      boundaries: [boundary({ kind: 'window', condition: 'external-air', uValue: 1.4, area: 2, azimuthDeg: 180 })],
    });
    const rHi = deriveAnnualHeating(resultsOf(hiU), [makeSpace('sp-1')], 'B').rows[0];
    const rLo = deriveAnnualHeating(resultsOf(loU), [makeSpace('sp-2')], 'B').rows[0];
    expect(rHi.solarGainKWh).toBeCloseTo(rLo.solarGainKWh); // ηλιακά ίδια
    expect(rHi.glazingSkyRadiationLossKWh).toBeGreaterThan(rLo.glazingSkyRadiationLossKWh);
    expect(rHi.netDemandKWh).toBeGreaterThan(rLo.netDemandKWh); // περισσότερη απώλεια → μεγαλύτερη ζήτηση
  });

  it('L7.8-B — totalGlazingSkyRadiationLossKWh αθροίζει όλα τα εξωτ. παράθυρα', () => {
    const combo = makeResult('sp-1', {
      boundaries: [
        boundary({ kind: 'window', condition: 'external-air', uValue: 2.8, area: 2, azimuthDeg: 180 }), // 22.176
        boundary({ kind: 'window', condition: 'external-air', uValue: 2.8, area: 1, azimuthDeg: 0 }), // 11.088
      ],
    });
    const result = deriveAnnualHeating(resultsOf(combo), [makeSpace('sp-1')], 'B');
    expect(result.rows[0].glazingSkyRadiationLossKWh).toBeCloseTo(glazingSkyLossB(2.8, 3)); // 33.264
    expect(result.totalGlazingSkyRadiationLossKWh).toBeCloseTo(glazingSkyLossB(2.8, 3));
  });

  // ─── L7.9 — δυναμικός a0 με θερμική μάζα (gain utilisation / σταθερά χρόνου) ────

  it('L7.9 — absent thermalMassLevel ⇒ utilisation/net ΑΜΕΤΑΒΛΗΤΑ (zero-regression)', () => {
    const result = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [makeSpace('sp-1')], 'B');
    const row = result.rows[0];
    expect(row.utilisation).toBeCloseTo(0.783114); // 1/(1+0.276923) — byte-identical L7.1
    expect(row.netDemandKWh).toBeCloseTo(977.349);
    expect(row.timeConstantHours).toBeUndefined(); // δεν μοντελοποιείται μάζα
  });

  it('L7.9 — heavy μάζα → δυναμικό a0 → μεγαλύτερο η_gn → μικρότερη net (παραγόμενο από τύπο)', () => {
    const heavy = makeSpace('sp-1', undefined, { thermalMassLevel: 'heavy' });
    const row = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [heavy], 'B').rows[0];
    // H=40, A=16: C_m=260000·16, τ=C_m/(40·3600)=28.889h, a0=1+τ/15≈2.926.
    const tau = computeTimeConstantHours(getThermalMassCapacity('heavy') * 16, 40);
    const a0 = computeNumericParam(tau);
    const gains = 345.6; // internal-only (χωρίς υαλοπίνακα), όπως το worked example
    const expectedEta = computeGainUtilisation(gains / 1248, a0);
    expect(row.timeConstantHours).toBeCloseTo(tau, 3); // ~28.889
    expect(row.utilisation).toBeCloseTo(expectedEta); // ~0.9830
    expect(row.netDemandKWh).toBeCloseTo(1248 - expectedEta * gains, 2); // ~908.26
    // αισθητά πάνω από το absent baseline, ζήτηση κάτω
    const base = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [makeSpace('sp-1')], 'B').rows[0];
    expect(row.utilisation).toBeGreaterThan(base.utilisation);
    expect(row.netDemandKWh).toBeLessThan(base.netDemandKWh);
  });

  it('L7.9 — μονοτονία: βαρύτερη μάζα → μεγαλύτερο η_gn → μικρότερη net (very-light→very-heavy)', () => {
    const rows = THERMAL_MASS_LEVELS.map(
      (level) =>
        deriveAnnualHeating(
          resultsOf(makeResult('sp-1')),
          [makeSpace('sp-1', undefined, { thermalMassLevel: level })],
          'B',
        ).rows[0],
    );
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].utilisation).toBeGreaterThan(rows[i - 1].utilisation);
      expect(rows[i].netDemandKWh).toBeLessThan(rows[i - 1].netDemandKWh);
    }
    // ακόμη και η ελαφρύτερη δηλωμένη κλάση ξεπερνά το absent baseline (τ>0)
    const base = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [makeSpace('sp-1')], 'B').rows[0];
    expect(rows[0].utilisation).toBeGreaterThan(base.utilisation);
  });

  it('L7.9 — H ≤ 0 (ΔΤ=0) με δηλωμένη μάζα ⇒ fallback χωρίς crash (net=0)', () => {
    const noDelta = makeResult('sp-1', { deltaTC: 0 });
    const heavy = makeSpace('sp-1', undefined, { thermalMassLevel: 'heavy' });
    const row = deriveAnnualHeating(resultsOf(noDelta), [heavy], 'B').rows[0];
    expect(row.lossCoefficientWperK).toBe(0);
    expect(row.timeConstantHours).toBe(0); // H≤0 ⇒ τ=0 (fallback)
    expect(row.netDemandKWh).toBe(0); // gross=0 → max(0, …)
    expect(Number.isFinite(row.utilisation)).toBe(true);
  });

  // ─── L7.9-B — geometry-derived C_m από τα assemblies (κ_m·A precedence) ─────────

  // Εσωτ. τοίχος (adjacent-heated) με stamped κ_m: συνεισφέρει στο C_m αλλά ΟΧΙ σε
  // ηλιακά κέρδη (φιλτράρονται στο external-air) → καθαρό geometry-C_m signal.
  const KAPPA_CONCRETE = 185280; // worked example: default exterior DNA μπετόν
  const KAPPA_GYPSUM = 24525; // worked example: γυψοσανίδα drywall

  it('L7.9-B — boundary χωρίς κ_m + χωρίς κλάση ⇒ ΑΜΕΤΑΒΛΗΤΑ (zero-regression)', () => {
    const wall = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'adjacent-heated', area: 48 })],
    });
    const row = deriveAnnualHeating(resultsOf(wall), [makeSpace('sp-1')], 'B').rows[0];
    expect(row.timeConstantHours).toBeUndefined();
    expect(row.utilisation).toBeCloseTo(0.783114); // byte-identical L7.1
    expect(row.netDemandKWh).toBeCloseTo(977.349);
  });

  it('L7.9-B — geometry C_m = Σ κ_m·A υπερισχύει της κατηγορίας (precedence)', () => {
    const wall = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'adjacent-heated', area: 48, arealHeatCapacityJperM2K: KAPPA_CONCRETE })],
    });
    // very-light κατηγορία (μικρό C_m) — αλλά το geometry υπερισχύει.
    const space = makeSpace('sp-1', undefined, { thermalMassLevel: 'very-light' });
    const row = deriveAnnualHeating(resultsOf(wall), [space], 'B').rows[0];
    const geomTau = computeTimeConstantHours(KAPPA_CONCRETE * 48, 40);
    const catTau = computeTimeConstantHours(getThermalMassCapacity('very-light') * 16, 40);
    expect(row.timeConstantHours).toBeCloseTo(geomTau, 3); // geometry, ΟΧΙ κατηγορία
    expect(row.timeConstantHours).toBeGreaterThan(catTau);
  });

  it('L7.9-B — worked τ/a0 από Σ κ·A → μεγαλύτερο η_gn → μικρότερη net (από τύπο)', () => {
    const wall = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'adjacent-heated', area: 48, arealHeatCapacityJperM2K: KAPPA_CONCRETE })],
    });
    const row = deriveAnnualHeating(resultsOf(wall), [makeSpace('sp-1')], 'B').rows[0];
    const tau = computeTimeConstantHours(KAPPA_CONCRETE * 48, 40); // C_m=8.89 MJ/K, H=40
    const a0 = computeNumericParam(tau);
    const gains = 345.6; // internal-only (adjacent τοίχος → μηδέν ηλιακά)
    const expectedEta = computeGainUtilisation(gains / 1248, a0);
    expect(row.timeConstantHours).toBeCloseTo(tau, 3); // ~61.76 h
    expect(row.utilisation).toBeCloseTo(expectedEta);
    expect(row.netDemandKWh).toBeCloseTo(1248 - expectedEta * gains, 2);
    // πάνω από το absent baseline, ζήτηση κάτω
    const base = deriveAnnualHeating(resultsOf(makeResult('sp-1')), [makeSpace('sp-1')], 'B').rows[0];
    expect(row.utilisation).toBeGreaterThan(base.utilisation);
    expect(row.netDemandKWh).toBeLessThan(base.netDemandKWh);
  });

  it('L7.9-B — βαρύ assembly (μπετόν) → μεγαλύτερο C_m/a0/μικρότερη net από ελαφρύ (γυψοσανίδα)', () => {
    const heavy = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'adjacent-heated', area: 48, arealHeatCapacityJperM2K: KAPPA_CONCRETE })],
    });
    const light = makeResult('sp-2', {
      boundaries: [boundary({ kind: 'wall', condition: 'adjacent-heated', area: 48, arealHeatCapacityJperM2K: KAPPA_GYPSUM })],
    });
    const rh = deriveAnnualHeating(resultsOf(heavy), [makeSpace('sp-1')], 'B').rows[0];
    const rl = deriveAnnualHeating(resultsOf(light), [makeSpace('sp-2')], 'B').rows[0];
    expect(rh.timeConstantHours!).toBeGreaterThan(rl.timeConstantHours!);
    expect(rh.utilisation).toBeGreaterThan(rl.utilisation);
    expect(rh.netDemandKWh).toBeLessThan(rl.netDemandKWh);
  });

  it('L7.9-B — geometry C_m=0 (κ_m absent) με δηλωμένη κλάση ⇒ fallback κατηγορία (L7.9)', () => {
    const wall = makeResult('sp-1', {
      boundaries: [boundary({ kind: 'wall', condition: 'adjacent-heated', area: 48 })], // χωρίς κ_m
    });
    const heavy = makeSpace('sp-1', undefined, { thermalMassLevel: 'heavy' });
    const row = deriveAnnualHeating(resultsOf(wall), [heavy], 'B').rows[0];
    const catTau = computeTimeConstantHours(getThermalMassCapacity('heavy') * 16, 40);
    expect(row.timeConstantHours).toBeCloseTo(catTau, 3); // κατηγορία (geometry=0)
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
