/**
 * ADR-422 L5 — tests για τον thermal-study report builder (pure).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Επιβεβαιώνει: σύνθεση 4 read-models σε σύνοψη + 5 πίνακες, σύνοψη totals (ΣΦ /
 * απαιτ. ισχύς / index ΔP / μανομετρικό / κυκλώματα / συν. παροχή), index circuit
 * στη σύνοψη, μετατροπή Pa→kPa, spaceLabel resolution, ΚΕΝΑΚ έλεγχος κελύφους L6
 * (✓/✗ + gating εξωτ. κελύφους), και άδειο δίκτυο (isEmpty).
 */

import { createThermalSpace } from '@/services/factories/thermal-space.factory';
import {
  computeThermalSpaceGeometry,
  type ThermalSpaceEntity,
} from '../../../types/thermal-space-types';
import { resolveSystemRegime } from '../../sizing/radiator-sizing-config';
import type { SpaceHeatLoads } from '../../../../hooks/data/useSpaceHeatLoads';
import type {
  RadiatorSizingMap,
  RadiatorSizingViewResult,
} from '../../../../hooks/data/useRadiatorSizing';
import type { PipeSizingMap, PipeSegmentSizing } from '../../sizing/pipe-network-sizing';
import type {
  HydraulicBalancingResult,
  TerminalBalancing,
} from '../../balancing/circuit-balancing';
import { buildThermalStudyReport, type ThermalStudyLookups } from '../thermal-study-report';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeSpace(id: string, name: string | undefined): ThermalSpaceEntity {
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
    name,
  };
  return createThermalSpace({
    id,
    params,
    geometry: computeThermalSpaceGeometry(params),
    layerId: 'layer-0',
  });
}

function makeSpaceLoads(spaces: ThermalSpaceEntity[]): SpaceHeatLoads {
  const results = new Map(
    spaces.map((s, i) => [
      s.id,
      {
        spaceId: s.id,
        deltaTC: 20,
        transmissionW: 600 + i * 100,
        ventilationW: 200,
        infiltrationW: 0,
        designedVentilationW: 200,
        thermalBridgeW: 0,
        reheatW: 0,
        totalW: 800 + i * 100,
        specificLoadWperM2: 50 + i,
        boundaries: [],
      },
    ]),
  );
  let totalW = 0;
  for (const r of results.values()) totalW += r.totalW;
  return { results, minWperM2: 50, maxWperM2: 51, totalW, spaces, climateZone: 'B' as const };
}

function radiator(id: string, spaceId: string, catalogueW: number | null): RadiatorSizingViewResult {
  return {
    radiatorId: id,
    spaceId,
    roomLoadW: 800,
    shareW: 800,
    siblingCount: 1,
    regime: resolveSystemRegime('75-65'),
    deltaTActualK: 50,
    correctionFactor: 1,
    requiredNominalW: 900,
    catalogueW,
    adequate: catalogueW === null ? null : catalogueW >= 900,
  };
}

function segment(id: string, dnMm: number): PipeSegmentSizing {
  return {
    segmentId: id,
    dnMm,
    outerMm: dnMm + 2,
    innerMm: dnMm - 2,
    massFlowKgS: 0.02,
    flowM3s: 0.00002,
    velocityMS: 0.4,
    frictionPaM: 120,
    cumulativeLoadW: 900,
    saturated: false,
    inLoop: false,
  };
}

function terminal(
  id: string,
  circuitDropPa: number,
  isIndex: boolean,
  requiredKv: number | null,
): TerminalBalancing {
  return {
    terminalId: id,
    massFlowKgS: 0.02,
    circuitDropPa,
    isIndex,
    surplusPa: isIndex ? 0 : 3000,
    requiredKv,
  };
}

