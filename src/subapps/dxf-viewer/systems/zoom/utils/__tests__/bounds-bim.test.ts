/**
 * ADR-436/ADR-363 — Zoom-extents (Home / Shift+1) BIM inclusion.
 *
 * Regression guard: `createBoundsFromDxfScene` (the fit-to-view bounds SSoT)
 * used to switch only over DXF primitives (line/circle/arc/polyline/text), so
 * every BIM entity (wall/column/beam/foundation/slab/opening/mep-*) was silently
 * excluded from Home/Shift+1 zoom-extents. The `default` case now projects each
 * BIM entity's `geometry.bbox` via the BIM bounds SSoT.
 */

import { createBoundsFromDxfScene } from '../bounds';
import type { DxfScene } from '../../../../canvas-v2/dxf-canvas/dxf-types';

function sceneOf(entities: unknown[]): DxfScene {
  return {
    entities,
    layers: [],
    layersById: undefined,
    bounds: null,
    units: 'mm',
  } as unknown as DxfScene;
}

describe('ADR-436 — createBoundsFromDxfScene includes BIM entities', () => {
  it('frames a BIM entity by its geometry.bbox (foundation)', () => {
    const scene = sceneOf([
      { id: 'f1', type: 'foundation', geometry: { bbox: { min: { x: 100, y: 100 }, max: { x: 200, y: 200 } } } },
    ]);
    expect(createBoundsFromDxfScene(scene, true)).toEqual({
      min: { x: 100, y: 100 },
      max: { x: 200, y: 200 },
    });
  });

  it('unions DXF primitive + BIM bbox extents', () => {
    const scene = sceneOf([
      { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      { id: 'w1', type: 'wall', geometry: { bbox: { min: { x: -50, y: -30 }, max: { x: 300, y: 80 } } } },
    ]);
    expect(createBoundsFromDxfScene(scene, true)).toEqual({
      min: { x: -50, y: -30 },
      max: { x: 300, y: 80 },
    });
  });

  it('drops the z component (XY plan projection)', () => {
    const scene = sceneOf([
      { id: 'c1', type: 'column', geometry: { bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 400, y: 400, z: 3000 } } } },
    ]);
    expect(createBoundsFromDxfScene(scene, true)).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 400, y: 400 },
    });
  });

  it('ignores BIM entity with no geometry (pre-compute / legacy) without throwing', () => {
    const scene = sceneOf([
      { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
      { id: 's1', type: 'slab' }, // no geometry → contributes nothing
    ]);
    expect(createBoundsFromDxfScene(scene, true)).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 5, y: 5 },
    });
  });
});

/**
 * Zoom-extents (Home / Shift+1) now delegates each entity's 2D extent to the
 * canonical `resolveEntityBounds` SSoT. Regression guard for the bug where a lone
 * `dimension` on the canvas gave NULL bounds (the old hand-rolled switch had no
 * `dimension` case → it fell to the BIM-only default → null) so Home did nothing.
 */
describe('createBoundsFromDxfScene frames a lone dimension (SSoT delegation)', () => {
  it('frames a single wrapped linear dimension by its rendered world bounds', () => {
    const scene = sceneOf([
      {
        id: 'd1',
        type: 'dimension',
        dimensionEntity: {
          id: 'd1',
          type: 'dimension',
          dimensionType: 'linear',
          rotation: 0,
          defPoints: [
            { x: 100, y: 500 },
            { x: 900, y: 500 },
            { x: 100, y: 460 }, // dim-line definition point (offset below)
          ],
        },
      },
    ]);
    // Non-null bounds spanning at least the feature points → Home has something to frame.
    expect(createBoundsFromDxfScene(scene, true)).toEqual({
      min: { x: 100, y: 460 },
      max: { x: 900, y: 500 },
    });
  });

  it('unions a dimension with a DXF primitive', () => {
    const scene = sceneOf([
      { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 50, y: 50 } },
      {
        id: 'd1',
        type: 'dimension',
        dimensionEntity: {
          id: 'd1',
          type: 'dimension',
          dimensionType: 'linear',
          rotation: 0,
          defPoints: [
            { x: 200, y: 300 },
            { x: 600, y: 300 },
            { x: 200, y: 260 },
          ],
        },
      },
    ]);
    const b = createBoundsFromDxfScene(scene, true);
    expect(b).not.toBeNull();
    expect(b!.min.x).toBe(0);
    expect(b!.min.y).toBe(0);
    expect(b!.max.x).toBe(600);
    expect(b!.max.y).toBe(300);
  });
});
