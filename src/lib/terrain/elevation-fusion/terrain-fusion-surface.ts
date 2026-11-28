/**
 * ADR-920 §14.12 Β3 — **the measured ground as the mosaic sees it**: for one point of the snapshot frame, «is this
 * measured, is it the band around the measurement, or is it outside?». Built ONCE per snapshot.
 *
 *   inside the published mesh   ─▶ `measured` / `sparse`   the surface itself, barycentric, untouched (decision Β-3)
 *   within `transitionM` of it  ─▶ `transition`            the height of the nearest point of the RIM + how hard it pulls
 *   farther                     ─▶ `outside`
 *
 * 🔑 **Nothing new is decided about the surface.** The reading is `elevationAt` of the inspector's index (the one the
 * point inspector, the profile and the 3D share), «sparse» is the map's hatched area (`sparseTriangleFlags`), and the
 * rim is the boundary of the triangle set (`tinBoundaryEdges`) — the «survey extent» the map already draws.
 *
 * 🔑 **The rim, not the plot.** The measured area is the MESH: it may be smaller than the plot, larger than it, or have
 * holes. A hole is outside the measurement, so it gets the same band, from all its sides.
 *
 * 🔑 **The height of the rim is read from the rim.** The nearest point lies on a boundary edge, whose two ends carry
 * measured elevations: the height there is their linear blend — exactly the surface (a TIN is linear along an edge),
 * with no second point location that could miss by a rounding.
 *
 * 🔑 **The pull is `3t² − 2t³`, outward only**: `1` on the rim (the band meets the measurement with no step), `0` at the
 * outer edge (it meets the coarse ground with no step and no kink). Mapterhorn blends its own sources with the same
 * curve; WhiteboxTools weights by the squared distance to the data edge.
 *
 * ⚠️ **Known limit of «pull towards the nearest rim point»**: in a concave pocket two rim points are equally near, and
 * where they carry different heights the band has a crease along the pocket's bisector (scaled by the pull). It is
 * interpolation either way and is labelled so; the measurement is never affected.
 *
 * Pure: no I/O, no MapLibre; runs on the main thread and in a worker alike.
 *
 * @module lib/terrain/elevation-fusion/terrain-fusion-surface
 */

import { createPlanarMapLattice, type PlanarMapLattice } from '@/lib/geometry/planar-map-lattice';
import { clamp01 } from '@/lib/geometry/scalar';
import {
  createNearestSegmentSink,
  createSegmentNearestIndex,
  type PlanarSegment,
  type SegmentNearestIndex,
} from '@/lib/geometry/segment-nearest-index';
import { smoothStep } from '@/lib/motion/easing';
import {
  createSurfaceElevationSink,
  elevationInto,
  terrainInspectIndexOf,
  type TerrainInspectIndex,
} from '@/lib/terrain/inspect/terrain-inspect-index';
import { terrainMapPlacementOf, type TerrainMapPlacement } from '@/lib/terrain/map-placement/terrain-map-placement';
import {
  LISTING_TERRAIN_FUSION_PROJECTION_TOLERANCE_M,
  LISTING_TERRAIN_FUSION_TRANSITION_COARSE_CELLS,
} from '@/lib/terrain/publication/listing-terrain-config';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import { tinBoundaryEdges } from '@/lib/terrain/tin-boundary-loops';

/** One edge of the rim of the measured ground, with the measured elevation of its two ends. */
export interface TerrainRimEdge extends PlanarSegment {
  readonly za: number;
  readonly zb: number;
}

/** A box of the snapshot frame, metres. */
export interface FrameBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** A box on the earth, WGS84 degrees. */
export interface GeoBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface TerrainFusionSurface {
  readonly index: TerrainInspectIndex;
  /** Where the frame sits on the earth — the same placement the map features go through. */
  readonly placement: TerrainMapPlacement;
  /** Width of the transition zone, metres outward from the rim. `0` ⇒ no zone (a step at the rim). */
  readonly transitionM: number;
  readonly rim: readonly TerrainRimEdge[];
  readonly nearestRim: SegmentNearestIndex;
  /** The mesh grown by the transition width: outside it only the coarse ground exists. */
  readonly reach: FrameBounds;
  /** A box on the earth that CONTAINS {@link reach} — the cheap «this point cannot touch the survey». */
  readonly geoReach: GeoBounds;
  /**
   * `placement.toFrame` over {@link geoReach}, read from a lattice whose error against the exact projection was
   * MEASURED to be within `LISTING_TERRAIN_FUSION_PROJECTION_TOLERANCE_M` (Β3.1): input (lng, lat), output frame metres.
   * It belongs to the survey, not to a tile — every tile and every zoom reads the same numbers at the same point.
   * `null` when no lattice got there: the mosaic then projects exactly, pixel by pixel. The elevation shown as a number
   * never goes through it.
   */
  readonly frameLattice: PlanarMapLattice | null;
}

