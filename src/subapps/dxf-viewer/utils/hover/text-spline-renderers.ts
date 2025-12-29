/**
 * Text and Spline Hover Renderers
 * Handles hover rendering for text, mtext, spline entities and angle measurements
 */

import { renderGreenDots } from './render-utils';
import { renderPolylineHover } from './polyline-renderer';
import type { Point2D } from '../../rendering/types/Types';
import type { HoverRenderContext } from './types';
import { extractAngleMeasurementPoints } from '../../rendering/entities/shared/geometry-rendering-utils';
import { UI_COLORS } from '../../config/color-config';
import { isTextEntity, isAngleMeasurementEntity } from '../../types/entities';

export function renderTextHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  // ✅ ENTERPRISE FIX: Use type guard to ensure entity is TextEntity
  if (!isTextEntity(entity)) return;

  const position = entity.position;
  const text = entity.text;
  const height = entity.fontSize || 12;
  
  if (!position || !text) return;
  
  const screenPos = worldToScreen(position);
  const screenHeight = height;
  
  // Simple text bounding box
  ctx.save();
  ctx.font = `${screenHeight}px Arial`;
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  
  // Draw bounding rectangle
  ctx.strokeStyle = UI_COLORS.BRIGHT_YELLOW;
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(screenPos.x, screenPos.y - screenHeight, width, screenHeight);
  
  ctx.restore();
}

export function renderSplineHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  // ✅ ENTERPRISE FIX: Type-safe access to spline properties
  if (!('controlPoints' in entity) || !('closed' in entity)) return;

  // Spline is treated as polyline for simplicity
  const controlPoints = entity.controlPoints as Point2D[];
  const closed = entity.closed as boolean;
  const splineAsPolyline = { ...entity, vertices: controlPoints, closed: closed };
  renderPolylineHover({ entity: splineAsPolyline, ctx, worldToScreen, options });
}

export function renderAngleMeasurementHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  const angleMeasurement = extractAngleMeasurementPoints(entity);
  if (!angleMeasurement) return;
  
  const { vertex, point1, point2, angle } = angleMeasurement;
  
  const screenVertex = worldToScreen(vertex);
  const screenPoint1 = worldToScreen(point1);
  const screenPoint2 = worldToScreen(point2);
  
  // Draw the two lines
  ctx.beginPath();
  ctx.moveTo(screenVertex.x, screenVertex.y);
  ctx.lineTo(screenPoint1.x, screenPoint1.y);
  ctx.moveTo(screenVertex.x, screenVertex.y);
  ctx.lineTo(screenPoint2.x, screenPoint2.y);
  ctx.stroke();
  
  // Draw green dots at endpoints
  renderGreenDots(ctx, [screenVertex, screenPoint1, screenPoint2]);
  
  // Simple angle text at vertex
  ctx.save();
  ctx.fillStyle = UI_COLORS.DRAWING_TEMP;
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${angle.toFixed(1)}°`, screenVertex.x, screenVertex.y - 20);
  ctx.restore();
}