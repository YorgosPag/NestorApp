/**
 * @module drawing-preview-arc
 * @description Arc-tool live preview builder (arc-3p / arc-cse / arc-sce), extracted from
 * `drawing-preview-generator.ts` for file-size SRP (N.7.1). Pure — no React/store deps beyond the
 * geometry SSoT + default layer id.
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  DrawingTool,
  ExtendedSceneEntity,
  ExtendedArcEntity,
  ExtendedPolylineEntity,
} from './drawing-types';
import {
  arcFrom3Points,
  arcFromCenterStartEnd,
  arcFromStartCenterEnd,
  calculateDistance,
  calculateAngle,
  pointOnCircle,
} from '../../rendering/entities/shared';
import { GEOMETRY_PRECISION } from '../../config/tolerance-config';
import { getDefaultLayerId } from '../../stores/LayerStore';

/**
 * Build the live preview entity for the 3 arc tools. Returns the rubber-band polyline (1 point),
 * the WYSIWYG arc ghost (≥2 points, with construction vertices + edge distances), the polyline
 * fallback (collinear → arc calc failed), or `null` (no points yet → caller falls through to its
 * generic `createEntity`). `makeRubberBand` is injected so the fallback reuses the caller's SSoT
 * rubber-band builder instead of a twin.
 */
export function generateArcPreview(
  tool: DrawingTool,
  tempPoints: readonly Point2D[],
  worldPoints: Point2D[],
  arcFlipped: boolean,
  makeRubberBand: (id: string, vertices: Point2D[]) => ExtendedPolylineEntity,
): ExtendedSceneEntity | null {
  if (tempPoints.length === 1) {
    return makeRubberBand('preview_arc_rubberband', worldPoints);
  }
  if (tempPoints.length >= 2) {
    // Calculate arc based on tool type
    let arcResult: {
      center: Point2D;
      radius: number;
      startAngle: number;
      endAngle: number;
      counterclockwise?: boolean;
    } | null = null;
    if (tool === 'arc-3p') {
      arcResult = arcFrom3Points(worldPoints[0], worldPoints[1], worldPoints[2]);
    } else if (tool === 'arc-cse') {
      arcResult = arcFromCenterStartEnd(worldPoints[0], worldPoints[1], worldPoints[2]);
    } else if (tool === 'arc-sce') {
      arcResult = arcFromStartCenterEnd(worldPoints[0], worldPoints[1], worldPoints[2]);
    }
    if (arcResult) {
      // Project the cursor onto the arc circle → the live end vertex (SSoT for both the
      // center-start-end and start-center-end construction chains; degenerate cursor keeps
      // the start). One helper instead of a copy-paste twin per tool (N.18).
      const projectArcEndOnCircle = (center: Point2D, start: Point2D, cursor: Point2D): Point2D =>
        calculateDistance(center, cursor) > GEOMETRY_PRECISION.POINT_MATCH
          ? pointOnCircle(center, arcResult.radius, calculateAngle(center, cursor))
          : start;
      // Calculate construction vertices based on tool type
      let constructionVerts: Point2D[];
      if (tool === 'arc-cse') {
        const center = worldPoints[0];
        const start = worldPoints[1];
        constructionVerts = [center, start, projectArcEndOnCircle(center, start, worldPoints[2])];
      } else if (tool === 'arc-sce') {
        const start = worldPoints[0];
        const center = worldPoints[1];
        constructionVerts = [start, center, projectArcEndOnCircle(center, start, worldPoints[2])];
      } else {
        // arc-3p: all points define the circumference
        constructionVerts = worldPoints;
      }
      const finalCounterclockwise = arcFlipped
        ? !arcResult.counterclockwise
        : arcResult.counterclockwise;
      const arcPreview: ExtendedArcEntity = {
        id: 'preview_arc',
        type: 'arc',
        center: arcResult.center,
        radius: arcResult.radius,
        startAngle: arcResult.startAngle,
        endAngle: arcResult.endAngle,
        visible: true,
        layerId: getDefaultLayerId(),
        preview: true,
        showPreviewGrips: true,
        constructionVertices: constructionVerts,
        showConstructionLines: true,
        showEdgeDistances: true,
        counterclockwise: finalCounterclockwise,
        constructionLineMode: tool === 'arc-3p' ? 'polyline' : 'radial',
      };
      return arcPreview;
    }
    // Arc calculation failed (collinear) — show polyline fallback
    return makeRubberBand('preview_arc_rubberband', worldPoints);
  }
  return null;
}
