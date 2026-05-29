/**
 * Tests για bim/schedule/schedule-builder + schedule-presets (ADR-363 Phase 8 §6).
 */

import type { OpeningEntity, OpeningHanding, OpeningKind, OpeningSwing } from '../../types/opening-types';
import type { WallEntity } from '../../types/wall-types';
import type { SlabEntity } from '../../types/slab-types';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { SlabOpeningEntity } from '../../types/slab-opening-types';
import type { AnyBimEntity } from '../schedule-presets';
import {
  buildSchedule,
  emptySchedule,
} from '../schedule-builder';
import {
  getPreset,
  handingToDIN,
  handingToGreek,
  openingKindToScheduleType,
} from '../schedule-presets';
import {
  passesBuildingFilter,
} from '../filters';
import type { ScheduleConfig, ScheduleLookups } from '../types';

// ─── Lookups + fixtures ──────────────────────────────────────────────────────

// finishThickness registry: floor-1 has 100mm finish, unknown floors → undefined (fallback 80mm)
const FINISH_REGISTRY: Record<string, number> = { 'floor-1': 100 };

// Building registry: building-A = "Κτίριο Α", building-B = "Κτίριο Β"
const BUILDING_REGISTRY: Record<string, { id: string; name: string }> = {
  'building-A': { id: 'building-A', name: 'Κτίριο Α' },
  'building-B': { id: 'building-B', name: 'Κτίριο Β' },
};

const lookups: ScheduleLookups = {
  floor: (id) => (id ? `Όροφος ${id}` : ''),
  material: (id) => (id ? `Υλικό:${id}` : ''),
  floorFinish: (id) => (id ? FINISH_REGISTRY[id] : undefined),
};

const lookupsWithBuilding: ScheduleLookups = {
  ...lookups,
  building: (buildingId) => (buildingId ? BUILDING_REGISTRY[buildingId] : undefined),
};

function emptyValidation() {
  return { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null };
}

function bbox(x: number, y: number) {
  return { min: { x: 0, y: 0 }, max: { x, y } };
}

function makeWall(id: string, overrides: Partial<WallEntity> = {}): WallEntity {
  return {
    id,
    type: 'wall',
    kind: 'straight',
    floorId: 'floor-1',
    buildingId: undefined,
    params: {
      category: 'exterior',
      start: { x: 0, y: 0 },
      end: { x: 5000, y: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }] },
      outerEdge: { points: [] },
      innerEdge: { points: [] },
      bbox: bbox(5000, 250),
      length: 5,
      area: 15,
      volume: 3.75,
    },
    validation: emptyValidation(),
    ...overrides,
  } as unknown as WallEntity;
}

function makeOpening(
  id: string,
  kind: OpeningKind,
  handing?: OpeningHanding,
  swing?: OpeningSwing,
): OpeningEntity {
  return {
    id,
    type: 'opening',
    kind,
    floorId: 'floor-1',
    params: {
      kind,
      wallId: 'wall-1',
      offsetFromStart: 500,
      width: 900,
      height: 2100,
      sillHeight: kind === 'window' ? 900 : 0,
      handing,
      openDirection: swing,
      material: 'mat-wood',
    },
    geometry: {
      position: { x: 1000, y: 0 },
      rotation: 0,
      outline: { vertices: [] },
      bbox: bbox(900, 2100),
      area: 1.89,
      perimeter: 6,
    },
    validation: emptyValidation(),
  } as unknown as OpeningEntity;
}

function makeSlab(id: string, levelElevation = 0): SlabEntity {
  return {
    id,
    type: 'slab',
    kind: 'floor',
    floorId: 'floor-1',
    params: {
      kind: 'floor',
      outline: { vertices: [] },
      levelElevation,
      geometryType: 'box',
      thickness: 200,
      material: 'mat-concrete-c25',
    },
    geometry: {
      polygon: { vertices: [] },
      bbox: bbox(5000, 5000),
      area: 25,
      netArea: 25,
      volume: 5,
      perimeter: 20,
    },
    validation: emptyValidation(),
  } as unknown as SlabEntity;
}

