/**
 * @module drawing-preview-partial
 * @description Preview styling and partial preview generation for drawing tools.
 * Extracted from drawing-preview-generator.ts per ADR-065 (file size compliance).
 *
 * Functions:
 * - applyPreviewStyling(): Decorates a preview entity with flags, grip points, and measurement info
 * - createPartialPreview(): Creates partial preview after point clicks for multi-point tools
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  DrawingTool,
  ExtendedSceneEntity,
  ExtendedPolylineEntity,
  ExtendedCircleEntity,
  ExtendedLineEntity,
  PreviewPoint,
} from './drawing-types';
import { circleBestFit } from '../../rendering/entities/shared';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { UI_COLORS } from '../../config/color-config';
import type { ApplySettingsFn } from './drawing-preview-generator';

// ─── Preview Styling ─────────────────────────────────────────────────────────

/**
 * Applies preview styling (flags, grip points, measurement markers) to a preview entity.
 * Mutates the entity in-place for performance.
 */
export function applyPreviewStyling(
  entity: ExtendedSceneEntity,
  tool: DrawingTool,
  worldPoints: Point2D[],
  cursorPoint: Point2D,
  isOverlayMode: boolean,
  applySettings: ApplySettingsFn
): void {
  const isStylableTool =
    tool === 'polygon' || tool === 'polyline' || tool === 'measure-angle' ||
    tool === 'measure-angle-measuregeom' ||
    tool === 'measure-area' || tool === 'line' || tool === 'measure-distance' ||
    tool === 'measure-distance-continuous' || tool === 'rectangle' ||
    tool === 'circle' || tool === 'circle-diameter' || tool === 'circle-2p-diameter' ||
    tool === 'circle-3p' || tool === 'circle-chord-sagitta' || tool === 'circle-2p-radius' ||
    tool === 'circle-best-fit' || tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce';

  if (!isStylableTool) return;

  if (entity.type === 'polyline') {
    const extPoly = entity as ExtendedPolylineEntity;
    extPoly.preview = true;
    extPoly.showEdgeDistances = true;
    extPoly.showPreviewGrips = true;
    extPoly.isOverlayPreview = isOverlayMode;
    applySettings(extPoly as unknown as Record<string, unknown>);

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

  // Measurement flag
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

// ─── Partial Preview ─────────────────────────────────────────────────────────

/** Tools that need 3 points and share the same dot → line partial preview pattern */
const THREE_POINT_DOT_LINE_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'arc-3p', 'arc-cse', 'arc-sce',
  'circle-3p', 'circle-chord-sagitta', 'circle-2p-radius',
]);

/**
 * Creates a partial preview entity to display after a point click for multi-point tools.
 *
 * Consolidates repeated dot/line/polyline patterns that were previously
 * copy-pasted across 6 tool groups in useUnifiedDrawing.addPoint().
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

  // ── Pattern B: measure-angle variants ────────────────────────────────
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

  // ── Pattern C: circle-best-fit (dot → line → best-fit circle) ─────────
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

  return null;
}
