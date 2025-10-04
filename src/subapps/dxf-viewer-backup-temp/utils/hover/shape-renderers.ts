/**
 * Shape Hover Renderers
 * Handles hover rendering for circles, rectangles, arcs, ellipses
 */

import { HOVER_CONFIG } from './config';
import { renderPolylineHover } from './polyline-renderer';
import { renderGreenDots } from './render-utils';
import { renderRadiusWithMeasurement } from './radius-utils';
import type { Point2D } from '../../rendering/types/Types';
import { drawVerticesPath } from '../../rendering/entities/shared/geometry-rendering-utils';
import { validateArcEntity, validateEllipseEntity } from '../../rendering/entities/shared/entity-validation-utils';
import { renderMeasurementLabel } from '../../rendering/entities/shared/geometry-rendering-utils';
import { UI_COLORS } from '../../config/color-config';

export function renderCircleHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  return; // ⚠️ ΠΡΟΣΩΡΙΝΑ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING κίτρινων grips

  const center = entity.center as Point2D;
  const radius = entity.radius as number;

  if (!center || !radius) return;

  const screenCenter = worldToScreen(center);
  const screenRadius = radius; // Use world radius, will be transformed by setupStyle

  // Determine line style based on hover/selection state
  // If hovered (regardless of selection), use dashed
  // If only selected (no hover), use solid
  const isDashed = options.hovered ? true : false;

  // Setup style exactly like preview but with white color
  ctx.save();
  ctx.setLineDash([]); // Reset line dash first
  
  if (isDashed) {
    // Hover: white dashed (like preview but white instead of blue)
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Same dash pattern as preview
    ctx.strokeStyle = UI_COLORS.HOVERED_ENTITY; 
  } else {
    // Selection: exactly like 2nd phase normal rendering (white, thin, solid)
    ctx.lineWidth = 1; // Thin line like normal entity
    ctx.setLineDash([]);
    ctx.strokeStyle = UI_COLORS.HOVERED_ENTITY; // White like normal entity
  }

  // Draw circle perimeter (use screen coordinates)
  const screenCenterTransformed = worldToScreen(center);
  const radiusPoint = { x: center.x + radius, y: center.y };
  const screenRadiusPoint = worldToScreen(radiusPoint);
  const screenRadiusTransformed = Math.abs(screenRadiusPoint.x - screenCenterTransformed.x);
  
  ctx.beginPath();
  ctx.arc(screenCenterTransformed.x, screenCenterTransformed.y, screenRadiusTransformed, 0, Math.PI * 2);
  ctx.stroke();

  // Determine which mode we're in (copy from preview logic)
  const isDiameterMode = ('diameterMode' in entity && entity.diameterMode === true);
  const isTwoPointDiameter = ('twoPointDiameter' in entity && entity.twoPointDiameter === true);

  if (isTwoPointDiameter || isDiameterMode) {
    // Shared diameter line calculation for both modes
    const leftPoint = { x: center.x - radius, y: center.y };
    const rightPoint = { x: center.x + radius, y: center.y };
    const screenLeft = worldToScreen(leftPoint);
    const screenRight = worldToScreen(rightPoint);
    
    // Draw diameter line - dashed for hover, solid for selection
    ctx.beginPath();
    ctx.moveTo(screenLeft.x, screenLeft.y);
    ctx.lineTo(screenRight.x, screenRight.y);
    ctx.stroke();
    
    // Render diameter label based on mode
    const diameter = radius * 2;
    const labelX = screenCenterTransformed.x;
    const labelY = screenCenterTransformed.y - 25;
    
    if (isTwoPointDiameter) {
      const label = `Διάμετρος: ${diameter.toFixed(2)} (2P)`;
      renderMeasurementLabel(ctx, labelX, labelY, label, UI_COLORS.MEASUREMENT_TEXT);
    } else {
      const label = `Διάμετρος: ${diameter.toFixed(2)}`;
      renderMeasurementLabel(ctx, labelX, labelY, label, UI_COLORS.MEASUREMENT_TEXT);
    }
    
  } else {
    // Copy exact logic from preview - radius mode with gap for measurement
    const radiusEndPoint = { x: center.x + radius, y: center.y };
    const screenRadiusEnd = worldToScreen(radiusEndPoint);
    
    // Calculate gap for radius text (same as preview)
    const textGap = Math.max(20, Math.min(60, 30));
    const radiusLength = screenRadiusTransformed;
    const gapStart = screenCenterTransformed.x + (radiusLength - textGap) / 2;
    const gapEnd = screenCenterTransformed.x + (radiusLength + textGap) / 2;
    
    // Draw split radius line (with gap like preview)
    ctx.beginPath();
    ctx.moveTo(screenCenterTransformed.x, screenCenterTransformed.y);
    ctx.lineTo(gapStart, screenCenterTransformed.y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(gapEnd, screenCenterTransformed.y);
    ctx.lineTo(screenRadiusEnd.x, screenRadiusEnd.y);
    ctx.stroke();
    
    // Render radius label in the gap
    const labelX = (gapStart + gapEnd) / 2;
    const labelY = screenCenterTransformed.y;
    const label = `R: ${radius.toFixed(2)}`;
    renderMeasurementLabel(ctx, labelX, labelY, label, '#00ff00');
  }

  ctx.restore();

  // Calculate and display area and circumference (same as preview)
  const area = Math.PI * radius * radius;
  const circumference = 2 * Math.PI * radius;
  
  // Display area and circumference (same positions as preview)
  renderMeasurementLabel(ctx, screenCenterTransformed.x, screenCenterTransformed.y - screenRadiusTransformed / 2, `Εμβαδόν: ${area.toFixed(2)}`, '#00ff00');
  renderMeasurementLabel(ctx, screenCenterTransformed.x, screenCenterTransformed.y + screenRadiusTransformed / 2, `Περιφέρεια: ${circumference.toFixed(2)}`, '#00ff00');
}