/** What the measured ground says about one point of the frame. */
export type TerrainGroundVerdict =
  /** On a triangle between survey points: the surface, as measured. */
  | { readonly kind: 'measured'; readonly elevationM: number; readonly triangle: number }
  /** On a triangle that spans unmeasured ground (the map's hatched area): the surface, but interpolation. */
  | { readonly kind: 'sparse'; readonly elevationM: number; readonly triangle: number }
  /** In the band around the measurement. `weight`: `1` on the rim … `0` at the outer edge of the band. */
  | { readonly kind: 'transition'; readonly edgeElevationM: number; readonly weight: number; readonly distanceM: number }
  | { readonly kind: 'outside' };

const OUTSIDE: TerrainGroundVerdict = { kind: 'outside' };

/** Slack of {@link TerrainFusionSurface.geoReach}, degrees (≈ 0,1 m): it must contain the reach, not equal it. */
const GEO_REACH_PAD_DEG = 1e-6;

/**
 * The width of the transition zone for a coarse model of this ground sample — the ONE place that turns the knob
 * (`LISTING_TERRAIN_FUSION_TRANSITION_COARSE_CELLS`) into metres. Heights and the drawn zone both come through here.
 */
export function terrainFusionTransitionM(coarseGroundSampleM: number): number {
  return LISTING_TERRAIN_FUSION_TRANSITION_COARSE_CELLS * coarseGroundSampleM;
}

function rimOf(index: TerrainInspectIndex): TerrainRimEdge[] {
  const { xy, z } = index;
  return tinBoundaryEdges(index.triangles).map(([a, b]) => ({
    a: { x: xy[a][0], y: xy[a][1] },
    b: { x: xy[b][0], y: xy[b][1] },
    za: z[a],
    zb: z[b],
  }));
}

function reachOf(index: TerrainInspectIndex, marginM: number): FrameBounds {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of index.xy) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX: minX - marginM, minY: minY - marginM, maxX: maxX + marginM, maxY: maxY + marginM };
}

/** The earth box of the four corners of the reach, padded: the frame is turned against the meridians, never bent. */
function geoReachOf(placement: TerrainMapPlacement, reach: FrameBounds): GeoBounds {
  const corners = [
    placement.toGeo(reach.minX, reach.minY),
    placement.toGeo(reach.maxX, reach.minY),
    placement.toGeo(reach.maxX, reach.maxY),
    placement.toGeo(reach.minX, reach.maxY),
  ];
  const lngs = corners.map((corner) => corner.lng);
  const lats = corners.map((corner) => corner.lat);
  return {
    west: Math.min(...lngs) - GEO_REACH_PAD_DEG,
    east: Math.max(...lngs) + GEO_REACH_PAD_DEG,
    south: Math.min(...lats) - GEO_REACH_PAD_DEG,
    north: Math.max(...lats) + GEO_REACH_PAD_DEG,
  };
}

function frameLatticeOf(placement: TerrainMapPlacement, geoReach: GeoBounds): PlanarMapLattice | null {
  return createPlanarMapLattice(
    (lng, lat) => placement.toFrame({ lat, lng }),
    { minU: geoReach.west, minV: geoReach.south, maxU: geoReach.east, maxV: geoReach.north },
    LISTING_TERRAIN_FUSION_PROJECTION_TOLERANCE_M,
  );
}

function buildSurface(snapshot: ListingTerrainSnapshot, transitionM: number): TerrainFusionSurface | null {
  if (snapshot.georeference === null) return null;
  const index = terrainInspectIndexOf(snapshot);
  const placement = terrainMapPlacementOf(snapshot.georeference);
  const rim = rimOf(index);
  const reach = reachOf(index, transitionM);
  const geoReach = geoReachOf(placement, reach);
  return {
    index, placement, transitionM, rim, reach, geoReach,
    nearestRim: createSegmentNearestIndex(rim),
    frameLattice: frameLatticeOf(placement, geoReach),
  };
}

const memo = new WeakMap<ListingTerrainSnapshot, Map<number, TerrainFusionSurface | null>>();

