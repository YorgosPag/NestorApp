/**
 * ADR-471 — Beam reinforcement detail-sheet builders.
 *
 * Verifies the orchestrator lays out five regions, the per-region builders emit
 * non-empty primitives for a reinforced beam (empty without reinforcement), and
 * the schedule numbers match the `computeBeamReinforcementQuantities` SSoT. Pure
 * (no canvas / no WebGL) — the 3D capture is browser-verified separately.
 */

import { buildBeamDetailSheet } from '../beam-detail-sheet';
import { buildBeamScheduleRegion } from '../beam-detail-schedule';
import { buildBeamSectionRegion } from '../beam-detail-section';
import { buildBeamElevationRegion } from '../beam-detail-elevation';
import { buildBeamTitleBlockRegion } from '../beam-detail-titleblock';
import { computeDetailSheetLayout } from '../detail-sheet-layout';
import { buildBeamSectionContext } from '../../section-context';
import { computeBeamReinforcementQuantities } from '../../reinforcement/beam-reinforcement-compute';
import { computeBeamGeometry } from '../../../geometry/beam-geometry';
import type { BeamEntity, BeamParams } from '../../../types/beam-types';
import type { BeamReinforcement } from '../../reinforcement/beam-reinforcement-types';
import type { BeamDetailSheetLabels, DetailPrimitive } from '../detail-sheet-types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const beamEntity = (reinforcement?: BeamReinforcement): BeamEntity => {
  const params = {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 5000, y: 0, z: 0 },
    width: 300, depth: 600, topElevation: 3000, sceneUnits: 'mm',
    reinforcement,
  } as unknown as BeamParams;
  return {
    id: 'beam-1', type: 'beam', kind: 'straight',
    params, geometry: computeBeamGeometry(params),
  } as unknown as BeamEntity;
};

const BEAM_R: BeamReinforcement = {
  bottom: { diameterMm: 16, count: 3 },
  top: { diameterMm: 14, count: 4 },
  stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
  coverMm: 30,
};

const LABELS: BeamDetailSheetLabels = {
  plan: 'SECTION', elevation: 'ELEVATION', perspective: '3D', schedule: 'REBAR', titleBlock: 'TITLE',
  scheduleTable: {
    item: 'Item', description: 'Reinf', length: 'L', weight: 'W',
    bottomLongitudinal: 'Bottom', topLongitudinal: 'Top', stirrups: 'Stir', total: 'Total', ratio: 'ρ',
  },
  titleFields: {
    section: 'Section', span: 'Span', concrete: 'Concrete', steel: 'Steel',
    cover: 'Cover', longitudinal: 'Long', stirrups: 'Stir',
  },
};

const { regions } = computeDetailSheetLayout();
const texts = (prims: readonly DetailPrimitive[]): string[] =>
  prims.filter((p): p is Extract<DetailPrimitive, { kind: 'text' }> => p.kind === 'text').map((p) => p.text);

describe('buildBeamDetailSheet — layout & regions', () => {
  it('lays out five regions in render order', () => {
    const model = buildBeamDetailSheet({ beam: beamEntity(BEAM_R), reinforcement: BEAM_R, labels: LABELS });
    expect(model.regions.map((r) => r.id)).toEqual(['elevation', 'plan', 'schedule', 'perspective', 'title-block']);
    expect(model.paper.size).toBe('A3');
  });

  it('fills elevation / section / schedule / title-block for a reinforced beam', () => {
    const model = buildBeamDetailSheet({ beam: beamEntity(BEAM_R), reinforcement: BEAM_R, labels: LABELS });
    for (const id of ['plan', 'elevation', 'schedule', 'title-block'] as const) {
      const region = model.regions.find((r) => r.id === id);
      expect(region && region.primitives.length).toBeGreaterThan(0);
    }
  });

  it('perspective region carries a (pending) raster slot when no capture supplied', () => {
    const model = buildBeamDetailSheet({ beam: beamEntity(BEAM_R), reinforcement: BEAM_R, labels: LABELS });
    const persp = model.regions.find((r) => r.id === 'perspective');
    expect(persp?.primitives.some((p) => p.kind === 'raster')).toBe(true);
  });

  it('empty primitives without reinforcement', () => {
    expect(buildBeamSectionRegion(beamEntity(), undefined, regions.plan).primitives).toHaveLength(0);
    expect(buildBeamElevationRegion(beamEntity(), undefined, regions.elevation).primitives).toHaveLength(0);
    expect(buildBeamScheduleRegion(beamEntity(), undefined, regions.schedule, LABELS.scheduleTable).primitives).toHaveLength(0);
    expect(buildBeamTitleBlockRegion(beamEntity(), undefined, regions['title-block'], LABELS.titleFields).primitives).toHaveLength(0);
  });
});

describe('beam region builders — geometry-is-SSoT consistency', () => {
  it('section view draws a stirrup outline + bar dots', () => {
    const out = buildBeamSectionRegion(beamEntity(BEAM_R), BEAM_R, regions.plan).primitives;
    expect(out.some((p) => p.kind === 'circle')).toBe(true);  // longitudinal bar dots
    expect(out.some((p) => p.kind === 'polyline' && p.closed)).toBe(true); // stirrup + concrete
  });

  it('elevation view draws stirrup levels (vertical lines) + spacing dims', () => {
    const out = buildBeamElevationRegion(beamEntity(BEAM_R), BEAM_R, regions.elevation).primitives;
    expect(out.some((p) => p.kind === 'line')).toBe(true);
    expect(out.some((p) => p.kind === 'dim')).toBe(true);
  });
});

describe('buildBeamScheduleRegion — numbers match the compute SSoT', () => {
  it('renders the total steel weight + ρ from computeBeamReinforcementQuantities', () => {
    const beam = beamEntity(BEAM_R);
    const q = computeBeamReinforcementQuantities(buildBeamSectionContext(beam), BEAM_R);
    const all = texts(buildBeamScheduleRegion(beam, BEAM_R, regions.schedule, LABELS.scheduleTable).primitives);
    expect(all).toContain(q.totalSteelWeightKg.toFixed(1));
    expect(all).toContain(q.bottomWeightKg.toFixed(1));
    expect(all).toContain(q.topWeightKg.toFixed(1));
    expect(all.some((s) => s.startsWith('ρ ='))).toBe(true);
  });

  it('shows bottom + top + stirrup rows', () => {
    const all = texts(buildBeamScheduleRegion(beamEntity(BEAM_R), BEAM_R, regions.schedule, LABELS.scheduleTable).primitives);
    expect(all).toContain('Bottom');
    expect(all).toContain('Top');
    expect(all).toContain('Stir');
  });
});