export function renderRectangleHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  return; // ⚠️ ΠΡΟΣΩΡΙΝΑ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING κίτρινων grips

  // ✅ PERFORMANCE FIX: Render only dashed lines, skip heavy measurements
  const vertices = entity.vertices as Point2D[];
  if (!vertices || vertices.length < 4) return;
  
  const screenVertices = vertices.map(v => worldToScreen(v));
  
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  
  // Draw simple dashed rectangle without measurements
  drawVerticesPath(ctx, screenVertices, true);
  ctx.stroke();
  ctx.restore();
  
  // ✅ Skip heavy polyline hover with measurements during drag
  // renderPolylineHover({ entity, ctx, worldToScreen }); // Temporarily disabled
}

export function renderArcHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  return; // ⚠️ ΠΡΟΣΩΡΙΝΑ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING κίτρινων grips

  const arcData = validateArcEntity(entity);
  if (!arcData) return;
  
  const { center, radius, startAngle, endAngle } = arcData;
  
  // Draw normal arc
  const screenCenter = worldToScreen(center);
  const screenRadius = radius;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  
  ctx.beginPath();
  ctx.arc(screenCenter.x, screenCenter.y, screenRadius, startRad, endRad, false);
  ctx.stroke();
  
  // Simple arc measurement - radius and arc length
  const arcLength = Math.abs(endRad - startRad) * radius;
  const midRad = (startRad + endRad) / 2;
  const textX = screenCenter.x + Math.cos(midRad) * (screenRadius + HOVER_CONFIG.offsets.textFromArc);
  const textY = screenCenter.y + Math.sin(midRad) * (screenRadius + HOVER_CONFIG.offsets.textFromArc);
  
  ctx.save();
  ctx.fillStyle = HOVER_CONFIG.colors.distance;
  ctx.font = HOVER_CONFIG.fonts.distance;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`L=${arcLength.toFixed(2)}`, textX, textY);
  ctx.restore();
}

export function renderEllipseHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  return; // ⚠️ ΠΡΟΣΩΡΙΝΑ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING κίτρινων grips

  // Simple ellipse - just draw the shape, no complex measurements for now
  const ellipseData = validateEllipseEntity(entity);
  if (!ellipseData) return;
  
  const { center, majorAxis, minorAxis, rotation } = ellipseData;
  
  const screenCenter = worldToScreen(center);
  
  ctx.save();
  ctx.translate(screenCenter.x, screenCenter.y);
  ctx.rotate((rotation * Math.PI) / 180);
  
  ctx.beginPath();
  ctx.ellipse(0, 0, majorAxis, minorAxis, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.restore();
}

