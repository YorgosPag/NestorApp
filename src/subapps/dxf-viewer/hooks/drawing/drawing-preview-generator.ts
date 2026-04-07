/**
 * @module drawing-preview-generator
 * @description Pure functions for generating real-time drawing preview entities.
 * Extracted from useUnifiedDrawing.tsx for separation of concerns and testability.
 *
 * Functions:
 * - generatePreviewEntity(): Creates a preview entity based on tool, existing points, and cursor position
 * - applyPreviewStyling(): Decorates a preview entity with flags, grip points, and measurement info
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PolylineEntity } from '../../types/scene';
import type {
  DrawingTool,
  ExtendedSceneEntity,
  ExtendedPolylineEntity,
  ExtendedCircleEntity,
  ExtendedLineEntity,
  ExtendedArcEntity,
  PreviewPoint,
} from './drawing-types';
import {
  arcFrom3Points,
  arcFromCenterStartEnd,
  arcFromStartCenterEnd,
  circleFrom3Points,
  circleFromChordAndSagitta,
  circleFrom2PointsAndRadius,
  circleBestFit,
  calculateDistance,
  calculateAngle,
  pointOnCircle,
} from '../../rendering/entities/shared';
import { GEOMETRY_PRECISION } from '../../config/tolerance-config';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { UI_COLORS } from '../../config/color-config';

// ─── Callback types for dependency injection ───────────────────────────────

/** Creates an entity from tool + points. Injected to avoid circular dependency. */
export type CreateEntityFn = (tool: DrawingTool, points: Point2D[]) => ExtendedSceneEntity | null;

/** Applies ColorPalettePanel preview settings to an entity. Injected because it depends on hook state. */
export type ApplySettingsFn = (entity: Record<string, unknown>) => void;


// ─── Helper: create a rubber-band polyline preview ─────────────────────────

function makeRubberBandPolyline(id: string, vertices: Point2D[]): ExtendedPolylineEntity {
  const base: PolylineEntity = {
    id,
    type: 'polyline',
    vertices,
    closed: false,
    visible: true,
    layer: '0',
    color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
    lineweight: 1,
    opacity: 1.0,
    lineType: 'solid' as const,
  };
  return {
    ...base,
    preview: true,
    showEdgeDistances: true,
    showPreviewGrips: true,
  } as ExtendedPolylineEntity;
}


/**
 * Generates a preview entity based on the active tool, existing clicked points, and cursor position.
 *
 * This is a pure function — it produces a new entity object without side effects.
 *
 * @param tool - The active drawing tool
 * @param tempPoints - Points already clicked by the user (from state machine)
 * @param cursorPoint - Current cursor position in world space
 * @param arcFlipped - Whether the arc direction is flipped
 * @param createEntity - Callback to create standard entities (injected from hook)
 * @returns A preview entity, or null if no preview should be shown
 */