/**
 * The fusion surface of `snapshot` for a transition zone `transitionM` wide — built on first ask, then the same object
 * for as long as the snapshot lives. `null` when the snapshot carries no georeference (decision Β-6: no position ⇒
 * nothing is placed). A negative or non-finite width counts as `0`.
 */
export function terrainFusionSurfaceOf(snapshot: ListingTerrainSnapshot, transitionM: number): TerrainFusionSurface | null {
  const width = Number.isFinite(transitionM) && transitionM > 0 ? transitionM : 0;
  let byWidth = memo.get(snapshot);
  if (byWidth === undefined) {
    byWidth = new Map();
    memo.set(snapshot, byWidth);
  }
  if (!byWidth.has(width)) byWidth.set(width, buildSurface(snapshot, width));
  return byWidth.get(width) ?? null;
}

/** One reading and one rim hit for every verdict: the questions are synchronous and never nest. */
const READING = createSurfaceElevationSink();
const RIM_HIT = createNearestSegmentSink();

/**
 * How far (x, y) is from the measured ground, metres: `0` on it, the distance to its rim outside it, and `null` when
 * that is more than `within`. The ONE distance the band is defined by — its heights ({@link groundVerdictAt}) and its
 * outline (`terrain-fusion-transition.ts`) both ask it.
 */
export function distanceOutsideMeasured(surface: TerrainFusionSurface, x: number, y: number, within: number): number | null {
  if (elevationInto(READING, surface.index, x, y)) return 0;
  return surface.nearestRim.nearestInto(RIM_HIT, x, y, within) ? RIM_HIT.distance : null;
}

/**
 * A reusable verdict, for a caller that asks many times (one tile of the elevation mosaic: once per pixel). The fields
 * a `kind` does not own keep whatever the previous verdict left in them — read only what the kind defines:
 * `measured` / `sparse` ⇒ `elevationM` (the surface) and `triangle`; `transition` ⇒ `elevationM` (the RIM at its
 * nearest point), `weight` and `distanceM`; `outside` ⇒ nothing.
 */
export interface TerrainGroundVerdictSink {
  kind: TerrainGroundVerdict['kind'];
  elevationM: number;
  triangle: number;
  weight: number;
  distanceM: number;
}

export function createGroundVerdictSink(): TerrainGroundVerdictSink {
  return { kind: 'outside', elevationM: 0, triangle: -1, weight: 0, distanceM: 0 };
}

function transitionInto(sink: TerrainGroundVerdictSink, surface: TerrainFusionSurface, x: number, y: number): void {
  const { transitionM } = surface;
  sink.kind = 'outside';
  if (transitionM <= 0) return;
  if (!surface.nearestRim.nearestInto(RIM_HIT, x, y, transitionM) || RIM_HIT.distance >= transitionM) return;
  // The nearest point lies on a rim edge whose ends are measured: its height is their linear blend, at the place the
  // index found it (`t`) — the surface itself, with no second projection that could disagree by a rounding.
  const edge = surface.rim[RIM_HIT.segment];
  sink.kind = 'transition';
  sink.elevationM = edge.za + RIM_HIT.t * (edge.zb - edge.za);
  sink.weight = smoothStep(clamp01(1 - RIM_HIT.distance / transitionM));
  sink.distanceM = RIM_HIT.distance;
}

/** What the measured ground says about (x, y), snapshot frame — written into `sink`. THE verdict. */
export function groundVerdictInto(sink: TerrainGroundVerdictSink, surface: TerrainFusionSurface, x: number, y: number): void {
  const { reach, index } = surface;
  if (x < reach.minX || x > reach.maxX || y < reach.minY || y > reach.maxY) {
    sink.kind = 'outside';
    return;
  }
  if (!elevationInto(READING, index, x, y)) {
    transitionInto(sink, surface, x, y);
    return;
  }
  sink.kind = index.sparse[READING.triangle] ? 'sparse' : 'measured';
  sink.elevationM = READING.z;
  sink.triangle = READING.triangle;
}

const VERDICT = createGroundVerdictSink();

/** What the measured ground says about (x, y), snapshot frame — {@link groundVerdictInto} as a value of its own. */
export function groundVerdictAt(surface: TerrainFusionSurface, x: number, y: number): TerrainGroundVerdict {
  groundVerdictInto(VERDICT, surface, x, y);
  const { kind, elevationM, triangle, weight, distanceM } = VERDICT;
  if (kind === 'outside') return OUTSIDE;
  if (kind === 'transition') return { kind, edgeElevationM: elevationM, weight, distanceM };
  return { kind, elevationM, triangle };
}
