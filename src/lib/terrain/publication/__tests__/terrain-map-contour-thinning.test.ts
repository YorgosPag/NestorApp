/**
 * ADR-920 Β6.8 — local thinning of the INTERMEDIATE contours, on REAL snapshots (`buildListingTerrainSnapshot`).
 *
 *   - `PLANE`: 20 × 20 m rising 10 % to the east ⇒ 0.1 m contours, 1 m apart on the ground.
 *       at 20 px/m (the reference map) they are 20 px apart — nothing to thin;
 *       at 3 px/m they would be 3 px apart — every intermediate goes, index contours stay.
 *   - `FAN`: 40 × 40 m whose east-west gradient grows along y (2 % at the south edge → 22 % at the north edge), so the
 *     SAME intermediate line is legible in the south and crowded in the north — the case that needs runs, not lines.
 */

import type { TopoPoint } from '@/lib/terrain/terrain-types';

import { LISTING_TERRAIN_MAP_THINNING_MIN_RUN_PX } from '../listing-terrain-config';
import { buildListingTerrainSnapshot } from '../listing-terrain-snapshot';
import type { ListingTerrainSnapshot } from '../listing-terrain-types';
import { contourPathData } from '../terrain-map-contours';
import { thinMinorContours, type TerrainMapContourPiece } from '../terrain-map-contour-thinning';
import { joinPathData, polylinePathData } from '../terrain-map-svg';

const E0 = 400_000_000;
const N0 = 4_200_000_000;
const every = (from: number, to: number, step: number): number[] =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

function snapshotOf(xs: readonly number[], ys: readonly number[], zMmAt: (xM: number, yM: number) => number): ListingTerrainSnapshot {
  const points: TopoPoint[] = xs.flatMap((x) => ys.map((y) => ({ x: E0 + x * 1000, y: N0 + y * 1000, z: zMmAt(x, y) })));
  const result = buildListingTerrainSnapshot({ points, boundaryWorldMm: null, envelope: null });
  if (!result.ok) throw new Error(`expected a snapshot, got ${result.reason}`);
  return result.snapshot;
}

const PLANE = snapshotOf(every(0, 20, 2), every(0, 20, 2), (x) => 120_000 + 100 * x);
const FAN = snapshotOf(every(0, 40, 1), every(0, 40, 2), (x, y) => 100_000 + x * (20 + 5 * y));

const pathOf = (pieces: readonly TerrainMapContourPiece[]) =>
  joinPathData(pieces.map((piece) => polylinePathData(piece.points, piece.closed)));
const lengthM = (piece: TerrainMapContourPiece) =>
  piece.points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - piece.points[i].x, p.y - piece.points[i].y), 0);
const scaleOf = (snapshot: ListingTerrainSnapshot, pxPerM: number) => ({ intervalM: snapshot.contourIntervalM, pxPerM });

describe('thinMinorContours — legible ground is drawn untouched', () => {
  it('at the reference scale a 10 % plane draws EXACTLY the intermediate contours of the snapshot', () => {
    const out = thinMinorContours(PLANE.contours, PLANE.mesh, scaleOf(PLANE, 20));
    expect(out.shown).toBe('all');
    expect(pathOf(out.pieces)).toBe(contourPathData(PLANE.contours, false));
  });
});

describe('thinMinorContours — crowded ground', () => {
  it('drops every intermediate where all of them crowd — and says «none» (Β6.9), never «some»', () => {
    const out = thinMinorContours(PLANE.contours, PLANE.mesh, scaleOf(PLANE, 3));
    expect(out.shown).toBe('none');
    expect(out.pieces).toHaveLength(0);
  });

  it('never touches an index contour — not even at a scale where nothing crowds (it is not its input) — and «nothing to draw» withholds nothing: «all»', () => {
    const indexOnly = PLANE.contours.filter((c) => c.major);
    expect(indexOnly.length).toBeGreaterThan(0);
    for (const pxPerM of [3, 20]) {
      const out = thinMinorContours(indexOnly, PLANE.mesh, scaleOf(PLANE, pxPerM));
      expect(out.pieces).toHaveLength(0);
      expect(out.shown).toBe('all');
    }
  });
});

describe('thinMinorContours — the same line, legible in one place and crowded in another', () => {
  // On FAN at 2 px/m: 0.x m interval / gradient(y) × 2 px — crosses the 6 px minimum part-way up the plot.
  const out = thinMinorContours(FAN.contours, FAN.mesh, scaleOf(FAN, 2));

  it('keeps the legible stretches and drops the crowded ones', () => {
    expect(out.shown).toBe('some');
    expect(out.pieces.length).toBeGreaterThan(0);
    expect(pathOf(out.pieces)).not.toBe(contourPathData(FAN.contours, false));
  });

  it('no dashes: every surviving piece is at least the minimum run on screen', () => {
    for (const piece of out.pieces) expect(lengthM(piece) * 2).toBeGreaterThanOrEqual(LISTING_TERRAIN_MAP_THINNING_MIN_RUN_PX);
  });

  it('pieces only reuse the snapshot\'s own vertices (thinning removes, it never redraws)', () => {
    const vertices = new Set(contourPathData(FAN.contours, false).match(/-?\d+(\.\d+)? -?\d+(\.\d+)?/gu) ?? []);
    for (const piece of out.pieces) {
      for (const p of piece.points) expect(vertices.has(`${p.x} ${p.y}`)).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(pathOf(thinMinorContours(FAN.contours, FAN.mesh, scaleOf(FAN, 2)).pieces)).toBe(pathOf(out.pieces));
  });
});
