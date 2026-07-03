/**
 * ADR-040 Phase IX — viewport-culling tests.
 *
 * Regression (2026-07-03): `getEntityBBox` had no `case 'wall'`, so a wall fell to the
 * `default` ±1e6 full-plane bbox. In a geo-referenced DXF (coords ~1e7) that box sits far
 * from the real geometry, so `isEntityInViewport` culled the committed wall from the 2D base
 * render — invisible in 2D while visible in 3D and on hover (both bypass culling). The fix
 * routes wall/column/foundation + every BIM direct-entity through their real `geometry.bbox`.
 */

import type { DxfEntityUnion } from '../dxf-types';
import { getEntityBBox, isEntityInViewport } from '../dxf-viewport-culling';

/** Minimal BIM direct-entity with a world-space `geometry.bbox`. */
function bimEntity(type: string, minX: number, minY: number, maxX: number, maxY: number): DxfEntityUnion {
  return {
    type,
    geometry: { bbox: { min: { x: minX, y: minY, z: 0 }, max: { x: maxX, y: maxY, z: 3 } } },
  } as unknown as DxfEntityUnion;
}

describe('getEntityBBox — BIM direct-entities use geometry.bbox', () => {
  it('wall returns its real world-space bbox (not the ±1e6 fallback)', () => {
    const w = bimEntity('wall', 17_123_468, 4_176_766, 17_129_022, 4_176_976);
    expect(getEntityBBox(w)).toEqual({
      minX: 17_123_468, minY: 4_176_766, maxX: 17_129_022, maxY: 4_176_976,
    });
  });

  it('beam / slab (via default branch) also use their geometry.bbox', () => {
    expect(getEntityBBox(bimEntity('beam', 100, 200, 400, 500))).toEqual({ minX: 100, minY: 200, maxX: 400, maxY: 500 });
    expect(getEntityBBox(bimEntity('slab', -50, -50, 50, 50))).toEqual({ minX: -50, minY: -50, maxX: 50, maxY: 50 });
  });

  it('column / foundation keep using geometry.bbox (no regression)', () => {
    expect(getEntityBBox(bimEntity('column', 10, 10, 20, 20))).toEqual({ minX: 10, minY: 10, maxX: 20, maxY: 20 });
    expect(getEntityBBox(bimEntity('foundation', 0, 0, 5, 5))).toEqual({ minX: 0, minY: 0, maxX: 5, maxY: 5 });
  });

  it('a BIM entity without geometry.bbox falls back to the full-plane box', () => {
    const noBbox = { type: 'wall' } as unknown as DxfEntityUnion;
    expect(getEntityBBox(noBbox)).toEqual({ minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 });
  });
});

/** Minimal DxfDimension wrapper carrying a linear DimensionEntity (defPoints at real coords). */
function linearDim(
  p1: [number, number],
  p2: [number, number],
  dimLineDef: [number, number],
): DxfEntityUnion {
  return {
    type: 'dimension',
    dimensionEntity: {
      id: 'dim_test',
      type: 'dimension',
      dimensionType: 'linear',
      rotation: 0,
      defPoints: [
        { x: p1[0], y: p1[1] },
        { x: p2[0], y: p2[1] },
        { x: dimLineDef[0], y: dimLineDef[1] },
      ],
    },
  } as unknown as DxfEntityUnion;
}

describe('getEntityBBox — dimensions use real geometry, not the ±1e6 fallback (2026-07-03)', () => {
  it('a geo-referenced linear dimension returns its real world-space bbox', () => {
    // Real cluster coords from the "Κάτοψη ισογείου" DXF (X ~1.71e7, Y ~4.18e6).
    const d = linearDim([17_119_418, 4_184_017], [17_157_268, 4_184_017], [17_119_418, 4_182_617]);
    expect(getEntityBBox(d)).toEqual({
      minX: 17_119_418, minY: 4_182_617, maxX: 17_157_268, maxY: 4_184_017,
    });
  });

  it('a dimension with no usable points falls back to the full-plane box', () => {
    const empty = { type: 'dimension', dimensionEntity: { dimensionType: 'linear', rotation: 0, defPoints: [] } } as unknown as DxfEntityUnion;
    expect(getEntityBBox(empty)).toEqual({ minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 });
  });
});

describe('isEntityInViewport — geo-referenced dimensions are NOT culled (the bug)', () => {
  const buildingViewport = { minX: 17_107_368, minY: 4_168_981, maxX: 17_170_678, maxY: 4_210_192 };

  it('a dimension inside the building viewport is kept (regression fixed)', () => {
    const d = linearDim([17_119_418, 4_184_017], [17_157_268, 4_184_017], [17_119_418, 4_182_617]);
    expect(isEntityInViewport(d, buildingViewport)).toBe(true);
  });

  it('the origin outlier dimension is correctly culled when viewing the building (no poisoning)', () => {
    // The stray dim_86a06e54 at world origin (460,-380) — a far dim must NOT affect near ones.
    const outlier = linearDim([460, -380], [780, -350], [815, -466]);
    expect(isEntityInViewport(outlier, buildingViewport)).toBe(false);
  });
});

describe('isEntityInViewport — geo-referenced walls are NOT culled (the bug)', () => {
  const geoViewport = { minX: 17_107_368, minY: 4_168_981, maxX: 17_170_678, maxY: 4_210_192 };

  it('a wall inside a large-coordinate viewport is kept (regression fixed)', () => {
    const w = bimEntity('wall', 17_123_468, 4_176_766, 17_129_022, 4_176_976);
    expect(isEntityInViewport(w, geoViewport)).toBe(true);
  });

  it('a wall far outside the viewport is still culled', () => {
    const w = bimEntity('wall', 0, 0, 1000, 1000);
    expect(isEntityInViewport(w, geoViewport)).toBe(false);
  });

  it('a local-coordinate wall renders in a local viewport', () => {
    const w = bimEntity('wall', 40, -460, 1140, -250);
    expect(isEntityInViewport(w, { minX: -62, minY: -976, maxX: 1482, maxY: 29 })).toBe(true);
  });
});