function makeColumn(id: string): ColumnEntity {
  return {
    id,
    type: 'column',
    kind: 'rectangular',
    floorId: 'floor-1',
    params: {
      kind: 'rectangular',
      position: { x: 0, y: 0 },
      anchor: 'center',
      width: 400,
      depth: 400,
      height: 3000,
      rotation: 0,
    },
    geometry: {
      footprint: { vertices: [] },
      bbox: bbox(400, 400),
      area: 0.16,
      volume: 0.48,
      height: 3000,
    },
    validation: emptyValidation(),
  } as unknown as ColumnEntity;
}

function makeBeam(id: string): BeamEntity {
  return {
    id,
    type: 'beam',
    kind: 'straight',
    floorId: 'floor-1',
    params: {
      kind: 'straight',
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 4000, y: 0 },
      width: 250,
      depth: 500,
      elevation: 3000,
      supportType: 'simple',
    },
    geometry: {
      axisPolyline: { points: [] },
      outline: { vertices: [] },
      bbox: bbox(4000, 250),
      length: 4,
      area: 1,
      volume: 0.5,
    },
    validation: emptyValidation(),
  } as unknown as BeamEntity;
}

function makeSlabOpening(id: string): SlabOpeningEntity {
  return {
    id,
    type: 'slab-opening',
    kind: 'shaft',
    floorId: 'floor-1',
    params: {
      kind: 'shaft',
      slabId: 'slab-1',
      outline: { vertices: [] },
      fireRating: 90,
    },
    geometry: {
      polygon: { vertices: [] },
      bbox: bbox(1500, 1500),
      area: 2.25,
      perimeter: 6,
    },
    validation: emptyValidation(),
  } as unknown as SlabOpeningEntity;
}

// ─── Handing helpers ─────────────────────────────────────────────────────────

describe('handingToGreek', () => {
  test('returns empty string when handing undefined', () => {
    expect(handingToGreek(undefined, undefined)).toBe('');
  });
  test('side-only when swing undefined', () => {
    expect(handingToGreek('left', undefined)).toBe('Αριστερά');
    expect(handingToGreek('right', undefined)).toBe('Δεξιά');
  });
  test('full descriptive label when both set', () => {
    expect(handingToGreek('right', 'inward')).toBe('Δεξιά · Άνοιγμα προς τα μέσα');
    expect(handingToGreek('left', 'outward')).toBe('Αριστερά · Άνοιγμα προς τα έξω');
  });
});

describe('handingToDIN', () => {
  test('returns empty string when handing undefined', () => {
    expect(handingToDIN(undefined, undefined)).toBe('');
  });
  test('hand-only when swing undefined', () => {
    expect(handingToDIN('left', undefined)).toBe('LH');
    expect(handingToDIN('right', undefined)).toBe('RH');
  });
  test('full DIN code when both set', () => {
    expect(handingToDIN('right', 'inward')).toBe('RH-IN');
    expect(handingToDIN('left', 'outward')).toBe('LH-OUT');
  });
});

// ─── Opening kind routing ────────────────────────────────────────────────────

describe('openingKindToScheduleType', () => {
  test('door routes to door preset', () => {
    expect(openingKindToScheduleType('door')).toBe('door');
  });
  test('sliding-door routes to door preset', () => {
    expect(openingKindToScheduleType('sliding-door')).toBe('door');
  });
  test('french-door routes to door preset', () => {
    expect(openingKindToScheduleType('french-door')).toBe('door');
  });
  test('window routes to window preset', () => {
    expect(openingKindToScheduleType('window')).toBe('window');
  });
  test('fixed routes to window preset', () => {
    expect(openingKindToScheduleType('fixed')).toBe('window');
  });
});

// ─── Preset registry ─────────────────────────────────────────────────────────

describe('getPreset', () => {
  test('door preset has dual-handing columns', () => {
    const preset = getPreset('door');
    const keys = preset.columns.map((c) => c.key);
    expect(keys).toContain('handingText');
    expect(keys).toContain('handingCode');
    expect(keys).not.toContain('glazing');
  });
  test('window preset has glazing column but no handing', () => {
    const preset = getPreset('window');
    const keys = preset.columns.map((c) => c.key);
    expect(keys).toContain('glazing');
    expect(keys).not.toContain('handingText');
  });
  test('combined preset has geometry-derived quantity columns (ADR-395 G5)', () => {
    const preset = getPreset('combined');
    const keys = preset.columns.map((c) => c.key);
    expect(keys).toContain('primaryQuantity');
    expect(keys).toContain('primaryUnit');
    expect(keys).toContain('atoeCategory');
  });
});

