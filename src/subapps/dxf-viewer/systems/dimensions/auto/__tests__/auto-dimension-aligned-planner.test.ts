/**
 * ADR-563 Φ4-Β — aligned (skewed member) planner unit tests.
 */

import type { Entity } from '../../../../types/entities';
import { planAlignedChains } from '../auto-dimension-aligned-planner';
import { buildAutoDimensionEntities } from '../auto-dimension-entity-factory';
import { runAutoDimension } from '../auto-dimension-engine';
import { AUTO_DIMENSION_DEFAULTS } from '../auto-dimension-types';

/** bbox spanning the two endpoints (read by `calculateBimEntity2DBounds` in the engine). */
function bboxOf(sx: number, sy: number, ex: number, ey: number) {
  return {
    bbox: {
      min: { x: Math.min(sx, ex), y: Math.min(sy, ey), z: 0 },
      max: { x: Math.max(sx, ex), y: Math.max(sy, ey), z: 0 },
    },
  };
}

/** Wall stub carrying the axis endpoints the planner reads (`params.start/.end`). */
function makeWall(id: string, sx: number, sy: number, ex: number, ey: number): Entity {
  return {
    id,
    type: 'wall',
    params: { start: { x: sx, y: sy, z: 0 }, end: { x: ex, y: ey, z: 0 } },
    geometry: bboxOf(sx, sy, ex, ey),
  } as unknown as Entity;
}

/** Beam stub carrying `params.startPoint/endPoint` (read by `beamAxisSceneFrame`). */
function makeBeam(id: string, sx: number, sy: number, ex: number, ey: number): Entity {
  return {
    id,
    type: 'beam',
    params: { startPoint: { x: sx, y: sy, z: 0 }, endPoint: { x: ex, y: ey, z: 0 } },
    geometry: bboxOf(sx, sy, ex, ey),
  } as unknown as Entity;
}

const CTX = { styleId: 'iso', layerId: '0' };

describe('planAlignedChains', () => {
  it('emits one aligned segment for a 45° skewed wall, along its own axis', () => {
    const segs = planAlignedChains([makeWall('w1', 0, 0, 1000, 1000)], AUTO_DIMENSION_DEFAULTS);
    expect(segs).toHaveLength(1);
    expect(segs[0].dimensionType).toBe('aligned');
    // defPoints ride the wall endpoints (true axis), not a bbox projection.
    expect(segs[0].defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(segs[0].defPoints[1]).toEqual({ x: 1000, y: 1000 });
    // dimLineRef = midpoint (500,500) offset perpendicular by offsetFromModel (600).
    const off = AUTO_DIMENSION_DEFAULTS.offsetFromModel;
    const half = (off * Math.SQRT1_2);
    expect(segs[0].defPoints[2].x).toBeCloseTo(500 - half, 3);
    expect(segs[0].defPoints[2].y).toBeCloseTo(500 + half, 3);
  });

  it('SKIPS axis-aligned walls (horizontal / vertical) — perimeter handles those', () => {
    const horizontal = makeWall('h', 0, 0, 1000, 0);
    const vertical = makeWall('v', 0, 0, 0, 1000);
    expect(planAlignedChains([horizontal, vertical], AUTO_DIMENSION_DEFAULTS)).toEqual([]);
  });

  it('handles skewed beams via the beamAxisSceneFrame SSoT', () => {
    const segs = planAlignedChains([makeBeam('b1', 0, 0, 2000, 1000)], AUTO_DIMENSION_DEFAULTS);
    expect(segs).toHaveLength(1);
    expect(segs[0].dimensionType).toBe('aligned');
    expect(segs[0].defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(segs[0].defPoints[1]).toEqual({ x: 2000, y: 1000 });
  });

  it('ignores columns / non-linear members (no axis SSoT)', () => {
    const column = { id: 'c', type: 'column', params: {} } as unknown as Entity;
    expect(planAlignedChains([column], AUTO_DIMENSION_DEFAULTS)).toEqual([]);
  });
});

describe('aligned entity factory + engine wiring', () => {
  it('factory emits an AlignedDimensionEntity (no rotation, no associations)', () => {
    const segs = planAlignedChains([makeWall('w1', 0, 0, 1000, 1000)], AUTO_DIMENSION_DEFAULTS);
    const [dim] = buildAutoDimensionEntities(segs, CTX);
    expect(dim.dimensionType).toBe('aligned');
    expect('rotation' in dim).toBe(false); // aligned dims are parallel to defPoints
    expect(dim.associations).toBeUndefined(); // non-associative slice
  });

  it('engine includes aligned dims only when alignedSkewed is on', () => {
    const skewedWall = makeWall('w1', 0, 0, 1000, 1000);
    const off = runAutoDimension([skewedWall], AUTO_DIMENSION_DEFAULTS, CTX);
    const on = runAutoDimension([skewedWall], { ...AUTO_DIMENSION_DEFAULTS, alignedSkewed: true }, CTX);
    expect(off.some((d) => d.dimensionType === 'aligned')).toBe(false);
    expect(on.some((d) => d.dimensionType === 'aligned')).toBe(true);
  });
});
