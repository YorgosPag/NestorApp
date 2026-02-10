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
// 🏢 ADR-083: Centralized Line Dash Patterns
// 🏢 ADR-086: Centralized Font Definitions
// 🏢 ADR-091: Centralized UI Fonts (buildUIFont for dynamic sizes)
// 🏢 ADR-142: Centralized Default Font Size
import { UI_FONTS, buildUIFont, LINE_DASH_PATTERNS, TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
// 🏢 ADR-086: Centralized Angle Formatting
import { formatAngle } from '../../rendering/entities/shared/distance-label-utils';
import { isTextEntity } from '../../types/entities';

export function renderTextHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  // ✅ ENTERPRISE FIX: Use type guard to ensure entity is TextEntity
  if (!isTextEntity(entity)) return;

  const position = entity.position;
  const text = entity.text;
  // 🏢 ADR-142: Use centralized DEFAULT_FONT_SIZE for fallback
  const height = entity.fontSize || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE;
  
  if (!position || !text) return;
  
  const screenPos = worldToScreen(position);
  const screenHeight = height;
  
  // Simple text bounding box
  ctx.save();
  ctx.font = buildUIFont(screenHeight, 'arial');
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  
  // Draw bounding rectangle
  ctx.strokeStyle = UI_COLORS.BRIGHT_YELLOW;
  ctx.setLineDash([...LINE_DASH_PATTERNS.TEXT_BOUNDING]); // 🏢 ADR-083
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
  ctx.font = UI_FONTS.ARIAL.LARGE; // 🏢 ADR-086: Use centralized font constant
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 🏢 ADR-086: Use centralized angle formatting
  ctx.fillText(formatAngle(angle, 1), screenVertex.x, screenVertex.y - 20);
  ctx.restore();
}