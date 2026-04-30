/**
 * Unit tests — property-floor-helpers (ADR-329 §3.7.1, §3.7.2)
 */
import { propertiesOnFloor, propertyAreaOnFloor } from '@/lib/properties/floor-helpers';
import type { Property } from '@/types/property';

function makeProperty(p: Partial<Property> & { id: string }): Property {
  return {
    id: p.id,
    name: p.name ?? p.id,
    type: p.type ?? 'apartment',
    building: p.building ?? 'b1',
    floor: p.floor ?? 0,
    status: p.status ?? 'available',
    project: p.project ?? 'proj1',
    buildingId: p.buildingId ?? 'b1',
    floorId: p.floorId ?? '',
    ...p,
  } as Property;
}

describe('propertiesOnFloor', () => {
  it('returns single-level properties matching floorId', () => {
    const props = [
      makeProperty({ id: 'a1', floorId: 'f1' }),
      makeProperty({ id: 'a2', floorId: 'f2' }),
      makeProperty({ id: 'a3', floorId: 'f1' }),
    ];
    expect(propertiesOnFloor('f1', props).map((p) => p.id)).toEqual(['a1', 'a3']);
  });

  it('includes multi-level properties on every floor they occupy', () => {
    const maisonette = makeProperty({
      id: 'm1',
      floorId: 'f1',
      isMultiLevel: true,
      levels: [
        { floorId: 'f1', floorNumber: 1, name: '1ος', isPrimary: true },
        { floorId: 'f2', floorNumber: 2, name: '2ος', isPrimary: false },
      ],
    });
    const flat = makeProperty({ id: 'a2', floorId: 'f2' });
    expect(propertiesOnFloor('f1', [maisonette, flat]).map((p) => p.id)).toEqual(['m1']);
    expect(propertiesOnFloor('f2', [maisonette, flat]).map((p) => p.id)).toEqual(['m1', 'a2']);
  });

  it('returns empty array when floorId is empty', () => {
    expect(propertiesOnFloor('', [makeProperty({ id: 'a1', floorId: 'f1' })])).toEqual([]);
  });
});

describe('propertyAreaOnFloor', () => {
  it('returns total gross for single-level on the floor', () => {
    const p = makeProperty({ id: 'a1', floorId: 'f1', areas: { gross: 80 } });
    expect(propertyAreaOnFloor(p, 'f1')).toEqual({ area: 80, isPartial: false, isFallback: false });
  });

  it('returns null when property is not on the floor', () => {
    const p = makeProperty({ id: 'a1', floorId: 'f1' });
    expect(propertyAreaOnFloor(p, 'f2')).toBeNull();
  });

  it('uses partial level area when multi-level has levelData[floorId]', () => {
    const p = makeProperty({
      id: 'm1',
      floorId: 'f1',
      areas: { gross: 120 },
      isMultiLevel: true,
      levels: [
        { floorId: 'f1', floorNumber: 1, name: '1', isPrimary: true },
        { floorId: 'f2', floorNumber: 2, name: '2', isPrimary: false },
      ],
      levelData: {
        f1: { areas: { gross: 60 } },
        f2: { areas: { gross: 60 } },
      },
    });
    expect(propertyAreaOnFloor(p, 'f1')).toEqual({ area: 60, isPartial: true, isFallback: false });
    expect(propertyAreaOnFloor(p, 'f2')).toEqual({ area: 60, isPartial: true, isFallback: false });
  });

  it('falls back to total area with isFallback=true when no per-level data', () => {
    const p = makeProperty({
      id: 'm1',
      floorId: 'f1',
      areas: { gross: 120 },
      isMultiLevel: true,
      levels: [
        { floorId: 'f1', floorNumber: 1, name: '1', isPrimary: true },
        { floorId: 'f2', floorNumber: 2, name: '2', isPrimary: false },
      ],
    });
    expect(propertyAreaOnFloor(p, 'f2')).toEqual({ area: 120, isPartial: false, isFallback: true });
  });
});
