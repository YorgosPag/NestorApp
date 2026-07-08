/**
 * ADR-363 §crop-hatch-bim — SSoT contract tests for clip-entity-helpers, the shared
 * crop orchestration used by BOTH ClipToRegionService and ClipToPolygonService.
 */

import { describe, it, expect } from '@jest/globals';
import { clipHatchLoops, bboxCullEntity } from '../clip/clip-entity-helpers';
import type { HatchEntity, Entity } from '../../types/entities';
import type { SpatialBounds } from '../../types/entity-bounds';

function makeHatch(paths: Array<Array<{ x: number; y: number }>>): HatchEntity {
  return { id: 'h1', type: 'hatch', layerId: 'lyr_0', visible: true, boundaryPaths: paths } as unknown as HatchEntity;
}
function makeWall(min: { x: number; y: number }, max: { x: number; y: number }): Entity {
  return { id: 'w1', type: 'wall', layerId: 'lyr_0', visible: true, geometry: { bbox: { min, max } } } as unknown as Entity;
}

describe('clipHatchLoops — SSoT hatch orchestration', () => {
  const identity = (loop: Array<{ x: number; y: number }>) => loop; // region = keep everything

  it('returns null when no boundary loops (caller must bbox-cull)', () => {
    expect(clipHatchLoops(makeHatch([]), identity)).toBeNull();
  });

  it('returns [] when the outer loop is emptied by the clipper', () => {
    const drop = () => [] as Array<{ x: number; y: number }>;
    const out = clipHatchLoops(makeHatch([[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]]), drop);
    expect(out).toEqual([]);
  });

  it('keeps outer + surviving islands, filters degenerate island loops', () => {
    const hatch = makeHatch([
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }],   // valid island
    ]);
    // clipper that drops any loop with < 4 verts → island (3 verts) removed
    const only4 = (loop: Array<{ x: number; y: number }>) => (loop.length >= 4 ? loop : []);
    const out = clipHatchLoops(hatch, only4);
    expect(out).toHaveLength(1);
    expect((out![0] as HatchEntity).boundaryPaths).toHaveLength(1); // outer kept, island dropped
  });
});

describe('bboxCullEntity — SSoT all-or-nothing cull', () => {
  it('drops entity when overlaps() is false', () => {
    const wall = makeWall({ x: 200, y: 200 }, { x: 260, y: 260 });
    expect(bboxCullEntity(wall, () => false)).toEqual([]);
  });

  it('keeps entity when overlaps() is true', () => {
    const wall = makeWall({ x: 0, y: 0 }, { x: 60, y: 60 });
    expect(bboxCullEntity(wall, () => true)).toHaveLength(1);
  });

  it('keeps unmeasurable (zero-area sentinel bounds) entity regardless of overlaps()', () => {
    // A BIM entity with no geometry.bbox → getEntityRenderBounds returns {0,0,0,0}.
    const degenerate = { id: 'w2', type: 'wall', layerId: 'lyr_0', visible: true } as unknown as Entity;
    const overlaps = (_b: SpatialBounds) => false;
    expect(bboxCullEntity(degenerate, overlaps)).toHaveLength(1);
  });
});
