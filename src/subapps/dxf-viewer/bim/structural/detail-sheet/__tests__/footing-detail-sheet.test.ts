/**
 * ADR-463 — Footing reinforcement detail-sheet builders (pad / strip / tie-beam).
 *
 * Verifies the orchestrator lays out five regions, the per-region builders emit
 * non-empty primitives for a reinforced footing (empty without reinforcement),
 * and the schedule numbers match the `computeFootingReinforcementQuantities` SSoT.
 * Pure (no canvas / no WebGL) — the 3D capture is browser-verified separately.
 */

import { buildFootingDetailSheet } from '../footing-detail-sheet';
import { buildFootingScheduleRegion } from '../footing-detail-schedule';
import { buildFootingPlanRegion } from '../footing-detail-plan';
import { buildFootingElevationRegion } from '../footing-detail-elevation';
import { computeDetailSheetLayout } from '../detail-sheet-layout';
import { buildFootingSectionContext } from '../../section-context';
import { computeFootingReinforcementQuantities } from '../../reinforcement/footing-reinforcement-compute';
import type {
  PadFootingParams,
  StripFootingParams,
  TieBeamParams,
  FoundationEntity,
} from '../../../types/foundation-types';
import type {
  PadReinforcement,
  StripReinforcement,
  TieBeamReinforcement,
} from '../../reinforcement/footing-reinforcement-types';
import type { DetailPrimitive, FootingDetailSheetLabels } from '../detail-sheet-types';

// ─── Fixtures (mirror footing-reinforcement-compute.test / foundation-grips.test) ──

const padEntity = (reinforcement?: PadReinforcement): FoundationEntity =>
  ({
    id: 'fnd-pad', type: 'foundation', kind: 'pad',
    params: {
      kind: 'pad', topElevationMm: -1000, thicknessMm: 500,
      position: { x: 0, y: 0, z: 0 }, width: 1500, length: 1500, rotation: 0,
      anchor: 'center', profile: 'flat', sceneUnits: 'mm', reinforcement,
    } as PadFootingParams,
  } as unknown as FoundationEntity);

const PAD_R: PadReinforcement = {
  kind: 'pad',
  bottomMeshX: { diameterMm: 12, spacingMm: 200 },
  bottomMeshY: { diameterMm: 12, spacingMm: 200 },
  coverMm: 50,
};

const stripEntity = (reinforcement?: StripReinforcement): FoundationEntity =>
  ({
    id: 'fnd-strip', type: 'foundation', kind: 'strip',
    params: {
      kind: 'strip', topElevationMm: -1000, thicknessMm: 400,
      start: { x: 0, y: 0, z: 0 }, end: { x: 4000, y: 0, z: 0 }, width: 600,
      sceneUnits: 'mm', reinforcement,
    } as StripFootingParams,
  } as unknown as FoundationEntity);

const STRIP_R: StripReinforcement = {
  kind: 'strip',
  transverse: { diameterMm: 12, spacingMm: 200 },
  longitudinal: { diameterMm: 12, count: 4 },
  stirrups: { diameterMm: 8, spacingMm: 250 },
  coverMm: 50,
};

const tieEntity = (reinforcement?: TieBeamReinforcement): FoundationEntity =>
  ({
    id: 'fnd-tie', type: 'foundation', kind: 'tie-beam',
    params: {
      kind: 'tie-beam', topElevationMm: -800, thicknessMm: 500,
      start: { x: 0, y: 0, z: 0 }, end: { x: 3000, y: 0, z: 0 }, width: 300,
      sceneUnits: 'mm', reinforcement,
    } as TieBeamParams,
  } as unknown as FoundationEntity);

const TIE_R: TieBeamReinforcement = {
  kind: 'tie-beam',
  bottom: { diameterMm: 16, count: 3 },
  top: { diameterMm: 16, count: 3 },
  stirrups: { diameterMm: 8, spacingMm: 200 },
  coverMm: 40,
};

