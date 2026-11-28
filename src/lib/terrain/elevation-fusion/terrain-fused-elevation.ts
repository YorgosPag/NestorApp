/**
 * ADR-920 §14.12 Β3 — **THE height of the fused ground at one point of the earth, and where that height comes from.**
 *
 *   measured ground   ─▶ the survey, untouched                               `measured`
 *   sparse triangle   ─▶ the survey's surface, across ground nobody measured `interpolated` · `sparse-survey`
 *   transition zone   ─▶ coarse + pull · (rim − coarse)                      `interpolated` · `transition`
 *   beyond            ─▶ the coarse model                                    `indicative`
 *   no coarse tile    ─▶ 0 m as a stand-in (a pixel is never empty)          `none`
 *
 * 🔑 **One function, two readers.** The tile composer fills every pixel through {@link fuseElevationInto}, and the
 * elevation shown under the cursor (Β6) asks {@link fusedElevationAt} — the same arithmetic, so the number on screen is
 * the ground that is drawn, with its provenance attached. It is NOT `map.queryTerrainElevation`: that one is multiplied
 * by the exaggeration and depends on which zoom of the DEM happens to be loaded (ADR-920 §14.12, research 2026-11-25).
 *
 * 🔑 **A pure function of the point.** Nothing here knows the tile, the zoom or the pixel that asked.
 *
 * 🔑 **Two roads into the survey's frame, one arithmetic after it** (Β3.1). `exact` projects the point through the
 * Greek grid and the datum shift — the DEFINITION, and what the number under the cursor asks. `lattice` reads the same
 * projection from the survey's own lattice, whose distance from the exact one is measured and bounded
 * (`TerrainFusionSurface.frameLattice`): the tile composer takes it, because a tile asks a quarter of a million times
 * and the exact projection alone was measured at ~1 µs. The lattice belongs to the survey, never to a tile, so the
 * height stays a function of the point on both roads; they differ by at most the slope times a hundredth of a millimetre.
 *
 * 🔑 **The measurement never moves** (decision Β-3): inside the mesh the coarse model is not even read.
 *
 * ⚠️ `none` is a stand-in, not a height: outside the elevation archive the pixel gets 0 m because the map may never
 * receive an empty tile (it would drop to a z ≤ 5 ancestor), and the reader must say «no data», not «0 m».
 *
 * Pure: no I/O, no MapLibre; runs on the main thread and in a worker alike.
 *
 * @module lib/terrain/elevation-fusion/terrain-fused-elevation
 */

import type { PlanarPointSink } from '@/lib/geometry/planar-map-lattice';
import { lngLatToWorldPixel, MAPLIBRE_TILE_SIZE_PX } from '@/lib/maps/metric-size';
import type { GeoPoint } from '@/types/geo/coordinates';

import { coarseElevationAt, type CoarseElevationField } from './coarse-elevation-field';
import { createGroundVerdictSink, groundVerdictInto, type TerrainFusionSurface } from './terrain-fusion-surface';

/** Where a height comes from — most trustworthy first. The legend of the map (decision Β-5) lists exactly these. */
export const TERRAIN_ELEVATION_PROVENANCES = ['measured', 'interpolated', 'indicative', 'none'] as const;
export type TerrainElevationProvenance = (typeof TERRAIN_ELEVATION_PROVENANCES)[number];

/** Why a height is interpolation: between distant survey points, or in the band that joins survey and coarse model. */
export type TerrainInterpolationCause = 'sparse-survey' | 'transition';

export interface FusedElevation {
  /** Metres above sea level, as written into the pixel. With `provenance: 'none'` it is the 0 m stand-in. */
  readonly elevationM: number;
  readonly provenance: TerrainElevationProvenance;
  /** Set exactly when `provenance` is `'interpolated'`. */
  readonly cause: TerrainInterpolationCause | null;
}

/** A reusable result: the tile composer fills a quarter of a million pixels into ONE of these. */
export type FusedElevationSink = { -readonly [K in keyof FusedElevation]: FusedElevation[K] };

