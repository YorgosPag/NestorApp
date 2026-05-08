import {
  hitTestGeometry,
  computeGeometryAABB,
  DEFAULT_HIT_TOLERANCE,
} from '../overlay-hit-test';
import type { OverlayGeometry } from '@/types/floorplan-overlays';

jest.mock('@core/polygon-system/utils/polygon-utils', () => ({
  isPointInPolygon: jest.fn(),
}));

import { isPointInPolygon } from '@core/polygon-system/utils/polygon-utils';
const mockIsPointInPolygon = isPointInPolygon as jest.Mock;

beforeEach(() => {
  mockIsPointInPolygon.mockReset();
});

describe('hitTestGeometry', () => {
  it('polygon closed — delegates to isPointInPolygon', () => {
    mockIsPointInPolygon.mockReturnValue(true);
    const geo: OverlayGeometry = {
      type: 'polygon',
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      closed: true,
    };
    expect(hitTestGeometry({ x: 5, y: 5 }, geo, 'id-1')).toBe(true);
    expect(mockIsPointInPolygon).toHaveBeenCalledTimes(1);
  });

  it('line — distance to segment within tolerance → hit', () => {
    const geo: OverlayGeometry = { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
    expect(hitTestGeometry({ x: 5, y: 0 }, geo, 'id-2')).toBe(true);
  });

  it('line — distance exceeds tolerance → miss', () => {
    const geo: OverlayGeometry = { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
    expect(hitTestGeometry({ x: 5, y: 5 }, geo, 'id-3', 1)).toBe(false);
  });

  it('circle — point on circumference within tolerance → hit', () => {
    const geo: OverlayGeometry = { type: 'circle', center: { x: 0, y: 0 }, radius: 5 };
    // dist(point, center) = 5, |5 - 5| = 0 ≤ tolerance
    expect(hitTestGeometry({ x: 5, y: 0 }, geo, 'id-4')).toBe(true);
  });

  it('circle — point far inside or outside → miss', () => {
    const geo: OverlayGeometry = { type: 'circle', center: { x: 0, y: 0 }, radius: 5 };
    // point at center: dist=0, |0 - 5| = 5 > DEFAULT_HIT_TOLERANCE(1) → miss
    expect(hitTestGeometry({ x: 0, y: 0 }, geo, 'id-5')).toBe(false);
  });

  it('text — point inside AABB → hit', () => {
    const geo: OverlayGeometry = { type: 'text', position: { x: 5, y: 5 }, text: 'hi' };
    expect(hitTestGeometry({ x: 5.5, y: 5 }, geo, 'id-6')).toBe(true);
  });

  it('text — point outside AABB → miss', () => {
    const geo: OverlayGeometry = { type: 'text', position: { x: 5, y: 5 }, text: 'hi' };
    expect(hitTestGeometry({ x: 8, y: 5 }, geo, 'id-7')).toBe(false);
  });
});

describe('computeGeometryAABB', () => {
  it('line — AABB spans start to end', () => {
    const geo: OverlayGeometry = { type: 'line', start: { x: 2, y: 3 }, end: { x: 8, y: 7 } };
    const aabb = computeGeometryAABB(geo);
    expect(aabb).toEqual({ minX: 2, minY: 3, maxX: 8, maxY: 7 });
  });

  it('circle — AABB is center ± radius', () => {
    const geo: OverlayGeometry = { type: 'circle', center: { x: 10, y: 10 }, radius: 5 };
    const aabb = computeGeometryAABB(geo);
    expect(aabb).toEqual({ minX: 5, minY: 5, maxX: 15, maxY: 15 });
  });

  it('text — AABB is 1-unit square around position', () => {
    const geo: OverlayGeometry = { type: 'text', position: { x: 5, y: 5 }, text: 'x' };
    const aabb = computeGeometryAABB(geo);
    expect(aabb).toEqual({ minX: 4, minY: 4, maxX: 6, maxY: 6 });
  });
});

describe('DEFAULT_HIT_TOLERANCE', () => {
  it('exports a positive number', () => {
    expect(DEFAULT_HIT_TOLERANCE).toBeGreaterThan(0);
  });
});