export function generatePreviewEntity(
  tool: DrawingTool,
  tempPoints: readonly Point2D[],
  cursorPoint: Point2D,
  arcFlipped: boolean,
  createEntity: CreateEntityFn
): ExtendedSceneEntity | null {

  // ── Zero-point preview: show start indicator ─────────────────────────────
  if (tempPoints.length === 0) {
    const isMeasurementTool =
      tool === 'measure-distance' ||
      tool === 'measure-distance-continuous' ||
      tool === 'measure-area' ||
      tool === 'measure-angle' ||
      tool === 'measure-angle-measuregeom';

    // All tools that need a starting dot
    const needsStartDot =
      tool === 'line' || tool === 'measure-distance' || tool === 'measure-distance-continuous' ||
      tool === 'rectangle' || tool === 'circle' || tool === 'circle-diameter' ||
      tool === 'circle-2p-diameter' || tool === 'circle-3p' || tool === 'circle-chord-sagitta' ||
      tool === 'circle-2p-radius' || tool === 'polygon' || tool === 'polyline' ||
      tool === 'measure-area' || tool === 'measure-angle' ||
      tool === 'measure-angle-measuregeom' ||
      tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce';

    if (needsStartDot) {
      return {
        id: 'preview_start',
        type: 'point',
        position: cursorPoint,
        size: 4,
        visible: true,
        layer: '0',
        preview: true,
        showPreviewGrips: true,
        ...(isMeasurementTool && { measurement: true }),
      } as PreviewPoint;
    }

    return null;
  }

  // ── Multi-point preview: show shape being drawn ──────────────────────────
  const worldPoints = [...tempPoints, cursorPoint];

  // ── Circle-3p ────────────────────────────────────────────────────────────
  if (tool === 'circle-3p') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_circle3p_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      const circleResult = circleFrom3Points(worldPoints[0], worldPoints[1], worldPoints[2]);
      if (circleResult) {
        return {
          id: 'preview_circle3p',
          type: 'circle',
          center: circleResult.center,
          radius: circleResult.radius,
          visible: true,
          layer: '0',
          preview: true,
          showPreviewGrips: true,
        } as ExtendedCircleEntity;
      }
      // Collinear fallback
      return makeRubberBandPolyline('preview_circle3p_rubberband', worldPoints);
    }
  }

  // ── Circle-chord-sagitta ─────────────────────────────────────────────────
  if (tool === 'circle-chord-sagitta') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_chord_sagitta_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      const circleResult = circleFromChordAndSagitta(worldPoints[0], worldPoints[1], worldPoints[2]);
      if (circleResult) {
        return {
          id: 'preview_chord_sagitta',
          type: 'circle',
          center: circleResult.center,
          radius: circleResult.radius,
          visible: true,
          layer: '0',
          preview: true,
          showPreviewGrips: true,
        } as ExtendedCircleEntity;
      }
      return makeRubberBandPolyline('preview_chord_sagitta_rubberband', worldPoints);
    }
  }

  // ── Circle-2p-radius ─────────────────────────────────────────────────────
  if (tool === 'circle-2p-radius') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_2p_radius_rubberband', worldPoints);
    }
    if (tempPoints.length >= 2) {
      const circleResult = circleFrom2PointsAndRadius(worldPoints[0], worldPoints[1], worldPoints[2]);
      if (circleResult) {
        return {
          id: 'preview_2p_radius',
          type: 'circle',
          center: circleResult.center,
          radius: circleResult.radius,
          visible: true,
          layer: '0',
          preview: true,
          showPreviewGrips: true,
        } as ExtendedCircleEntity;
      }
      return makeRubberBandPolyline('preview_2p_radius_rubberband', worldPoints);
    }
  }

  // ── Circle-best-fit ──────────────────────────────────────────────────────
  if (tool === 'circle-best-fit') {
    if (tempPoints.length === 1 || tempPoints.length === 2) {
      return makeRubberBandPolyline('preview_bestfit_rubberband', worldPoints);
    }
    // 3+ clicked points + cursor
    const circleResult = circleBestFit(worldPoints);
    if (circleResult) {
      return {
        id: 'preview_bestfit',
        type: 'circle',
        center: circleResult.center,
        radius: circleResult.radius,
        visible: true,
        layer: '0',
        preview: true,
        showPreviewGrips: true,
      } as ExtendedCircleEntity;
    }
    return makeRubberBandPolyline('preview_bestfit_rubberband', worldPoints);
  }

  // ── Arc tools (arc-3p, arc-cse, arc-sce) ─────────────────────────────────
  if (tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce') {
    if (tempPoints.length === 1) {
      return makeRubberBandPolyline('preview_arc_rubberband', worldPoints);
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
        // Calculate construction vertices based on tool type
        let constructionVerts: Point2D[];

        if (tool === 'arc-cse') {
          const center = worldPoints[0];
          const start = worldPoints[1];
          const cursor = worldPoints[2];
          const dist = calculateDistance(center, cursor);
          const projectedEnd = dist > GEOMETRY_PRECISION.POINT_MATCH
            ? pointOnCircle(center, arcResult.radius, calculateAngle(center, cursor))
            : start;
          constructionVerts = [center, start, projectedEnd];
        } else if (tool === 'arc-sce') {
          const start = worldPoints[0];
          const center = worldPoints[1];
          const cursor = worldPoints[2];
          const dist = calculateDistance(center, cursor);
          const projectedEnd = dist > GEOMETRY_PRECISION.POINT_MATCH
            ? pointOnCircle(center, arcResult.radius, calculateAngle(center, cursor))
            : start;
          constructionVerts = [start, center, projectedEnd];
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
          layer: '0',
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
      return makeRubberBandPolyline('preview_arc_rubberband', worldPoints);
    }
  }

  // ── All other tools: delegate to createEntity ────────────────────────────
  return createEntity(tool, worldPoints);
}


// Re-export from extracted module for backward compatibility
export { applyPreviewStyling, createPartialPreview } from './drawing-preview-partial';