const LABELS: FootingDetailSheetLabels = {
  plan: 'PLAN', elevation: 'SECTION', perspective: '3D', schedule: 'REBAR', titleBlock: 'TITLE',
  scheduleTable: {
    item: 'Item', description: 'Reinf', length: 'L', weight: 'W',
    main: 'Main', secondary: 'Sec', stirrups: 'Stir', total: 'Total', ratio: 'ρ',
  },
  titleFields: {
    kind: 'Type', section: 'Section', thickness: 'Depth', concrete: 'Concrete',
    steel: 'Steel', cover: 'Cover', main: 'Main', secondary: 'Secondary',
  },
  kindValues: { 'pad': 'Pad', 'strip': 'Strip', 'tie-beam': 'Tie' },
};

const { regions } = computeDetailSheetLayout();
const texts = (prims: readonly DetailPrimitive[]): string[] =>
  prims.filter((p): p is Extract<DetailPrimitive, { kind: 'text' }> => p.kind === 'text').map((p) => p.text);

describe('buildFootingDetailSheet — layout & regions', () => {
  it('lays out five regions in render order', () => {
    const model = buildFootingDetailSheet({ foundation: padEntity(PAD_R), labels: LABELS });
    expect(model.regions.map((r) => r.id)).toEqual(['elevation', 'plan', 'schedule', 'perspective', 'title-block']);
    expect(model.paper.size).toBe('A3');
  });

  it('fills plan / section / schedule / title-block for a reinforced pad', () => {
    const model = buildFootingDetailSheet({ foundation: padEntity(PAD_R), labels: LABELS });
    for (const id of ['plan', 'elevation', 'schedule', 'title-block'] as const) {
      const region = model.regions.find((r) => r.id === id);
      expect(region && region.primitives.length).toBeGreaterThan(0);
    }
  });

  it('perspective region carries a (pending) raster slot when no capture supplied', () => {
    const model = buildFootingDetailSheet({ foundation: padEntity(PAD_R), labels: LABELS });
    const persp = model.regions.find((r) => r.id === 'perspective');
    expect(persp?.primitives.some((p) => p.kind === 'raster')).toBe(true);
  });

  it('strip & tie-beam also produce non-empty plan + schedule', () => {
    for (const foundation of [stripEntity(STRIP_R), tieEntity(TIE_R)]) {
      const model = buildFootingDetailSheet({ foundation, labels: LABELS });
      expect(model.regions.find((r) => r.id === 'plan')?.primitives.length).toBeGreaterThan(0);
      expect(model.regions.find((r) => r.id === 'schedule')?.primitives.length).toBeGreaterThan(0);
    }
  });

  it('empty primitives without reinforcement', () => {
    expect(buildFootingPlanRegion(padEntity(), regions.plan).primitives).toHaveLength(0);
    expect(buildFootingElevationRegion(padEntity(), regions.elevation).primitives).toHaveLength(0);
    expect(buildFootingScheduleRegion(padEntity(), regions.schedule, LABELS.scheduleTable).primitives).toHaveLength(0);
  });
});

describe('buildFootingScheduleRegion — numbers match the compute SSoT', () => {
  it('renders the total steel weight + ρ from computeFootingReinforcementQuantities (pad)', () => {
    const foundation = padEntity(PAD_R);
    const q = computeFootingReinforcementQuantities(buildFootingSectionContext(foundation), PAD_R);
    const out = buildFootingScheduleRegion(foundation, regions.schedule, LABELS.scheduleTable).primitives;
    const all = texts(out);
    expect(all).toContain(q.totalSteelWeightKg.toFixed(1));
    expect(all).toContain(q.mainWeightKg.toFixed(1));
    expect(all.some((s) => s.startsWith('ρ ='))).toBe(true);
  });

  it('strip schedule shows main + secondary + stirrups rows', () => {
    const foundation = stripEntity(STRIP_R);
    const q = computeFootingReinforcementQuantities(buildFootingSectionContext(foundation), STRIP_R);
    const all = texts(buildFootingScheduleRegion(foundation, regions.schedule, LABELS.scheduleTable).primitives);
    expect(all).toContain('Main');
    expect(all).toContain('Sec');
    expect(all).toContain('Stir');
    expect(all).toContain(q.stirrupTotalLengthM.toFixed(1));
  });
});