export function createFusedElevationSink(): FusedElevationSink {
  return { elevationM: 0, provenance: 'none', cause: null };
}

/** A point of the earth as the mosaic addresses it: Mercator (u, v) in [0, 1] (v from the north) and its WGS84 twin. */
export interface FusionPoint {
  readonly u: number;
  readonly v: number;
  readonly lng: number;
  readonly lat: number;
}

/**
 * How the point reaches the survey's frame: `exact` = the projection itself (the definition); `lattice` = the survey's
 * measured lattice of it, falling back to the projection when the survey has none.
 */
export type FusionProjectionRoad = 'exact' | 'lattice';

/** One frame point and one verdict for every question: they are synchronous and never nest. */
const FRAME: PlanarPointSink = { x: 0, y: 0 };
const VERDICT = createGroundVerdictSink();

/**
 * What the survey says about the point, left in {@link VERDICT} — `outside` without a survey, and for every point its
 * reach cannot contain.
 */
function judge(surface: TerrainFusionSurface | null, lng: number, lat: number, road: FusionProjectionRoad): void {
  VERDICT.kind = 'outside';
  if (surface === null) return;
  const { west, east, south, north } = surface.geoReach;
  if (lng < west || lng > east || lat < south || lat > north) return;
  if (road === 'lattice' && surface.frameLattice !== null) {
    surface.frameLattice.mapInto(FRAME, lng, lat);
    groundVerdictInto(VERDICT, surface, FRAME.x, FRAME.y);
    return;
  }
  const frame = surface.placement.toFrame({ lat, lng });
  groundVerdictInto(VERDICT, surface, frame.x, frame.y);
}

function set(
  sink: FusedElevationSink,
  elevationM: number,
  provenance: TerrainElevationProvenance,
  cause: TerrainInterpolationCause | null,
): void {
  sink.elevationM = elevationM;
  sink.provenance = provenance;
  sink.cause = cause;
}

/**
 * The fused height at `point`, written into `sink`. `surface: null` ⇒ no survey here; `coarse: null` ⇒ no coarse model.
 * The coarse field is expected to be the one around the point (`coarsePrimaryFor`). `road` defaults to the exact
 * projection; only a caller that fills a whole tile asks for the lattice.
 */
export function fuseElevationInto(
  sink: FusedElevationSink,
  surface: TerrainFusionSurface | null,
  coarse: CoarseElevationField | null,
  point: FusionPoint,
  road: FusionProjectionRoad = 'exact',
): void {
  judge(surface, point.lng, point.lat, road);
  const { kind } = VERDICT;
  if (kind === 'measured') return set(sink, VERDICT.elevationM, 'measured', null);
  if (kind === 'sparse') return set(sink, VERDICT.elevationM, 'interpolated', 'sparse-survey');
  const coarseM = coarse === null ? null : coarseElevationAt(coarse, point.u, point.v);
  const baseM = coarseM ?? 0;
  if (kind === 'transition') {
    // In the band `VERDICT.elevationM` is the height of the RIM at its nearest point.
    return set(sink, baseM + VERDICT.weight * (VERDICT.elevationM - baseM), 'interpolated', 'transition');
  }
  return set(sink, baseM, coarseM === null ? 'none' : 'indicative', null);
}

/** A WGS84 point as the mosaic addresses it — through the map's own Web Mercator (`metric-size.ts`). */
export function fusionPointOf(point: GeoPoint): FusionPoint {
  const [x, y] = lngLatToWorldPixel(point.lng, point.lat, 0);
  return { u: x / MAPLIBRE_TILE_SIZE_PX, v: y / MAPLIBRE_TILE_SIZE_PX, lng: point.lng, lat: point.lat };
}

/** The fused height at a point of the earth, with its provenance — what the elevation under the cursor shows (Β6). */
export function fusedElevationAt(
  surface: TerrainFusionSurface | null,
  coarse: CoarseElevationField | null,
  point: GeoPoint,
): FusedElevation {
  const sink = createFusedElevationSink();
  fuseElevationInto(sink, surface, coarse, fusionPointOf(point));
  return sink;
}
