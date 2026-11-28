/**
 * ADR-920 §14.12 Β2 — **the published relief as map features**: contours, elevation bands, slope classes, survey
 * extent, plot boundary and plot outline as GeoJSON, where the survey puts them.
 *
 *   snapshot ─┬─ contours (as published)                         ─▶ one LineString per contour
 *             ├─ elevationBandShapesOf (the sheet's own bands)    ─▶ one MultiPolygon per band
 *             ├─ slopeClassShapesOf    (the sheet's own classes)  ─▶ one MultiPolygon per class with ground
 *             ├─ the whole mesh                                   ─▶ the survey extent
 *             ├─ boundary · plotOutline                           ─▶ one Polygon each
 *             └─ transitionZoneOf (the elevation mosaic's band)   ─▶ the transition zone, when a width is given
 *                         every point ─ terrainMapPlacementOf ─▶ WGS84
 *
 * 🔑 **It READS the shapes — it never re-derives them.** Bands, classes and contours are the ones the 2D sheet draws
 * (`publication/terrain-map-*`); this module only gives their rings a hierarchy (`nestRings`: the map has no
 * `fill-rule="evenodd"`) and a place on the earth. One relief, three surfaces (sheet · 3D · map), one derivation.
 *
 * 🔑 **Properties are the legend's numbers**, not styles: the level of a contour, the range and colour of a band, the
 * range of a slope class. How they are drawn (widths, zoom ranges, labels) is the style's business (Β5).
 *
 * 🔑 **The transition zone is READ too.** The band of interpolated ground around the survey (decision Β-4) is defined by
 * the elevation mosaic (`elevation-fusion/`, Β3) — its width and its edge. This module asks it for the shape and only
 * places it; drawing it from a second definition would let the picture and the heights disagree.
 *
 * Pure: no I/O, no MapLibre.
 *
 * @module lib/terrain/map-placement/terrain-map-features
 */

import { lineToGeoJson, polygonsToGeoJson, type GeoPolygonRings } from '@/lib/geo/geo-geojson';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { nestRings } from '@/lib/geometry/ring-nesting';
import { terrainFusionSurfaceOf } from '@/lib/terrain/elevation-fusion/terrain-fusion-surface';
import { transitionZoneOf, type TerrainTransitionZone } from '@/lib/terrain/elevation-fusion/terrain-fusion-transition';
import { framePointsOf } from '@/lib/terrain/publication/listing-terrain-frame';
import type {
  ListingTerrainContour,
  ListingTerrainPlotOutline,
  ListingTerrainSnapshot,
} from '@/lib/terrain/publication/listing-terrain-types';
import { elevationBandShapesOf, type TerrainElevationBandShape } from '@/lib/terrain/publication/terrain-map-elevation-bands';
import { terrainMapSheetBandLevelsOf } from '@/lib/terrain/publication/terrain-map-model';
import {
  meshTriangles,
  regionRings,
  slopeClassShapesOf,
  type TerrainSlopeClassShape,
} from '@/lib/terrain/publication/terrain-map-regions';
import type { TriangleIndices } from '@/lib/terrain/tin-boundary-loops';

import { terrainMapPlacementOf, type TerrainMapPlacement } from './terrain-map-placement';

export type TerrainMapContourProperties = Pick<ListingTerrainContour, 'levelM' | 'major'>;
export type TerrainMapElevationBandProperties = Omit<TerrainElevationBandShape, 'triangles'>;
export type TerrainMapSlopeClassProperties = Omit<TerrainSlopeClassShape, 'triangles'>;
export type TerrainMapPlotOutlineProperties = Pick<ListingTerrainPlotOutline, 'areaM2' | 'coverage' | 'coveredFraction'>;
/** The legend's number of the transition zone: how far from the survey the ground is still interpolation. */
export type TerrainMapTransitionProperties = Pick<TerrainTransitionZone, 'widthM'>;
/** A feature that carries no numbers of its own (extent, boundary). */
export type TerrainMapPlainProperties = Record<string, never>;

type Region<P> = GeoJSON.Feature<GeoJSON.MultiPolygon, P>;

const PLAIN: TerrainMapPlainProperties = {};

export interface TerrainMapFeatures {
  /** The placement every feature went through — the same one the elevation mosaic reads the surface with. */
  readonly placement: TerrainMapPlacement;
  readonly contours: GeoJSON.FeatureCollection<GeoJSON.LineString, TerrainMapContourProperties>;
  /** Lowest first; the bands of the 2D sheet and its legend. */
  readonly elevationBands: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, TerrainMapElevationBandProperties>;
  /** Flattest first; classes without ground are not listed (the legend still shows the full scale). */
  readonly slopeClasses: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, TerrainMapSlopeClassProperties>;
  /** Outline of the published surface — «survey extent», NOT «plot boundary». */
  readonly extent: Region<TerrainMapPlainProperties>;
  /** The plot boundary, when the surface was clipped to one. */
  readonly boundary: Region<TerrainMapPlainProperties> | null;
  /** The plot outline from the surveyor's drawing (it cuts nothing), when the snapshot carries one. */
  readonly plotOutline: Region<TerrainMapPlotOutlineProperties> | null;
  /**
   * The band of interpolated ground around the survey — the survey itself is its hole. `null` when no width was asked
   * for, or when the mosaic has no outline to give (`transitionZoneOf`).
   */
  readonly transition: Region<TerrainMapTransitionProperties> | null;
}