// ─── buildSchedule — wall ────────────────────────────────────────────────────

describe('buildSchedule', () => {
  test('builds wall schedule from wall entities only', () => {
    const entities: AnyBimEntity[] = [makeWall('w1'), makeWall('w2'), makeSlab('s1')];
    const config: ScheduleConfig = { entityType: 'wall', filters: {} };
    const schedule = buildSchedule(entities, config, lookups);
    expect(schedule.entityType).toBe('wall');
    expect(schedule.rows).toHaveLength(2);
    expect(schedule.rows.map((r) => r.entityId)).toEqual(['w1', 'w2']);
    expect(schedule.rows[0].cells['length']).toBe(5); // m, από makeWall geometry.length
  });

  // ADR-395 §4.6 (G5): combined preset derives primaryQuantity/unit/ΑΤΟΕ από
  // computed geometry + ΑΤΟΕ SSoT (όχι από το αφαιρεμένο `qto` field).
  test('combined schedule derives primary quantity from geometry + ΑΤΟΕ (ADR-395 G5)', () => {
    const entities: AnyBimEntity[] = [makeWall('w1')];
    const config: ScheduleConfig = { entityType: 'combined', filters: {} };
    const schedule = buildSchedule(entities, config, lookups);
    expect(schedule.rows).toHaveLength(1);
    const cells = schedule.rows[0].cells;
    expect(cells['primaryQuantity']).toBe(15); // m² από makeWall geometry.area
    expect(cells['primaryUnit']).toBe('m2');
    expect(cells['atoeCategory']).toBe('OIK-3.05'); // exterior wall ΑΤΟΕ
  });

  test('door schedule routes only door-kind openings', () => {
    const entities: AnyBimEntity[] = [
      makeOpening('o1', 'door', 'left', 'inward'),
      makeOpening('o2', 'window'),
      makeOpening('o3', 'sliding-door', 'right', 'outward'),
      makeOpening('o4', 'french-door', 'right', 'inward'),
      makeOpening('o5', 'fixed'),
    ];
    const config: ScheduleConfig = { entityType: 'door', filters: {} };
    const schedule = buildSchedule(entities, config, lookups);
    expect(schedule.rows.map((r) => r.entityId)).toEqual(['o1', 'o3', 'o4']);
  });

  test('window schedule routes only window+fixed openings', () => {
    const entities: AnyBimEntity[] = [
      makeOpening('o1', 'door'),
      makeOpening('o2', 'window'),
      makeOpening('o3', 'fixed'),
    ];
    const config: ScheduleConfig = { entityType: 'window', filters: {} };
    const schedule = buildSchedule(entities, config, lookups);
    expect(schedule.rows.map((r) => r.entityId)).toEqual(['o2', 'o3']);
  });

  test('door schedule populates handing dual columns', () => {
    const entities: AnyBimEntity[] = [makeOpening('o1', 'door', 'right', 'inward')];
    const config: ScheduleConfig = { entityType: 'door', filters: {} };
    const schedule = buildSchedule(entities, config, lookups);
    const row = schedule.rows[0];
    expect(row.cells.handingText).toBe('Δεξιά · Άνοιγμα προς τα μέσα');
    expect(row.cells.handingCode).toBe('RH-IN');
  });

  test('combined schedule includes ALL entity types', () => {
    const entities: AnyBimEntity[] = [
      makeWall('w1'),
      makeOpening('o1', 'door'),
      makeSlab('s1'),
      makeColumn('c1'),
      makeBeam('b1'),
      makeSlabOpening('so1'),
    ];
    const config: ScheduleConfig = { entityType: 'combined', filters: {} };
    const schedule = buildSchedule(entities, config, lookups);
    expect(schedule.rows).toHaveLength(6);
    expect(schedule.rows.map((r) => r.cells.type)).toEqual([
      'wall', 'opening', 'slab', 'column', 'beam', 'slab-opening',
    ]);
  });

  test('floor filter excludes other floors', () => {
    const entities: AnyBimEntity[] = [
      makeWall('w1', { floorId: 'floor-1' }),
      makeWall('w2', { floorId: 'floor-2' }),
    ];
    const config: ScheduleConfig = {
      entityType: 'wall',
      filters: { floorIds: ['floor-1'] },
    };
    const schedule = buildSchedule(entities, config, lookups);
    expect(schedule.rows.map((r) => r.entityId)).toEqual(['w1']);
  });

  test('selection filter narrows to selected ids', () => {
    const entities: AnyBimEntity[] = [makeWall('w1'), makeWall('w2'), makeWall('w3')];
    const config: ScheduleConfig = {
      entityType: 'wall',
      filters: { selectionIds: ['w2'] },
    };
    const schedule = buildSchedule(entities, config, lookups);
    expect(schedule.rows.map((r) => r.entityId)).toEqual(['w2']);
  });

  test('preserves caller entity order in output rows', () => {
    const entities: AnyBimEntity[] = [
      makeWall('w3'),
      makeWall('w1'),
      makeWall('w2'),
    ];
    const schedule = buildSchedule(entities, { entityType: 'wall', filters: {} }, lookups);
    expect(schedule.rows.map((r) => r.entityId)).toEqual(['w3', 'w1', 'w2']);
  });

  test('lookups resolve floor + material labels into cells', () => {
    const entities: AnyBimEntity[] = [makeOpening('o1', 'door')];
    const schedule = buildSchedule(entities, { entityType: 'door', filters: {} }, lookups);
    const row = schedule.rows[0];
    expect(row.cells.floor).toBe('Όροφος floor-1');
    expect(row.cells.material).toBe('Υλικό:mat-wood');
  });

  test('slab tosElevation = levelElevation - floorFinish (ADR-369 Q4)', () => {
    // floor-1 has finishThickness=100mm; slab levelElevation=3000mm → ToS=2900mm
    const entities: AnyBimEntity[] = [makeSlab('s1', 3000)];
    const schedule = buildSchedule(entities, { entityType: 'slab', filters: {} }, lookups);
    expect(schedule.rows[0].cells.tosElevation).toBe(2900);
  });

  test('slab tosElevation falls back to 80mm when floor not in registry', () => {
    // unknown floor → finishThickness fallback 80mm; levelElevation=1000 → ToS=920mm
    const slab: SlabEntity = { ...makeSlab('s2', 1000), floorId: 'unknown-floor' };
    const schedule = buildSchedule([slab], { entityType: 'slab', filters: {} }, lookups);
    expect(schedule.rows[0].cells.tosElevation).toBe(920);
  });

  test('generatedAt is fresh timestamp', () => {
    const before = Date.now();
    const schedule = buildSchedule([], { entityType: 'wall', filters: {} }, lookups);
    const after = Date.now();
    expect(schedule.generatedAt).toBeGreaterThanOrEqual(before);
    expect(schedule.generatedAt).toBeLessThanOrEqual(after);
  });

  test('columns matches preset schema', () => {
    const schedule = buildSchedule([], { entityType: 'wall', filters: {} }, lookups);
    expect(schedule.columns).toBe(getPreset('wall').columns);
  });
});