const LOOKUPS: ThermalStudyLookups = {
  buildingLabel: 'Κτίριο Α',
  floorLabel: 'Ισόγειο',
  spaceLabel: (space) => space.params.name?.trim() || space.params.useType,
  boundaryKindLabel: (kind) => kind,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('buildThermalStudyReport', () => {
  it('builds summary + 5 data sections with worked rows', () => {
    const spaces = [makeSpace('sp-1', 'Σαλόνι'), makeSpace('sp-2', undefined)];
    const spaceLoads = makeSpaceLoads(spaces);
    const radiatorSizing: RadiatorSizingMap = new Map([
      ['rad-1', radiator('rad-1', 'sp-1', 1000)],
      ['rad-2', radiator('rad-2', 'sp-2', 500)],
    ]);
    const pipeSizing: PipeSizingMap = new Map([
      ['seg-1', segment('seg-1', 20)],
      ['seg-2', segment('seg-2', 15)],
    ]);
    const balancing: HydraulicBalancingResult = {
      terminals: new Map([
        ['rad-1', terminal('rad-1', 18000, true, null)],
        ['rad-2', terminal('rad-2', 12000, false, 1.5)],
      ]),
      indexTerminalId: 'rad-1',
      pumpHeadPa: 21600,
      segmentDropPa: new Map(),
    };

    const report = buildThermalStudyReport({
      spaceLoads,
      radiatorSizing,
      pipeSizing,
      balancing,
      climateZone: null,
      lookups: LOOKUPS,
    });

    expect(report.isEmpty).toBe(false);
    expect(report.header).toEqual({ buildingLabel: 'Κτίριο Α', floorLabel: 'Ισόγειο' });
    expect(report.sections).toHaveLength(8);

    const [summary, loads, radiators, pipes, balancingSection] = report.sections;
    expect(loads.rows).toHaveLength(2);
    expect(radiators.rows).toHaveLength(2);
    expect(pipes.rows).toHaveLength(2);
    expect(balancingSection.rows).toHaveLength(2);

    // Summary KPIs (1 row).
    expect(summary.rows).toHaveLength(1);
    const kpi = summary.rows[0];
    expect(kpi.floorLoad).toBe(1700); // 800 + 900
    expect(kpi.requiredPower).toBe(1800); // 900 + 900
    expect(kpi.indexDrop).toBeCloseTo(18); // 18000 Pa → kPa
    expect(kpi.pumpHead).toBeCloseTo(21.6); // 21600 Pa → kPa
    expect(kpi.circuits).toBe(2);
    expect(kpi.totalFlow).toBeCloseTo(0.04);
  });

  it('resolves space labels (name override → use-type fallback)', () => {
    const spaces = [makeSpace('sp-1', 'Σαλόνι'), makeSpace('sp-2', undefined)];
    const report = buildThermalStudyReport({
      spaceLoads: makeSpaceLoads(spaces),
      radiatorSizing: new Map(),
      pipeSizing: new Map(),
      balancing: { terminals: new Map(), indexTerminalId: null, pumpHeadPa: 0, segmentDropPa: new Map() },
      climateZone: null,
      lookups: LOOKUPS,
    });
    const loads = report.sections[1];
    expect(loads.rows[0].space).toBe('Σαλόνι');
    expect(loads.rows[1].space).toBe('living-room');
  });

  it('flags balancing index circuit + maps kv null to cell', () => {
    const balancing: HydraulicBalancingResult = {
      terminals: new Map([
        ['rad-1', terminal('rad-1', 18000, true, null)],
        ['rad-2', terminal('rad-2', 12000, false, 1.5)],
      ]),
      indexTerminalId: 'rad-1',
      pumpHeadPa: 21600,
      segmentDropPa: new Map(),
    };
    const report = buildThermalStudyReport({
      spaceLoads: makeSpaceLoads([makeSpace('sp-1', 'Σαλόνι')]),
      radiatorSizing: new Map([['rad-1', radiator('rad-1', 'sp-1', 1000)]]),
      pipeSizing: new Map(),
      balancing,
      climateZone: null,
      lookups: LOOKUPS,
    });
    const balancingSection = report.sections[4];
    const indexRow = balancingSection.rows.find((r) => r.isIndex !== '');
    expect(indexRow?.kv).toBeNull();
    expect(balancingSection.rows.find((r) => r.isIndex === '')?.kv).toBe(1.5);
  });

  it('builds the L6 KENAK envelope-compliance section (✓/✗ + external-only gating)', () => {
    const spaces = [makeSpace('sp-1', 'Σαλόνι')];
    const base = makeSpaceLoads(spaces);
    // boundaries: εξωτ. τοίχος U=0.6 (>0.45 ζώνη Β ⇒ ✗) · εξωτ. κούφωμα U=2.5
    // (≤2.6 ⇒ ✓) · γειτονικός τοίχος (adjacent-heated ⇒ εκτός ΚΕΝΑΚ, skip).
    const withBoundaries: SpaceHeatLoads = {
      ...base,
      results: new Map([
        [
          'sp-1',
          {
            ...base.results.get('sp-1')!,
            boundaries: [
              { kind: 'wall', condition: 'external-air', uValue: 0.6, area: 12, factor: 1, lossW: 0, thermalBridgeW: 0 },
              { kind: 'window', condition: 'external-air', uValue: 2.5, area: 2, factor: 1, lossW: 0, thermalBridgeW: 0 },
              { kind: 'wall', condition: 'adjacent-heated', uValue: 1.0, area: 8, factor: 0.5, lossW: 0, thermalBridgeW: 0 },
            ],
          },
        ],
      ]),
    };

    const report = buildThermalStudyReport({
      spaceLoads: withBoundaries,
      radiatorSizing: new Map(),
      pipeSizing: new Map(),
      balancing: { terminals: new Map(), indexTerminalId: null, pumpHeadPa: 0, segmentDropPa: new Map() },
      climateZone: 'B',
      lookups: LOOKUPS,
    });

    const compliance = report.sections[5];
    expect(compliance.titleKey).toBe('thermalStudyReport.sections.compliance');
    // Μόνο τα 2 εξωτ. στοιχεία ελέγχονται (ο γειτονικός τοίχος gated out).
    expect(compliance.rows).toHaveLength(2);
    const wallRow = compliance.rows.find((r) => r.element === 'wall');
    const windowRow = compliance.rows.find((r) => r.element === 'window');
    expect(wallRow?.uMax).toBe(0.45);
    expect(wallRow?.compliant).toBe('✗');
    expect(windowRow?.uMax).toBe(2.6);
    expect(windowRow?.compliant).toBe('✓');
  });

  it('omits compliance rows when no climate zone is known', () => {
    const report = buildThermalStudyReport({
      spaceLoads: makeSpaceLoads([makeSpace('sp-1', 'Σαλόνι')]),
      radiatorSizing: new Map(),
      pipeSizing: new Map(),
      balancing: { terminals: new Map(), indexTerminalId: null, pumpHeadPa: 0, segmentDropPa: new Map() },
      climateZone: null,
      lookups: LOOKUPS,
    });
    const compliance = report.sections[5];
    expect(compliance.titleKey).toBe('thermalStudyReport.sections.compliance');
    expect(compliance.rows).toHaveLength(0);
  });

  it('builds the L7/L7.1 annual-energy section + summary KPIs (μεικτή/καθαρή με κέρδη)', () => {
    // χώρος 4×4 m (A=16 m²), H=(600+200)/20=40 W/K, ζώνη Β (HDD 1300, hours 3600)
    // → μεικτή 1248 kWh · Q_int=6·16·3600/1000=345.6 · γ=0.2769 · η=0.7831
    // → καθαρή 977 kWh · q_net=61.1 → ενδεικτική κατηγορία Β+.
    const report = buildThermalStudyReport({
      spaceLoads: makeSpaceLoads([makeSpace('sp-1', 'Σαλόνι')]),
      radiatorSizing: new Map(),
      pipeSizing: new Map(),
      balancing: { terminals: new Map(), indexTerminalId: null, pumpHeadPa: 0, segmentDropPa: new Map() },
      climateZone: 'B',
      lookups: LOOKUPS,
    });

    const annual = report.sections[6];
    expect(annual.titleKey).toBe('thermalStudyReport.sections.annualEnergy');
    expect(annual.rows).toHaveLength(1);
    const row = annual.rows[0];
    expect(row.lossCoeff).toBeCloseTo(40);
    expect(row.floorArea).toBeCloseTo(16);
    expect(row.grossDemand).toBe(1248); // μεικτή (L7, zero-regression)
    expect(row.gains).toBe(346); // round(345.6 εσωτ. + 0 ηλιακά)
    expect(row.utilisation).toBeCloseTo(78.31); // η ×100 (%)
    expect(row.annualDemand).toBe(977); // καθαρή (headline)
    expect(row.specificDemand).toBeCloseTo(61.08);

    const kpi = report.sections[0].rows[0];
    expect(kpi.grossEnergy).toBe(1248); // μεικτή KPI
    expect(kpi.annualEnergy).toBe(977); // καθαρή KPI
    expect(kpi.specificDemand).toBeCloseTo(61.08);
    expect(kpi.energyClass).toBe('B+');
  });

  it('omits annual-energy rows + class when no climate zone is known', () => {
    const report = buildThermalStudyReport({
      spaceLoads: makeSpaceLoads([makeSpace('sp-1', 'Σαλόνι')]),
      radiatorSizing: new Map(),
      pipeSizing: new Map(),
      balancing: { terminals: new Map(), indexTerminalId: null, pumpHeadPa: 0, segmentDropPa: new Map() },
      climateZone: null,
      lookups: LOOKUPS,
    });
    const annual = report.sections[6];
    expect(annual.titleKey).toBe('thermalStudyReport.sections.annualEnergy');
    expect(annual.rows).toHaveLength(0);
    expect(report.sections[0].rows[0].energyClass).toBe('—');
    expect(report.sections[0].rows[0].annualEnergy).toBe(0);
    expect(report.sections[0].rows[0].grossEnergy).toBe(0);
  });

  it('builds the L1.8 heat-loss breakdown section (fabric-by-kind + split + Σ invariant)', () => {
    const spaces = [makeSpace('sp-1', 'Σαλόνι')];
    const base = makeSpaceLoads(spaces);
    // fabric: τοίχος 300 + κούφωμα 150 + δάπεδο 125 + στέγη 200 + οροφή 50 = 825 (=transmission)·
    // split: infiltration 100 ↔ designed 382.5 → ventilationW = max = 382.5· reheat 0.
    // totalW = 825 + 382.5 = 1207.5.
    const withBreakdown: SpaceHeatLoads = {
      ...base,
      results: new Map([
        [
          'sp-1',
          {
            ...base.results.get('sp-1')!,
            transmissionW: 825,
            ventilationW: 382.5,
            infiltrationW: 100,
            designedVentilationW: 382.5,
            reheatW: 0,
            totalW: 1207.5,
            boundaries: [
              { kind: 'wall', condition: 'external-air', uValue: 0.4, area: 12, factor: 1, lossW: 300, thermalBridgeW: 0 },
              { kind: 'window', condition: 'external-air', uValue: 2.5, area: 2, factor: 1, lossW: 150, thermalBridgeW: 0 },
              { kind: 'floor', condition: 'ground', uValue: 0.5, area: 20, factor: 0.5, lossW: 125, thermalBridgeW: 0 },
              { kind: 'roof', condition: 'external-air', uValue: 0.4, area: 20, factor: 1, lossW: 200, thermalBridgeW: 0 },
              { kind: 'ceiling', condition: 'adjacent-heated', uValue: 1, area: 10, factor: 0.5, lossW: 50, thermalBridgeW: 0 },
            ],
          },
        ],
      ]),
    };

    const report = buildThermalStudyReport({
      spaceLoads: withBreakdown,
      radiatorSizing: new Map(),
      pipeSizing: new Map(),
      balancing: { terminals: new Map(), indexTerminalId: null, pumpHeadPa: 0, segmentDropPa: new Map() },
      climateZone: null,
      lookups: LOOKUPS,
    });

    const lossBreakdown = report.sections[7];
    expect(lossBreakdown.titleKey).toBe('thermalStudyReport.sections.lossBreakdown');
    expect(lossBreakdown.footnoteKey).toBe('thermalStudyReport.footnotes.lossBreakdownVentilation');
    expect(lossBreakdown.rows).toHaveLength(1);
    const r = lossBreakdown.rows[0];
    expect(r.space).toBe('Σαλόνι');
    expect(r.walls).toBe(300);
    expect(r.windows).toBe(150);
    expect(r.doors).toBe(0);
    expect(r.floor).toBe(125);
    expect(r.roof).toBe(250); // στέγη 200 + οροφή 50 ενοποιημένα
    expect(r.infiltration).toBe(100);
    expect(r.designedVentilation).toBe(383); // round(382.5)
    expect(r.reheat).toBe(0);
    expect(r.total).toBe(1208); // round(1207.5)
    // Σ invariant (raw): fabric (825) + ventilationW=max (382.5) + reheat (0) === totalW (1207.5).
    const fabricSum =
      (r.walls as number) +
      (r.windows as number) +
      (r.doors as number) +
      (r.floor as number) +
      (r.roof as number);
    expect(fabricSum + 382.5 + 0).toBeCloseTo(1207.5, 5);
  });

  it('omits loss-breakdown rows when no heating model (footnote still present)', () => {
    const report = buildThermalStudyReport({
      spaceLoads: null,
      radiatorSizing: new Map(),
      pipeSizing: new Map(),
      balancing: { terminals: new Map(), indexTerminalId: null, pumpHeadPa: 0, segmentDropPa: new Map() },
      climateZone: null,
      lookups: LOOKUPS,
    });
    const lossBreakdown = report.sections[7];
    expect(lossBreakdown.titleKey).toBe('thermalStudyReport.sections.lossBreakdown');
    expect(lossBreakdown.rows).toHaveLength(0);
    expect(lossBreakdown.footnoteKey).toBe('thermalStudyReport.footnotes.lossBreakdownVentilation');
  });

  it('returns isEmpty for a floor with no heating model', () => {
    const report = buildThermalStudyReport({
      spaceLoads: null,
      radiatorSizing: new Map(),
      pipeSizing: new Map(),
      balancing: { terminals: new Map(), indexTerminalId: null, pumpHeadPa: 0, segmentDropPa: new Map() },
      climateZone: null,
      lookups: LOOKUPS,
    });
    expect(report.isEmpty).toBe(true);
    expect(report.sections).toHaveLength(8);
    expect(report.sections[0].rows).toHaveLength(1); // σύνοψη πάντα παρούσα
    expect(report.sections[1].rows).toHaveLength(0);
    expect(report.sections[0].rows[0].floorLoad).toBe(0);
  });
});
