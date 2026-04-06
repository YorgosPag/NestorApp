/**
 * Geometry rendering utilities
 * Consolidates duplicate geometric calculation and rendering patterns
 *
 * Split: ADR-065 — Pure math extracted to geometry-vector-utils.ts
 */

import type { Point2D } from '../../types/Types';

// ===== PIXEL-PERFECT RENDERING =====
// ADR-088: Centralized Pixel-Perfect Alignment

/**
 * Rounds a coordinate and adds 0.5 for crisp 1px canvas lines.
 * Canvas coordinates are at pixel CENTER — +0.5 places line exactly on pixel boundary.
 */
export function pixelPerfect(value: number): number {
  return Math.round(value) + 0.5;
}

/**
 * Applies pixel-perfect alignment to a Point2D.
 */
export function pixelPerfectPoint(point: Point2D): Point2D {
  return {
    x: Math.round(point.x) + 0.5,
    y: Math.round(point.y) + 0.5
  };
}

import type { AngleMeasurementEntity, Entity } from '../../../types/entities';
import { isAngleMeasurementEntity } from '../../../types/entities';
import type { EntityModel } from '../../types/Types';
import { UI_COLORS } from '../../../config/color-config';
import { renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';
import { UI_FONTS, RENDER_LINE_WIDTHS } from '../../../config/text-rendering-config';
import { degToRad, clamp } from './geometry-utils';

// ===== RE-EXPORTS from geometry-vector-utils.ts (ADR-065 split) =====
// Backward compatibility — all vector/math exports available from this module
export {
  calculateDistance,
  squaredDistance,
  vectorMagnitude,
  normalizeVector,
  getUnitVector,
  getPerpendicularUnitVector,
  dotProduct,
  pointOnCircle,
  subtractPoints,
  addPoints,
  scalePoint,
  offsetPoint,
  calculateMidpoint,
  calculateAngle,
  vectorAngle,
  angleBetweenVectors,
  rotatePoint,
  getPerpendicularDirection,
} from './geometry-vector-utils';

// ===== ENTITY UTILITIES =====

/**
 * Extract and validate angle measurement points from entity
 */
export function extractAngleMeasurementPoints(entity: EntityModel): {
  vertex: Point2D;
  point1: Point2D;
  point2: Point2D;
  angle: number;
} | null {
  if (!isAngleMeasurementEntity(entity as Entity)) return null;

  const angleEntity = entity as AngleMeasurementEntity;
  const vertex = angleEntity.vertex;
  const point1 = angleEntity.point1;
  const point2 = angleEntity.point2;
  const angle = angleEntity.angle;

  if (!vertex || !point1 || !point2) return null;

  return { vertex, point1, point2, angle };
}

// ============================================================================
// NOTE: Polygon calculations available from geometry-utils.ts (SSoT):
// - calculatePolygonArea(), calculatePolylineLength()
// - calculatePolygonPerimeter(), calculatePolygonCentroid()
// ============================================================================

/**
 * Check if entity should be rendered with specific styling
 */
export function shouldApplySpecialRendering(entity: EntityModel, renderMode: string): boolean {
  return (renderMode in entity && (entity as unknown as Record<string, unknown>)[renderMode] === true);
}

/**
 * Apply common transformation for rendering
 */
export function applyRenderingTransform(
  ctx: CanvasRenderingContext2D,
  screenCenter: Point2D,
  rotation: number,
  callback: () => void
): void {
  ctx.save();
  ctx.translate(screenCenter.x, screenCenter.y);
  if (rotation !== 0) {
    ctx.rotate(degToRad(rotation));
  }
  callback();
  ctx.restore();
}

/**
 * Draw a path through vertices
 */
export function drawVerticesPath(
  ctx: CanvasRenderingContext2D,
  screenVertices: Point2D[],
  closed = false
): void {
  if (screenVertices.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(screenVertices[0].x, screenVertices[0].y);

  for (let i = 1; i < screenVertices.length; i++) {
    ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
  }

  if (closed) {
    ctx.closePath();
  }
}

/**
 * Render measurement label
 */
export function renderMeasurementLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string = UI_COLORS.MEASUREMENT_TEXT
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = UI_FONTS.ARIAL.SMALL;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  renderStyledTextWithOverride(ctx, text, x, y);
  ctx.restore();
}

/**
 * Generate edge midpoints from vertices array
 */
export function generateEdgeMidpoints(vertices: Point2D[]): Point2D[] {
  const midpoints: Point2D[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const next = (i + 1) % vertices.length;
    const midpoint = {
      x: (vertices[i].x + vertices[next].x) / 2,
      y: (vertices[i].y + vertices[next].y) / 2
    };
    midpoints.push(midpoint);
  }
  return midpoints;
}

/**
 * Calculate line bounds
 */
export function calculateLineBounds(start: Point2D, end: Point2D) {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y)
  };
}

// ===== RECTANGLE BOUNDS =====
// ADR-080: Rectangle Bounds Centralization

/**
 * Rectangle bounds interface for bounding box calculations.
 * Used by: zoom window, selection marquee, ghost rendering, preview rendering.
 */
export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate rectangle bounds from two corner points.
 */
export function rectFromTwoPoints(p1: Point2D, p2: Point2D): RectBounds {
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y)
  };
}

/**
 * Get all line segments of a polyline
 */
export function getPolylineSegments(points: Point2D[], isClosed: boolean): Array<{ start: Point2D; end: Point2D }> {
  const segments: Array<{ start: Point2D; end: Point2D }> = [];

  for (let i = 1; i < points.length; i++) {
    segments.push({ start: points[i - 1], end: points[i] });
  }

  if (isClosed && points.length > 2) {
    segments.push({ start: points[points.length - 1], end: points[0] });
  }

  return segments;
}

/**
 * Render a square grip at specified position
 */
export function renderSquareGrip(
  ctx: CanvasRenderingContext2D,
  position: Point2D,
  size: number = 8,
  fillColor: string = UI_COLORS.GRIP_DEFAULT,
  strokeColor: string = UI_COLORS.BLACK
): void {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = RENDER_LINE_WIDTHS.GRIP_OUTLINE;

  ctx.fillRect(position.x - size / 2, position.y - size / 2, size, size);
  ctx.strokeRect(position.x - size / 2, position.y - size / 2, size, size);
  ctx.restore();
}

/**
 * Base Configuration Manager pattern — eliminates duplicate listener management
 */
export class BaseConfigurationManager<T> {
  protected listeners = new Set<(settings: T) => void>();

  subscribe(listener: (settings: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected notifyListeners(settings: T): void {
    this.listeners.forEach(listener => listener(settings));
  }
}

// ===== TEXT GAP CALCULATION =====
// ADR-124: Centralized Text Gap Calculation

const TEXT_GAP_CONFIG = {
  BASE: 30,
  MIN: 20,
  MAX: 60,
} as const;

/**
 * Calculate scale-aware text gap for measurement labels.
 * Formula: clamp(BASE * scale, MIN, MAX)
 */
export function calculateTextGap(scale: number): number {
  return clamp(TEXT_GAP_CONFIG.BASE * scale, TEXT_GAP_CONFIG.MIN, TEXT_GAP_CONFIG.MAX);
}
