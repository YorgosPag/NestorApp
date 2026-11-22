/**
 * ADR-920 §14.10 — «which contour is nearest to (x, y)?», over the snapshot's OWN contours. Pure.
 *
 * 🔑 **From `snapshot.contours`, never from the drawn paths**: the map merges every contour of a class into one path and,
 *   at `minorShown: 'none'`, draws no intermediate at all (Β6.9). The inspector answers with the contour of the SURFACE —
 *   the one the 3D shows and the stats count — and then lights it along its full length.
 * 🔑 **Bucket grid of segments** (the same idea as `triangle-locator.ts`): a ring search outward from the point's cell, which
 *   stops as soon as no farther ring can hold a closer segment. O(1) amortised per pointer move on a real survey.
 *
 * @module lib/terrain/inspect/terrain-contour-index
 */

import { distanceToSegment, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { ListingTerrainContour } from '@/lib/terrain/publication/listing-terrain-types';

/** The answer: which contour, its level and class, and how far the point is from it (plan metres). */
export interface NearestContour {
  readonly contour: number;
  readonly levelM: number;
  readonly major: boolean;
  readonly distanceM: number;
}

export interface ContourIndex {
  readonly nearest: (x: number, y: number) => NearestContour | null;
}

interface Segment {
  readonly contour: number;
  readonly a: PlanarPoint;
  readonly b: PlanarPoint;
}

interface SegmentGrid {
  readonly minX: number;
  readonly minY: number;
  readonly axis: number;
  readonly cellW: number;
  readonly cellH: number;
  readonly buckets: readonly (readonly number[])[];
}

const MAX_CELLS_PER_AXIS = 256;
const EPSILON = 1e-9;

/** Every straight piece of every contour; a closed contour gets its closing piece. */
function contourSegmentsOf(contours: readonly ListingTerrainContour[]): Segment[] {
  const out: Segment[] = [];
  contours.forEach((contour, index) => {
    const p = contour.points;
    const count = Math.floor(p.length / 2);
    for (let i = 0; i + 1 < count; i++) {
      out.push({ contour: index, a: { x: p[2 * i], y: p[2 * i + 1] }, b: { x: p[2 * i + 2], y: p[2 * i + 3] } });
    }
    if (contour.closed && count > 2) {
      out.push({ contour: index, a: { x: p[2 * count - 2], y: p[2 * count - 1] }, b: { x: p[0], y: p[1] } });
    }
  });
  return out;
}

function gridOf(segments: readonly Segment[]): SegmentGrid {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const { a, b } of segments) {
    minX = Math.min(minX, a.x, b.x); minY = Math.min(minY, a.y, b.y);
    maxX = Math.max(maxX, a.x, b.x); maxY = Math.max(maxY, a.y, b.y);
  }
  const axis = Math.min(MAX_CELLS_PER_AXIS, Math.max(1, Math.ceil(Math.sqrt(segments.length))));
  const cellW = Math.max(maxX - minX, EPSILON) / axis;
  const cellH = Math.max(maxY - minY, EPSILON) / axis;
  const buckets: number[][] = Array.from({ length: axis * axis }, () => []);
  const clamp = (v: number): number => Math.min(axis - 1, Math.max(0, v));
  segments.forEach(({ a, b }, s) => {
    const c0 = clamp(Math.floor((Math.min(a.x, b.x) - minX) / cellW));
    const c1 = clamp(Math.floor((Math.max(a.x, b.x) - minX) / cellW));
    const r0 = clamp(Math.floor((Math.min(a.y, b.y) - minY) / cellH));
    const r1 = clamp(Math.floor((Math.max(a.y, b.y) - minY) / cellH));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) buckets[r * axis + c].push(s);
  });
  return { minX, minY, axis, cellW, cellH, buckets };
}

/** The cells at Chebyshev distance exactly `ring` from (col, row), clipped to the grid. */
function ringCells(grid: SegmentGrid, col: number, row: number, ring: number): number[] {
  const cells: number[] = [];
  for (let r = row - ring; r <= row + ring; r++) {
    if (r < 0 || r >= grid.axis) continue;
    for (let c = col - ring; c <= col + ring; c++) {
      if (c < 0 || c >= grid.axis) continue;
      if (Math.max(Math.abs(r - row), Math.abs(c - col)) === ring) cells.push(r * grid.axis + c);
    }
  }
  return cells;
}

interface Best {
  segment: number;
  distance: number;
}

function searchRing(grid: SegmentGrid, segments: readonly Segment[], cells: readonly number[], point: PlanarPoint, best: Best): void {
  for (const cell of cells) {
    for (const s of grid.buckets[cell]) {
      const d = distanceToSegment(point, segments[s].a, segments[s].b);
      if (d < best.distance) { best.distance = d; best.segment = s; }
    }
  }
}

/** The index of a snapshot's contours. An empty list answers `null` everywhere. */
export function createContourIndex(contours: readonly ListingTerrainContour[]): ContourIndex {
  const segments = contourSegmentsOf(contours);
  if (segments.length === 0) return { nearest: () => null };
  const grid = gridOf(segments);
  const clamp = (v: number): number => Math.min(grid.axis - 1, Math.max(0, v));
  const step = Math.min(grid.cellW, grid.cellH);
  const nearest = (x: number, y: number): NearestContour | null => {
    const col = clamp(Math.floor((x - grid.minX) / grid.cellW));
    const row = clamp(Math.floor((y - grid.minY) / grid.cellH));
    const best: Best = { segment: -1, distance: Infinity };
    // A cell `ring + 1` away is at least `ring · step` from any point of the start cell (or farther, from outside it).
    for (let ring = 0; ring < grid.axis; ring++) {
      searchRing(grid, segments, ringCells(grid, col, row, ring), { x, y }, best);
      if (best.segment >= 0 && best.distance <= ring * step) break;
    }
    if (best.segment < 0) return null;
    const contour = contours[segments[best.segment].contour];
    return { contour: segments[best.segment].contour, levelM: contour.levelM, major: contour.major, distanceM: best.distance };
  };
  return { nearest };
}
