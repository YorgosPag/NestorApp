/**
 * ADR-370 §5.3 — `getSlabCornerWorldPoints` tests.
 *
 * Verifies:
 *   - Returns one entry per polygon vertex (vertexIndex 0..N-1).
 *   - Coordinates match the polygon vertices exactly.
 *   - Degenerate slab (< 3 vertices) returns [].
 *   - Arbitrary polygon vertex count supported (triangle, quad, pentagon…).
 */

import { getSlabCornerWorldPoints } from '../slab-corner-anchors';
import type { SlabEntity } from '../../types/slab-types';
import type { Polygon3D } from '../../types/bim-base';

function makeSlabEntity(vertices: { x: number; y: number }[], id = 'slab_test'): SlabEntity {
  const polygon: Polygon3D = { vertices: vertices.map(v => ({ x: v.x, y: v.y })) };
  return {
    id,
    type: 'slab',
    kind: 'floor',
    layerId: '0',
    params: undefined as never,
    geometry: { polygon, bbox: undefined as never, area: 0, netArea: 0, volume: 0, perimeter: 0 },
    validation: undefined as never,
    visible: true,
  } as unknown as SlabEntity;
}

const SQUARE = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
const TRIANGLE = [{ x: 0, y: 0 }, { x: 500, y: 866 }, { x: 1000, y: 0 }];
const PENTAGON = [
  { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 900, y: 400 },
  { x: 400, y: 700 }, { x: -100, y: 400 },
];

describe('getSlabCornerWorldPoints', () => {
  it('square slab: returns 4 entries', () => {
    expect(getSlabCornerWorldPoints(makeSlabEntity(SQUARE))).toHaveLength(4);
  });

  it('triangle slab: returns 3 entries', () => {
    expect(getSlabCornerWorldPoints(makeSlabEntity(TRIANGLE))).toHaveLength(3);
  });

  it('pentagon slab: returns 5 entries', () => {
    expect(getSlabCornerWorldPoints(makeSlabEntity(PENTAGON))).toHaveLength(5);
  });

  it('vertexIndex matches position in array', () => {
    const result = getSlabCornerWorldPoints(makeSlabEntity(SQUARE));
    result.forEach((c, i) => {
      expect(c.vertexIndex).toBe(i);
    });
  });

  it('point coordinates match polygon vertices', () => {
    const result = getSlabCornerWorldPoints(makeSlabEntity(SQUARE));
    SQUARE.forEach((v, i) => {
      expect(result[i]!.point.x).toBeCloseTo(v.x, 6);
      expect(result[i]!.point.y).toBeCloseTo(v.y, 6);
    });
  });

  it('degenerate: 2-vertex polygon returns []', () => {
    expect(getSlabCornerWorldPoints(makeSlabEntity([{ x: 0, y: 0 }, { x: 100, y: 0 }]))).toHaveLength(0);
  });

  it('degenerate: empty polygon returns []', () => {
    expect(getSlabCornerWorldPoints(makeSlabEntity([]))).toHaveLength(0);
  });
});
