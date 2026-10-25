/**
 * ADR-920 Β4.8 βήμα Τ — characterization of `buildTin` BEFORE the triangulator changes (`cdt2d` → Delaunator +
 * Constrainautor, ADR-650). Every case here was MEASURED on `cdt2d` in plain Node (2026-10-25) and must hold, unchanged,
 * on the new triangulator — the API is the same and no consumer may notice.
 *
 * Deliberately NOT pinned: WHICH diagonal a cocircular quad gets. Both triangulators return a valid Delaunay
 * triangulation and they pick different diagonals on an exact grid; the contract is «empty circumcircle», not a tie-break.
 *
 * The last two cases were `it.failing` against `cdt2d`: they pinned a MEASURED defect (crossing breaklines cut holes
 * and dropped surveyed vertices) as the correct behaviour. They flipped red the moment the new triangulator landed,
 * which is how the fix was PROVED rather than claimed; they are ordinary regression tests now.
 */

import { buildTin } from '../tin-builder';
import type { Breakline, TopoPoint } from '../terrain-types';
import { cross, hasEdge, isDelaunay, jitteredGrid, polygonArea, triangleArea } from './tin-test-geometry';

describe('buildTin — characterization before the triangulator change (ADR-920 Β4.8 Τ)', () => {
  it('every triangle is counter-clockwise seen from above (the TinSurface contract)', () => {
    const tin = buildTin(jitteredGrid(12, 9, 1000));
    expect(tin.triangles.length).toBeGreaterThan(0);
    for (const [i, j, k] of tin.triangles) {
      expect(cross(tin.positions[i], tin.positions[j], tin.positions[k])).toBeGreaterThan(0);
    }
  });

  it('collinear points yield NO triangles but keep every vertex', () => {
    const tin = buildTin([
      { x: 0, y: 0, z: 1 },
      { x: 500, y: 500, z: 2 },
      { x: 1000, y: 1000, z: 3 },
      { x: 1500, y: 1500, z: 4 },
    ]);
    expect(tin.triangles).toHaveLength(0);
    expect(tin.positions).toHaveLength(4);
  });

  it('a repeated position is ONE vertex, and it keeps the FIRST elevation', () => {
    const tin = buildTin([
      { x: 0, y: 0, z: 1 },
      { x: 1000, y: 0, z: 2 },
      { x: 1000, y: 0, z: 9 },
      { x: 0, y: 1000, z: 3 },
    ]);
    expect(tin.positions).toHaveLength(3);
    expect(tin.elevations).toEqual([1, 2, 3]);
    expect(tin.triangles).toHaveLength(1);
  });

  it('a concave outline is filled to its CONVEX hull (no boundary is implied by the points)', () => {
    const ring: TopoPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2000, y: 0, z: 0 },
      { x: 2000, y: 1000, z: 0 },
      { x: 1000, y: 1000, z: 0 },
      { x: 1000, y: 2000, z: 0 },
      { x: 0, y: 2000, z: 0 },
    ];
    const tin = buildTin(ring);
    expect(triangleArea(tin)).toBe(polygonArea([[0, 0], [2000, 0], [2000, 1000], [1000, 2000], [0, 2000]]));
  });

  it('an exact (cocircular) grid triangulates to a valid Delaunay surface covering the grid', () => {
    const grid: TopoPoint[] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) grid.push({ x: c * 1000, y: r * 1000, z: c * r });
    const tin = buildTin(grid);
    // Euler for a convex point set: 2n − 2 − h triangles, h = hull vertices (14 on a 5 × 4 lattice boundary).
    expect(tin.triangles).toHaveLength(2 * 20 - 2 - 14);
    expect(triangleArea(tin)).toBe(4000 * 3000);
    expect(isDelaunay(tin)).toBe(true);
  });

  it('a jittered survey is Delaunay, uses every vertex, and no edge is shared by more than two triangles', () => {
    const tin = buildTin(jitteredGrid(10, 8, 1000));
    expect(isDelaunay(tin)).toBe(true);
    expect(new Set(tin.triangles.flat()).size).toBe(tin.positions.length);
    const uses = new Map<string, number>();
    for (const [a, b, c] of tin.triangles) {
      for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
        const key = u < v ? `${u}-${v}` : `${v}-${u}`;
        uses.set(key, (uses.get(key) ?? 0) + 1);
      }
    }
    expect(Math.max(...uses.values())).toBeLessThanOrEqual(2);
  });

  it('non-crossing breaklines survive as triangle edges, segment by segment', () => {
    const points = jitteredGrid(8, 8, 1000);
    const breaklines: Breakline[] = [
      { id: 'ridge', vertices: [{ x: 500, y: 2500, z: 120 }, { x: 3500, y: 2700, z: 121 }, { x: 6500, y: 2600, z: 122 }] },
      { id: 'ditch', vertices: [{ x: 600, y: 5400, z: 98 }, { x: 6400, y: 5500, z: 97 }] },
    ];
    const tin = buildTin(points, breaklines);
    for (const bl of breaklines) {
      for (let i = 0; i < bl.vertices.length - 1; i++) {
        const a = bl.vertices[i];
        const b = bl.vertices[i + 1];
        expect(hasEdge(tin, [a.x - tin.origin.x, a.y - tin.origin.y], [b.x - tin.origin.x, b.y - tin.origin.y])).toBe(true);
      }
    }
  });

  it('a closed breakline ring also constrains its closing edge', () => {
    const points = jitteredGrid(6, 6, 1000);
    const ring: Breakline = {
      id: 'pad',
      closed: true,
      vertices: [
        { x: 1500, y: 1500, z: 110 },
        { x: 3500, y: 1500, z: 110 },
        { x: 3500, y: 3500, z: 110 },
        { x: 1500, y: 3500, z: 110 },
      ],
    };
    const tin = buildTin(points, [ring]);
    const o = tin.origin;
    expect(hasEdge(tin, [1500 - o.x, 3500 - o.y], [1500 - o.x, 1500 - o.y])).toBe(true);
  });

  it('a breakline that passes THROUGH a surveyed vertex is honoured as two edges meeting at that vertex', () => {
    // 3 × 3 lattice; the breakline runs corner to corner through the centre vertex.
    const grid: TopoPoint[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) grid.push({ x: c * 1000, y: r * 1000, z: c + r });
    const tin = buildTin(grid, [{ id: 'diag', vertices: [{ x: 0, y: 0, z: 0 }, { x: 2000, y: 2000, z: 4 }] }]);
    expect(hasEdge(tin, [0, 0], [1000, 1000])).toBe(true);
    expect(hasEdge(tin, [1000, 1000], [2000, 2000])).toBe(true);
    expect(tin.positions).toHaveLength(9);
  });

  it('the same input gives the same surface (deterministic)', () => {
    const points = jitteredGrid(7, 5, 1000);
    expect(buildTin(points)).toEqual(buildTin(points));
  });

  // ── Defects of `cdt2d` measured 2026-10-25, fixed by step Τ (were `it.failing` until then) ──────────────────────

  it('two crossing breaklines do not cut a hole in the surface (cdt2d dropped triangles)', () => {
    const points: TopoPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 3000, y: 0, z: 0 },
      { x: 3000, y: 1000, z: 0 },
      { x: 0, y: 1000, z: 0 },
      { x: 1500, y: -500, z: 0 },
      { x: 1500, y: 1500, z: 0 },
    ];
    const breaklines: Breakline[] = [
      { id: 'a', vertices: [{ x: 0, y: 0, z: 0 }, { x: 3000, y: 1000, z: 0 }] },
      { id: 'b', vertices: [{ x: 3000, y: 0, z: 0 }, { x: 0, y: 1000, z: 0 }] },
    ];
    const tin = buildTin(points, breaklines);
    const hull = polygonArea([[0, 0], [1500, -500], [3000, 0], [3000, 1000], [1500, 1500], [0, 1000]]);
    expect(triangleArea(tin)).toBe(hull);
  });

  it('a crossing breakline does not remove a surveyed vertex from the surface (cdt2d did)', () => {
    const points: TopoPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2000, y: 0, z: 0 },
      { x: 2000, y: 2000, z: 0 },
      { x: 0, y: 2000, z: 0 },
      { x: 1000, y: 3000, z: 0 },
    ];
    const breaklines: Breakline[] = [
      { id: 'a', vertices: [{ x: 0, y: 0, z: 0 }, { x: 2000, y: 2000, z: 0 }] },
      { id: 'b', vertices: [{ x: 2000, y: 0, z: 0 }, { x: 0, y: 2000, z: 0 }] },
      { id: 'c', vertices: [{ x: 2000, y: 2000, z: 0 }, { x: 1000, y: 3000, z: 0 }] },
    ];
    const tin = buildTin(points, breaklines);
    const used = new Set(tin.triangles.flat());
    expect(used.size).toBe(tin.positions.length);
  });
});
