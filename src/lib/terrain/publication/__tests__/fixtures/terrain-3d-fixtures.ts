/**
 * ADR-920 Β6.4 — fixtures of the 3D tests: a REAL snapshot (built by `buildListingTerrainSnapshot`) and small
 * hand-made meshes whose boundary is known by construction (a square; a square frame with a hole).
 */

import type { TopoPoint } from '@/lib/terrain/terrain-types';

import type { ListingTerrain } from '@/types/public-listing';

import { listingTerrainCardOf } from '../../listing-terrain-card';
import { buildListingTerrainSnapshot } from '../../listing-terrain-snapshot';
import type { ListingTerrainContour, ListingTerrainSnapshot } from '../../listing-terrain-types';

const E0 = 400_000_000;
const N0 = 4_200_000_000;

export const every = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

/** Real snapshot of a grid surface (metres in, world mm to the builder). */
export function realSnapshotOf(xs: readonly number[], ys: readonly number[], zMmAt: (x: number, y: number) => number): ListingTerrainSnapshot {
  const points: TopoPoint[] = xs.flatMap((x) => ys.map((y) => ({ x: E0 + x * 1000, y: N0 + y * 1000, z: zMmAt(x, y) })));
  const result = buildListingTerrainSnapshot({ points, boundaryWorldMm: null, envelope: null });
  if (!result.ok) throw new Error(`expected a snapshot, got ${result.reason}`);
  return result.snapshot;
}

/** 20 × 20 m plot rising 10 % to the east from 120 m. */
export const REAL_PLANE = (): ListingTerrainSnapshot =>
  realSnapshotOf(every(0, 20, 2), every(0, 20, 2), (x) => 120_000 + 100 * x);

/** ADR-920 Β6.6 — the terrain a public listing carries for `snapshot`: the card from the ONE derivation + the shelf URL. */
export const PUBLISHED_TERRAIN_URL = 'https://storage.googleapis.com/shelf/terrain/abc.json';
export function publishedTerrainOf(snapshot: ListingTerrainSnapshot, url = PUBLISHED_TERRAIN_URL): ListingTerrain {
  const card = listingTerrainCardOf(snapshot, { surveyorName: 'Γ. Τοπογράφος', surveyedOn: '2026-10-01', rightsAffirmed: true });
  return { url, ...card };
}

/** A snapshot around a hand-made mesh; stats follow its z range. */
export function syntheticSnapshot(
  positions: number[],
  triangles: number[],
  contours: ListingTerrainContour[] = [],
): ListingTerrainSnapshot {
  const zs = positions.filter((_, i) => i % 3 === 2);
  const min = Math.min(...zs);
  const max = Math.max(...zs);
  return {
    version: 2,
    mesh: { positions, triangles, slopeClass: triangles.filter((_, i) => i % 3 === 0).map(() => 0) },
    contours,
    contourIntervalM: 1,
    contourMajorEvery: 5,
    slopeBandsPct: [5, 15, 25],
    boundary: null,
    stats: {
      planAreaM2: 1, minElevationM: min, maxElevationM: max, reliefM: max - min,
      meanSlopePct: 0, maxSlopePct: 0, downslopeAzimuthDeg: null,
    },
    envelope: null,
    envelopeOmission: null,
    plotOutline: null,
    plotOutlineOmission: null,
  };
}

/** Square 2 × 2 m (two CCW triangles), z = 100 at the west edge, 101 at the east edge. */
export function squareSnapshot(): ListingTerrainSnapshot {
  return syntheticSnapshot(
    [-1, -1, 100, 1, -1, 101, 1, 1, 101, -1, 1, 100],
    [0, 1, 2, 0, 2, 3],
  );
}

/**
 * Square frame: outer ring O0..O3 (±2 m), inner ring I0..I3 (±1 m) — a surface WITH A HOLE. Per side k, the two CCW
 * triangles (Ok, Ok+1, Ik+1) and (Ok, Ik+1, Ik). Boundary edges = 4 outer + 4 inner.
 */
export function frameSnapshot(): ListingTerrainSnapshot {
  const outer = [[-2, -2], [2, -2], [2, 2], [-2, 2]];
  const inner = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const positions = [...outer, ...inner].flatMap(([x, y], i) => [x, y, 100 + (i % 2)]);
  const triangles: number[] = [];
  for (let k = 0; k < 4; k++) {
    const next = (k + 1) % 4;
    triangles.push(k, next, 4 + next, k, 4 + next, 4 + k);
  }
  return syntheticSnapshot(positions, triangles);
}
