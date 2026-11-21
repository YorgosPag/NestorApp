/**
 * ADR-920 Β6.4 — the 3D picture of a published terrain snapshot, as plain typed arrays (no three.js).
 *
 * The viewer (Β6.5) uploads these buffers as they are; every geometric decision lives here, where a jest test can
 * check it without a GPU:
 *
 *   - **Axes** (three.js, Y up): X = east, **−Z = north** (the view cube's compass puts N at −Z), Y = height above the
 *     LOWEST point × exaggeration. Plan coordinates are already relative to the surface centre (Δ3), heights become
 *     relative too — Float32 keeps centimetres, and the buffers carry no absolute altitude.
 *   - **Surface**: the surveyor's TIN as published, one colour per vertex from the ONE elevation ramp, normalised over
 *     `stats.min..max` exactly like the plan map (Β6.2) and the DXF viewer — the same height reads the same colour.
 *   - **Soil block**: Cesium-style «skirts» (vertical walls on the boundary edges) PLUS a bottom (Cesium PR #11460: a
 *     skirt without a floor leaks light), so the terrain reads as a solid slab from every side of the cube.
 *     The walls come from `tinBoundaryEdges`, which returns every boundary edge in its triangle's counter-clockwise
 *     order — the interior is always on the LEFT, so the outward side is known without guessing, holes included.
 *     The bottom is the surface's own triangles at the base level, reversed: exactly the footprint, no retriangulation.
 *   - **Contours**: segment pairs (for `LineSegments2`) at `levelM`, index and minor apart. No lift: the viewer keeps
 *     them on top with `polygonOffset` on the surface, so a contour never floats above the ground it describes.
 *
 * Pure — zero DOM / React / three.
 *
 * @module lib/terrain/publication/terrain-3d-geometry
 */

import { writeTerrainElevationColor } from '../elevation-ramp';
import { tinBoundaryEdges } from '../tin-boundary-loops';
import {
  LISTING_TERRAIN_3D_BASE_DEPTH_FRACTION,
  LISTING_TERRAIN_3D_BASE_DEPTH_MIN_M,
  LISTING_TERRAIN_3D_EXAGGERATIONS,
  type ListingTerrain3dExaggeration,
} from './listing-terrain-config';
import type { ListingTerrainContour, ListingTerrainMesh, ListingTerrainSnapshot } from './listing-terrain-types';
import { meshTriangles } from './terrain-map-regions';

/** Indexed triangles: `positions` = flat xyz, `indices` = flat triangle corners. */
export interface Terrain3dBuffers {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
}

/** Everything the 3D viewer draws, in metres. */
export interface Terrain3dGeometry {
  readonly exaggeration: ListingTerrain3dExaggeration;
  /** The ground: linear-space RGB per vertex (`BufferGeometry` `color` attribute). */
  readonly surface: Terrain3dBuffers & { readonly colors: Float32Array };
  /** Walls + bottom of the soil block — one material. */
  readonly soil: Terrain3dBuffers;
  /** Segment pairs `[x0,y0,z0, x1,y1,z1, …]`. */
  readonly contours: { readonly major: Float32Array; readonly minor: Float32Array };
  /** Axis-aligned box of the whole block (for framing the camera). */
  readonly bounds: {
    readonly minX: number; readonly maxX: number;
    readonly minZ: number; readonly maxZ: number;
    readonly baseY: number; readonly topY: number;
  };
}

export type Terrain3dGeometryResult =
  | { readonly ok: true; readonly geometry: Terrain3dGeometry }
  | { readonly ok: false; readonly reason: 'unknown-exaggeration' };

/** The closed set of exaggerations (Α5) — a type guard for UI input. */
export function isTerrain3dExaggeration(value: number): value is ListingTerrain3dExaggeration {
  return (LISTING_TERRAIN_3D_EXAGGERATIONS as readonly number[]).includes(value);
}

interface Vertical {
  readonly minM: number;
  readonly spanM: number;
  readonly exaggeration: number;
}

function heightY(elevationM: number, v: Vertical): number {
  return (elevationM - v.minM) * v.exaggeration;
}

/** Plan extent of the mesh (snapshot frame: x east, y north). */
function planExtent(positions: readonly number[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1]);
  }
  return { minX, maxX, minY, maxY };
}

/** Writes one snapshot vertex into three.js axes at float offset `o`. */
function writeVertex(out: Float32Array, o: number, xM: number, yM: number, heightM: number): void {
  out[o] = xM;
  out[o + 1] = heightM;
  out[o + 2] = -yM;
}

