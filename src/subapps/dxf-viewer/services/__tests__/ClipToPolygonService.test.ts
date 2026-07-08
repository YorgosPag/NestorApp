/**
 * ADR-363 §crop-hatch-bim — Tests for ClipToPolygonService hatch clip (Α) and
 * BIM structural all-or-nothing bbox cull (Β) on polygon/lasso crop.
 */

import { describe, it, expect } from '@jest/globals';
import { ClipToPolygonService } from '../ClipToPolygonService';
import type { HatchEntity, Entity, LineEntity } from '../../types/entities';

// Square crop region (0,0)-(100,100) as a lasso polygon.
const poly: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];

const svc = new ClipToPolygonService();

function makeHatch(paths: Array<Array<{ x: number; y: number }>>): HatchEntity {
  return { id: 'h1', type: 'hatch', layerId: 'lyr_0', visible: true, boundaryPaths: paths } as unknown as HatchEntity;
}

function makeWall(min: { x: number; y: number }, max: { x: number; y: number }): Entity {
  return { id: 'w1', type: 'wall', layerId: 'lyr_0', visible: true, geometry: { bbox: { min, max } } } as unknown as Entity;
}

describe('ClipToPolygonService — γραμμοσκιάσεις (Α: γεωμετρικό clip)', () => {
  it('fully-inside hatch kept', () => {
    const hatch = makeHatch([[{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]]);
    const result = svc.clipByPolygon({ entities: [hatch] }, poly);
    expect(result.entities).toHaveLength(1);
  });

  it('partially-outside hatch → outer loop clipped within region bounds', () => {
    const hatch = makeHatch([[{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }, { x: 50, y: 150 }]]);
    const result = svc.clipByPolygon({ entities: [hatch] }, poly);
    expect(result.entities).toHaveLength(1);
    const outer = (result.entities[0] as HatchEntity).boundaryPaths[0];
    expect(outer.length).toBeGreaterThanOrEqual(3);
    for (const p of outer) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6); expect(p.x).toBeLessThanOrEqual(100 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6); expect(p.y).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it('fully-outside hatch → dropped', () => {
    const hatch = makeHatch([[{ x: 200, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }, { x: 200, y: 300 }]]);
    const result = svc.clipByPolygon({ entities: [hatch] }, poly);
    expect(result.entities).toHaveLength(0);
  });
});

describe('ClipToPolygonService — BIM δομικά (Β: all-or-nothing)', () => {
  it('BIM wall fully inside → kept whole', () => {
    const wall = makeWall({ x: 20, y: 20 }, { x: 80, y: 80 });
    const result = svc.clipByPolygon({ entities: [wall] }, poly);
    expect(result.entities).toHaveLength(1);
  });

  it('BIM wall partially overlapping → kept whole (geometry untouched)', () => {
    const wall = makeWall({ x: 80, y: 80 }, { x: 180, y: 180 });
    const result = svc.clipByPolygon({ entities: [wall] }, poly);
    expect(result.entities).toHaveLength(1);
    expect((result.entities[0] as unknown as { geometry: { bbox: { max: { x: number } } } }).geometry.bbox.max.x).toBe(180);
  });

  it('BIM wall crossing the region without a corner inside → kept (edge-crossing)', () => {
    // Thin wall spanning x=-50..150 at y=40..60: no bbox corner inside poly, no poly
    // vertex inside bbox, but bbox edges cross the region → must be kept.
    const wall = makeWall({ x: -50, y: 40 }, { x: 150, y: 60 });
    const result = svc.clipByPolygon({ entities: [wall] }, poly);
    expect(result.entities).toHaveLength(1);
  });

  it('BIM wall fully outside → dropped', () => {
    const wall = makeWall({ x: 200, y: 200 }, { x: 260, y: 260 });
    const result = svc.clipByPolygon({ entities: [wall] }, poly);
    expect(result.entities).toHaveLength(0);
  });
});

describe('ClipToPolygonService — regression (πρωτογενής γεωμετρία ανέπαφη)', () => {
  it('line fully inside kept', () => {
    const line = { id: 'l1', type: 'line', layerId: 'lyr_0', visible: true, start: { x: 10, y: 10 }, end: { x: 90, y: 90 } } as unknown as LineEntity;
    const result = svc.clipByPolygon({ entities: [line] }, poly);
    expect(result.entities.length).toBeGreaterThanOrEqual(1);
  });
});
