/**
 * ADR-476 Slice 5 — Slab reinforcement detail-sheet builders.
 *
 * Verifies the orchestrator lays out five regions, the per-region builders emit
 * non-empty primitives for a reinforced slab (empty without reinforcement), the
 * schedule numbers match the `computeSlabFoundationReinforcementQuantities` SSoT
 * and the builders never mutate the input entity. Pure (no canvas / no WebGL) —
 * the 3D capture is browser-verified separately.
 *
 * Manual reinforcement (`auto` absent) → `resolveActiveSlabReinforcementForEntity`
 * fast-paths to the stored value WITHOUT touching the settings store (no provider).
 */

import { buildSlabDetailSheet } from '../slab-detail-sheet';
import { buildSlabPlanRegion } from '../slab-detail-plan';
import { buildSlabSectionRegion } from '../slab-detail-section';
import { buildSlabScheduleRegion } from '../slab-detail-schedule';
import { buildSlabTitleBlockRegion } from '../slab-detail-titleblock';
import { computeDetailSheetLayout } from '../detail-sheet-layout';
import { buildSlabFoundationSectionContext } from '../../section-context';
import { computeSlabFoundationReinforcementQuantities } from '../../reinforcement/slab-foundation-reinforcement-compute';
import type { SlabFoundationReinforcement } from '../../reinforcement/slab-foundation-reinforcement-types';
import type { SlabEntity, SlabKind } from '../../../types/slab-types';
import type { DetailPrimitive, SlabDetailSheetLabels } from '../detail-sheet-types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const RECT = (w: number, h: number) => [
  { x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: w, y: h, z: 0 }, { x: 0, y: h, z: 0 },
];

const slabEntity = (kind: SlabKind, reinforcement?: SlabFoundationReinforcement): SlabEntity =>
  ({
    id: `slab-${kind}`, type: 'slab', kind,
    params: {
      kind, outline: { vertices: RECT(4000, 3000) }, thickness: 200,
      levelElevation: 3000, sceneUnits: 'mm', structuralReinforcement: reinforcement,
    },
    geometry: { polygon: { vertices: RECT(4000, 3000) }, maxFreeSpanM: 3 },
  } as unknown as SlabEntity);

const SLAB_R: SlabFoundationReinforcement = {
  bottomMeshX: { diameterMm: 12, spacingMm: 200 },
  bottomMeshY: { diameterMm: 12, spacingMm: 200 },
  topMeshX: { diameterMm: 10, spacingMm: 250 },
  topMeshY: { diameterMm: 10, spacingMm: 250 },
  coverMm: 25,
};

const LABELS: SlabDetailSheetLabels = {
  plan: 'PLAN', section: 'SECTION', perspective: '3D', schedule: 'REBAR', titleBlock: 'TITLE',
  scheduleTable: {
    item: 'Item', description: 'Reinf', length: 'L', weight: 'W',
    bottomMesh: 'Bottom', topMesh: 'Top', total: 'Total', ratio: 'ρ',
  },
  titleFields: {
    kind: 'Type', section: 'Section', thickness: 'Thickness', concrete: 'Concrete',
    steel: 'Steel', cover: 'Cover', bottomMesh: 'Bottom', topMesh: 'Top',
    span: 'Span', designLoad: 'Load',
  },
  kindValues: { floor: 'Floor', ceiling: 'Ceiling', roof: 'Roof', ground: 'Ground', foundation: 'Foundation' },
};

const { regions } = computeDetailSheetLayout();
const texts = (prims: readonly DetailPrimitive[]): string[] =>
  prims.filter((p): p is Extract<DetailPrimitive, { kind: 'text' }> => p.kind === 'text').map((p) => p.text);

