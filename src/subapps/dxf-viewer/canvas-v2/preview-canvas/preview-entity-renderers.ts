/**
 * Preview Entity Renderers — ADR-065 SRP split
 * Per-entity-type canvas rendering functions for drawing previews.
 * Extracted from PreviewRenderer.ts.
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { ExtendedLineEntity, ExtendedCircleEntity, ExtendedPolylineEntity, PreviewPoint } from '../../hooks/drawing/useUnifiedDrawing';
import type { AngleMeasurementEntity } from '../../types/scene';
import type { PreviewRenderOptions, ArcPreviewEntity, PreviewRenderHelpers } from './preview-renderer-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { formatDistance, calculateWorldDistance } from '../../rendering/entities/shared/distance-label-utils';
import { RENDER_LINE_WIDTHS, UI_FONTS, LINE_DASH_PATTERNS, RENDER_GEOMETRY } from '../../config/text-rendering-config';
import { calculateAngle, rectFromTwoPoints } from '../../rendering/entities/shared/geometry-rendering-utils';
import { bisectorAngle, TAU, degToRad } from '../../rendering/entities/shared/geometry-utils';
import { UI_COLORS, OPACITY } from '../../config/color-config';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

// ===== LINE =====

export function renderLine(
  ctx: CanvasRenderingContext2D, entity: ExtendedLineEntity,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const start = CoordinateTransforms.worldToScreen(entity.start, transform, h.viewport);
  const end = CoordinateTransforms.worldToScreen(entity.end, transform, h.viewport);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  if (opts.showGrips) {
    h.renderGrip(ctx, start, opts);
    h.renderGrip(ctx, end, opts);
  }

  if (entity.measurement || entity.showEdgeDistances) {
    h.renderDistanceLabelFromWorld(ctx, entity.start, entity.end, start, end);
  }
}

// ===== CIRCLE =====

export function renderCircle(
  ctx: CanvasRenderingContext2D, entity: ExtendedCircleEntity,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const center = CoordinateTransforms.worldToScreen(entity.center, transform, h.viewport);
  const radiusScreen = entity.radius * transform.scale;

  ctx.beginPath();
  ctx.ellipse(center.x, center.y, radiusScreen, radiusScreen, 0, 0, TAU);
  ctx.stroke();

  if (opts.showGrips) h.renderGrip(ctx, center, opts);

  if (entity.showPreviewMeasurements && entity.radius > 0) {
    const radius = entity.radius;
    const radiusEndWorld: Point2D = { x: entity.center.x + radius, y: entity.center.y };
    const radiusEndScreen = CoordinateTransforms.worldToScreen(radiusEndWorld, transform, h.viewport);
    h.renderDistanceLabelFromWorld(ctx, entity.center, radiusEndWorld, center, radiusEndScreen);

    const circumference = TAU * radius;
    const area = Math.PI * radius * radius;
    h.renderInfoLabel(ctx, center, [
      `Περ: ${formatDistance(circumference)}`,
      `Ε: ${formatDistance(area)}`,
    ]);
  }
}

// ===== POLYLINE =====

export function renderPolyline(
  ctx: CanvasRenderingContext2D, entity: ExtendedPolylineEntity,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  if (!entity.vertices || entity.vertices.length < 2) return;

  const screenPoints = entity.vertices.map(v => CoordinateTransforms.worldToScreen(v, transform, h.viewport));

  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  if (entity.closed) ctx.closePath();
  ctx.stroke();

  if (opts.showGrips) {
    for (const pt of screenPoints) h.renderGrip(ctx, pt, opts);
  }

  if (entity.showEdgeDistances) {
    for (let i = 1; i < screenPoints.length; i++) {
      h.renderDistanceLabelFromWorld(ctx, entity.vertices[i - 1], entity.vertices[i], screenPoints[i - 1], screenPoints[i]);
    }

    if (entity.vertices.length >= 3) {
      const verts = entity.vertices;
      let perimeter = 0;
      for (let i = 1; i < verts.length; i++) perimeter += calculateWorldDistance(verts[i - 1], verts[i]);
      perimeter += calculateWorldDistance(verts[verts.length - 1], verts[0]);

      let area = 0;
      for (let i = 0; i < verts.length; i++) {
        const j = (i + 1) % verts.length;
        area += verts[i].x * verts[j].y;
        area -= verts[j].x * verts[i].y;
      }
      area = Math.abs(area) / 2;

      const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
      const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
      const centroidScreen = CoordinateTransforms.worldToScreen({ x: cx, y: cy }, transform, h.viewport);
      h.renderInfoLabel(ctx, centroidScreen, [
        `Περ: ${formatDistance(perimeter)}`,
        `Ε: ${formatDistance(area)}`,
      ]);
    }
  }
}

// ===== RECTANGLE =====

export function renderRectangle(
  ctx: CanvasRenderingContext2D,
  entity: { corner1?: Point2D; corner2?: Point2D; showPreviewMeasurements?: boolean },
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  if (!entity.corner1 || !entity.corner2) return;

  const c1 = CoordinateTransforms.worldToScreen(entity.corner1, transform, h.viewport);
  const c2 = CoordinateTransforms.worldToScreen(entity.corner2, transform, h.viewport);
  const { x, y, width, height } = rectFromTwoPoints(c1, c2);

  ctx.strokeRect(x, y, width, height);

  if (opts.showGrips) {
    h.renderGrip(ctx, { x, y }, opts);
    h.renderGrip(ctx, { x: x + width, y }, opts);
    h.renderGrip(ctx, { x, y: y + height }, opts);
    h.renderGrip(ctx, { x: x + width, y: y + height }, opts);
  }

  if (entity.showPreviewMeasurements) {
    const wc1 = entity.corner1;
    const wc2 = entity.corner2;
    const topRight: Point2D = { x: wc2.x, y: wc1.y };
    const bottomLeft: Point2D = { x: wc1.x, y: wc2.y };
    const screenTopRight = CoordinateTransforms.worldToScreen(topRight, transform, h.viewport);
    const screenBottomLeft = CoordinateTransforms.worldToScreen(bottomLeft, transform, h.viewport);

    h.renderDistanceLabelFromWorld(ctx, wc1, topRight, c1, screenTopRight);
    h.renderDistanceLabelFromWorld(ctx, wc1, bottomLeft, c1, screenBottomLeft);

    const worldWidth = calculateWorldDistance(wc1, topRight);
    const worldHeight = calculateWorldDistance(wc1, bottomLeft);
    const perimeter = 2 * (worldWidth + worldHeight);
    const area = worldWidth * worldHeight;
    const centerScreen: Point2D = { x: x + width / 2, y: y + height / 2 };
    h.renderInfoLabel(ctx, centerScreen, [
      `Περ: ${formatDistance(perimeter)}`,
      `Ε: ${formatDistance(area)}`,
    ]);
  }
}

// ===== ANGLE MEASUREMENT =====

export function renderAngleMeasurement(
  ctx: CanvasRenderingContext2D,
  entity: { vertex: Point2D; point1: Point2D; point2: Point2D; angle: number },
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const screenVertex = CoordinateTransforms.worldToScreen(entity.vertex, transform, h.viewport);
  const screenPoint1 = CoordinateTransforms.worldToScreen(entity.point1, transform, h.viewport);
  const screenPoint2 = CoordinateTransforms.worldToScreen(entity.point2, transform, h.viewport);

  ctx.beginPath();
  ctx.moveTo(screenVertex.x, screenVertex.y);
  ctx.lineTo(screenPoint1.x, screenPoint1.y);
  ctx.moveTo(screenVertex.x, screenVertex.y);
  ctx.lineTo(screenPoint2.x, screenPoint2.y);
  ctx.stroke();

  const arcRadius = RENDER_GEOMETRY.ANGLE_ARC_RADIUS;
  const angle1 = calculateAngle(entity.vertex, entity.point1);
  const angle2 = calculateAngle(entity.vertex, entity.point2);

  ctx.save();
  ctx.strokeStyle = UI_COLORS.PREVIEW_ARC_ORANGE;
  ctx.setLineDash([...LINE_DASH_PATTERNS.DASHED]);
  ctx.beginPath();
  ctx.ellipse(screenVertex.x, screenVertex.y, arcRadius, arcRadius, 0, angle1, angle2, false);
  ctx.stroke();
  ctx.restore();

  if (opts.showGrips) {
    h.renderGrip(ctx, screenVertex, opts);
    h.renderGrip(ctx, screenPoint1, opts);
    h.renderGrip(ctx, screenPoint2, opts);
  }

  if (entity.vertex && entity.point1) h.renderDistanceLabelFromWorld(ctx, entity.vertex, entity.point1, screenVertex, screenPoint1);
  if (entity.vertex && entity.point2) h.renderDistanceLabelFromWorld(ctx, entity.vertex, entity.point2, screenVertex, screenPoint2);

  const bisectorAngleValue = bisectorAngle(angle1, angle2);
  const textDistance = RENDER_GEOMETRY.ANGLE_TEXT_DISTANCE;
  const textX = screenVertex.x + Math.cos(bisectorAngleValue) * textDistance;
  const textY = screenVertex.y + Math.sin(bisectorAngleValue) * textDistance;

  ctx.save();
  ctx.fillStyle = UI_COLORS.DIMENSION_TEXT;
  ctx.font = UI_FONTS.ARIAL.LARGE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${entity.angle.toFixed(1)}°`, textX, textY);
  ctx.restore();
}

// ===== POINT =====

export function renderPoint(
  ctx: CanvasRenderingContext2D, entity: PreviewPoint,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const pos = CoordinateTransforms.worldToScreen(entity.position, transform, h.viewport);
  h.renderGrip(ctx, pos, opts);
}

// ===== ARC =====

export function renderArc(
  ctx: CanvasRenderingContext2D, entity: ArcPreviewEntity,
  transform: ViewTransform, opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const center = CoordinateTransforms.worldToScreen(entity.center, transform, h.viewport);
  const radiusScreen = entity.radius * transform.scale;
  const startRad = degToRad(entity.startAngle);
  const endRad = degToRad(entity.endAngle);

  // Construction lines (rubber band)
  if (entity.showConstructionLines && entity.constructionVertices && entity.constructionVertices.length >= 2) {
    ctx.save();
    ctx.setLineDash([...LINE_DASH_PATTERNS.CONSTRUCTION]);
    ctx.strokeStyle = PANEL_LAYOUT.CAD_COLORS.CONSTRUCTION_LINE || opts.color;
    ctx.lineWidth = RENDER_LINE_WIDTHS.PREVIEW_CONSTRUCTION || 1;
    ctx.globalAlpha = OPACITY.MEDIUM;

    const screenVertices = entity.constructionVertices.map(v => CoordinateTransforms.worldToScreen(v, transform, h.viewport));
    const mode = entity.constructionLineMode || 'polyline';

    if (mode === 'radial') {
      renderArcRadialConstruction(ctx, entity, center, transform, opts, h);
    } else {
      renderArcPolylineConstruction(ctx, entity, screenVertices, opts, h);
    }
    ctx.restore();
  }

  // Arc shape (solid)
  const screenStartRad = -startRad;
  const screenEndRad = -endRad;
  const screenCounterclockwise = !(entity.counterclockwise ?? false);

  ctx.beginPath();
  ctx.ellipse(center.x, center.y, radiusScreen, radiusScreen, 0, screenStartRad, screenEndRad, screenCounterclockwise);
  ctx.stroke();

  if (opts.showGrips) h.renderGrip(ctx, center, opts);

  // Arc measurements
  if (entity.radius > 0) {
    let sweepRad = endRad - startRad;
    if (entity.counterclockwise) { if (sweepRad <= 0) sweepRad += TAU; }
    else { if (sweepRad >= 0) sweepRad -= TAU; }
    const absSweep = Math.abs(sweepRad);

    if (absSweep > 0.001) {
      const arcLength = entity.radius * absSweep;
      const sectorArea = 0.5 * entity.radius * entity.radius * absSweep;
      h.renderInfoLabel(ctx, center, [
        `L: ${formatDistance(arcLength)}`,
        `Ε: ${formatDistance(sectorArea)}`,
      ]);
    }
  }
}

// ===== ARC CONSTRUCTION HELPERS =====

function renderArcRadialConstruction(
  ctx: CanvasRenderingContext2D, entity: ArcPreviewEntity,
  centerScreen: Point2D, transform: ViewTransform,
  opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  const startAngleRad = degToRad(entity.startAngle);
  const endAngleRad = degToRad(entity.endAngle);

  const startPointWorld: Point2D = {
    x: entity.center.x + Math.cos(startAngleRad) * entity.radius,
    y: entity.center.y + Math.sin(startAngleRad) * entity.radius,
  };
  const endPointWorld: Point2D = {
    x: entity.center.x + Math.cos(endAngleRad) * entity.radius,
    y: entity.center.y + Math.sin(endAngleRad) * entity.radius,
  };

  const startPointScreen = CoordinateTransforms.worldToScreen(startPointWorld, transform, h.viewport);
  const endPointScreen = CoordinateTransforms.worldToScreen(endPointWorld, transform, h.viewport);

  ctx.beginPath();
  ctx.moveTo(centerScreen.x, centerScreen.y);
  ctx.lineTo(startPointScreen.x, startPointScreen.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerScreen.x, centerScreen.y);
  ctx.lineTo(endPointScreen.x, endPointScreen.y);
  ctx.stroke();

  if (opts.showGrips) {
    h.renderGrip(ctx, centerScreen, opts);
    h.renderGrip(ctx, startPointScreen, opts);
    h.renderGrip(ctx, endPointScreen, opts);
  }

  if (entity.showEdgeDistances) {
    h.renderDistanceLabelFromWorld(ctx, entity.center, startPointWorld, centerScreen, startPointScreen);
  }
}

function renderArcPolylineConstruction(
  ctx: CanvasRenderingContext2D, entity: ArcPreviewEntity,
  screenVertices: Point2D[], opts: Required<PreviewRenderOptions>, h: PreviewRenderHelpers,
): void {
  ctx.beginPath();
  ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
  for (let i = 1; i < screenVertices.length; i++) {
    ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
  }
  ctx.stroke();

  if (opts.showGrips) {
    for (const sv of screenVertices) h.renderGrip(ctx, sv, opts);
  }

  if (entity.showEdgeDistances && entity.constructionVertices) {
    for (let i = 0; i < entity.constructionVertices.length - 1; i++) {
      h.renderDistanceLabelFromWorld(
        ctx, entity.constructionVertices[i], entity.constructionVertices[i + 1],
        screenVertices[i], screenVertices[i + 1]
      );
    }
  }
}