export interface TerrainMapFeatureOptions {
  /**
   * Width of the transition zone, metres (`terrainFusionTransitionM` of the coarse elevation source). The SAME number
   * the elevation mosaic is built with — absent ⇒ no zone is drawn.
   */
  readonly transitionM?: number;
}

/** Rings without hierarchy, in the frame → polygons with their holes, on the earth. */
function placedPolygons(placement: TerrainMapPlacement, rings: readonly (readonly PlanarPoint[])[]): GeoPolygonRings[] {
  const placed = (ring: readonly PlanarPoint[]) => ring.map((p) => placement.toGeo(p.x, p.y));
  return nestRings(rings).map(({ outer, holes }) => ({ outer: placed(outer), holes: holes.map(placed) }));
}

function collectionOf<G extends GeoJSON.Geometry, P>(features: GeoJSON.Feature<G, P>[]): GeoJSON.FeatureCollection<G, P> {
  return { type: 'FeatureCollection', features };
}

function contourFeatures(snapshot: ListingTerrainSnapshot, placement: TerrainMapPlacement) {
  return snapshot.contours.map(({ levelM, major, closed, points }) =>
    lineToGeoJson(framePointsOf(points).map((p) => placement.toGeo(p.x, p.y)), closed, { levelM, major }),
  );
}

function elevationBandFeatures(
  snapshot: ListingTerrainSnapshot,
  triangles: readonly TriangleIndices[],
  placement: TerrainMapPlacement,
): Region<TerrainMapElevationBandProperties>[] {
  const { minElevationM, maxElevationM } = snapshot.stats;
  const levels = terrainMapSheetBandLevelsOf(snapshot);
  const { positions, bands } = elevationBandShapesOf(snapshot.mesh, triangles, levels, minElevationM, maxElevationM);
  return bands.map(({ triangles: members, ...properties }) =>
    polygonsToGeoJson(placedPolygons(placement, regionRings({ positions }, members)), properties),
  );
}

function slopeClassFeatures(
  snapshot: ListingTerrainSnapshot,
  triangles: readonly TriangleIndices[],
  placement: TerrainMapPlacement,
): Region<TerrainMapSlopeClassProperties>[] {
  return slopeClassShapesOf(snapshot.mesh, triangles, snapshot.slopeBandsPct)
    .filter((shape) => shape.triangles.length > 0)
    .map(({ triangles: members, ...properties }) =>
      polygonsToGeoJson(placedPolygons(placement, regionRings(snapshot.mesh, members)), properties),
    );
}

/** One published ring (boundary, plot outline) as a region of the map; `null` stays `null`. */
function ringFeature<P extends GeoJSON.GeoJsonProperties>(
  placement: TerrainMapPlacement,
  flat: readonly number[] | null,
  properties: P,
): Region<P> | null {
  return flat === null ? null : polygonsToGeoJson(placedPolygons(placement, [framePointsOf(flat)]), properties);
}

/** The transition zone of the mosaic built with this width, placed; `null` when there is none to draw. */
function transitionFeature(
  snapshot: ListingTerrainSnapshot,
  placement: TerrainMapPlacement,
  transitionM: number | undefined,
): Region<TerrainMapTransitionProperties> | null {
  if (transitionM === undefined) return null;
  const surface = terrainFusionSurfaceOf(snapshot, transitionM);
  const zone = surface === null ? null : transitionZoneOf(surface);
  return zone === null ? null : polygonsToGeoJson(placedPolygons(placement, zone.rings), { widthM: zone.widthM });
}

/**
 * The map features of a published terrain snapshot, or `null` when the snapshot carries no georeference (decision Β-6:
 * no position ⇒ nothing is placed; WHY there is none is the snapshot's `georeferenceOmission`, for the owner).
 */
export function terrainMapFeaturesOf(
  snapshot: ListingTerrainSnapshot,
  options: TerrainMapFeatureOptions = {},
): TerrainMapFeatures | null {
  if (snapshot.georeference === null) return null;
  const placement = terrainMapPlacementOf(snapshot.georeference);
  const triangles = meshTriangles(snapshot.mesh);
  const outline = snapshot.plotOutline;
  return {
    placement,
    contours: collectionOf(contourFeatures(snapshot, placement)),
    elevationBands: collectionOf(elevationBandFeatures(snapshot, triangles, placement)),
    slopeClasses: collectionOf(slopeClassFeatures(snapshot, triangles, placement)),
    extent: polygonsToGeoJson(placedPolygons(placement, regionRings(snapshot.mesh, triangles)), PLAIN),
    boundary: ringFeature(placement, snapshot.boundary, PLAIN),
    plotOutline: outline === null ? null : ringFeature(placement, outline.ring, {
      areaM2: outline.areaM2,
      coverage: outline.coverage,
      coveredFraction: outline.coveredFraction,
    }),
    transition: transitionFeature(snapshot, placement, options.transitionM),
  };
}
