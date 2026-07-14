/**
 * ADR-650 M8β/Γ — auto-breakline extraction.
 *
 * Analytic surfaces with a KNOWN answer (a pitched roof has exactly one ridge; a Y-junction has
 * exactly three branches), so every assertion is a fact about geometry, not a snapshot of
 * whatever the code happened to produce. Deterministic — no LLM, no randomness.
 */

import type { TinSurface, LocalOrigin } from '../topo-types';
import { findSteepUnconstrainedEdges, type SteepEdge } from '../auto-breaklines/detect-feature-edges';
import { chainFeatureEdges } from '../auto-breaklines/chain-feature-edges';
import { AUTO_BREAKLINE_CONFIG } from '../auto-breaklines/auto-breakline-config';
import { chainUndirectedEdges } from '../graph-chain';

const ORIGIN: LocalOrigin = { x: 1_000, y: 2_000 };

function surfaceOf(
  positions: ReadonlyArray<readonly [number, number]>,
  elevations: readonly number[],
  triangles: ReadonlyArray<readonly [number, number, number]>,
): TinSurface {
  return {
    positions,
    elevations,
    triangles,
    origin: ORIGIN,
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0 },
    flatTriangleCount: 0,
  };
}

/**
 * A pitched roof: 5 columns × 3 rows. The middle row (y = 0, z = 5 m) is the RIDGE; both sides
 * fall to z = 0 at y = ±10 m. Every quad is split into two triangles, so each ridge edge is
 * shared by one triangle from each slope — the only edges in the whole surface that fold.
 */
function roofSurface(): TinSurface {
  const xs = [0, 10_000, 20_000, 30_000, 40_000];
  const rows: ReadonlyArray<{ y: number; z: number }> = [
    { y: -10_000, z: 0 },
    { y: 0, z: 5_000 },
    { y: 10_000, z: 0 },
  ];
  const positions: [number, number][] = [];
  const elevations: number[] = [];
  for (const row of rows) {
    for (const x of xs) {
      positions.push([x, row.y]);
      elevations.push(row.z);
    }
  }
  const at = (r: number, c: number): number => r * xs.length + c;
  const triangles: [number, number, number][] = [];
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < xs.length - 1; c++) {
      triangles.push([at(r, c), at(r, c + 1), at(r + 1, c + 1)]);
      triangles.push([at(r, c), at(r + 1, c + 1), at(r + 1, c)]);
    }
  }
  return surfaceOf(positions, elevations, triangles);
}

/** The ridge nodes of {@link roofSurface} (middle row, indices 5…9). */
const RIDGE_NODES = [5, 6, 7, 8, 9];

describe('findSteepUnconstrainedEdges — the fold measurement (shared with the M5α QA check)', () => {
  it('finds exactly the ridge edges of a pitched roof, and nothing else', () => {
    const edges = findSteepUnconstrainedEdges(roofSurface(), [], ORIGIN, 35);

    expect(edges).toHaveLength(RIDGE_NODES.length - 1);
    for (const e of edges) {
      expect(RIDGE_NODES).toContain(e.a);
      expect(RIDGE_NODES).toContain(e.b);
      // 5 m rise over 10 m run on both slopes ⇒ the normals disagree by 53.13°.
      expect(e.foldDeg).toBeCloseTo(53.13, 1);
    }
  });

  it('drops edges a breakline already constrains — an expected fold is not a finding', () => {
    const surface = roofSurface();
    const ridge = RIDGE_NODES.map((n) => ({
      x: surface.positions[n]![0] + ORIGIN.x,
      y: surface.positions[n]![1] + ORIGIN.y,
      z: surface.elevations[n]!,
    }));

    const edges = findSteepUnconstrainedEdges(
      surface,
      [{ id: 'bl-1', vertices: ridge }],
      ORIGIN,
      35,
    );

    expect(edges).toHaveLength(0);
  });

  it('stays quiet below the threshold (a gentle fold is ordinary terrain relief)', () => {
    expect(findSteepUnconstrainedEdges(roofSurface(), [], ORIGIN, 60)).toHaveLength(0);
  });

  it('returns nothing for a surface with no triangles', () => {
    expect(findSteepUnconstrainedEdges(surfaceOf([], [], []), [], ORIGIN, 35)).toHaveLength(0);
  });
});

describe('chainFeatureEdges — edges → ONE ordered polyline (the actual M8β/Γ)', () => {
  it('recovers the roof ridge as a single ordered candidate in WORLD coordinates', () => {
    const surface = roofSurface();
    const { candidates, droppedByCap } = chainFeatureEdges(
      surface,
      findSteepUnconstrainedEdges(surface, [], ORIGIN, 35),
    );

    expect(droppedByCap).toBe(0);
    expect(candidates).toHaveLength(1);

    const ridge = candidates[0]!;
    expect(ridge.closed).toBe(false);
    expect(ridge.edgeCount).toBe(4);
    expect(ridge.vertices).toHaveLength(5);
    expect(ridge.lengthMm).toBeCloseTo(40_000, 6);
    expect(ridge.avgFoldDeg).toBeCloseTo(53.13, 1);

    // WORLD frame (LOCAL + origin), walked end-to-end along the ridge — not a bag of edges.
    const xs = ridge.vertices.map((v) => v.x);
    const monotonic = xs.every((x, i) => i === 0 || x > xs[i - 1]!)
      || xs.every((x, i) => i === 0 || x < xs[i - 1]!);
    expect(monotonic).toBe(true);
    expect([...xs].sort((a, b) => a - b)).toEqual([1_000, 11_000, 21_000, 31_000, 41_000]);
    for (const v of ridge.vertices) {
      expect(v.y).toBe(ORIGIN.y);
      expect(v.z).toBe(5_000);
    }
  });
});

