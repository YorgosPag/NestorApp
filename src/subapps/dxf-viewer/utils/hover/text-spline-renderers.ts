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
import { UI_FONTS, buildUIFont, LINE_DASH_PATTERNS } from '../../config/text-rendering-config';
// 🏢 ADR-086: Centralized Angle Formatting
import { formatAngle } from '../../rendering/entities/shared/distance-label-utils';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { degToRad } from '../../rendering/entities/shared/geometry-utils';

export function renderTextHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  if (entity.type !== 'text' && entity.type !== 'mtext') return;

  const e = entity as Record<string, unknown>;
  const position = e.position as Point2D | undefined;

  // Support flat `text` (DXF-imported) and `textNode` AST (CreateTextCommand).
  let text = e.text as string | undefined;
  if (!text) {
    type TextNodeShape = { paragraphs?: Array<{ runs?: Array<{ text?: string }> }> };
    const node = e.textNode as TextNodeShape | undefined;
    if (node?.paragraphs) {
      text = node.paragraphs
        .flatMap(p => p.runs ?? [])
        .map(r => r.text ?? '')
        .join('') || undefined;
    }
  }

  const height = (e.height as number | undefined) || (e.fontSize as number | undefined) || 2.5;
  const rotation = (e.rotation as number | undefined) ?? 0;

  if (!position || !text) return;

  // 🏢 FIX (2026-02-20): Compute screenHeight from world-to-screen transform
  // instead of using raw world units. Measure vertical distance between two world points.
  const screenPos = worldToScreen(position);
  const screenPosUp = worldToScreen({ x: position.x, y: position.y + height });
  const screenHeight = Math.abs(screenPos.y - screenPosUp.y);

  // Skip if text is too small on screen to warrant a hover box
  if (screenHeight < 2) return;

  // Measure text width at screen scale
  ctx.save();
  ctx.font = buildUIFont(screenHeight, 'arial');
  const metrics = ctx.measureText(text);
  const width = metrics.width;

  // Draw subtle bounding rectangle (non-destructive overlay)
  ctx.strokeStyle = UI_COLORS.BRIGHT_YELLOW;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.setLineDash([...LINE_DASH_PATTERNS.TEXT_BOUNDING]); // 🏢 ADR-083

  // 🏢 FIX (2026-02-20): Respect text rotation — bounding box must follow the text angle.
  // Without this, vertical dimension text ("2.95" rotated 90°) gets a horizontal box.
  // Same rotation logic as TextRenderer.render() (negate angle for Y-flip).
  let normalizedRotation = rotation % 360;
  if (normalizedRotation < 0) normalizedRotation += 360;

  if (normalizedRotation !== 0) {
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(degToRad(-normalizedRotation));
    ctx.strokeRect(0, 0, width, screenHeight);
  } else {
    ctx.strokeRect(screenPos.x, screenPos.y, width, screenHeight);
  }

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