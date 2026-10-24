/**
 * ADR-920 Β4.8 (Α5) — **published terrain snapshot → the 2D map, ready to draw**. Pure: no React, no I/O, no i18n.
 *
 *   snapshot ─┬─ terrain-map-regions  ─▶ survey extent · one region per slope class (+ % of area) · sparse area
 *             ├─ terrain-map-contours ─▶ minor / index contour paths · upright, collision-free index labels
 *             └─ terrain-map-furniture ─▶ view box + margin · north arrow · 1-2-5 scale bar
 *   (+ the owner's preview only) survey marks ─▶ the same SVG space
 *
 * The same model feeds the screen, the screen-reader table and the PDF of the showcase: one SVG, a fixed «paper»
 * surface in both themes (the view's business). Numbers stay numbers here; the view formats them for the locale.
 *
 * 🔑 It READS the snapshot — never re-derives it. The surface, contours and slope classes are the builder's
 * (`listing-terrain-snapshot.ts`, the derivation home of CHECK 3.105); the map only decides how they are drawn.
 *
 * @module lib/terrain/publication/terrain-map-model
 */

import { LISTING_TERRAIN_MAP_LABEL_FRACTION } from './listing-terrain-config';
import { roundPublished } from './listing-terrain-frame';
import type { SurveyPointMark } from '../survey-import/survey-upload-preparation';
import type { ListingTerrainSnapshot } from './listing-terrain-types';
import { contourLabelsOf, contourPathData, type TerrainMapContourLabel } from './terrain-map-contours';
import {
  northArrowOf,
  scaleBarOf,
  viewBoxOf,
  type TerrainMapNorthArrow,
  type TerrainMapScaleBar,
  type TerrainMapViewBox,
} from './terrain-map-furniture';
import {
  meshTriangles,
  regionPathData,
  slopeRegionsOf,
  sparseAreaPathData,
  type TerrainMapSlopeRegion,
} from './terrain-map-regions';
import { flatSvgPoints, meshSvgPoint, polylinePathData, svgPointOf, type SvgPoint } from './terrain-map-svg';

/** A survey mark of the owner's preview (`SurveyPointMark`, the ONE definition), in SVG user space. */
export interface TerrainMapMark extends SvgPoint {
  readonly kind: SurveyPointMark['kind'];
}

export interface TerrainMapModel {
  readonly viewBox: TerrainMapViewBox;
  /** Outline of the published surface — «survey extent», NOT «plot boundary» (that one is `boundaryPathData`). */
  readonly extentPathData: string;
  /** The plot boundary, when the surface was clipped to one; `null` otherwise (Β4: points-only sources). */
  readonly boundaryPathData: string | null;
  /** Every slope class, flattest first — empty classes included, so the legend shows the full scale. */
  readonly slopeRegions: readonly TerrainMapSlopeRegion[];
  /** Triangles spanning unmeasured ground (interpolation, not survey); `null` when there are none. */
  readonly sparsePathData: string | null;
  readonly minorContoursPathData: string;
  readonly majorContoursPathData: string;
  readonly contourLabels: readonly TerrainMapContourLabel[];
  readonly contourIntervalM: number;
  /** Spacing of the labelled index contours (`contourIntervalM × contourMajorEvery`) — the legend names it. */
  readonly majorContourIntervalM: number;
  /** Height of every map text, SVG units. */
  readonly labelHeightM: number;
  readonly northArrow: TerrainMapNorthArrow;
  readonly scaleBar: TerrainMapScaleBar;
  readonly marks: readonly TerrainMapMark[];
}

/** Every point the map must show — the frame of the view box. */
function contentPoints(snapshot: ListingTerrainSnapshot): SvgPoint[] {
  const vertexCount = snapshot.mesh.positions.length / 3;
  const points = Array.from({ length: vertexCount }, (_, i) => meshSvgPoint(snapshot.mesh.positions, i));
  if (snapshot.boundary) points.push(...flatSvgPoints(snapshot.boundary));
  return points;
}

/** The 2D map of a published terrain snapshot. `marks` = the owner's preview only (never on the public listing). */
export function terrainMapModelOf(
  snapshot: ListingTerrainSnapshot,
  marks: readonly SurveyPointMark[] = [],
): TerrainMapModel {
  const triangles = meshTriangles(snapshot.mesh);
  const viewBox = viewBoxOf(contentPoints(snapshot));
  const labelHeightM = roundPublished(Math.max(viewBox.width, viewBox.height) * LISTING_TERRAIN_MAP_LABEL_FRACTION);
  return {
    viewBox,
    extentPathData: regionPathData(snapshot.mesh, triangles),
    boundaryPathData: snapshot.boundary ? polylinePathData(flatSvgPoints(snapshot.boundary), true) : null,
    slopeRegions: slopeRegionsOf(snapshot.mesh, triangles, snapshot.slopeBandsPct),
    sparsePathData: sparseAreaPathData(snapshot.mesh, triangles),
    minorContoursPathData: contourPathData(snapshot.contours, false),
    majorContoursPathData: contourPathData(snapshot.contours, true),
    contourLabels: contourLabelsOf(snapshot.contours, labelHeightM),
    contourIntervalM: snapshot.contourIntervalM,
    majorContourIntervalM: roundPublished(snapshot.contourIntervalM * snapshot.contourMajorEvery),
    labelHeightM,
    northArrow: northArrowOf(viewBox),
    scaleBar: scaleBarOf(viewBox),
    marks: marks.map((mark) => ({ ...svgPointOf(mark.x, mark.y), kind: mark.kind })),
  };
}
