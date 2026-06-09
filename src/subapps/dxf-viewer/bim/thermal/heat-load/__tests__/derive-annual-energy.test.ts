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
import type { BoundaryHeatLoss, SpaceHeatLoadResult } from '../heat-load-types';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeSpace(
  id: string,
  geometry?: ThermalSpaceGeometry,
  paramsOver: Partial<Pick<ThermalSpaceParams, 'solarShadingLevel'>> = {},
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
