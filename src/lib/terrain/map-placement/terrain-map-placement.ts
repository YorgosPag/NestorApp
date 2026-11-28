/**
 * ADR-920 §14.12 Β2 — **the snapshot frame on the earth**: frame metres ⇄ WGS84, exactly.
 *
 *   georeference.centre (WGS84) ─geoPointToGreekGrid─▶ the frame origin on the Greek grid (E₀, N₀)
 *   frame (x, y) ─▶ (E₀ + x, N₀ + y) ─greekGridToGeoPoint─▶ WGS84          (and the same road backwards)
 *
 * 🔑 **Through the projection, not through a tangent plane.** The frame is metres of the Greek GRID (`listing-terrain-
 * frame.ts`: world mm minus the centre), so the exact way back to the earth is the grid's own projection and datum shift
 * — what a GIS does with a declared CRS (PROJ · ArcGIS · IFC4 `IfcMapConversion` + `IfcProjectedCRS`). A local tangent
 * plane on a sphere (`geo-local-frame.ts`) is the right tool for a shape drawn with a finger; here it would move a corner
 * 100 m from the centre by about two decimetres (the earth's radii of curvature at 38° differ from the mean sphere by
 * 0,18 % and 0,24 %, and a grid metre is not a ground metre) — a survey shown beside the neighbour's wall.
 *
 * 🔑 **The only error is the one phase Α declared**: the centre is published rounded to 1e-7° (about a centimetre), so
 * the whole relief may sit up to a centimetre off — rigidly. Nothing inside it moves relative to anything else.
 *
 * ⚠️ **A georeference means EPSG:2100.** `georeferenceOf` produces one only for a survey declared on the Greek grid
 * (`TerrainCoordinateSystem`), and the snapshot does not name the system. A second projected system must be written INTO
 * the georeference first; this module then picks the projection from it. It never guesses.
 *
 * `gridConvergenceDeg` is not used to place anything (the projection already turns the grid). It stays what phase Α
 * published: the bearing of the frame's +y, for a camera or a north arrow — and the anchor of the tests of this module.
 *
 * Pure: no I/O, no MapLibre; runs on the main thread and in a worker alike.
 *
 * @module lib/terrain/map-placement/terrain-map-placement
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { geoPointToGreekGrid, greekGridToGeoPoint } from '@/lib/geo/greek-grid';
import type { ListingTerrainGeoreference } from '@/lib/terrain/publication/listing-terrain-types';
import type { GeoPoint } from '@/types/geo/coordinates';

export interface TerrainMapPlacement {
  /** Snapshot frame (x east, y north — metres from the surface centre) → WGS84. */
  readonly toGeo: (xM: number, yM: number) => GeoPoint;
  /** WGS84 → snapshot frame, metres. The inverse of {@link toGeo}. */
  readonly toFrame: (point: GeoPoint) => PlanarPoint;
  /** The frame origin on the map, as published. */
  readonly centre: GeoPoint;
  /** Bearing of the frame's +y from true north, degrees (positive = east of north), as published. */
  readonly gridConvergenceDeg: number;
}

/** Where the snapshot frame of this georeference sits on the earth. */
export function terrainMapPlacementOf(georeference: ListingTerrainGeoreference): TerrainMapPlacement {
  const origin = geoPointToGreekGrid(georeference.centre);
  return {
    toGeo: (xM, yM) => greekGridToGeoPoint(origin.easting + xM, origin.northing + yM),
    toFrame: (point) => {
      const grid = geoPointToGreekGrid(point);
      return { x: grid.easting - origin.easting, y: grid.northing - origin.northing };
    },
    centre: georeference.centre,
    gridConvergenceDeg: georeference.gridConvergenceDeg,
  };
}
