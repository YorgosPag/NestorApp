/**
 * ADR-920 Β4.8 — `tinBoundaryLoops`: the boundary of ANY set of triangles (whole TIN or a subset).
 *
 * The DXF footprint test (`topo-surface-perimeter.test.ts`) guards the quad + the LOCAL→WORLD lift. Here: a
 * subset with a HOLE (the shape a slope class takes around a steeper patch), the edge census, the degenerate cases.
 */

import { tinBoundaryEdges, tinBoundaryLoops, type TriangleIndices } from '../tin-boundary-loops';

/** A 3 × 3 grid of quads over a 4 × 4 vertex lattice (index = row * 4 + col), two CCW triangles per quad. */
function gridTriangles(skipQuad?: { row: number; col: number }): TriangleIndices[] {
  const out: TriangleIndices[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (skipQuad && skipQuad.row === row && skipQuad.col === col) continue;
      const a = row * 4 + col;
      out.push([a, a + 1, a + 5], [a, a + 5, a + 4]);
    }
  }
  return out;
}

const sorted = (ring: readonly number[]): number[] => [...ring].sort((x, y) => x - y);

describe('tinBoundaryLoops', () => {
  it('an empty set has no boundary', () => {
    expect(tinBoundaryLoops([])).toEqual([]);
    expect(tinBoundaryEdges([])).toEqual([]);
  });

  it('one triangle is its own ring of three', () => {
    expect(tinBoundaryLoops([[0, 1, 2]]).map(sorted)).toEqual([[0, 1, 2]]);
  });

  it('a full grid: ONE ring of the 12 lattice vertices on the rim, no interior vertex', () => {
    const rings = tinBoundaryLoops(gridTriangles());
    expect(rings).toHaveLength(1);
    expect(sorted(rings[0])).toEqual([0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15]);
  });

  it('a grid without its centre quad: outer ring + the 4-vertex hole', () => {
    const rings = tinBoundaryLoops(gridTriangles({ row: 1, col: 1 }));
    expect(rings.map((ring) => ring.length).sort((x, y) => x - y)).toEqual([4, 12]);
    expect(rings.map(sorted)).toContainEqual([5, 6, 9, 10]);
  });

  it('the edge census: interior edges (shared by two triangles) never count', () => {
    // 3 × 3 grid: 12 rim edges; minus the centre quad: + its 4 sides, which now border nothing.
    expect(tinBoundaryEdges(gridTriangles())).toHaveLength(12);
    expect(tinBoundaryEdges(gridTriangles({ row: 1, col: 1 }))).toHaveLength(16);
  });

  it('the closing vertex is not repeated', () => {
    for (const ring of tinBoundaryLoops(gridTriangles({ row: 1, col: 1 }))) {
      expect(new Set(ring).size).toBe(ring.length);
    }
  });
});
