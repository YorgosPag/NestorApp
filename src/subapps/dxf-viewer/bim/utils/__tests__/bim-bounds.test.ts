/**
 * ADR-363 Phase 7A — BIM marquee bounds unit tests.
 *
 * Verifies:
 *  - Each of the 7 BIM types (wall/opening/slab/slab-opening/column/beam/stair)
 *    projects geometry.bbox to a 2D `{min,max}` AABB usable by marquee selection.
 *  - z component on Point3D is dropped (XY plan view).
 *  - Missing geometry returns null (stair pre-compute / legacy partial data path).
 *  - Non-BIM entity types return null (caller falls through to existing logic).
 */

import { calculateBimEntity2DBounds } from '../bim-bounds';
import type { Entity } from '../../../types/entities';

function makeBimEntity(
  type: 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair',
  bbox: { min: { x: number; y: number; z?: number }; max: { x: number; y: number; z?: number } } | null,
): Entity {
  return {
    type,
    geometry: bbox === null ? undefined : { bbox },
  } as unknown as Entity;
}

describe('ADR-363 Phase 7A — calculateBimEntity2DBounds', () => {
  it.each([
    'wall',
    'opening',
    'slab',
    'slab-opening',
    'column',
    'beam',
    'stair',
  ] as const)('projects geometry.bbox to 2D for %s', (type) => {
    const e = makeBimEntity(type, { min: { x: 10, y: 20 }, max: { x: 100, y: 200 } });
    expect(calculateBimEntity2DBounds(e)).toEqual({
      min: { x: 10, y: 20 },
      max: { x: 100, y: 200 },
    });
  });

  it('drops z component (XY plan view projection)', () => {
    const e = makeBimEntity('wall', {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 5000, y: 200, z: 3000 },
    });
    expect(calculateBimEntity2DBounds(e)).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 5000, y: 200 },
    });
  });

  it('returns null when BIM entity has no geometry (pre-compute / legacy)', () => {
    const e = makeBimEntity('stair', null);
    expect(calculateBimEntity2DBounds(e)).toBeNull();
  });

  it('returns null for non-BIM entity types (caller falls through)', () => {
    const line = { type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity;
    expect(calculateBimEntity2DBounds(line)).toBeNull();
  });

  it('returns null for unknown entity type', () => {
    const weird = { type: 'mystery-shape' } as unknown as Entity;
    expect(calculateBimEntity2DBounds(weird)).toBeNull();
  });

  it('handles negative coordinates', () => {
    const e = makeBimEntity('slab', { min: { x: -500, y: -300 }, max: { x: 500, y: 300 } });
    expect(calculateBimEntity2DBounds(e)).toEqual({
      min: { x: -500, y: -300 },
      max: { x: 500, y: 300 },
    });
  });

  it('handles zero-area bbox (degenerate point)', () => {
    const e = makeBimEntity('column', { min: { x: 1000, y: 2000 }, max: { x: 1000, y: 2000 } });
    expect(calculateBimEntity2DBounds(e)).toEqual({
      min: { x: 1000, y: 2000 },
      max: { x: 1000, y: 2000 },
    });
  });
});
