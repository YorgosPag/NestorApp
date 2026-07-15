/**
 * ADR-662 Φ2β (Δρόμος Γ) — topoSurfacePerimeter: boundary-edge extraction + LOCAL→WORLD.
 *
 * Guards the two things that break the footprint: (1) picking the boundary edges (claimed by
 * exactly ONE triangle) so interior diagonals never leak into the outline, and (2) the origin
 * re-projection — without it a geo-referenced footprint would sit at (0,0) and the hit-test
 * would fire in the wrong place (the ADR-635/650 datum trap).
 */

import { topoSurfacePerimeter } from '../topo-surface-perimeter';
import type { TinSurface, TopoBounds } from '../topo-types';

const BOUNDS: TopoBounds = { minX: 0, minY: 0, maxX: 10, maxY: 10, minZ: 0, maxZ: 0 };

/** A unit «quad» surface: 4 corners, 2 CCW triangles sharing the 0–2 diagonal. */
function quadSurface(origin: { x: number; y: number }): TinSurface {
  return {
    positions: [[0, 0], [10, 0], [10, 10], [0, 10]],
    elevations: [0, 0, 0, 0],
    triangles: [[0, 1, 2], [0, 2, 3]],
    origin,
    bounds: BOUNDS,
    flatTriangleCount: 0,
  };
}

/** Round a ring to a comparable set of «x:y» keys (order-independent). */
function ringKeys(ring: { x: number; y: number }[]): Set<string> {
  return new Set(ring.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`));
}

describe('topoSurfacePerimeter', () => {
  it('returns an empty footprint for a surface with no triangles', () => {
    const empty: TinSurface = {
      positions: [], elevations: [], triangles: [], origin: { x: 0, y: 0 }, bounds: BOUNDS, flatTriangleCount: 0,
    };
    expect(topoSurfacePerimeter(empty)).toEqual([]);
  });

  it('chains the 4 boundary edges of a quad into ONE closed ring (drops the shared diagonal)', () => {
    const rings = topoSurfacePerimeter(quadSurface({ x: 0, y: 0 }));
    expect(rings).toHaveLength(1);
    // 4 outer corners, not 5 — the closing repeat is dropped and the 0–2 diagonal is interior.
    expect(rings[0]).toHaveLength(4);
    expect(ringKeys(rings[0])).toEqual(new Set(['0:0', '10:0', '10:10', '0:10']));
  });

  it('re-projects every corner LOCAL→WORLD through the origin offset', () => {
    const rings = topoSurfacePerimeter(quadSurface({ x: 100, y: 200 }));
    expect(rings).toHaveLength(1);
    // LOCAL (0,0),(10,0),(10,10),(0,10) + origin (100,200) → WORLD corners.
    expect(ringKeys(rings[0])).toEqual(new Set(['100:200', '110:200', '110:210', '100:210']));
  });
});
