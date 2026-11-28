/**
 * ADR-920 §14.10 — everything the point inspector, the profile and the water drop ask of ONE snapshot, built ONCE.
 *
 * 🔑 **Built once per snapshot, memoised by identity** (`WeakMap`): a pointer move is a lookup, never a rebuild. The same
 *   index serves the plan map, the 3D view and the profile chart, so the three can never disagree about a point.
 * 🔑 **Nothing new is computed that the map already decides**: the triangle locator is `triangle-locator.ts` (the one the
 *   volume engine uses), the planes are `fitDzPlane`, «interpolated ground» is `sparseTriangleFlags` (the hatched area of
 *   the map). Everything is in the snapshot frame: plan metres from the surface centre, elevations absolute (Δ3).
 *
 * @module lib/terrain/inspect/terrain-inspect-index
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { fitDzPlane, type DzPlane } from '@/lib/terrain/dz-plane';
import { framePointsOf } from '@/lib/terrain/publication/listing-terrain-frame';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import { meshTriangles, sparseTriangleFlags } from '@/lib/terrain/publication/terrain-map-regions';
import type { TriangleIndices } from '@/lib/terrain/tin-boundary-loops';
import { createTriangleHitSink, createTriangleLocator, type TriangleLocator } from '@/lib/terrain/triangle-locator';

import { createContourIndex, type ContourIndex } from './terrain-contour-index';

export interface TerrainInspectIndex {
  readonly snapshot: ListingTerrainSnapshot;
  /** Vertex plan positions. */
  readonly xy: readonly (readonly [number, number])[];
  /** Vertex elevations, absolute metres. */
  readonly z: readonly number[];
  readonly triangles: readonly TriangleIndices[];
  readonly locator: TriangleLocator;
  /** The plane `z = a·x + b·y + c` of each triangle; `null` for a degenerate one. */
  readonly planes: readonly (DzPlane | null)[];
  /** Per triangle: spans unmeasured ground (the map's hatched area). */
  readonly sparse: readonly boolean[];
  /** `adjacent[3t + e]` = the triangle across edge `e` (vertex `e` → vertex `e + 1`) of triangle `t`; `-1` on the rim. */
  readonly adjacent: Int32Array;
  /** Unique mesh edges as vertex pairs `[a0, b0, a1, b1, …]`. */
  readonly edges: Uint32Array;
  readonly contours: ContourIndex;
  /** The plot boundary ring, when the surface was clipped to one. */
  readonly boundary: readonly PlanarPoint[] | null;
  /** The footprint of the indicative building envelope, when published. */
  readonly footprint: readonly PlanarPoint[] | null;
}

/** Flat `[x, y, …]` → points; `null` stays `null`. */
function flatRing(flat: readonly number[] | null | undefined): PlanarPoint[] | null {
  return !flat || flat.length < 6 ? null : framePointsOf(flat);
}

function planesOf(xy: TerrainInspectIndex['xy'], z: readonly number[], triangles: readonly TriangleIndices[]): (DzPlane | null)[] {
  return triangles.map(([i, j, k]) => fitDzPlane(
    { x: xy[i][0], y: xy[i][1], dz: z[i] },
    { x: xy[j][0], y: xy[j][1], dz: z[j] },
    { x: xy[k][0], y: xy[k][1], dz: z[k] },
  ));
}

/** Neighbour across every triangle edge, and the unique edge list — one pass over the edges. */
function topologyOf(triangles: readonly TriangleIndices[]): { adjacent: Int32Array; edges: Uint32Array } {
  const adjacent = new Int32Array(triangles.length * 3).fill(-1);
  const open = new Map<string, number>();
  const edges: number[] = [];
  triangles.forEach((tri, t) => {
    for (let e = 0; e < 3; e++) {
      const a = tri[e];
      const b = tri[(e + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const other = open.get(key);
      if (other === undefined) { open.set(key, 3 * t + e); edges.push(a, b); continue; }
      adjacent[3 * t + e] = Math.floor(other / 3);
      adjacent[other] = t;
      open.delete(key);
    }
  });
  return { adjacent, edges: Uint32Array.from(edges) };
}

function buildIndex(snapshot: ListingTerrainSnapshot): TerrainInspectIndex {
  const { positions } = snapshot.mesh;
  const count = Math.floor(positions.length / 3);
  const xy = Array.from({ length: count }, (_, i) => [positions[3 * i], positions[3 * i + 1]] as const);
  const z = Array.from({ length: count }, (_, i) => positions[3 * i + 2]);
  const triangles = meshTriangles(snapshot.mesh);
  return {
    snapshot, xy, z, triangles,
    locator: createTriangleLocator(xy, triangles),
    planes: planesOf(xy, z, triangles),
    sparse: sparseTriangleFlags(positions, triangles),
    ...topologyOf(triangles),
    contours: createContourIndex(snapshot.contours),
    boundary: flatRing(snapshot.boundary),
    footprint: flatRing(snapshot.envelope?.footprint),
  };
}

const memo = new WeakMap<ListingTerrainSnapshot, TerrainInspectIndex>();

/** The index of `snapshot` — built on first ask, then the same object for as long as the snapshot lives. */
export function terrainInspectIndexOf(snapshot: ListingTerrainSnapshot): TerrainInspectIndex {
  const cached = memo.get(snapshot);
  if (cached) return cached;
  const index = buildIndex(snapshot);
  memo.set(snapshot, index);
  return index;
}

/** The surface at one point: its elevation and the triangle that carries it. */
export interface SurfaceElevation {
  readonly z: number;
  readonly triangle: number;
}

/** A reusable reading, for a caller that asks many times (one tile of the elevation mosaic: once per pixel). */
export type SurfaceElevationSink = { -readonly [K in keyof SurfaceElevation]: SurfaceElevation[K] };

export function createSurfaceElevationSink(): SurfaceElevationSink {
  return { z: 0, triangle: -1 };
}

/** One hit for every reading: the questions are synchronous and never nest. */
const HIT = createTriangleHitSink();

/**
 * Elevation of the surface at (x, y) — barycentric on the published triangle — written into `sink`; `false` (and `sink`
 * untouched) off the surface. THE reading: {@link elevationAt} is this one with a fresh result.
 */
export function elevationInto(sink: SurfaceElevationSink, index: TerrainInspectIndex, x: number, y: number): boolean {
  if (!index.locator.locateInto(HIT, x, y)) return false;
  const triangle = index.triangles[HIT.triangle];
  sink.z = HIT.wa * index.z[triangle[0]] + HIT.wb * index.z[triangle[1]] + HIT.wc * index.z[triangle[2]];
  sink.triangle = HIT.triangle;
  return true;
}

/** Elevation of the surface at (x, y) — barycentric on the published triangle — or `null` off the surface. */
export function elevationAt(index: TerrainInspectIndex, x: number, y: number): SurfaceElevation | null {
  const sink = createSurfaceElevationSink();
  return elevationInto(sink, index, x, y) ? sink : null;
}
