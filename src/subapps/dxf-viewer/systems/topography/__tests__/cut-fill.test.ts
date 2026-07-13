/**
 * ADR-650 M6 — earthworks volumes. Ground truth by CLOSED FORM, never by re-running the engine's
 * own arithmetic: every expectation below is a number a surveyor could compute on paper.
 *
 * The load-bearing test is «tilted plane crossing the level»: if the daylight split were missing,
 * cut and fill would cancel inside each triangle and one of them would come back 0 — while `net`
 * stayed right and everything LOOKED fine. That is the silent failure this milestone exists to
 * prevent, so it gets its own case.
 */

import { computeCutFill, datumReference, surfaceReference } from '../cut-fill';
import { crossCheckCutFill } from '../cut-fill-crosscheck';
import { volumeMm3ToM3, areaMm2ToM2 } from '../../../utils/scene-units';
import type { TinSurface, TopoBoundary } from '../topo-types';

/** 10 m × 10 m in canonical mm — one square, two CCW triangles, elevations from `zAt`. */
const SIDE_MM = 10_000;

function squareTin(zAt: (x: number, y: number) => number, side = SIDE_MM): TinSurface {
  const positions: [number, number][] = [
    [0, 0],
    [side, 0],
    [side, side],
    [0, side],
  ];
  const elevations = positions.map(([x, y]) => zAt(x, y));
  return {
    positions,
    elevations,
    triangles: [
      [0, 1, 2],
      [0, 2, 3],
    ],
    origin: { x: 0, y: 0 },
    bounds: {
      minX: 0,
      minY: 0,
      maxX: side,
      maxY: side,
      minZ: Math.min(...elevations),
      maxZ: Math.max(...elevations),
    },
    flatTriangleCount: 0,
  };
}

const EMPTY_TIN: TinSurface = {
  positions: [],
  elevations: [],
  triangles: [],
  origin: { x: 0, y: 0 },
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0 },
  flatTriangleCount: 0,
};

