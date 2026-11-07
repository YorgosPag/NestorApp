/// <reference types="jest" />
/**
 * ADR-933 — Μέθοδος «Ορθογώνια»: δύο γωνίες → 4 κορυφές, ίδιες για προεπισκόπηση και αποθήκευση.
 */

import { regionRectangleRing } from '../region-rectangle';
import { polygonArea } from '@/lib/geometry/planar-polygon';

const area = (ring: Array<[number, number]>) => polygonArea(ring.map(([x, y]) => ({ x, y })));

describe('regionRectangleRing', () => {
  it('builds the 4-corner ring of the two opposite corners', () => {
    const ring = regionRectangleRing([0, 0], { x: 4000, y: 3000 });
    expect(ring).toHaveLength(4);
    expect(area(ring as Array<[number, number]>)).toBe(12_000_000);
  });

  it('is independent of drag direction (right→left / top→bottom)', () => {
    const a = regionRectangleRing([0, 0], { x: 4000, y: 3000 });
    const b = regionRectangleRing([4000, 3000], { x: 0, y: 0 });
    expect(b).toEqual(a);
  });

  it('returns null for a degenerate rectangle (zero width or height)', () => {
    expect(regionRectangleRing([0, 0], { x: 0, y: 3000 })).toBeNull();
    expect(regionRectangleRing([0, 0], { x: 4000, y: 0 })).toBeNull();
  });
});