// ─── emptySchedule ───────────────────────────────────────────────────────────

describe('emptySchedule', () => {
  test('returns preset columns + zero rows', () => {
    const schedule = emptySchedule('door');
    expect(schedule.columns.length).toBeGreaterThan(0);
    expect(schedule.rows).toHaveLength(0);
    expect(schedule.entityType).toBe('door');
  });
});

// ─── Q2.4: buildingId propagation ────────────────────────────────────────────

describe('Q2.4: buildingId in ScheduleRow', () => {
  test('row.buildingId propagated from entity.buildingId', () => {
    const wall: WallEntity = { ...makeWall('w1'), buildingId: 'building-A' };
    const schedule = buildSchedule([wall], { entityType: 'wall', filters: {} }, lookups);
    expect(schedule.rows[0].buildingId).toBe('building-A');
  });

  test('row.buildingId is undefined when entity has none', () => {
    const schedule = buildSchedule([makeWall('w1')], { entityType: 'wall', filters: {} }, lookups);
    expect(schedule.rows[0].buildingId).toBeUndefined();
  });

  test('wall cells include buildingName via building lookup', () => {
    const wall: WallEntity = { ...makeWall('w1'), buildingId: 'building-A' };
    const schedule = buildSchedule([wall], { entityType: 'wall', filters: {} }, lookupsWithBuilding);
    expect(schedule.rows[0].cells['buildingName']).toBe('Κτίριο Α');
  });

  test('wall cells have null buildingName when lookup absent', () => {
    const wall: WallEntity = { ...makeWall('w1'), buildingId: 'building-A' };
    const schedule = buildSchedule([wall], { entityType: 'wall', filters: {} }, lookups);
    expect(schedule.rows[0].cells['buildingName']).toBeNull();
  });

  test('wall preset includes buildingName column def', () => {
    const preset = getPreset('wall');
    const keys = preset.columns.map((c) => c.key);
    expect(keys).toContain('buildingName');
  });
});

