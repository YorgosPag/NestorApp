/**
 * ADR-650 Milestone 1 — TIN builder ground-truth tests.
 */

import { buildTin } from '../tin-builder';
import type { TopoPoint, Breakline } from '../topo-types';

describe('buildTin', () => {
  it('returns an empty surface for fewer than 3 distinct points', () => {
    const tin = buildTin([
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 10 },
    ]);
    expect(tin.triangles).toHaveLength(0);
    expect(tin.positions).toHaveLength(2);
  });

  it('triangulates a unit square into 2 triangles covering all 4 corners', () => {
    const pts: TopoPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1000, y: 1000, z: 0 },
      { x: 0, y: 1000, z: 0 },
    ];
    const tin = buildTin(pts);
    expect(tin.positions).toHaveLength(4);
    expect(tin.triangles).toHaveLength(2);
    // All four corners flat → both triangles are false flats.
    expect(tin.flatTriangleCount).toBe(2);
  });

  it('subtracts a LOCAL origin so positions are small and non-negative', () => {
    // ΕΓΣΑ'87-scale coordinates (mm): X ~4.7e8, Y ~4.2e9.
    const base = { x: 470_000_000, y: 4_200_000_000 };
    const pts: TopoPoint[] = [
      { x: base.x + 0, y: base.y + 0, z: 0 },
      { x: base.x + 1000, y: base.y + 0, z: 5 },
      { x: base.x + 0, y: base.y + 1000, z: 5 },
    ];
    const tin = buildTin(pts);
    expect(tin.origin.x).toBe(base.x);
    expect(tin.origin.y).toBe(base.y);
    for (const [x, y] of tin.positions) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1000);
      expect(y).toBeLessThanOrEqual(1000);
    }
  });

  it('preserves a breakline as a constrained edge of the triangulation', () => {
    // Four corners + a diagonal breakline (0,0)→(1000,1000). The CDT must keep that
    // diagonal as an edge shared by the two triangles.
    const pts: TopoPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1000, y: 1000, z: 10 },
      { x: 0, y: 1000, z: 10 },
    ];
    const breaklines: Breakline[] = [
      { id: 'bl1', vertices: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 1000, z: 10 }] },
    ];
    const tin = buildTin(pts, breaklines);
    const idx0 = tin.positions.findIndex(([x, y]) => x === 0 && y === 0);
    const idx2 = tin.positions.findIndex(([x, y]) => x === 1000 && y === 1000);
    const diagonalUsed = tin.triangles.some(
      (t) => t.includes(idx0) && t.includes(idx2),
    );
    expect(diagonalUsed).toBe(true);
  });
});