describe('buildSlabDetailSheet — layout & regions', () => {
  it('lays out five regions in render order', () => {
    const model = buildSlabDetailSheet({ slab: slabEntity('floor', SLAB_R), labels: LABELS });
    expect(model.regions.map((r) => r.id)).toEqual(['elevation', 'plan', 'schedule', 'perspective', 'title-block']);
    expect(model.paper.size).toBe('A3');
  });

  it('fills plan / section / schedule / title-block for a reinforced slab', () => {
    const model = buildSlabDetailSheet({ slab: slabEntity('floor', SLAB_R), labels: LABELS });
    for (const id of ['plan', 'elevation', 'schedule', 'title-block'] as const) {
      const region = model.regions.find((r) => r.id === id);
      expect(region && region.primitives.length).toBeGreaterThan(0);
    }
  });

  it('perspective region carries a (pending) raster slot when no capture supplied', () => {
    const model = buildSlabDetailSheet({ slab: slabEntity('floor', SLAB_R), labels: LABELS });
    const persp = model.regions.find((r) => r.id === 'perspective');
    expect(persp?.primitives.some((p) => p.kind === 'raster')).toBe(true);
  });

  it('foundation (raft) slab also produces non-empty plan + schedule', () => {
    const model = buildSlabDetailSheet({ slab: slabEntity('foundation', SLAB_R), labels: LABELS });
    expect(model.regions.find((r) => r.id === 'plan')?.primitives.length).toBeGreaterThan(0);
    expect(model.regions.find((r) => r.id === 'schedule')?.primitives.length).toBeGreaterThan(0);
  });

  it('empty primitives without reinforcement', () => {
    expect(buildSlabPlanRegion(slabEntity('floor'), regions.plan).primitives).toHaveLength(0);
    expect(buildSlabSectionRegion(slabEntity('floor'), regions.elevation).primitives).toHaveLength(0);
    expect(buildSlabScheduleRegion(slabEntity('floor'), regions.schedule, LABELS.scheduleTable).primitives).toHaveLength(0);
    expect(buildSlabTitleBlockRegion(slabEntity('floor'), regions['title-block'], LABELS.titleFields, 'Floor').primitives).toHaveLength(0);
  });

  it('does not mutate the input slab entity', () => {
    const slab = slabEntity('floor', SLAB_R);
    const snapshot = JSON.stringify(slab);
    buildSlabDetailSheet({ slab, labels: LABELS });
    expect(JSON.stringify(slab)).toEqual(snapshot);
  });
});

describe('buildSlabScheduleRegion — numbers match the compute SSoT', () => {
  it('renders total steel weight + ρ from computeSlabFoundationReinforcementQuantities', () => {
    const slab = slabEntity('floor', SLAB_R);
    const q = computeSlabFoundationReinforcementQuantities(buildSlabFoundationSectionContext(slab), SLAB_R);
    const all = texts(buildSlabScheduleRegion(slab, regions.schedule, LABELS.scheduleTable).primitives);
    expect(all).toContain(q.totalSteelWeightKg.toFixed(1));
    expect(all).toContain(q.bottomWeightKg.toFixed(1));
    expect(all).toContain('Bottom');
    expect(all).toContain('Top');
    expect(all.some((s) => s.startsWith('ρ ='))).toBe(true);
  });
});

describe('buildSlabTitleBlockRegion — kind-aware span/load', () => {
  it('omits span/load rows for a foundation (raft) slab', () => {
    const slab = slabEntity('foundation', SLAB_R);
    const all = texts(buildSlabTitleBlockRegion(slab, regions['title-block'], LABELS.titleFields, 'Foundation').primitives);
    expect(all).not.toContain('Span');
    expect(all).not.toContain('Load');
    expect(all).toContain('Foundation');
  });

  it('includes the span row for a suspended slab', () => {
    const slab = slabEntity('floor', SLAB_R);
    const all = texts(buildSlabTitleBlockRegion(slab, regions['title-block'], LABELS.titleFields, 'Floor').primitives);
    expect(all).toContain('Span');
  });
});