// ─── Q2.4: buildingIds filter axis ───────────────────────────────────────────

describe('Q2.4: passesBuildingFilter', () => {
  const entity = { id: 'w1', floorId: 'f1', buildingId: 'building-A', kind: 'straight', geometry: { bbox: { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } } }, params: {} };

  test('undefined buildingIds → pass-through', () => {
    expect(passesBuildingFilter(entity, undefined)).toBe(true);
  });

  test('empty array → match-nothing', () => {
    expect(passesBuildingFilter(entity, [])).toBe(false);
  });

  test('matching buildingId → passes', () => {
    expect(passesBuildingFilter(entity, ['building-A'])).toBe(true);
  });

  test('non-matching buildingId → fails', () => {
    expect(passesBuildingFilter(entity, ['building-B'])).toBe(false);
  });

  test('entity without buildingId fails when filter active', () => {
    const noBuilding = { ...entity, buildingId: undefined };
    expect(passesBuildingFilter(noBuilding, ['building-A'])).toBe(false);
  });
});

describe('Q2.4: buildingIds filter in buildSchedule', () => {
  test('buildingIds filter excludes other buildings', () => {
    const wallA: WallEntity = { ...makeWall('w1'), buildingId: 'building-A' };
    const wallB: WallEntity = { ...makeWall('w2'), buildingId: 'building-B' };
    const config: ScheduleConfig = { entityType: 'wall', filters: { buildingIds: ['building-A'] } };
    const schedule = buildSchedule([wallA, wallB], config, lookups);
    expect(schedule.rows.map((r) => r.entityId)).toEqual(['w1']);
  });

  test('undefined buildingIds includes all buildings', () => {
    const wallA: WallEntity = { ...makeWall('w1'), buildingId: 'building-A' };
    const wallB: WallEntity = { ...makeWall('w2'), buildingId: 'building-B' };
    const schedule = buildSchedule([wallA, wallB], { entityType: 'wall', filters: {} }, lookups);
    expect(schedule.rows).toHaveLength(2);
  });
});

// ─── Q2.4: groupByBuilding sort ──────────────────────────────────────────────

describe('Q2.4: groupByBuilding', () => {
  test('rows sorted by buildingId when groupByBuilding = true', () => {
    const wallB: WallEntity = { ...makeWall('w1'), buildingId: 'building-B' };
    const wallA: WallEntity = { ...makeWall('w2'), buildingId: 'building-A' };
    const wallC: WallEntity = { ...makeWall('w3'), buildingId: 'building-A' };
    const config: ScheduleConfig = { entityType: 'wall', filters: {}, groupByBuilding: true };
    const schedule = buildSchedule([wallB, wallA, wallC], config, lookups);
    expect(schedule.rows.map((r) => r.buildingId)).toEqual([
      'building-A', 'building-A', 'building-B',
    ]);
  });

  test('without groupByBuilding preserves caller order', () => {
    const wallB: WallEntity = { ...makeWall('w1'), buildingId: 'building-B' };
    const wallA: WallEntity = { ...makeWall('w2'), buildingId: 'building-A' };
    const schedule = buildSchedule([wallB, wallA], { entityType: 'wall', filters: {} }, lookups);
    expect(schedule.rows.map((r) => r.buildingId)).toEqual(['building-B', 'building-A']);
  });

  test('entities without buildingId sort before named buildings', () => {
    const wallNone: WallEntity = { ...makeWall('w1'), buildingId: undefined };
    const wallA: WallEntity = { ...makeWall('w2'), buildingId: 'building-A' };
    const config: ScheduleConfig = { entityType: 'wall', filters: {}, groupByBuilding: true };
    const schedule = buildSchedule([wallA, wallNone], config, lookups);
    expect(schedule.rows[0].buildingId).toBeUndefined();
    expect(schedule.rows[1].buildingId).toBe('building-A');
  });
});
