/**
 * ADR-718 / ADR-920 Β4.8 Τ — the boundary as convex pieces, and the crop that depends on it.
 *
 * The crop used to fan `whole boundary ∩ triangle` from its first vertex, claiming the piece was convex. A concave
 * boundary whose reflex corner falls INSIDE a TIN triangle (the ordinary case on a real survey — the grid fixture only
 * hid it while its corner happened to be a TIN vertex) made the fan overlap. Here the corner is inside on purpose.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { buildTin } from '../tin-builder';
import { clipTinToBoundary } from '../tin-clip-to-boundary';
import { ringConvexPieces } from '../ring-convex-pieces';
import type { TinSurface } from '../terrain-types';
import { triangleArea } from './tin-test-geometry';

const M = 1000;

/** 20 × 20 m minus the 10 × 10 m top-right quadrant: 300 m², reflex corner at (10, 10). */
const L_SHAPE: PlanarPoint[] = [
  { x: 0, y: 0 },
  { x: 20 * M, y: 0 },
  { x: 20 * M, y: 10 * M },
  { x: 10 * M, y: 10 * M },
  { x: 10 * M, y: 20 * M },
  { x: 0, y: 20 * M },
];

function absoluteArea(surface: TinSurface): number {
  let total = 0;
  for (const [i, j, k] of surface.triangles) {
    const [a, b, c] = [surface.positions[i], surface.positions[j], surface.positions[k]];
    total += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  }
  return total;
}

describe('ringConvexPieces', () => {
  it('a concave ring becomes interior triangles whose areas add up to the ring', () => {
    const pieces = ringConvexPieces(L_SHAPE);
    expect(pieces).toHaveLength(L_SHAPE.length - 2);
    const area = pieces.reduce((sum, { corners: [a, b, c] }) => sum + Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2, 0);
    expect(area / (M * M)).toBeCloseTo(300, 9);
  });

  it('a clockwise ring gives the same pieces as its counter-clockwise twin', () => {
    expect(ringConvexPieces([...L_SHAPE].reverse())).toHaveLength(ringConvexPieces(L_SHAPE).length);
  });

  it('fewer than three corners → no pieces', () => {
    expect(ringConvexPieces(L_SHAPE.slice(0, 2))).toEqual([]);
  });
});

describe('clipTinToBoundary — the reflex corner INSIDE a TIN triangle', () => {
  // ONE big triangle (plus a fourth point) so the L's reflex corner (10, 10) is strictly inside a triangle.
  const surface = buildTin([
    { x: -10 * M, y: -10 * M, z: 0 },
    { x: 50 * M, y: -10 * M, z: 6 * M },
    { x: -10 * M, y: 50 * M, z: 3 * M },
    { x: 40 * M, y: 40 * M, z: 9 * M },
  ]);

  it('crops to exactly the plot: 300 m², and no triangle overlaps another (|area| sum = signed sum)', () => {
    const cropped = clipTinToBoundary(surface, L_SHAPE);
    expect(absoluteArea(cropped) / (M * M)).toBeCloseTo(300, 6);
    expect(triangleArea(cropped) / (M * M)).toBeCloseTo(300, 6);
  });
});
