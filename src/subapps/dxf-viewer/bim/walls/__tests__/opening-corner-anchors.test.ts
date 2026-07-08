/**
 * ADR-597 §5.5 — `getOpeningCornerWorldPoints` tests.
 *
 * Verifies:
 *   - Returns exactly 4 entries for valid 4-vertex outline.
 *   - Corner labels: innerStart, innerEnd, outerEnd, outerStart (CCW).
 *   - Point coordinates match geometry.outline.vertices exactly.
 *   - Non-4-vertex outline (degenerate) → returns [].
 */

import { getOpeningCornerWorldPoints } from '../opening-corner-anchors';
import type { OpeningEntity } from '../../types/opening-types';
import type { Polygon3D } from '../../types/bim-base';

function makeOpeningEntity(vertices: { x: number; y: number }[], id = 'opening_test'): OpeningEntity {
  const outline: Polygon3D = { vertices: vertices.map(v => ({ x: v.x, y: v.y })) };
  return {
    id,
    type: 'opening',
    kind: 'door',
    ifcType: 'IfcDoor',
    layerId: '0',
    params: { kind: 'door', wallId: 'wall_1', offsetFromStart: 500, width: 900, height: 2100, sillHeight: 0 },
    geometry: {
      position: { x: 950, y: 0 },
      rotation: 0,
      outline,
      bbox: undefined as never,
      area: 1.89,
      perimeter: 6,
    },
    validation: undefined as never,
    visible: true,
  } as unknown as OpeningEntity;
}

const RECT_4 = [
  { x: 500, y: -125 },
  { x: 1400, y: -125 },
  { x: 1400, y: 125 },
  { x: 500, y: 125 },
];

describe('getOpeningCornerWorldPoints', () => {
  it('4-vertex outline: returns exactly 4 entries', () => {
    expect(getOpeningCornerWorldPoints(makeOpeningEntity(RECT_4))).toHaveLength(4);
  });

  it('corner labels in CCW order: innerStart, innerEnd, outerEnd, outerStart', () => {
    const result = getOpeningCornerWorldPoints(makeOpeningEntity(RECT_4));
    expect(result[0]!.corner).toBe('innerStart');
    expect(result[1]!.corner).toBe('innerEnd');
    expect(result[2]!.corner).toBe('outerEnd');
    expect(result[3]!.corner).toBe('outerStart');
  });

  it('point coordinates match outline vertices', () => {
    const result = getOpeningCornerWorldPoints(makeOpeningEntity(RECT_4));
    RECT_4.forEach((v, i) => {
      expect(result[i]!.point.x).toBeCloseTo(v.x, 6);
      expect(result[i]!.point.y).toBeCloseTo(v.y, 6);
    });
  });

  it('non-4-vertex outline returns []', () => {
    expect(getOpeningCornerWorldPoints(makeOpeningEntity([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]))).toHaveLength(0);
    expect(getOpeningCornerWorldPoints(makeOpeningEntity([]))).toHaveLength(0);
  });
});
