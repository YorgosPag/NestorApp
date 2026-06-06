/**
 * ADR-401 Phase E.1 — wall-attach-pick helper tests.
 *
 * Pure host/target resolution for the manual attach pick-host interaction:
 *   - resolveWallAttachTargets filters selected ids to walls (+ reads kind)
 *   - resolveStructuralHostId validates a hovered id as beam/slab
 *   - findStructuralHostAtPoint geometry fallback (mm space)
 */

import {
  resolveWallAttachTargets,
  resolveStructuralHostId,
  findStructuralHostAtPoint,
} from '../wall-attach-pick';
import type { Entity } from '../../../types/entities';

const wall = (id: string, kind = 'straight'): Entity =>
  ({ id, type: 'wall', kind } as unknown as Entity);

const beam = (id: string): Entity =>
  ({
    id,
    type: 'beam',
    params: {
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 4000, y: 0, z: 0 },
      width: 250,
    },
  } as unknown as Entity);

const slab = (id: string): Entity =>
  ({
    id,
    type: 'slab',
    params: {
      outline: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 4000, y: 0, z: 0 },
          { x: 4000, y: 3000, z: 0 },
          { x: 0, y: 3000, z: 0 },
        ],
      },
    },
  } as unknown as Entity);

describe('resolveWallAttachTargets', () => {
  it('keeps only walls and reads kind', () => {
    const entities = [wall('w1', 'straight'), beam('b1'), wall('w2', 'curved')];
    const targets = resolveWallAttachTargets(['w1', 'b1', 'w2', 'missing'], entities);
    expect(targets).toEqual([
      { wallId: 'w1', kind: 'straight' },
      { wallId: 'w2', kind: 'curved' },
    ]);
  });

  it('returns empty when no walls selected', () => {
    expect(resolveWallAttachTargets(['b1'], [beam('b1')])).toEqual([]);
  });
});

const roof = (id: string): Entity =>
  ({
    id,
    type: 'roof',
    params: {
      outline: {
        vertices: [
          { x: 0, y: 0, z: 3000 },
          { x: 4000, y: 0, z: 3000 },
          { x: 4000, y: 3000, z: 3000 },
          { x: 0, y: 3000, z: 3000 },
        ],
      },
      edges: [
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
      ],
      slopeUnit: 'deg',
      basePivotZ: 3000,
      thickness: 200,
      sceneUnits: 'mm',
    },
  } as unknown as Entity);

describe('resolveStructuralHostId', () => {
  const entities = [wall('w1'), beam('b1'), slab('s1'), roof('r1')];
  it('returns id for beam/slab', () => {
    expect(resolveStructuralHostId(entities, 'b1')).toBe('b1');
    expect(resolveStructuralHostId(entities, 's1')).toBe('s1');
  });
  it('returns id for roof (ADR-417 Φ4)', () => {
    expect(resolveStructuralHostId(entities, 'r1')).toBe('r1');
  });
  it('returns null for wall / null / missing', () => {
    expect(resolveStructuralHostId(entities, 'w1')).toBeNull();
    expect(resolveStructuralHostId(entities, null)).toBeNull();
    expect(resolveStructuralHostId(entities, 'x')).toBeNull();
  });
});

describe('findStructuralHostAtPoint', () => {
  const entities = [slab('s1'), beam('b1')];
  it('returns slab id when point inside outline', () => {
    expect(findStructuralHostAtPoint(entities, { x: 2000, y: 1500 }, 10)).toBe('s1');
  });
  it('returns beam id when point near axis but outside slab', () => {
    expect(findStructuralHostAtPoint([beam('b1')], { x: 2000, y: 100 }, 10)).toBe('b1');
  });
  it('returns null when point far from everything', () => {
    expect(findStructuralHostAtPoint([beam('b1')], { x: 2000, y: 5000 }, 10)).toBeNull();
  });
  it('returns roof id when point inside roof outline (ADR-417 Φ4)', () => {
    expect(findStructuralHostAtPoint([roof('r1')], { x: 2000, y: 1500 }, 10)).toBe('r1');
  });
  it('roof takes priority over slab (checked first)', () => {
    const roofEntity = roof('r1');
    const slabEntity = slab('s1');
    // both outlines overlap — roof checked first in new implementation
    expect(findStructuralHostAtPoint([roofEntity, slabEntity], { x: 2000, y: 1500 }, 10)).toBe('r1');
  });
});