/** Mesh vertex `i` on the ground, into `out` at the same vertex slot. Returns its elevation (absolute m). */
function writeGroundVertex(out: Float32Array, mesh: ListingTerrainMesh, i: number, v: Vertical): number {
  const z = mesh.positions[3 * i + 2];
  writeVertex(out, 3 * i, mesh.positions[3 * i], mesh.positions[3 * i + 1], heightY(z, v));
  return z;
}

function surfaceBuffers(mesh: ListingTerrainMesh, v: Vertical): Terrain3dGeometry['surface'] {
  const count = mesh.positions.length / 3;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const z = writeGroundVertex(positions, mesh, i, v);
    writeTerrainElevationColor(colors, 3 * i, v.spanM > 0 ? (z - v.minM) / v.spanM : 0);
  }
  return { positions, colors, indices: Uint32Array.from(mesh.triangles) };
}

/**
 * Soil block: vertices `0..n-1` = the surface, `n..2n-1` = the same plan points at `baseY`.
 * Wall quad on boundary edge a→b (interior on its left ⇒ outward on its right): [a, a′, b′] + [a, b′, b] — counter-
 * clockwise seen from outside. Bottom: every surface triangle at the base, reversed so it faces down.
 */
function soilBuffers(mesh: ListingTerrainMesh, v: Vertical, baseY: number): Terrain3dBuffers {
  const n = mesh.positions.length / 3;
  const positions = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    writeGroundVertex(positions, mesh, i, v);
    writeVertex(positions, 3 * (n + i), mesh.positions[3 * i], mesh.positions[3 * i + 1], baseY);
  }
  const triangles = meshTriangles(mesh);
  const edges = tinBoundaryEdges(triangles);
  const indices = new Uint32Array(edges.length * 6 + triangles.length * 3);
  let o = 0;
  for (const [a, b] of edges) {
    indices.set([a, n + a, n + b, a, n + b, b], o);
    o += 6;
  }
  for (const [i, j, k] of triangles) {
    indices.set([n + i, n + k, n + j], o);
    o += 3;
  }
  return { positions, indices };
}

/** One contour's segments, appended to `out` (closed lines get their closing segment). */
function pushContourSegments(out: number[], contour: ListingTerrainContour, v: Vertical): void {
  const y = heightY(contour.levelM, v);
  const p = contour.points;
  const pointCount = p.length / 2;
  const segmentCount = contour.closed ? pointCount : pointCount - 1;
  for (let s = 0; s < segmentCount; s++) {
    const a = s;
    const b = (s + 1) % pointCount;
    out.push(p[2 * a], y, -p[2 * a + 1], p[2 * b], y, -p[2 * b + 1]);
  }
}

function contourBuffers(contours: readonly ListingTerrainContour[], v: Vertical): Terrain3dGeometry['contours'] {
  const major: number[] = [];
  const minor: number[] = [];
  for (const contour of contours) pushContourSegments(contour.major ? major : minor, contour, v);
  return { major: Float32Array.from(major), minor: Float32Array.from(minor) };
}

/** Depth of the soil block under the lowest point — independent of the exaggeration. */
function baseDepthM(extent: ReturnType<typeof planExtent>): number {
  const larger = Math.max(extent.maxX - extent.minX, extent.maxY - extent.minY);
  return Math.max(larger * LISTING_TERRAIN_3D_BASE_DEPTH_FRACTION, LISTING_TERRAIN_3D_BASE_DEPTH_MIN_M);
}

/** Build the 3D picture of a snapshot that `readListingTerrainSnapshot` accepted. */
export function buildTerrain3dGeometry(
  snapshot: ListingTerrainSnapshot,
  options: { readonly verticalExaggeration: number },
): Terrain3dGeometryResult {
  const exaggeration = options.verticalExaggeration;
  if (!isTerrain3dExaggeration(exaggeration)) return { ok: false, reason: 'unknown-exaggeration' };
  const { minElevationM, maxElevationM } = snapshot.stats;
  const v: Vertical = { minM: minElevationM, spanM: maxElevationM - minElevationM, exaggeration };
  const extent = planExtent(snapshot.mesh.positions);
  const baseY = -baseDepthM(extent);
  return {
    ok: true,
    geometry: {
      exaggeration,
      surface: surfaceBuffers(snapshot.mesh, v),
      soil: soilBuffers(snapshot.mesh, v, baseY),
      contours: contourBuffers(snapshot.contours, v),
      bounds: {
        minX: extent.minX, maxX: extent.maxX,
        minZ: -extent.maxY, maxZ: -extent.minY,
        baseY, topY: heightY(maxElevationM, v),
      },
    },
  };
}
