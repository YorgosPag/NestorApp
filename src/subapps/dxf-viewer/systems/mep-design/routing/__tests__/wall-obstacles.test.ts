/**
 * ADR-429 — Routing Brain: wall → obstacle extraction + axis-segment crossing tests (pure).
 */

import type { Entity } from '../../../../types/entities';
import {
  wallObstacles,
  pointInRect,
  pointInAnyObstacle,
  segmentHitsRect,
  segmentHitsObstacles,
} from '../wall-obstacles';
import type { Rect2D } from '../routing-constants';

function wall(id: string, min: [number, number], max: [number, number]): Entity {
  return {
    id,
    type: 'wall',
    geometry: { bbox: { min: { x: min[0], y: min[1], z: 0 }, max: { x: max[0], y: max[1], z: 0 } } },
  } as unknown as Entity;
}

function nonWall(id: string): Entity {
  return { id, type: 'mep-fixture' } as unknown as Entity;
}

describe('wallObstacles', () => {
  it('extracts one inflated rect per wall, skipping non-walls', () => {
    const obs = wallObstacles([wall('w1', [0, 0], [1000, 200]), nonWall('f1')], 75);
    expect(obs).toHaveLength(1);
    expect(obs[0]).toEqual({ minX: -75, minY: -75, maxX: 1075, maxY: 275 });
  });

  it('skips degenerate (zero-footprint) walls', () => {
    expect(wallObstacles([wall('w', [50, 50], [50, 50])], 75)).toHaveLength(0);
  });

  it('is deterministic and order-preserving', () => {
    const entities = [wall('a', [0, 0], [10, 10]), wall('b', [100, 0], [110, 10])];
    expect(wallObstacles(entities)).toEqual(wallObstacles(entities));
  });
});

describe('pointInRect / pointInAnyObstacle', () => {
  const r: Rect2D = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  it('is inclusive of the boundary', () => {
    expect(pointInRect(0, 50, r)).toBe(true);
    expect(pointInRect(100, 100, r)).toBe(true);
    expect(pointInRect(150, 50, r)).toBe(false);
  });
  it('tests against any obstacle', () => {
    expect(pointInAnyObstacle(50, 50, [r])).toBe(true);
    expect(pointInAnyObstacle(-1, -1, [r])).toBe(false);
  });
});

describe('segmentHitsRect (axis-aligned, boundary = free)', () => {
  const r: Rect2D = { minX: 400, minY: -300, maxX: 600, maxY: 300 };
  it('flags a horizontal run crossing the interior', () => {
    expect(segmentHitsRect({ x: 0, y: 0 }, { x: 1000, y: 0 }, r)).toBe(true);
  });
  it('treats a run hugging the top face as free (boundary)', () => {
    expect(segmentHitsRect({ x: 0, y: 300 }, { x: 1000, y: 300 }, r)).toBe(false);
  });
  it('flags a vertical run crossing the interior', () => {
    expect(segmentHitsRect({ x: 500, y: -500 }, { x: 500, y: 500 }, r)).toBe(true);
  });
  it('passes a run entirely outside', () => {
    expect(segmentHitsRect({ x: 0, y: 800 }, { x: 1000, y: 800 }, r)).toBe(false);
  });
  it('segmentHitsObstacles ORs over the set', () => {
    expect(segmentHitsObstacles({ x: 0, y: 0 }, { x: 1000, y: 0 }, [r])).toBe(true);
    expect(segmentHitsObstacles({ x: 0, y: 800 }, { x: 1000, y: 800 }, [r])).toBe(false);
  });
});
