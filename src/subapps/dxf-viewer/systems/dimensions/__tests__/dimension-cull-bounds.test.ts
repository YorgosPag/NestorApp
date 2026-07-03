/**
 * ADR-362 / ADR-040 Phase IX — getDimensionWorldBounds tests.
 *
 * The cull box is derived from the hit-geometry SSoT (style-free) so it tracks the RENDERED
 * dimension, not just the raw feature points. Regression guard for the 2026-07-03 bug where
 * every dimension fell to the ±1e6 full-plane fallback and was culled in a geo-referenced DXF.
 */

import type { DimensionEntity } from '../../../types/dimension';
import { getDimensionWorldBounds } from '../dimension-cull-bounds';

function dim(partial: Partial<DimensionEntity>): DimensionEntity {
  return { id: 'dim_test', type: 'dimension', ...partial } as unknown as DimensionEntity;
}

describe('getDimensionWorldBounds', () => {
  it('linear dim — covers feature points, the dim line and the text anchor', () => {
    const b = getDimensionWorldBounds(dim({
      dimensionType: 'linear',
      rotation: 0,
      defPoints: [
        { x: 17_119_418, y: 4_184_017 },
        { x: 17_157_268, y: 4_184_017 },
        { x: 17_119_418, y: 4_182_617 }, // dim-line definition point (offset below)
      ],
    }));
    expect(b).toEqual({ minX: 17_119_418, minY: 4_182_617, maxX: 17_157_268, maxY: 4_184_017 });
  });

  it('aligned dim — axis derived from p0→p1 (style-free hit geometry)', () => {
    const b = getDimensionWorldBounds(dim({
      dimensionType: 'aligned',
      rotation: 0,
      defPoints: [
        { x: 460, y: -380 },
        { x: 780, y: -350 },
        { x: 815, y: -466 },
      ],
    }));
    // AABB must at least span the raw feature points.
    expect(b).not.toBeNull();
    expect(b!.minX).toBeLessThanOrEqual(460);
    expect(b!.maxX).toBeGreaterThanOrEqual(815);
    expect(b!.minY).toBeLessThanOrEqual(-466);
    expect(b!.maxY).toBeGreaterThanOrEqual(-350);
  });

  it('empty defPoints → null (caller applies the full-plane fallback)', () => {
    expect(getDimensionWorldBounds(dim({ dimensionType: 'linear', rotation: 0, defPoints: [] }))).toBeNull();
  });

  it('baseline/continued (no straight-axis, no per-variant builder) still bound the defPoints', () => {
    const b = getDimensionWorldBounds(dim({
      dimensionType: 'baseline',
      rotation: 0,
      defPoints: [
        { x: 100, y: 200 },
        { x: 400, y: 200 },
        { x: 100, y: 150 },
      ],
    }));
    expect(b).toEqual({ minX: 100, minY: 150, maxX: 400, maxY: 200 });
  });
});
