/**
 * Unit tests — allocateCost (ADR-329 §3.1.1, §3.7.2)
 */
import { allocateCost } from '../cost-engine';
import type { Property } from '@/types/property';

function P(id: string, area: number, levels?: Property['levels'], levelData?: Property['levelData']): Property {
  return {
    id,
    name: id,
    type: 'apartment',
    building: 'b1',
    floor: 0,
    status: 'available',
    project: 'p1',
    buildingId: 'b1',
    floorId: levels ? levels[0].floorId : 'f1',
    areas: { gross: area },
    isMultiLevel: !!levels,
    levels,
    levelData,
  } as Property;
}

describe('allocateCost — equal', () => {
  it('splits totalCost evenly across N targets', () => {
    const targets = [P('a1', 80), P('a2', 70), P('a3', 60)];
    const r = allocateCost(targets, 900, 'equal', 'building', null, null);
    expect(r.allocations).toEqual({ a1: 300, a2: 300, a3: 300 });
    expect(r.warnings).toEqual([]);
  });
});

describe('allocateCost — by_area (single-level)', () => {
  it('proportional split using gross area', () => {
    const targets = [P('a1', 80), P('a2', 70)];
    const r = allocateCost(targets, 1500, 'by_area', 'building', null, null);
    expect(r.allocations.a1).toBeCloseTo(800);
    expect(r.allocations.a2).toBeCloseTo(700);
  });

  it('falls back to equal when total area is 0', () => {
    const targets = [P('a1', 0), P('a2', 0)];
    const r = allocateCost(targets, 100, 'by_area', 'building', null, null);
    expect(r.allocations).toEqual({ a1: 50, a2: 50 });
    expect(r.warnings.some((w) => w.type === 'no_area_fallback_to_equal')).toBe(true);
  });
});

describe('allocateCost — by_area on a floor with multi-level partial areas', () => {
  it('uses levelData[floorId].areas.gross instead of total area', () => {
    const maisonette = P(
      'm1',
      120,
      [
        { floorId: 'f1', floorNumber: 1, name: '1', isPrimary: true },
        { floorId: 'f2', floorNumber: 2, name: '2', isPrimary: false },
      ],
      { f1: { areas: { gross: 60 } }, f2: { areas: { gross: 60 } } },
    );
    const flat1 = P('a1', 80);
    const flat2 = P('a2', 70);
    const targets = [flat1, flat2, maisonette];
    const r = allocateCost(targets, 1200, 'by_area', 'floor', 'f1', null);
    // Σ areas on f1: 80 + 70 + 60 = 210
    expect(r.allocations.a1).toBeCloseTo((80 / 210) * 1200);
    expect(r.allocations.a2).toBeCloseTo((70 / 210) * 1200);
    expect(r.allocations.m1).toBeCloseTo((60 / 210) * 1200);
  });

  it('emits partial_area_fallback warning when multi-level lacks levelData', () => {
    const maisonette = P('m1', 120, [
      { floorId: 'f1', floorNumber: 1, name: '1', isPrimary: true },
      { floorId: 'f2', floorNumber: 2, name: '2', isPrimary: false },
    ]);
    const r = allocateCost([maisonette, P('a1', 80)], 600, 'by_area', 'floor', 'f1', null);
    expect(r.warnings.some((w) => w.type === 'partial_area_fallback' && w.propertyId === 'm1')).toBe(true);
  });
});

describe('allocateCost — custom', () => {
  it('honors user percentages', () => {
    const targets = [P('a1', 80), P('a2', 70), P('a3', 60)];
    const r = allocateCost(targets, 1000, 'custom', 'properties', null, { a1: 50, a2: 30, a3: 20 });
    expect(r.allocations).toEqual({ a1: 500, a2: 300, a3: 200 });
  });
});

describe('allocateCost — empty targets', () => {
  it('returns empty allocations with empty_targets warning', () => {
    const r = allocateCost([], 1000, 'by_area', 'building', null, null);
    expect(r.allocations).toEqual({});
    expect(r.warnings).toEqual([{ type: 'empty_targets' }]);
  });
});
