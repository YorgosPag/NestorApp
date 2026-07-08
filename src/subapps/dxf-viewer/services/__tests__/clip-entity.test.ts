/**
 * ADR-363 §crop-hatch-bim — Unified per-type clip tests, run against BOTH region
 * strategies (RectClipRegion + PolygonClipRegion) so the shared clip-entity SSoT is
 * locked identically for the rectangular and polygon/lasso crop modes.
 */

import { describe, it, expect } from '@jest/globals';
import { clipEntity } from '../clip/clip-entity';
import { RectClipRegion, PolygonClipRegion, type ClipRegion } from '../clip/clip-region';
import type {
  Entity, LineEntity, CircleEntity, PolylineEntity, PointEntity, AngleMeasurementEntity,
} from '../../types/entities';

// Same (0,0)-(100,100) window expressed as a rect and as a lasso polygon.
const regions: Array<[string, ClipRegion]> = [
  ['RectClipRegion', new RectClipRegion({ xMin: 0, yMin: 0, xMax: 100, yMax: 100 })],
  ['PolygonClipRegion', new PolygonClipRegion([[0, 0], [100, 0], [100, 100], [0, 100]])],
];

const base = { layerId: 'lyr_0', visible: true };

describe.each(regions)('clipEntity — %s', (_name, region) => {
  it('line fully inside → kept with endpoints preserved', () => {
    const line = { ...base, id: 'l1', type: 'line', start: { x: 10, y: 10 }, end: { x: 80, y: 80 } } as unknown as LineEntity;
    const out = clipEntity(line, region);
    expect(out).toHaveLength(1);
    expect((out[0] as LineEntity).end.x).toBeCloseTo(80, 6);
  });

  it('line crossing the boundary → clipped to the region edge', () => {
    const line = { ...base, id: 'l2', type: 'line', start: { x: 50, y: 50 }, end: { x: 150, y: 50 } } as unknown as LineEntity;
    const out = clipEntity(line, region);
    expect(out.length).toBeGreaterThanOrEqual(1);
    const seg = out[0] as LineEntity;
    expect(Math.max(seg.start.x, seg.end.x)).toBeCloseTo(100, 6);
  });

  it('line fully outside → dropped', () => {
    const line = { ...base, id: 'l3', type: 'line', start: { x: 200, y: 200 }, end: { x: 300, y: 300 } } as unknown as LineEntity;
    expect(clipEntity(line, region)).toHaveLength(0);
  });

  it('circle fully inside → kept AS a circle (not degraded to arc)', () => {
    const circle = { ...base, id: 'c1', type: 'circle', center: { x: 50, y: 50 }, radius: 20 } as unknown as CircleEntity;
    const out = clipEntity(circle, region);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('circle');
  });

  it('circle partially inside → converted to arc segments', () => {
    const circle = { ...base, id: 'c2', type: 'circle', center: { x: 100, y: 50 }, radius: 20 } as unknown as CircleEntity;
    const out = clipEntity(circle, region);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.every((e: Entity) => e.type === 'arc')).toBe(true);
  });

  it('open polyline crossing out-and-back → rebuilt chains', () => {
    // (10,50)→(150,50)→(90,50): exits then re-enters → 2 inside chains.
    const pl = { ...base, id: 'p1', type: 'polyline', closed: false,
      vertices: [{ x: 10, y: 50 }, { x: 150, y: 50 }, { x: 90, y: 40 }] } as unknown as PolylineEntity;
    const out = clipEntity(pl, region);
    expect(out.length).toBeGreaterThanOrEqual(1);
    for (const e of out) {
      for (const v of (e as PolylineEntity).vertices) {
        expect(v.x).toBeLessThanOrEqual(100 + 1e-6);
      }
    }
  });

  it('point inside kept, point outside dropped', () => {
    const pIn = { ...base, id: 'pt1', type: 'point', position: { x: 40, y: 40 } } as unknown as PointEntity;
    const pOut = { ...base, id: 'pt2', type: 'point', position: { x: 140, y: 40 } } as unknown as PointEntity;
    expect(clipEntity(pIn, region)).toHaveLength(1);
    expect(clipEntity(pOut, region)).toHaveLength(0);
  });

  it('angle-measurement: vertex inside → arms clipped to the boundary', () => {
    const m = { ...base, id: 'm1', type: 'angle-measurement',
      vertex: { x: 50, y: 50 }, point1: { x: 150, y: 50 }, point2: { x: 50, y: 150 } } as unknown as AngleMeasurementEntity;
    const out = clipEntity(m, region);
    expect(out).toHaveLength(1);
    const clipped = out[0] as AngleMeasurementEntity;
    expect(clipped.point1.x).toBeCloseTo(100, 6);
    expect(clipped.point2.y).toBeCloseTo(100, 6);
  });

  it('angle-measurement: vertex outside → dropped', () => {
    const m = { ...base, id: 'm2', type: 'angle-measurement',
      vertex: { x: 150, y: 150 }, point1: { x: 160, y: 150 }, point2: { x: 150, y: 160 } } as unknown as AngleMeasurementEntity;
    expect(clipEntity(m, region)).toHaveLength(0);
  });
});
