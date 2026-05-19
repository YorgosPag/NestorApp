/**
 * Tests για bim/schedule/filters (ADR-363 Phase 8 §6).
 */

import type { BoundingBox3D } from '../../types/bim-base';
import {
  applyScheduleFilters,
  passesAllFilters,
  passesCategoryFilter,
  passesFloorFilter,
  passesRegionFilter,
  passesSelectionFilter,
  type FilterableBimEntity,
} from '../filters';
import type { ScheduleFilterCriteria } from '../types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<FilterableBimEntity> = {}): FilterableBimEntity {
  return {
    id: 'e1',
    kind: 'straight',
    floorId: 'floor-1',
    geometry: { bbox: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } } },
    params: { material: 'mat-concrete-c25' },
    ...overrides,
  };
}

function box(minX: number, minY: number, maxX: number, maxY: number): BoundingBox3D {
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

// ─── Floor filter ────────────────────────────────────────────────────────────

describe('passesFloorFilter', () => {
  test('passes when criteria is undefined', () => {
    expect(passesFloorFilter(makeEntity(), undefined)).toBe(true);
  });
  test('passes when floorId is in allowed list', () => {
    expect(passesFloorFilter(makeEntity({ floorId: 'floor-2' }), ['floor-1', 'floor-2'])).toBe(true);
  });
  test('rejects when floorId not in allowed list', () => {
    expect(passesFloorFilter(makeEntity({ floorId: 'floor-3' }), ['floor-1', 'floor-2'])).toBe(false);
  });
  test('rejects when entity has no floorId and filter active', () => {
    expect(passesFloorFilter(makeEntity({ floorId: undefined }), ['floor-1'])).toBe(false);
  });
  test('rejects all when allowed list is empty array', () => {
    expect(passesFloorFilter(makeEntity(), [])).toBe(false);
  });
});

// ─── Category filter ─────────────────────────────────────────────────────────

describe('passesCategoryFilter', () => {
  test('passes when criteria is undefined', () => {
    expect(passesCategoryFilter(makeEntity(), undefined)).toBe(true);
  });
  test('matches by material id', () => {
    expect(passesCategoryFilter(makeEntity(), ['mat-concrete-c25'])).toBe(true);
  });
  test('matches by entity kind', () => {
    expect(passesCategoryFilter(makeEntity({ kind: 'door' }), ['door'])).toBe(true);
  });
  test('matches material OR kind heterogeneously', () => {
    // "door" (kind) + "mat-wood" (material) both in same filter array
    const woodDoor = makeEntity({ kind: 'door', params: { material: 'mat-wood' } });
    expect(passesCategoryFilter(woodDoor, ['mat-wood', 'window'])).toBe(true);
  });
  test('rejects when neither material nor kind match', () => {
    expect(passesCategoryFilter(makeEntity({ kind: 'wall' }), ['door', 'window'])).toBe(false);
  });
});

// ─── Region filter ───────────────────────────────────────────────────────────

describe('passesRegionFilter', () => {
  test('passes when criteria is undefined', () => {
    expect(passesRegionFilter(makeEntity(), undefined)).toBe(true);
  });
  test('passes when bboxes fully overlap', () => {
    const entity = makeEntity({ geometry: { bbox: box(100, 100, 500, 500) } });
    expect(passesRegionFilter(entity, box(0, 0, 1000, 1000))).toBe(true);
  });
  test('passes when bboxes partially overlap', () => {
    const entity = makeEntity({ geometry: { bbox: box(0, 0, 100, 100) } });
    expect(passesRegionFilter(entity, box(50, 50, 200, 200))).toBe(true);
  });
  test('passes when bboxes share an edge (inclusive)', () => {
    const entity = makeEntity({ geometry: { bbox: box(0, 0, 100, 100) } });
    expect(passesRegionFilter(entity, box(100, 0, 200, 100))).toBe(true);
  });
  test('rejects when bboxes are disjoint horizontally', () => {
    const entity = makeEntity({ geometry: { bbox: box(0, 0, 100, 100) } });
    expect(passesRegionFilter(entity, box(200, 0, 300, 100))).toBe(false);
  });
  test('rejects when bboxes are disjoint vertically', () => {
    const entity = makeEntity({ geometry: { bbox: box(0, 0, 100, 100) } });
    expect(passesRegionFilter(entity, box(0, 200, 100, 300))).toBe(false);
  });
  test('z dimension is ignored', () => {
    const entity = makeEntity({
      geometry: { bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } } },
    });
    const region: BoundingBox3D = {
      min: { x: 50, y: 50, z: 9999 },
      max: { x: 150, y: 150, z: 99999 },
    };
    expect(passesRegionFilter(entity, region)).toBe(true);
  });
});

