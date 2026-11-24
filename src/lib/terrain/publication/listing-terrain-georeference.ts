/**
 * ADR-920 §14.12 phase Α — **where the published relief sits on the earth**, and whether the owner's declaration can be true.
 *
 *   declared EPSG:2100 ─▶ every corner of the surface inside the registry's area of use? ─▶ centre (E, N) in metres
 *        ─greekGridToGeoPoint─▶ WGS84 (projection AND datum shift, ~325 m apart without it)
 *        ─meridianConvergenceDeg─▶ the angle between grid north (the frame's +y) and true north
 *
 * Three rules:
 *   1. **Never inferred.** The system is what the OWNER declared (Civil 3D `GEOCSASSIGN`, QGIS «prompt for CRS»). What the
 *      numbers suggest is offered as a suggestion WITH its evidence ({@link suggestCoordinateSystem}) — the same shape as
 *      the survey unit (`survey-units.ts`).
 *   2. **A declaration is CHECKED, twice.** By the numbers themselves (area of use — here, on every build) and against
 *      something independent: the listing's public position ({@link crossCheckWithListing} — at the door). No CAD or GIS
 *      does the second automatically; they leave it to the eye over a basemap.
 *   3. **One road out.** The frame's centre is never serialised (`listing-terrain-frame.ts`, Δ3); the position leaves
 *      ONLY through the value this module returns, and only when the builder was asked for it.
 *
 * Pure: no I/O, imported by the browser and the server alike.
 *
 * @module lib/terrain/publication/listing-terrain-georeference
 */

import { meridianConvergenceDeg } from '@/lib/geo/egsa87-projection';
import { distanceMeters, METRES_PER_KM } from '@/lib/geo/geo-distance';
import { GREEK_GRID_CRS, greekGridToGeoPoint, isWithinGreekGridAreaOfUse } from '@/lib/geo/greek-grid';
import { listingSearchArea } from '@/lib/listings/listing-map-shape';
import type { TinSurface } from '@/lib/terrain/terrain-types';
import type { ListingPosition } from '@/types/public-listing';

import {
  LISTING_TERRAIN_GEOREFERENCE_CONVERGENCE_DECIMALS,
  LISTING_TERRAIN_GEOREFERENCE_DEGREE_DECIMALS,
  LISTING_TERRAIN_GEOREFERENCE_MIN_TOLERANCE_M,
} from './listing-terrain-config';
import type { SnapshotFrame } from './listing-terrain-frame';
import type { TerrainSourcePoint } from './listing-terrain-source';
import type {
  ListingTerrainGeoreference,
  ListingTerrainGeoreferenceOmission,
  ListingTerrainInput,
  ListingTerrainSnapshot,
  TerrainCoordinateSystem,
} from './listing-terrain-types';

const MM_PER_M = 1000;

export type GeoreferenceOutcome =
  | { readonly georeference: ListingTerrainGeoreference; readonly omission: null }
  | { readonly georeference: null; readonly omission: ListingTerrainGeoreferenceOmission | null };

const NOT_REQUESTED: GeoreferenceOutcome = { georeference: null, omission: null };

/** Round to `decimals`, `-0` folded — byte-stable JSON. */
function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  const r = Math.round(value * f) / f;
  return r === 0 ? 0 : r;
}

/** The four corners of the surface in WORLD metres — a box inside the area of use ⇔ every point of it is. */
function cornersM(tin: TinSurface): ReadonlyArray<readonly [number, number]> {
  const minE = (tin.origin.x + tin.bounds.minX) / MM_PER_M;
  const maxE = (tin.origin.x + tin.bounds.maxX) / MM_PER_M;
  const minN = (tin.origin.y + tin.bounds.minY) / MM_PER_M;
  const maxN = (tin.origin.y + tin.bounds.maxY) / MM_PER_M;
  return [[minE, minN], [maxE, minN], [maxE, maxN], [minE, maxN]];
}

/**
 * The georeference of the snapshot built on `tin` in `frame`, for the given request. No request ⇒ nothing and no omission
 * (this audience is not told). A request that cannot be honoured names why — never a position nobody vouched for.
 */
