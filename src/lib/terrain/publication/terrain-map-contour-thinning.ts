/**
 * ADR-920 Β6.8 — **local thinning of the intermediate contours**, where the ground is too steep for the plot's interval
 * at the size the map is actually shown. Pure, deterministic.
 *
 * Cartographic practice (Ordnance Survey — Mackaness & Steven 2006, «contour segment removal»; USGS; swisstopo): one
 * interval per map; where adjacent lines would fall closer than the legible minimum, the INTERMEDIATE contours are
 * dropped locally and the INDEX contours stay — the reader still gets every index level, and the steepness itself is
 * what the gap says. Index contours are never touched here.
 *
 * 🔑 Beyond CSR: the decision is per segment (the triangle under its midpoint — exact on a TIN, where every contour
 * segment lies inside one triangle), then smoothed in RUNS along the line ({@link LISTING_TERRAIN_MAP_THINNING_MIN_RUN_PX}):
 * short crowded stretches are kept (no pinholes) and short surviving stretches are dropped (no dashes).
 *
 * @module lib/terrain/publication/terrain-map-contour-thinning
 */

import { fitDzPlane } from '@/lib/terrain/dz-plane';
import { createTriangleLocator, type TriangleLocator } from '@/lib/terrain/triangle-locator';
import { LISTING_TERRAIN_MAP_THINNING_MIN_RUN_PX } from './listing-terrain-config';
import type { ListingTerrainContour, ListingTerrainMesh } from './listing-terrain-types';
import { contoursCrowded } from './terrain-contour-density';
import { meshTriangles } from './terrain-map-regions';
import { svgPointOf, type SvgPoint } from './terrain-map-svg';
import { slopePct } from './terrain-slope';

/** A drawn (piece of an) intermediate contour, SVG user space. */
export interface TerrainMapContourPiece {
  readonly points: readonly SvgPoint[];
  readonly closed: boolean;
}

export interface ThinnedMinorContours {
  readonly pieces: readonly TerrainMapContourPiece[];
  /** `true` when any intermediate stretch was dropped — the legend then says so. */
  readonly thinned: boolean;
}

/** Where the map is drawn: the plot's interval and the css px per metre of THIS map. */
export interface ThinningScale {
  readonly intervalM: number;
  readonly pxPerM: number;
}

/** The mesh as something that answers «how steep is the ground here?». */
interface GradientField {
  readonly locator: TriangleLocator;
  readonly gradients: readonly number[];
}

/** Gradient (rise/run) of every mesh triangle, in mesh order — `0` for a degenerate one. Also read by the bands rule. */
export function meshTriangleGradients(mesh: ListingTerrainMesh): number[] {
  const p = mesh.positions;
  const vertex = (n: number) => ({ x: p[3 * n], y: p[3 * n + 1], dz: p[3 * n + 2] });
  return meshTriangles(mesh).map(([i, j, k]) => {
    const plane = fitDzPlane(vertex(i), vertex(j), vertex(k));
    return plane ? slopePct(plane) / 100 : 0;
  });
}

function gradientFieldOf(mesh: ListingTerrainMesh): GradientField {
  const p = mesh.positions;
  const xy: (readonly [number, number])[] = [];
  for (let i = 0; i + 2 < p.length; i += 3) xy.push([p[i], p[i + 1]]);
  return { locator: createTriangleLocator(xy, meshTriangles(mesh)), gradients: meshTriangleGradients(mesh) };
}

/** A run of consecutive segments that share one decision. */
interface Run {
  keep: boolean;
  /** First and last segment index (inclusive), in the rotated order. */
  readonly from: number;
  to: number;
  lengthPx: number;
}

/** Frame point `n` of a flat `[x, y, …]` contour. */
function vertexOf(flat: readonly number[], n: number): readonly [number, number] {
  return [flat[2 * n], flat[2 * n + 1]];
}