// ─── Selection filter ────────────────────────────────────────────────────────

describe('passesSelectionFilter', () => {
  test('passes when criteria is undefined', () => {
    expect(passesSelectionFilter(makeEntity(), undefined)).toBe(true);
  });
  test('passes when id is in selection', () => {
    expect(passesSelectionFilter(makeEntity({ id: 'a' }), ['a', 'b'])).toBe(true);
  });
  test('rejects when id not in selection', () => {
    expect(passesSelectionFilter(makeEntity({ id: 'c' }), ['a', 'b'])).toBe(false);
  });
  test('rejects all when selection is empty array', () => {
    expect(passesSelectionFilter(makeEntity(), [])).toBe(false);
  });
});

// ─── Composed AND ────────────────────────────────────────────────────────────

describe('passesAllFilters', () => {
  const allCriteria: ScheduleFilterCriteria = {
    floorIds: ['floor-1'],
    categories: ['mat-concrete-c25'],
    region: box(0, 0, 1000, 1000),
    selectionIds: ['e1'],
  };

  test('passes when all 4 axes pass', () => {
    expect(passesAllFilters(makeEntity(), allCriteria)).toBe(true);
  });
  test('fails when any single axis fails (floor)', () => {
    expect(passesAllFilters(makeEntity({ floorId: 'floor-2' }), allCriteria)).toBe(false);
  });
  test('fails when any single axis fails (category)', () => {
    expect(passesAllFilters(makeEntity({ params: { material: 'mat-other' }, kind: 'straight' }), allCriteria)).toBe(false);
  });
  test('fails when any single axis fails (region)', () => {
    expect(passesAllFilters(makeEntity({ geometry: { bbox: box(9000, 9000, 9100, 9100) } }), allCriteria)).toBe(false);
  });
  test('fails when any single axis fails (selection)', () => {
    expect(passesAllFilters(makeEntity({ id: 'e2' }), allCriteria)).toBe(false);
  });
  test('passes when only some axes defined (others undefined)', () => {
    const partial: ScheduleFilterCriteria = { floorIds: ['floor-1'] };
    expect(passesAllFilters(makeEntity(), partial)).toBe(true);
  });
});

// ─── applyScheduleFilters ────────────────────────────────────────────────────

describe('applyScheduleFilters', () => {
  test('returns a new array (input not mutated)', () => {
    const entities = [makeEntity({ id: 'a' }), makeEntity({ id: 'b' })];
    const filtered = applyScheduleFilters(entities, {});
    expect(filtered).not.toBe(entities);
    expect(filtered).toEqual(entities);
  });
  test('filters out non-matching entities', () => {
    const entities = [
      makeEntity({ id: 'a', floorId: 'floor-1' }),
      makeEntity({ id: 'b', floorId: 'floor-2' }),
      makeEntity({ id: 'c', floorId: 'floor-1' }),
    ];
    const filtered = applyScheduleFilters(entities, { floorIds: ['floor-1'] });
    expect(filtered.map((e) => e.id)).toEqual(['a', 'c']);
  });
  test('preserves input order in output', () => {
    const entities = ['a', 'b', 'c', 'd', 'e'].map((id) => makeEntity({ id }));
    const filtered = applyScheduleFilters(entities, { selectionIds: ['e', 'a', 'c'] });
    expect(filtered.map((e) => e.id)).toEqual(['a', 'c', 'e']);
  });
});
