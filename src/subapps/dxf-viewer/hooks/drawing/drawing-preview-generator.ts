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


/**
 * Applies preview styling (flags, grip points, measurement markers) to a preview entity.
 *
 * This function mutates the entity in-place for performance (same pattern as the original code).
 *
 * @param entity - The preview entity to decorate
 * @param tool - The active drawing tool
 * @param worldPoints - All points including cursor (tempPoints + cursor)
 * @param cursorPoint - Current cursor position (snapped)
 * @param isOverlayMode - Whether overlay drawing mode is active
 * @param applySettings - Callback to apply color/lineweight settings from the hook
 */
export function applyPreviewStyling(
  entity: ExtendedSceneEntity,
  tool: DrawingTool,
  worldPoints: Point2D[],
  cursorPoint: Point2D,
  isOverlayMode: boolean,
  applySettings: ApplySettingsFn
): void {
  // Only apply styling for recognized drawing tools
  const isStylableTool =
    tool === 'polygon' || tool === 'polyline' || tool === 'measure-angle' ||
    tool === 'measure-angle-measuregeom' ||
    tool === 'measure-area' || tool === 'line' || tool === 'measure-distance' ||
    tool === 'measure-distance-continuous' || tool === 'rectangle' ||
    tool === 'circle' || tool === 'circle-diameter' || tool === 'circle-2p-diameter' ||
    tool === 'circle-3p' || tool === 'circle-chord-sagitta' || tool === 'circle-2p-radius' ||
    tool === 'circle-best-fit' || tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce';

  if (!isStylableTool) return;

  // Handle different entity types appropriately
  if (entity.type === 'polyline') {
    const extPoly = entity as ExtendedPolylineEntity;
    extPoly.preview = true;
    extPoly.showEdgeDistances = true;
    extPoly.showPreviewGrips = true;
    extPoly.isOverlayPreview = isOverlayMode;
    applySettings(extPoly as unknown as Record<string, unknown>);

    // Highlight first point for closable tools when 3+ points
    if ((tool === 'measure-area' || tool === 'polygon') && worldPoints.length >= 3) {
      extPoly.previewGripPoints = [
        { position: worldPoints[0], type: 'close', color: UI_COLORS.BRIGHT_GREEN },
        { position: cursorPoint, type: 'cursor' },
      ];
    }
  } else if (entity.type === 'line') {
    const extLine = entity as ExtendedLineEntity;
    extLine.preview = true;
    extLine.showEdgeDistances = true;
    extLine.showPreviewGrips = true;
    extLine.isOverlayPreview = isOverlayMode;
    applySettings(extLine as unknown as Record<string, unknown>);

    // Grip points for line preview
    if ((tool === 'line' || tool === 'measure-distance-continuous') && worldPoints.length >= 2) {
      extLine.previewGripPoints = [
        { position: worldPoints[0], type: 'start' },
        { position: cursorPoint, type: 'cursor' },
      ];
    }
  } else if (entity.type === 'circle') {
    const extCircle = entity as ExtendedCircleEntity;
    extCircle.preview = true;
    extCircle.showPreviewGrips = true;
    extCircle.showPreviewMeasurements = true;
    applySettings(extCircle as unknown as Record<string, unknown>);
  } else if (entity.type === 'rectangle') {
    const extRect = entity as unknown as {
      preview?: boolean;
      showPreviewGrips?: boolean;
      showPreviewMeasurements?: boolean;
    } & typeof entity;
    extRect.preview = true;
    extRect.showPreviewGrips = true;
    extRect.showPreviewMeasurements = true;
    applySettings(extRect as unknown as Record<string, unknown>);
  } else if (entity.type === 'angle-measurement') {
    const extAngle = entity as unknown as {
      preview?: boolean;
      showPreviewGrips?: boolean;
    } & typeof entity;
    extAngle.preview = true;
    extAngle.showPreviewGrips = true;
    applySettings(extAngle as unknown as Record<string, unknown>);
  } else if (entity.type === 'arc') {
    const extArc = entity as unknown as {
      preview?: boolean;
      showPreviewGrips?: boolean;
    } & typeof entity;
    extArc.preview = true;
    extArc.showPreviewGrips = true;
    applySettings(extArc as unknown as Record<string, unknown>);
  }

  // Add measurement flag for measurement tools
  const isMeasurementTool =
    tool === 'measure-distance' || tool === 'measure-area' || tool === 'measure-angle' ||
    tool === 'measure-angle-measuregeom';
  if (isMeasurementTool) {
    if (entity.type === 'polyline') {
      (entity as ExtendedPolylineEntity).measurement = true;
    } else if (entity.type === 'line') {
      (entity as ExtendedLineEntity).measurement = true;
    } else if (entity.type === 'circle') {
      (entity as ExtendedCircleEntity).measurement = true;
    }
  }
}