/** Per segment: crowded? and its length in px. Segment `s` joins vertex `s` to `s + 1` (mod n when closed). */
function segmentsOf(contour: ListingTerrainContour, field: GradientField, scale: ThinningScale) {
  const n = contour.points.length / 2;
  const count = contour.closed ? n : n - 1;
  const crowded: boolean[] = [];
  const lengthPx: number[] = [];
  for (let s = 0; s < count; s++) {
    const [ax, ay] = vertexOf(contour.points, s);
    const [bx, by] = vertexOf(contour.points, (s + 1) % n);
    const hit = field.locator.locate((ax + bx) / 2, (ay + by) / 2);
    const gradient = hit === null ? 0 : field.gradients[hit.triangle] ?? 0;
    crowded.push(contoursCrowded(scale.intervalM, gradient, scale.pxPerM));
    lengthPx.push(Math.hypot(bx - ax, by - ay) * scale.pxPerM);
  }
  return { crowded, lengthPx, count, n };
}

/** Consecutive segments with the same decision, starting at `start` (a closed line is read from a change of state). */
function runsOf(keep: readonly boolean[], lengthPx: readonly number[], start: number): Run[] {
  const runs: Run[] = [];
  for (let r = 0; r < keep.length; r++) {
    const s = (start + r) % keep.length;
    const last = runs[runs.length - 1];
    if (last && last.keep === keep[s]) { last.to = r; last.lengthPx += lengthPx[s]; continue; }
    runs.push({ keep: keep[s], from: r, to: r, lengthPx: lengthPx[s] });
  }
  return runs;
}

/** Merge neighbouring runs that now share a decision. */
function merged(runs: readonly Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    if (last && last.keep === run.keep) { last.to = run.to; last.lengthPx += run.lengthPx; continue; }
    out.push({ ...run });
  }
  return out;
}

/** No pinholes (short dropped runs are kept), then no dashes (short kept runs are dropped). */
function smoothed(runs: readonly Run[]): Run[] {
  const short = (run: Run) => run.lengthPx < LISTING_TERRAIN_MAP_THINNING_MIN_RUN_PX;
  const holesClosed = merged(runs.map((run) => (!run.keep && short(run) ? { ...run, keep: true } : run)));
  return merged(holesClosed.map((run) => (run.keep && short(run) ? { ...run, keep: false } : run)));
}

/** The pieces of ONE intermediate contour that survive, and whether anything was dropped. */
function thinOne(contour: ListingTerrainContour, field: GradientField, scale: ThinningScale) {
  const { crowded, lengthPx, count, n } = segmentsOf(contour, field, scale);
  const whole = { points: toSvg(contour.points, 0, n - 1, n), closed: contour.closed };
  if (!crowded.some(Boolean)) return { pieces: [whole], thinned: false };
  const keep = crowded.map((c) => !c);
  const change = contour.closed ? Math.max(0, keep.findIndex((k, s) => k !== keep[(s + count - 1) % count])) : 0;
  const runs = smoothed(runsOf(keep, lengthPx, change));
  if (runs.every((run) => run.keep)) return { pieces: [whole], thinned: false };
  const pieces = runs
    .filter((run) => run.keep)
    .map((run) => ({ points: toSvg(contour.points, change + run.from, change + run.to + 1, n), closed: false }));
  return { pieces, thinned: true };
}

/** Vertices `from..to` (inclusive, wrapping mod n) of a flat contour, in SVG space. */
function toSvg(flat: readonly number[], from: number, to: number, n: number): SvgPoint[] {
  const out: SvgPoint[] = [];
  for (let v = from; v <= to; v++) {
    const [x, y] = vertexOf(flat, v % n);
    out.push(svgPointOf(x, y));
  }
  return out;
}

/** The intermediate contours as drawn on a map of this scale; index contours are not this module's business. */
export function thinMinorContours(
  contours: readonly ListingTerrainContour[],
  mesh: ListingTerrainMesh,
  scale: ThinningScale,
): ThinnedMinorContours {
  const field = gradientFieldOf(mesh);
  const pieces: TerrainMapContourPiece[] = [];
  let thinned = false;
  for (const contour of contours) {
    if (contour.major || contour.points.length < 4) continue;
    const one = thinOne(contour, field, scale);
    pieces.push(...one.pieces);
    thinned ||= one.thinned;
  }
  return { pieces, thinned };
}
