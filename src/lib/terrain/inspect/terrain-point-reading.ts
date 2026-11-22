/**
 * ADR-920 §14.10 — **the reading of one point of the ground**: what the buyer learns by pointing at the plot. Pure.
 *
 * Civil 3D «Surface Inquiry» + CalTopo «Point Info», on the published surface, in one object:
 *   - elevation (barycentric on the published triangle — the SAME surface the map is coloured from and the 3D shows),
 *     and how far it is above the lowest / below the highest point of the plot;
 *   - slope (% and degrees) and its class — the PUBLISHED class of that triangle, so the reading and the map colour agree;
 *   - the direction the ground falls (`downslopeAzimuth`, the convention of the plot summary) as one of the 8 directions;
 *   - «measured» vs «interpolated» (the map's hatched area — the same predicate);
 *   - distance to the plot boundary, and whether the point is under the indicative building envelope;
 *   - the nearest contour, so the view can light it along its full length (nobody among the big tools does).
 *
 * 🔑 **Elevations are always REAL**: nothing here knows about the 3D vertical exaggeration (Mapbox `exaggerated: false`).
 *
 * @module lib/terrain/inspect/terrain-point-reading
 */

import type { OrientationType } from '@/constants/property-features-enterprise';
import { orientationOfAzimuth } from '@/lib/geometry/azimuth-orientation';
import { distanceToRing, pointInPolygon } from '@/lib/geometry/planar-polygon';
import { downslopeAzimuth, slopePct } from '@/lib/terrain/publication/terrain-slope';

import type { NearestContour } from './terrain-contour-index';
import { elevationAt, type TerrainInspectIndex } from './terrain-inspect-index';

/** Where the point stands relative to the plot boundary. */
interface BoundaryReading {
  readonly inside: boolean;
  /** Plan distance to the boundary line, metres (the same inside and out). */
  readonly distanceM: number;
}

export interface TerrainPointReading {
  /** Snapshot frame: metres east / north of the surface centre. */
  readonly x: number;
  readonly y: number;
  readonly triangle: number;
  /** Absolute elevation, metres. */
  readonly elevationM: number;
  readonly aboveLowestM: number;
  readonly belowHighestM: number;
  readonly slopePct: number;
  readonly slopeDeg: number;
  /** The published slope class of the triangle (`0` = flattest). */
  readonly slopeClass: number;
  /** Clockwise from north; `null` on flat ground. */
  readonly downslopeAzimuthDeg: number | null;
  readonly downslope: OrientationType | null;
  /** `false` where the surface spans unmeasured ground (interpolation between distant survey points). */
  readonly measured: boolean;
  readonly boundary: BoundaryReading | null;
  readonly underEnvelope: boolean;
  readonly nearestContour: NearestContour | null;
}

const DEG = 180 / Math.PI;

function slopeOf(index: TerrainInspectIndex, triangle: number) {
  const plane = index.planes[triangle];
  if (plane === null) return { pct: 0, deg: 0, azimuth: null };
  const pct = slopePct(plane);
  return { pct, deg: Math.atan(pct / 100) * DEG, azimuth: downslopeAzimuth(plane.a, plane.b) };
}

function boundaryOf(index: TerrainInspectIndex, x: number, y: number): BoundaryReading | null {
  if (index.boundary === null) return null;
  const point = { x, y };
  return { inside: pointInPolygon(point, index.boundary), distanceM: distanceToRing(point, index.boundary) };
}

/** The reading at (x, y), snapshot frame — `null` off the published surface (nothing is invented there). */
export function readTerrainAt(index: TerrainInspectIndex, x: number, y: number): TerrainPointReading | null {
  const at = elevationAt(index, x, y);
  if (at === null) return null;
  const { stats, mesh } = index.snapshot;
  const slope = slopeOf(index, at.triangle);
  return {
    x, y,
    triangle: at.triangle,
    elevationM: at.z,
    aboveLowestM: at.z - stats.minElevationM,
    belowHighestM: stats.maxElevationM - at.z,
    slopePct: slope.pct,
    slopeDeg: slope.deg,
    slopeClass: mesh.slopeClass[at.triangle] ?? 0,
    downslopeAzimuthDeg: slope.azimuth,
    downslope: orientationOfAzimuth(slope.azimuth),
    measured: !index.sparse[at.triangle],
    boundary: boundaryOf(index, x, y),
    underEnvelope: index.footprint !== null && pointInPolygon({ x, y }, index.footprint),
    nearestContour: index.contours.nearest(x, y),
  };
}
