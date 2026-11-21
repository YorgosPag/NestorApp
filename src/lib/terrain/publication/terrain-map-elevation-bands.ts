/**
 * ADR-920 Β6.2 — the ELEVATION BANDS of the 2D terrain map (hypsometric tints, the plan twin of the 3D ramp).
 *
 * 🔑 **Exact bands, bounded by the contours that are drawn.** Each band is the ground between two consecutive contour
 * levels of the snapshot (`contours[].levelM`, the levels the map ALREADY draws), so a colour changes exactly on a
 * line. Colouring whole triangles by their mean height would give a staircase that crosses the contours.
 *
 * 🔑 **How**: the elevation is linear over a triangle, so the level lines inside it are parallel and every band piece
 * is convex. Each triangle is clipped (Sutherland–Hodgman) against the two levels of each band it spans. A crossing
 * point is keyed by ORIGINAL edge + level and interpolated between the original vertices, so the two triangles that
 * share an edge share the very same crossing vertices — the refined triangles are conforming, and each band's
 * outline comes from the SAME `tinBoundaryLoops` as the slope regions (`regionPathData`): one path per band, no seam.
 *
 * 🔑 **Colour** = the ONE elevation ramp (`@/lib/terrain/elevation-ramp`) at the band's mid height, normalised over the
 * surface's own range — the 3D view paints the same height with the same colour.
 *
 * @module lib/terrain/publication/terrain-map-elevation-bands
 */

import { terrainElevationHex } from '../elevation-ramp';
import type { TriangleIndices } from '../tin-boundary-loops';
import type { ListingTerrainContour, ListingTerrainMesh } from './listing-terrain-types';
import { regionPathData, triangleArea as areaOf } from './terrain-map-regions';

/** One elevation band on the map — and in its legend. */
export interface TerrainMapElevationBand {
  /** Lower bound, metres (the surface minimum for the first band). */
  readonly fromM: number;
  /** Upper bound, metres (the surface maximum for the last band). */
  readonly toM: number;
  /** `#RRGGBB` (sRGB) — the elevation ramp at the band's mid height. */
  readonly color: string;
  /** Share of the plan area in this band, `0..1`. */
  readonly areaShare: number;
  /** Path data, `fill-rule="evenodd"`. Bands without ground are not listed. */
  readonly pathData: string;
}

/** A vertex of a clipped polygon: its index in the refined positions + the original vertices it lies between. */
interface BandVertex {
  readonly index: number;
  readonly z: number;
  /** `[a]` for an original vertex, `[p, q]` for a crossing on the original edge p–q. */
  readonly support: readonly number[];
}

/** The refined positions: the original vertices first, then one shared vertex per (original edge, level). */
class BandVertexStore {
  readonly positions: number[];
  private readonly crossings = new Map<string, number>();

  constructor(private readonly original: readonly number[]) {
    this.positions = [...original];
  }

  vertex(index: number): BandVertex {
    return { index, z: this.original[3 * index + 2], support: [index] };
  }

  /** The crossing of `u–v` with `level`, shared by every triangle that holds the same original edge. */
  crossing(u: BandVertex, v: BandVertex, level: number): BandVertex {
    const edge = [...new Set([...u.support, ...v.support])].sort((a, b) => a - b);
    const [p, q] = edge.length === 2 ? edge : [u.index, v.index];
    const key = `${p}:${q}:${level}`;
    let index = this.crossings.get(key);
    if (index === undefined) {
      const src = edge.length === 2 ? this.original : this.positions;
      const t = (level - src[3 * p + 2]) / (src[3 * q + 2] - src[3 * p + 2]);
      const at = (k: number) => src[3 * p + k] + (src[3 * q + k] - src[3 * p + k]) * t;
      index = this.positions.length / 3;
      this.positions.push(at(0), at(1), level);
      this.crossings.set(key, index);
    }
    return { index, z: level, support: edge.length === 2 ? edge : [index] };
  }
}

/** Keep the part of `poly` above (`keepAbove`) or below `level`. Vertices ON the level stay on both sides. */
function clipAtLevel(poly: readonly BandVertex[], level: number, keepAbove: boolean, store: BandVertexStore): BandVertex[] {
  const inside = (v: BandVertex) => (keepAbove ? v.z >= level : v.z <= level);
  const out: BandVertex[] = [];
  poly.forEach((cur, i) => {
    const next = poly[(i + 1) % poly.length];
    if (inside(cur)) out.push(cur);
    if ((cur.z - level) * (next.z - level) < 0) out.push(store.crossing(cur, next, level));
  });
  return out;
}

/** Band of an elevation: the number of levels at or below it (a level belongs to the band above it). */
function bandOf(z: number, levels: readonly number[]): number {
  let band = 0;
  while (band < levels.length && levels[band] <= z) band++;
  return band;
}

/** The band pieces of ONE triangle, fan-triangulated (each piece is convex), into `byBand`. */
function splitTriangle(
  tri: TriangleIndices,
  levels: readonly number[],
  store: BandVertexStore,
  byBand: TriangleIndices[][],
): void {
  const corners = tri.map((v) => store.vertex(v));
  const zs = corners.map((c) => c.z);
  const first = bandOf(Math.min(...zs), levels);
  const last = bandOf(Math.max(...zs), levels);
  if (first === last) {
    byBand[first].push(tri);
    return;
  }
  for (let band = first; band <= last; band++) {
    let piece: BandVertex[] = corners;
    if (band > 0) piece = clipAtLevel(piece, levels[band - 1], true, store);
    if (band < levels.length) piece = clipAtLevel(piece, levels[band], false, store);
    for (let k = 1; k + 1 < piece.length; k++) {
      const fan: TriangleIndices = [piece[0].index, piece[k].index, piece[k + 1].index];
      if (areaOf(store.positions, fan) > 0) byBand[band].push(fan);
    }
  }
}

/** The distinct contour levels of the snapshot, ascending — the band edges. */
export function contourLevelsOf(contours: readonly ListingTerrainContour[]): number[] {
  return [...new Set(contours.map((c) => c.levelM))].sort((a, b) => a - b);
}

/**
 * Every elevation band of the surface, lowest first. `minM`/`maxM` = the surface's own range (the snapshot stats):
 * they bound the first and last band and normalise the colour ramp.
 */
export function elevationBandsOf(
  mesh: ListingTerrainMesh,
  triangles: readonly TriangleIndices[],
  levels: readonly number[],
  minM: number,
  maxM: number,
): TerrainMapElevationBand[] {
  const store = new BandVertexStore(mesh.positions);
  const byBand: TriangleIndices[][] = Array.from({ length: levels.length + 1 }, () => []);
  for (const tri of triangles) splitTriangle(tri, levels, store, byBand);
  const refined = { positions: store.positions };
  const areas = byBand.map((members) => members.reduce((sum, tri) => sum + areaOf(store.positions, tri), 0));
  const total = areas.reduce((sum, area) => sum + area, 0);
  const relief = maxM - minM;
  return byBand.flatMap((members, band) => {
    if (members.length === 0 || !(areas[band] > 0)) return [];
    const fromM = band === 0 ? minM : levels[band - 1];
    const toM = band === levels.length ? maxM : levels[band];
    const t = relief > 0 ? ((fromM + toM) / 2 - minM) / relief : 0;
    return [{
      fromM,
      toM,
      color: terrainElevationHex(t),
      areaShare: total > 0 ? areas[band] / total : 0,
      pathData: regionPathData(refined, members),
    }];
  });
}