// ─── Partial Preview (after point click, before entity is complete) ─────────

/** Tools that need 3 points and share the same dot → line partial preview pattern */
const THREE_POINT_DOT_LINE_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'arc-3p', 'arc-cse', 'arc-sce',
  'circle-3p', 'circle-chord-sagitta', 'circle-2p-radius',
]);

/**
 * Creates a partial preview entity to display after a point click for multi-point tools.
 *
 * This consolidates the repeated dot/line/polyline patterns that were previously
 * copy-pasted across 6 tool groups (~290 lines) in useUnifiedDrawing.addPoint().
 *
 * @param tool - The active drawing tool
 * @param points - Points collected so far (including the just-added point)
 * @returns A partial preview entity, or null if no partial preview is needed
 */
export function createPartialPreview(
  tool: DrawingTool,
  points: Point2D[]
): ExtendedSceneEntity | null {
  if (points.length === 0) return null;

  // ── Pattern A: 3-point tools (dot at 1pt, line at 2pt) ────────────────
  if (THREE_POINT_DOT_LINE_TOOLS.has(tool)) {
    if (points.length === 1) {
      return {
        id: 'preview_partial',
        type: 'point',
        position: points[0],
        size: 4,
        visible: true,
        layer: '0',
        preview: true,
        showPreviewGrips: true,
      } as PreviewPoint;
    }
    if (points.length === 2) {
      return {
        id: 'preview_partial',
        type: 'line',
        start: points[0],
        end: points[1],
        visible: true,
        layer: '0',
        color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
        lineweight: 1,
        opacity: 1.0,
        lineType: 'solid' as const,
        preview: true,
        showEdgeDistances: true,
        showPreviewGrips: true,
      } as ExtendedLineEntity;
    }
    return null;
  }

  // ── Pattern B: measure-angle variants (measurement dot at 1pt, measurement polyline at 2pt) ─
  // ADR-188: All angle measurement tools share the same 3-point partial preview pattern
  if (tool === 'measure-angle' || tool === 'measure-angle-measuregeom') {
    if (points.length === 1) {
      return {
        id: 'preview_partial',
        type: 'circle',
        center: points[0],
        radius: 3,
        visible: true,
        layer: '0',
        measurement: true,
        preview: true,
        showPreviewGrips: true,
      } as ExtendedCircleEntity;
    }
    if (points.length === 2) {
      return {
        id: 'preview_partial',
        type: 'polyline',
        vertices: points,
        closed: false,
        visible: true,
        layer: '0',
        color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
        lineweight: 1,
        opacity: 1.0,
        lineType: 'solid' as const,
        preview: true,
        showEdgeDistances: true,
        showPreviewGrips: true,
        measurement: true,
      } as ExtendedPolylineEntity;
    }
    return null;
  }

  // ── Pattern C: circle-best-fit (dot → line → best-fit circle or polyline) ─
  if (tool === 'circle-best-fit') {
    if (points.length === 1) {
      return {
        id: 'preview_partial',
        type: 'point',
        position: points[0],
        size: 4,
        visible: true,
        layer: '0',
        preview: true,
        showPreviewGrips: true,
      } as PreviewPoint;
    }
    if (points.length === 2) {
      return {
        id: 'preview_partial',
        type: 'line',
        start: points[0],
        end: points[1],
        visible: true,
        layer: '0',
        color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
        lineweight: 1,
        opacity: 1.0,
        lineType: 'solid' as const,
        preview: true,
        showEdgeDistances: true,
        showPreviewGrips: true,
      } as ExtendedLineEntity;
    }
    // 3+ points: try best-fit circle, fallback to polyline
    const circleResult = circleBestFit(points);
    if (circleResult) {
      return {
        id: 'preview_partial',
        type: 'circle',
        center: circleResult.center,
        radius: circleResult.radius,
        visible: true,
        layer: '0',
        preview: true,
        showPreviewGrips: true,
      } as ExtendedCircleEntity;
    }
    return {
      id: 'preview_partial',
      type: 'polyline',
      vertices: [...points],
      closed: false,
      visible: true,
      layer: '0',
      color: PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE,
      lineweight: 1,
      opacity: 1.0,
      lineType: 'solid' as const,
      preview: true,
      showEdgeDistances: true,
      showPreviewGrips: true,
    } as ExtendedPolylineEntity;
  }

  // No partial preview needed for this tool/point combination
  return null;
}
