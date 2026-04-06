/**
 * LAYER POLYGON RENDERER — Standalone functions for polygon + grip rendering
 * ADR-065: Extracted from LayerRenderer.ts for SRP compliance
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { ColorLayer } from './layer-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { getStatusColors } from '../../config/color-mapping';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-042/044/097/154: Centralized rendering constants
import { RENDER_LINE_WIDTHS, LINE_DASH_PATTERNS } from '../../config/text-rendering-config';
// 🏢 ADR-073: Centralized Midpoint Calculation
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-075/106: Centralized Grip Size Multipliers
import { GRIP_SIZE_MULTIPLIERS, EDGE_GRIP_SIZE_MULTIPLIERS, EDGE_GRIP_COLOR, DEFAULT_GRIP_COLORS } from '../../rendering/grips/constants';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../../rendering/primitives/canvasPaths';
// 🏢 ENTERPRISE: Centralized GripSettings type
import type { GripSettings } from '../../types/gripSettings';

/** Parameters for polygon rendering — avoids passing 8+ individual args */
interface PolygonRenderParams {
  ctx: CanvasRenderingContext2D;
  polygon: {
    vertices: Point2D[];
    fillColor?: string;
    strokeColor?: string;
    strokeWidth: number;
    selected?: boolean;
  };
  layer: ColorLayer;
  transform: ViewTransform;
  viewport: Viewport;
  gripSettings: GripSettings | null;
  /** Stored transform for worldToScreen in edge midpoint drag preview */
  storedTransform: ViewTransform | null;
  storedViewport: Viewport | null;
  worldToScreenFn: (point: Point2D, transform: ViewTransform, viewport: Viewport | null) => Point2D;
}

/**
 * Render a single polygon with fill, stroke, selection, hover, and grips.
 * Extracted from LayerRenderer.renderPolygon (ADR-065)
 */