export function georeferenceOf(
  tin: TinSurface,
  frame: SnapshotFrame,
  request: ListingTerrainInput['georeference'],
): GeoreferenceOutcome {
  if (request === undefined || request === null) return NOT_REQUESTED;
  if (request.coordinateSystem === null) return { georeference: null, omission: 'crs-undeclared' };
  if (request.coordinateSystem === 'local') return { georeference: null, omission: 'crs-local' };
  if (!cornersM(tin).every(([e, n]) => isWithinGreekGridAreaOfUse(e, n))) {
    return { georeference: null, omission: 'outside-area-of-use' };
  }

  const easting = frame.centreWorldMm.x / MM_PER_M;
  const northing = frame.centreWorldMm.y / MM_PER_M;
  const centre = greekGridToGeoPoint(easting, northing);
  return {
    georeference: {
      centre: {
        lat: roundTo(centre.lat, LISTING_TERRAIN_GEOREFERENCE_DEGREE_DECIMALS),
        lng: roundTo(centre.lng, LISTING_TERRAIN_GEOREFERENCE_DEGREE_DECIMALS),
      },
      gridConvergenceDeg: roundTo(meridianConvergenceDeg(easting, northing), LISTING_TERRAIN_GEOREFERENCE_CONVERGENCE_DECIMALS),
    },
    omission: null,
  };
}

/** What the numbers of a source suggest about its system — offered to the owner, never applied. */
export interface CoordinateSystemSuggestion {
  readonly system: TerrainCoordinateSystem;
  /** Share of the survey points inside the EPSG:2100 area of use, in `[0, 1]` — the evidence shown with the suggestion. */
  readonly insideShare: number;
}

/**
 * The suggestion a source's own points support, or `null` when they are split (some inside the area of use, some not —
 * the human decides, with no hint). All inside ⇒ the Greek grid; none inside ⇒ local. Absolute position is the strongest
 * evidence a coordinate carries: a plot in Greece cannot be anywhere else.
 */
export function suggestCoordinateSystem(points: readonly TerrainSourcePoint[]): CoordinateSystemSuggestion | null {
  if (points.length === 0) return null;
  const inside = points.filter(([x, y]) => isWithinGreekGridAreaOfUse(x / MM_PER_M, y / MM_PER_M)).length;
  if (inside === points.length) return { system: GREEK_GRID_CRS.name, insideShare: 1 };
  if (inside === 0) return { system: 'local', insideShare: 0 };
  return null;
}

/** Half the diagonal of the published surface, metres — how far its own corner is from its centre. */
export function halfDiagonalM(snapshot: Pick<ListingTerrainSnapshot, 'mesh'>): number {
  const { positions } = snapshot.mesh;
  let reach2 = 0;
  for (let i = 0; i < positions.length; i += 3) {
    reach2 = Math.max(reach2, positions[i] ** 2 + positions[i + 1] ** 2);
  }
  return Math.sqrt(reach2);
}

export type ListingCrossCheck =
  | { readonly ok: true; readonly distanceM: number; readonly toleranceM: number }
  /** The listing says nothing about where it is (declined, or never asked): there is nothing independent to check against. */
  | { readonly ok: false; readonly reason: 'listing-position-unknown' }
  /** The survey's centre is farther from the listing's position than that position's own uncertainty allows. */
  | { readonly ok: false; readonly reason: 'far-from-listing'; readonly distanceM: number; readonly toleranceM: number };

/**
 * **Does the declared position agree with where the listing says it is?** (ADR-920 §14.12 phase Α, decision Giorgio 2026-11-24.)
 *
 *   tolerance = max(uncertainty of the listing's position, 250 m) + the surface's own reach
 *
 * The uncertainty is the ONE table the map already draws from (`LISTING_UNCERTAINTY_KM`, through `listingSearchArea`): an
 * address-level point allows 250 m, a town-centre guess 10 km. It catches the wrong system (local · HATT · UTM read as
 * the Greek grid land kilometres away) and the survey of another plot; it cannot catch an error smaller than the tolerance.
 * Whole metres out: the numbers are shown to a human.
 */
export function crossCheckWithListing(
  georeference: ListingTerrainGeoreference,
  reachM: number,
  position: ListingPosition,
): ListingCrossCheck {
  const area = listingSearchArea(position);
  if (area === null) return { ok: false, reason: 'listing-position-unknown' };

  const toleranceM = Math.ceil(Math.max(area.radiusKm * METRES_PER_KM, LISTING_TERRAIN_GEOREFERENCE_MIN_TOLERANCE_M) + reachM);
  const distanceM = Math.round(distanceMeters(georeference.centre, area.center));
  return distanceM <= toleranceM
    ? { ok: true, distanceM, toleranceM }
    : { ok: false, reason: 'far-from-listing', distanceM, toleranceM };
}