describe('computeCutFill — datum reference', () => {
  it('flat ground 1 m above the level → cut = area × height, zero fill', () => {
    const ground = squareTin(() => 1000); // +1.00 m everywhere
    const result = computeCutFill(ground, datumReference(0));

    // 10 m × 10 m × 1.00 m = 100 m³ — the whole point of the exercise, by hand.
    expect(volumeMm3ToM3(result.cutVolumeMm3)).toBeCloseTo(100, 6);
    expect(result.fillVolumeMm3).toBe(0);
    expect(volumeMm3ToM3(result.netVolumeMm3)).toBeCloseTo(100, 6);
    expect(areaMm2ToM2(result.cutAreaMm2)).toBeCloseTo(100, 6);
    expect(result.fillAreaMm2).toBe(0);
    expect(result.skippedTriangles).toBe(0);
  });

  it('flat ground 0.5 m BELOW the level → pure fill', () => {
    const ground = squareTin(() => 0);
    const result = computeCutFill(ground, datumReference(500));

    expect(volumeMm3ToM3(result.fillVolumeMm3)).toBeCloseTo(50, 6); // 100 m² × 0.50 m
    expect(result.cutVolumeMm3).toBe(0);
    expect(volumeMm3ToM3(result.netVolumeMm3)).toBeCloseTo(-50, 6); // deficit → import soil
  });

  it('DAYLIGHT LINE: a plane crossing the level yields cut AND fill, both > 0', () => {
    // z runs linearly −1.00 m → +1.00 m across x; the level cuts it exactly at mid-span.
    const ground = squareTin((x) => (x / SIDE_MM) * 2000 - 1000);
    const result = computeCutFill(ground, datumReference(0));

    // Each half is a wedge: 5 m × 10 m plan × mean 0.50 m = 25 m³. Symmetric → cut = fill.
    expect(volumeMm3ToM3(result.cutVolumeMm3)).toBeCloseTo(25, 6);
    expect(volumeMm3ToM3(result.fillVolumeMm3)).toBeCloseTo(25, 6);
    expect(volumeMm3ToM3(result.netVolumeMm3)).toBeCloseTo(0, 6);

    // Without the split these would be 0 while `net` still read 0 — the silent failure.
    expect(result.cutVolumeMm3).toBeGreaterThan(0);
    expect(result.fillVolumeMm3).toBeGreaterThan(0);
    expect(areaMm2ToM2(result.cutAreaMm2)).toBeCloseTo(50, 6); // half the plot excavates
    expect(areaMm2ToM2(result.fillAreaMm2)).toBeCloseTo(50, 6);
  });

  it('pyramid (apex 3 m over a 10 m base) → V = ⅓ · base · height', () => {
    // A square pyramid split into 4 triangles around the apex — the analytic volume is exact
    // for the prism method because every face is planar.
    const half = SIDE_MM / 2;
    const pyramid: TinSurface = {
      positions: [[0, 0], [SIDE_MM, 0], [SIDE_MM, SIDE_MM], [0, SIDE_MM], [half, half]],
      elevations: [0, 0, 0, 0, 3000],
      triangles: [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
      origin: { x: 0, y: 0 },
      bounds: { minX: 0, minY: 0, maxX: SIDE_MM, maxY: SIDE_MM, minZ: 0, maxZ: 3000 },
      flatTriangleCount: 0,
    };

    const result = computeCutFill(pyramid, datumReference(0));
    expect(volumeMm3ToM3(result.cutVolumeMm3)).toBeCloseTo((100 * 3) / 3, 6); // 100 m³
    expect(result.fillVolumeMm3).toBe(0);
  });

  it('an empty surface answers zeros — never NaN', () => {
    const result = computeCutFill(EMPTY_TIN, datumReference(1234));
    expect(result.cutVolumeMm3).toBe(0);
    expect(result.fillVolumeMm3).toBe(0);
    expect(result.netVolumeMm3).toBe(0);
    expect(Number.isNaN(result.netVolumeMm3)).toBe(false);
    expect(result.evaluatedTriangles).toBe(0);
  });
});

describe('computeCutFill — site boundary (Γ)', () => {
  it('counts only the earth inside the boundary', () => {
    const ground = squareTin(() => 1000); // 100 m³ over the full plot
    const halfPlot: TopoBoundary = {
      vertices: [
        { x: 0, y: 0 },
        { x: SIDE_MM / 2, y: 0 },
        { x: SIDE_MM / 2, y: SIDE_MM },
        { x: 0, y: SIDE_MM },
      ],
    };

    const result = computeCutFill(ground, datumReference(0), halfPlot);
    expect(volumeMm3ToM3(result.cutVolumeMm3)).toBeCloseTo(50, 6); // exactly half
    expect(areaMm2ToM2(result.cutAreaMm2)).toBeCloseTo(50, 6);
  });

  it('a CONCAVE (Γ-shaped) boundary is honoured, not silently convex-hulled', () => {
    const ground = squareTin(() => 1000);
    // An L covering 3 of the 4 quadrants → 75 m² → 75 m³.
    const half = SIDE_MM / 2;
    const lShape: TopoBoundary = {
      vertices: [
        { x: 0, y: 0 },
        { x: SIDE_MM, y: 0 },
        { x: SIDE_MM, y: half },
        { x: half, y: half },
        { x: half, y: SIDE_MM },
        { x: 0, y: SIDE_MM },
      ],
    };

    const result = computeCutFill(ground, datumReference(0), lShape);
    expect(volumeMm3ToM3(result.cutVolumeMm3)).toBeCloseTo(75, 4);
  });

  it('a boundary that misses the survey entirely yields zero, not the whole plot', () => {
    const ground = squareTin(() => 1000);
    const elsewhere: TopoBoundary = {
      vertices: [
        { x: 50_000, y: 50_000 },
        { x: 60_000, y: 50_000 },
        { x: 60_000, y: 60_000 },
      ],
    };

    const result = computeCutFill(ground, datumReference(0), elsewhere);
    expect(result.cutVolumeMm3).toBe(0);
    expect(result.fillVolumeMm3).toBe(0);
  });
});

describe('computeCutFill — surface reference (Β)', () => {
  it('ground 1 m above a designed ground → the same 100 m³ as the equivalent datum', () => {
    const ground = squareTin(() => 2000);
    const proposed = squareTin(() => 1000);

    const result = computeCutFill(ground, surfaceReference(proposed));
    expect(volumeMm3ToM3(result.cutVolumeMm3)).toBeCloseTo(100, 6);
    expect(result.fillVolumeMm3).toBe(0);
    expect(result.skippedTriangles).toBe(0);
  });

  it('a SLOPING designed ground is read exactly (barycentric), not as an average', () => {
    const ground = squareTin(() => 2000); // flat +2.00 m
    const proposed = squareTin((x) => (x / SIDE_MM) * 2000); // ramp 0 → +2.00 m

    // Δz runs 2.00 m → 0 linearly ⇒ mean 1.00 m over 100 m² ⇒ 100 m³.
    const result = computeCutFill(ground, surfaceReference(proposed));
    expect(volumeMm3ToM3(result.cutVolumeMm3)).toBeCloseTo(100, 4);
    expect(result.fillVolumeMm3).toBe(0);
  });

  it('where the designed ground does not reach, the triangle is SKIPPED — not valued at zero', () => {
    const ground = squareTin(() => 2000);
    const smallProposed = squareTin(() => 1000, SIDE_MM / 4); // covers only a corner

    const result = computeCutFill(ground, surfaceReference(smallProposed));
    expect(result.skippedTriangles).toBe(2); // both triangles have vertices outside it
    expect(result.evaluatedTriangles).toBe(0);
    expect(result.cutVolumeMm3).toBe(0); // no earth invented out of a missing reference
  });
});

describe('crossCheckCutFill — the second opinion (ADR-650 §7)', () => {
  it('the grid method agrees with the prism method on a plane', () => {
    const ground = squareTin((x) => (x / SIDE_MM) * 2000 - 1000);
    const reference = datumReference(0);
    const prism = computeCutFill(ground, reference);

    const check = crossCheckCutFill(ground, reference, null, prism);
    expect(check).not.toBeNull();
    expect(check!.divergencePct).toBeLessThan(1);
    expect(check!.diverges).toBe(false);
  });

  it('reports nothing to check when no earth moves at all', () => {
    const ground = squareTin(() => 1000);
    const prism = computeCutFill(ground, datumReference(1000)); // ground already at the level
    expect(crossCheckCutFill(ground, datumReference(1000), null, prism)).toBeNull();
  });
});