export function renderPolygonToCanvas(params: PolygonRenderParams): void {
  const { ctx, polygon, layer, transform, viewport, gripSettings, storedTransform, storedViewport, worldToScreenFn } = params;

  if (polygon.vertices.length < 3) {
    if (!layer.isDraft) return;
    renderDraftPartialToCanvas({ ctx, polygon, layer, transform, viewport, gripSettings });
    return;
  }

  // Convert world coordinates to screen coordinates
  // 🏢 ENTERPRISE (2026-01-26): Handle real-time drag preview for MULTI-GRIP vertices
  const selectedVertexIndices = layer.selectedGripIndices ??
    (layer.selectedGripType === 'vertex' && layer.selectedGripIndex !== undefined ? [layer.selectedGripIndex] : []);

  const dragState = layer.isDragging ? layer.dragState : null;

  let screenVertices = polygon.vertices.map((vertex: Point2D, index: number) => {
    if (dragState && selectedVertexIndices.includes(index)) {
      const originalPosition = dragState.originalPositions.get(index);
      if (originalPosition) {
        const previewPosition: Point2D = {
          x: originalPosition.x + dragState.delta.x,
          y: originalPosition.y + dragState.delta.y
        };
        return CoordinateTransforms.worldToScreen(previewPosition, transform, viewport);
      }
      const previewPosition: Point2D = {
        x: vertex.x + dragState.delta.x,
        y: vertex.y + dragState.delta.y
      };
      return CoordinateTransforms.worldToScreen(previewPosition, transform, viewport);
    }
    return CoordinateTransforms.worldToScreen(vertex, transform, viewport);
  });

  // 🏢 ENTERPRISE (2026-01-26): Handle edge midpoint drag (vertex insertion preview)
  const selectedEdgeMidpointIndex = layer.selectedEdgeMidpointIndices?.[0] ??
    (layer.selectedGripType === 'edge-midpoint' ? layer.selectedGripIndex : undefined);

  if (layer.isDragging && layer.dragPreviewPosition && selectedEdgeMidpointIndex !== undefined) {
    const insertIndex = selectedEdgeMidpointIndex + 1;
    const previewVertex = CoordinateTransforms.worldToScreen(layer.dragPreviewPosition, transform, viewport);
    screenVertices = [
      ...screenVertices.slice(0, insertIndex),
      previewVertex,
      ...screenVertices.slice(insertIndex)
    ];
  }

  // Draw polygon path
  ctx.beginPath();
  const firstVertex = screenVertices[0];
  ctx.moveTo(firstVertex.x, firstVertex.y);
  for (let i = 1; i < screenVertices.length; i++) {
    ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
  }
  ctx.closePath();

  // Fill with centralized STATUS_COLORS_MAPPING
  let fillColor = polygon.fillColor;
  if (layer.status) {
    const statusColors = getStatusColors(layer.status);
    if (statusColors) {
      fillColor = statusColors.fill;
    }
  }
  fillColor = fillColor || layer.color;

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  // Stroke with consistent STATUS_COLORS_MAPPING
  if (polygon.strokeWidth > 0) {
    let strokeColor = polygon.strokeColor;
    if (layer.status) {
      const statusColors = getStatusColors(layer.status);
      if (statusColors) {
        strokeColor = statusColors.stroke;
      }
    }
    strokeColor = strokeColor || layer.color || UI_COLORS.BLACK;

    ctx.strokeStyle = polygon.selected ? UI_COLORS.SELECTED_RED : strokeColor;
    ctx.lineWidth = polygon.strokeWidth;
    ctx.stroke();
  }

  // Selection highlight
  if (polygon.selected) {
    ctx.strokeStyle = UI_COLORS.BRIGHT_GREEN;
    ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    ctx.setLineDash([...LINE_DASH_PATTERNS.SELECTION]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 🏢 ENTERPRISE (2026-02-15): Hover highlight — yellow glow (AutoCAD-style)
  if (layer.isHovered && !polygon.selected) {
    ctx.save();
    ctx.shadowColor = UI_COLORS.ENTITY_HOVER_GLOW;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = layer.color || UI_COLORS.WHITE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // 🏢 ENTERPRISE (2026-01-25): Vertex grips using CENTRALIZED GripSettings
  if (layer.showGrips && polygon.vertices.length >= 1) {
    renderVertexGrips(ctx, screenVertices, layer, gripSettings, selectedVertexIndices);
  }

  // 🏢 ENTERPRISE (2026-01-25): Edge midpoint grips (Autodesk pattern)
  if (layer.showEdgeMidpoints && polygon.vertices.length >= 2) {
    renderEdgeMidpointGrips(ctx, screenVertices, layer, gripSettings, storedTransform, storedViewport, worldToScreenFn);
  }
}

/**
 * Render vertex grips (square) for a polygon.
 */
function renderVertexGrips(
  ctx: CanvasRenderingContext2D,
  screenVertices: Point2D[],
  layer: ColorLayer,
  gripSettings: GripSettings | null,
  selectedVertexGripIndices: number[]
): void {
  const dpiScale = gripSettings?.dpiScale ?? 1.0;
  const baseSize = (gripSettings?.gripSize ?? 5) * dpiScale;

  // 🏢 ADR-075: Centralized grip size multipliers (cold->warm->hot)
  const GRIP_SIZE_COLD = Math.round(baseSize * GRIP_SIZE_MULTIPLIERS.COLD);
  const GRIP_SIZE_WARM = Math.round(baseSize * GRIP_SIZE_MULTIPLIERS.WARM);
  const GRIP_SIZE_HOT = Math.round(baseSize * GRIP_SIZE_MULTIPLIERS.HOT);

  // 🏢 FIX (2026-02-16): Centralized DEFAULT_GRIP_COLORS (same as DXF GripColorManager)
  const GRIP_COLOR_COLD = gripSettings?.colors?.cold ?? DEFAULT_GRIP_COLORS.COLD;
  const GRIP_COLOR_WARM = gripSettings?.colors?.warm ?? DEFAULT_GRIP_COLORS.WARM;
  const GRIP_COLOR_HOT = gripSettings?.colors?.hot ?? DEFAULT_GRIP_COLORS.HOT;
  const GRIP_COLOR_CONTOUR = gripSettings?.colors?.contour ?? DEFAULT_GRIP_COLORS.CONTOUR;

  for (let i = 0; i < screenVertices.length; i++) {
    const vertex = screenVertices[i];
    const isFirstGrip = i === 0;
    const isCloseHighlighted = isFirstGrip && layer.isNearFirstPoint;
    const isHovered = layer.hoveredVertexIndex === i;
    const isSelected = selectedVertexGripIndices.includes(i);

    const gripState: 'cold' | 'warm' | 'hot' = (isCloseHighlighted || isSelected) ? 'hot' : isHovered ? 'warm' : 'cold';
    const gripSize = gripState === 'hot' ? GRIP_SIZE_HOT : gripState === 'warm' ? GRIP_SIZE_WARM : GRIP_SIZE_COLD;
    const fillColor = gripState === 'hot' ? GRIP_COLOR_HOT : gripState === 'warm' ? GRIP_COLOR_WARM : GRIP_COLOR_COLD;

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = GRIP_COLOR_CONTOUR;
    ctx.lineWidth = gripState !== 'cold'
      ? RENDER_LINE_WIDTHS.GRIP_OUTLINE_ACTIVE
      : RENDER_LINE_WIDTHS.GRIP_OUTLINE;

    const halfSize = gripSize / 2;
    ctx.fillRect(vertex.x - halfSize, vertex.y - halfSize, gripSize, gripSize);
    ctx.strokeRect(vertex.x - halfSize, vertex.y - halfSize, gripSize, gripSize);

    // "Close" indicator for first grip when highlighted
    if (isCloseHighlighted) {
      ctx.strokeStyle = GRIP_COLOR_HOT;
      ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
      const outerSize = gripSize + 6;
      const outerHalf = outerSize / 2;
      ctx.strokeRect(vertex.x - outerHalf, vertex.y - outerHalf, outerSize, outerSize);
    }

    // Selection indicator for HOT grip (without close)
    if (isSelected && !isCloseHighlighted) {
      ctx.strokeStyle = GRIP_COLOR_HOT;
      ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
      const outerSize = gripSize + 4;
      const outerHalf = outerSize / 2;
      ctx.strokeRect(vertex.x - outerHalf, vertex.y - outerHalf, outerSize, outerSize);
    }

    ctx.restore();
  }
}

/**
 * Render edge midpoint grips (diamond/rhombus) for a polygon.
 */
function renderEdgeMidpointGrips(
  ctx: CanvasRenderingContext2D,
  screenVertices: Point2D[],
  layer: ColorLayer,
  gripSettings: GripSettings | null,
  storedTransform: ViewTransform | null,
  storedViewport: Viewport | null,
  worldToScreenFn: (point: Point2D, transform: ViewTransform, viewport: Viewport | null) => Point2D
): void {
  const dpiScale = gripSettings?.dpiScale ?? 1.0;
  const baseEdgeSize = ((gripSettings?.gripSize ?? 5) * 0.6) * dpiScale;

  // 🏢 ADR-106: Centralized edge grip multipliers
  const EDGE_GRIP_SIZE_COLD = Math.round(baseEdgeSize * EDGE_GRIP_SIZE_MULTIPLIERS.COLD);
  const EDGE_GRIP_SIZE_WARM = Math.round(baseEdgeSize * EDGE_GRIP_SIZE_MULTIPLIERS.WARM);

  // 🏢 FIX (2026-02-16): Edge grips use GREEN cold (matching DXF GripColorManager)
  const EDGE_GRIP_COLOR_COLD = EDGE_GRIP_COLOR;
  const EDGE_GRIP_COLOR_WARM = DEFAULT_GRIP_COLORS.WARM;
  const GRIP_COLOR_CONTOUR = DEFAULT_GRIP_COLORS.CONTOUR;

  const edgeCount = screenVertices.length;
  for (let i = 0; i < edgeCount; i++) {
    const startVertex = screenVertices[i];
    const endVertex = screenVertices[(i + 1) % screenVertices.length];
    const mid = calculateMidpoint(startVertex, endVertex);

    const isHovered = layer.hoveredEdgeIndex === i;

    const selectedEdgeMidpointIdx = layer.selectedEdgeMidpointIndices ??
      (layer.selectedGripType === 'edge-midpoint' && layer.selectedGripIndex !== undefined ? [layer.selectedGripIndex] : []);
    const isSelected = selectedEdgeMidpointIdx.includes(i);

    const EDGE_GRIP_SIZE_HOT = Math.round(baseEdgeSize * EDGE_GRIP_SIZE_MULTIPLIERS.HOT);
    const EDGE_GRIP_COLOR_HOT = gripSettings?.colors?.hot ?? UI_COLORS.SNAP_ENDPOINT;

    // Real-time drag preview for edge midpoint
    let drawMidX = mid.x;
    let drawMidY = mid.y;
    if (isSelected && layer.isDragging && layer.dragPreviewPosition && storedTransform) {
      const previewScreen = worldToScreenFn(layer.dragPreviewPosition, storedTransform, storedViewport);
      drawMidX = previewScreen.x;
      drawMidY = previewScreen.y;
    }

    const gripState: 'cold' | 'warm' | 'hot' = isSelected ? 'hot' : isHovered ? 'warm' : 'cold';
    const gripSize = gripState === 'hot' ? EDGE_GRIP_SIZE_HOT : gripState === 'warm' ? EDGE_GRIP_SIZE_WARM : EDGE_GRIP_SIZE_COLD;
    const fillColor = gripState === 'hot' ? EDGE_GRIP_COLOR_HOT : gripState === 'warm' ? EDGE_GRIP_COLOR_WARM : EDGE_GRIP_COLOR_COLD;

    // Draw diamond/rhombus grip at midpoint
    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = gripState !== 'cold' ? fillColor : GRIP_COLOR_CONTOUR;
    ctx.lineWidth = gripState !== 'cold'
      ? RENDER_LINE_WIDTHS.GRIP_OUTLINE_ACTIVE
      : RENDER_LINE_WIDTHS.GRIP_OUTLINE;

    ctx.beginPath();
    ctx.moveTo(drawMidX, drawMidY - gripSize);
    ctx.lineTo(drawMidX + gripSize, drawMidY);
    ctx.lineTo(drawMidX, drawMidY + gripSize);
    ctx.lineTo(drawMidX - gripSize, drawMidY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Highlight for WARM or HOT grips
    if (gripState !== 'cold') {
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
      const outerSize = gripSize + 4;
      ctx.beginPath();
      ctx.moveTo(drawMidX, drawMidY - outerSize);
      ctx.lineTo(drawMidX + outerSize, drawMidY);
      ctx.lineTo(drawMidX, drawMidY + outerSize);
      ctx.lineTo(drawMidX - outerSize, drawMidY);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }
}

/**
 * Render partial draft polygon with <3 vertices.
 * Shows grip points and line segments during drawing.
 */
function renderDraftPartialToCanvas(params: {
  ctx: CanvasRenderingContext2D;
  polygon: {
    vertices: Point2D[];
    fillColor?: string;
    strokeColor?: string;
    strokeWidth: number;
    selected?: boolean;
  };
  layer: ColorLayer;
  transform: ViewTransform;
  viewport: Viewport;
  gripSettings: GripSettings | null;
}): void {
  const { ctx, polygon, layer, transform, viewport, gripSettings } = params;

  const screenVertices = polygon.vertices.map((vertex: Point2D) =>
    CoordinateTransforms.worldToScreen(vertex, transform, viewport)
  );

  // Draw line segments for 2+ vertices (open polyline)
  if (screenVertices.length >= 2) {
    ctx.save();
    const strokeColor = polygon.strokeColor || layer.color || UI_COLORS.BUTTON_PRIMARY;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = polygon.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
    for (let i = 1; i < screenVertices.length; i++) {
      ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Draw vertex grips
  if (layer.showGrips) {
    const dpiScale = gripSettings?.dpiScale ?? 1.0;
    const baseSize = (gripSettings?.gripSize ?? 5) * dpiScale;

    const GRIP_SIZE_COLD = Math.round(baseSize * GRIP_SIZE_MULTIPLIERS.COLD);
    const GRIP_SIZE_HOT = Math.round(baseSize * GRIP_SIZE_MULTIPLIERS.HOT);
    const GRIP_COLOR_COLD = gripSettings?.colors?.cold ?? UI_COLORS.SNAP_CENTER;
    const GRIP_COLOR_HOT = gripSettings?.colors?.hot ?? UI_COLORS.SNAP_ENDPOINT;
    const GRIP_COLOR_CONTOUR = gripSettings?.colors?.contour ?? UI_COLORS.BLACK;

    for (let i = 0; i < screenVertices.length; i++) {
      const vertex = screenVertices[i];
      const isFirstGrip = i === 0;
      const isCloseHighlighted = isFirstGrip && layer.isNearFirstPoint;
      const gripSize = isCloseHighlighted ? GRIP_SIZE_HOT : GRIP_SIZE_COLD;
      const fillColor = isCloseHighlighted ? GRIP_COLOR_HOT : GRIP_COLOR_COLD;

      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = GRIP_COLOR_CONTOUR;
      ctx.lineWidth = RENDER_LINE_WIDTHS.GRIP_OUTLINE;

      const halfSize = gripSize / 2;
      ctx.fillRect(vertex.x - halfSize, vertex.y - halfSize, gripSize, gripSize);
      ctx.strokeRect(vertex.x - halfSize, vertex.y - halfSize, gripSize, gripSize);

      if (isCloseHighlighted) {
        ctx.strokeStyle = GRIP_COLOR_HOT;
        ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
        const outerSize = gripSize + 6;
        const outerHalf = outerSize / 2;
        ctx.strokeRect(vertex.x - outerHalf, vertex.y - outerHalf, outerSize, outerSize);
      }

      ctx.restore();
    }
  }
}
