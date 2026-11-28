/**
 * ADR-920 Β4.8 — the AREAS of the 2D terrain map: survey extent, one region per slope class, the sparse area.
 *
 * 🔑 **One SVG element per region, never one per triangle.** A plot carries up to 60 000 triangles; the map draws a
 * handful of paths. Each region is the boundary of its triangle set (`tinBoundaryLoops`, the SAME core as the DXF
 * surface footprint), so there is no seam between two triangles of the same class.
 *
 * 🔑 **Areas from the triangles, never from the rings**: the rings are chained over undirected edges and cannot tell a
 * hole from an island (`topo-surface-area.ts`). The view fills them with `fill-rule="evenodd"`, which needs no such
 * distinction.
 *
 * @module lib/terrain/publication/terrain-map-regions
 */

import { polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { tinBoundaryLoops, type TriangleIndices } from '../tin-boundary-loops';
import { LISTING_TERRAIN_MAP_SPARSE_EDGE_FACTOR } from './listing-terrain-config';
import type { ListingTerrainMesh } from './listing-terrain-types';
import { joinPathData, polylinePathData, svgPointOf } from './terrain-map-svg';

/** One slope class on the map — and in its legend / data table. */
export interface TerrainMapSlopeRegion {
  /** Index into the snapshot's slope bands (`0` = flattest). */
  readonly classIndex: number;
  /** Lower bound, percent (`0` for the first class). */
  readonly fromPct: number;
  /** Upper bound, percent — `null` for the last, open class. */
  readonly toPct: number | null;
  /** Share of the plan area in this class, `0..1` (the legend shows it; the big tools show only the range). */
  readonly areaShare: number;
  /** Path data, `fill-rule="evenodd"`; empty when no triangle falls in the class. */
  readonly pathData: string;
}

/** The flat mesh as triangle tuples. */
export function meshTriangles(mesh: ListingTerrainMesh): TriangleIndices[] {
  const out: TriangleIndices[] = [];
  for (let t = 0; t + 2 < mesh.triangles.length; t += 3) {
    out.push([mesh.triangles[t], mesh.triangles[t + 1], mesh.triangles[t + 2]]);
  }
  return out;
}

/**
 * The boundary of a triangle set as rings in the SNAPSHOT FRAME (x east, y north, metres — as stored, not rounded
 * again). The SHAPE of a region, before any surface decides how to draw it: the 2D sheet turns it into path data
 * ({@link regionPathData}), the map into GeoJSON (`map-placement/terrain-map-features.ts`, ADR-920 §14.12 Β2).
 * ⚠️ No hierarchy: the rings cannot tell a hole from an island (`tin-boundary-loops.ts`).
 */
export function regionRings(
  mesh: Pick<ListingTerrainMesh, 'positions'>,
  triangles: readonly TriangleIndices[],
): PlanarPoint[][] {
  const { positions } = mesh;
  return tinBoundaryLoops(triangles).map((ring) => ring.map((i) => ({ x: positions[3 * i], y: positions[3 * i + 1] })));
}

/**
 * The boundary of a triangle set as ONE path data string. Only the flat `[x, y, z, …]` positions are read, so the
 * elevation bands (`terrain-map-elevation-bands.ts`) draw their refined triangles through this SAME function.
 */
export function regionPathData(
  mesh: Pick<ListingTerrainMesh, 'positions'>,
  triangles: readonly TriangleIndices[],
): string {
  return joinPathData(
    regionRings(mesh, triangles).map((ring) => polylinePathData(ring.map((p) => svgPointOf(p.x, p.y)), true)),
  );
}

/** Plan area of one triangle, m² — also of the refined triangles of the elevation bands (one definition). */
export function triangleArea(positions: readonly number[], [i, j, k]: TriangleIndices): number {
  const at = (v: number) => ({ x: positions[3 * v], y: positions[3 * v + 1] });
  return polygonArea([at(i), at(j), at(k)]);
}

/** One slope class as a SHAPE: its range, its share and the triangles in it — not yet drawn by anyone. */
export interface TerrainSlopeClassShape extends Omit<TerrainMapSlopeRegion, 'pathData'> {
  readonly triangles: readonly TriangleIndices[];
}

/**
 * Every slope class of the snapshot, empty ones included (the legend lists the full scale) — the ONE grouping of the
 * triangles by class, read by the 2D sheet ({@link slopeRegionsOf}) and by the map (ADR-920 §14.12 Β2).
 */
export function slopeClassShapesOf(
  mesh: ListingTerrainMesh,
  triangles: readonly TriangleIndices[],
  bandsPct: readonly number[],
): TerrainSlopeClassShape[] {
  const byClass: TriangleIndices[][] = Array.from({ length: bandsPct.length + 1 }, () => []);
  const areaByClass = new Array<number>(bandsPct.length + 1).fill(0);
  let total = 0;
  triangles.forEach((tri, t) => {
    const cls = mesh.slopeClass[t];
    const area = triangleArea(mesh.positions, tri);
    byClass[cls].push(tri);
    areaByClass[cls] += area;
    total += area;
  });
  return byClass.map((members, classIndex) => ({
    classIndex,
    ...slopeClassRange(bandsPct, classIndex),
    areaShare: total > 0 ? areaByClass[classIndex] / total : 0,
    triangles: members,
  }));
}

/** Every slope class as the 2D sheet draws it: the shape ({@link slopeClassShapesOf}) + its path. */
export function slopeRegionsOf(
  mesh: ListingTerrainMesh,
  triangles: readonly TriangleIndices[],
  bandsPct: readonly number[],
): TerrainMapSlopeRegion[] {
  return slopeClassShapesOf(mesh, triangles, bandsPct).map(({ triangles: members, ...region }) => ({
    ...region,
    pathData: regionPathData(mesh, members),
  }));
}

/**
 * The range of slope class `classIndex` — the ONE definition: the map's regions and the point inspector's «class 5 % –
 * 15 %» (ADR-920 §14.10) both read it. `toPct: null` for the last, open class.
 */
export function slopeClassRange(bandsPct: readonly number[], classIndex: number): Pick<TerrainMapSlopeRegion, 'fromPct' | 'toPct'> {
  return {
    fromPct: classIndex === 0 ? 0 : bandsPct[classIndex - 1],
    toPct: classIndex < bandsPct.length ? bandsPct[classIndex] : null,
  };
}

/** Plan length of the edge `a–b`, metres. */
function edgeLength(positions: readonly number[], a: number, b: number): number {
  return Math.hypot(positions[3 * a] - positions[3 * b], positions[3 * a + 1] - positions[3 * b + 1]);
}

/** Median of the UNIQUE edges of the surface (an interior edge counts once, not once per triangle). */
function medianEdgeLength(positions: readonly number[], triangles: readonly TriangleIndices[]): number {
  const lengths = new Map<string, number>();
  for (const [i, j, k] of triangles) {
    for (const [a, b] of [[i, j], [j, k], [k, i]] as const) {
      lengths.set(a < b ? `${a}:${b}` : `${b}:${a}`, edgeLength(positions, a, b));
    }
  }
  const sorted = [...lengths.values()].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Per triangle: does it span unmeasured ground? Longest edge > {@link LISTING_TERRAIN_MAP_SPARSE_EDGE_FACTOR} × the
 * median edge. The ONE definition — the hatched area of the map and the «interpolated» reading of the point inspector
 * (ADR-920 §14.10) both ask it.
 */
export function sparseTriangleFlags(
  positions: readonly number[],
  triangles: readonly TriangleIndices[],
  factor: number = LISTING_TERRAIN_MAP_SPARSE_EDGE_FACTOR,
): boolean[] {
  if (triangles.length === 0) return [];
  const limit = factor * medianEdgeLength(positions, triangles);
  return triangles.map(([i, j, k]) =>
    Math.max(edgeLength(positions, i, j), edgeLength(positions, j, k), edgeLength(positions, k, i)) > limit,
  );
}

/**
 * The triangles that span unmeasured ground ({@link sparseTriangleFlags}) as one path. `null` when there are none — the
 * map then says nothing, rather than drawing an empty hatch.
 */
export function sparseAreaPathData(
  mesh: ListingTerrainMesh,
  triangles: readonly TriangleIndices[],
  factor: number = LISTING_TERRAIN_MAP_SPARSE_EDGE_FACTOR,
): string | null {
  const flags = sparseTriangleFlags(mesh.positions, triangles, factor);
  const sparse = triangles.filter((_, t) => flags[t]);
  return sparse.length === 0 ? null : regionPathData(mesh, sparse);
}
