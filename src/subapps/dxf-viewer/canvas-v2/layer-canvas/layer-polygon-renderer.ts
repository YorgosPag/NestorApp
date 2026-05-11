/**
 * LAYER POLYGON RENDERER — Standalone functions for polygon + grip rendering
 * ADR-065: Extracted from LayerRenderer.ts for SRP compliance
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { ColorLayer } from './layer-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { getStatusColors } from '../../config/color-mapping';
import { UI_COLORS, HOVER_HIGHLIGHT } from '../../config/color-config';
// 🏢 ADR-042/044/097/154: Centralized rendering constants
import { RENDER_LINE_WIDTHS, LINE_DASH_PATTERNS } from '../../config/text-rendering-config';
// 🏢 ADR-073: Centralized Midpoint Calculation
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-048: Unified Grip Rendering System (SSoT for all grip drawing)
import { UnifiedGripRenderer } from '../../rendering/grips/UnifiedGripRenderer';
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

  // 🏢 HOVER_HIGHLIGHT SSoT: double-stroke (no shadowBlur — GPU-expensive)
  if (layer.isHovered && !polygon.selected) {
    ctx.save();
    ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
    ctx.lineWidth = polygon.strokeWidth + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
    ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = layer.color || UI_COLORS.WHITE;
    ctx.lineWidth = polygon.strokeWidth;
    ctx.stroke();
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
 * Delegates to UnifiedGripRenderer (ADR-048 SSoT).
 */
function renderVertexGrips(
  ctx: CanvasRenderingContext2D,
  screenVertices: Point2D[],
  layer: ColorLayer,
  gripSettings: GripSettings | null,
  selectedVertexGripIndices: number[]
): void {
  const gripRenderer = new UnifiedGripRenderer(ctx, (p) => p);
  const settings = gripSettings ?? undefined;

  for (let i = 0; i < screenVertices.length; i++) {
    const vertex = screenVertices[i];
    const isCloseHighlighted = i === 0 && !!layer.isNearFirstPoint;
    const isHovered = layer.hoveredVertexIndex === i;
    const isSelected = selectedVertexGripIndices.includes(i);
    const temperature: 'cold' | 'warm' | 'hot' =
      isCloseHighlighted || isSelected ? 'hot' : isHovered ? 'warm' : 'cold';

    gripRenderer.renderGrip(
      {
        position: vertex,
        type: 'vertex',
        shape: 'square',
        showCloseRing: isCloseHighlighted,
        showSelectionRing: isSelected && !isCloseHighlighted,
      },
      settings,
      temperature
    );
  }
}

/**
 * Render edge midpoint grips (diamond) for a polygon.
 * Delegates to UnifiedGripRenderer.renderEdgeMidpointGrip (ADR-048 SSoT).
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
  const gripRenderer = new UnifiedGripRenderer(ctx, (p) => p);
  const edgeCount = screenVertices.length;

  for (let i = 0; i < edgeCount; i++) {
    const startVertex = screenVertices[i];
    const endVertex = screenVertices[(i + 1) % screenVertices.length];
    const mid = calculateMidpoint(startVertex, endVertex);

    const isHovered = layer.hoveredEdgeIndex === i;
    const selectedEdgeMidpointIdx = layer.selectedEdgeMidpointIndices ??
      (layer.selectedGripType === 'edge-midpoint' && layer.selectedGripIndex !== undefined
        ? [layer.selectedGripIndex]
        : []);
    const isSelected = selectedEdgeMidpointIdx.includes(i);

    // Real-time drag preview for edge midpoint
    let drawMid: Point2D = mid;
    if (isSelected && layer.isDragging && layer.dragPreviewPosition && storedTransform) {
      const previewScreen = worldToScreenFn(layer.dragPreviewPosition, storedTransform, storedViewport);
      drawMid = previewScreen;
    }

    const gripState: 'cold' | 'warm' | 'hot' = isSelected ? 'hot' : isHovered ? 'warm' : 'cold';
    gripRenderer.renderEdgeMidpointGrip(drawMid, gripState, gripSettings);
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

  // Draw vertex grips (ADR-048 SSoT)
  if (layer.showGrips) {
    const gripRenderer = new UnifiedGripRenderer(ctx, (p) => p);
    const settings = gripSettings ?? undefined;

    for (let i = 0; i < screenVertices.length; i++) {
      const vertex = screenVertices[i];
      const isCloseHighlighted = i === 0 && !!layer.isNearFirstPoint;
      const temperature: 'cold' | 'hot' = isCloseHighlighted ? 'hot' : 'cold';

      gripRenderer.renderGrip(
        { position: vertex, type: 'vertex', shape: 'square', showCloseRing: isCloseHighlighted },
        settings,
        temperature
      );
    }
  }
}