// ── Synthetic edge sets: geometry that a TIN would produce, stated directly ────────────────
// A node grid 10 m apart; only `positions`/`elevations` matter to the chainer.
function gridSurface(count: number): TinSurface {
  const positions: [number, number][] = [];
  const elevations: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push([i * 10_000, 0]);
    elevations.push(0);
  }
  return surfaceOf(positions, elevations, []);
}

function steep(pairs: ReadonlyArray<readonly [number, number]>): SteepEdge[] {
  return pairs.map(([a, b]) => ({ a: Math.min(a, b), b: Math.max(a, b), foldDeg: 50 }));
}

describe('chainFeatureEdges — junctions, noise and rings', () => {
  it('a Y-junction yields THREE chains, never a guessed-through polyline (Civil 3D rule)', () => {
    // Node 0 is the junction; three arms of 3 edges each radiate from it.
    const surface = gridSurface(10);
    const edges = steep([
      [0, 1], [1, 2], [2, 3],
      [0, 4], [4, 5], [5, 6],
      [0, 7], [7, 8], [8, 9],
    ]);

    const { candidates } = chainFeatureEdges(surface, edges);

    expect(candidates).toHaveLength(3);
    for (const c of candidates) {
      expect(c.edgeCount).toBe(3);
      expect(c.vertices).toHaveLength(4);
      expect(c.closed).toBe(false);
    }
    // Every arm starts (or ends) at the junction node — nothing walked THROUGH it.
    const junction = { x: ORIGIN.x, y: ORIGIN.y };
    for (const c of candidates) {
      const ends = [c.vertices[0]!, c.vertices[c.vertices.length - 1]!];
      expect(ends.some((v) => v.x === junction.x && v.y === junction.y)).toBe(true);
    }
  });

  it('drops chains under MIN_CHAIN_EDGES — two tilted triangles are noise, not a feature line', () => {
    expect(AUTO_BREAKLINE_CONFIG.MIN_CHAIN_EDGES).toBe(3);
    const { candidates } = chainFeatureEdges(gridSurface(4), steep([[0, 1], [1, 2]]));
    expect(candidates).toHaveLength(0);
  });

  it('drops chains shorter than MIN_CHAIN_LENGTH_MM even when they have enough edges', () => {
    // Four nodes 1 m apart ⇒ 3 edges (passes the edge gate) but only 3 m long.
    const positions: [number, number][] = [[0, 0], [1_000, 0], [2_000, 0], [3_000, 0]];
    const surface = surfaceOf(positions, [0, 0, 0, 0], []);
    const { candidates } = chainFeatureEdges(surface, steep([[0, 1], [1, 2], [2, 3]]));
    expect(candidates).toHaveLength(0);
  });

  it('a ring comes back closed, with the repeated start vertex dropped', () => {
    const surface = surfaceOf(
      [[0, 0], [20_000, 0], [20_000, 20_000], [0, 20_000]],
      [0, 0, 0, 0],
      [],
    );
    const { candidates } = chainFeatureEdges(surface, steep([[0, 1], [1, 2], [2, 3], [3, 0]]));

    expect(candidates).toHaveLength(1);
    const ring = candidates[0]!;
    expect(ring.closed).toBe(true);
    expect(ring.edgeCount).toBe(4);
    expect(ring.vertices).toHaveLength(4); // Breakline.closed implies the join — no repeat.
    expect(ring.lengthMm).toBeCloseTo(80_000, 6);
  });

  it('offers the longest first — a road edge outranks a short spur', () => {
    const surface = gridSurface(12);
    const { candidates } = chainFeatureEdges(surface, steep([
      [0, 1], [1, 2], [2, 3], // short: 3 edges
      [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], // long: 6 edges
    ]));

    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.edgeCount).toBe(6);
    expect(candidates[1]!.edgeCount).toBe(3);
  });
});

describe('chainUndirectedEdges — the shared walk (contours vs breaklines)', () => {
  it('walks THROUGH a junction by default (the M1 contour behaviour, unchanged)', () => {
    const paths = chainUndirectedEdges<number>([[0, 1], [1, 2], [1, 3]]);
    expect(paths.map((p) => p.nodes.length).sort()).toEqual([2, 3]);
  });

  it('stops AT a junction when asked (the breakline rule — three breaks, three lines)', () => {
    const paths = chainUndirectedEdges<number>([[0, 1], [1, 2], [1, 3]], { stopAtJunction: true });
    expect(paths).toHaveLength(3);
    for (const p of paths) expect(p.nodes).toHaveLength(2);
  });

  it('closes a cycle and repeats the start node', () => {
    const [loop] = chainUndirectedEdges<number>([[0, 1], [1, 2], [2, 0]], { stopAtJunction: true });
    expect(loop!.closed).toBe(true);
    expect(loop!.nodes[0]).toBe(loop!.nodes[loop!.nodes.length - 1]);
  });
});
