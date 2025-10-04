/**
 * Geometry rendering utilities  
 * Consolidates duplicate geometric calculation and rendering patterns
 */

import type { Point2D } from '../../../systems/rulers-grid/config';
import type { EntityModel } from '../../../types/renderer';
import { UI_COLORS } from '../../../config/color-config';
import { renderStyledText } from '../../../hooks/useTextPreviewStyle';

/**
 * Extract and validate angle measurement points from entity
 */
export function extractAngleMeasurementPoints(entity: EntityModel): {
  vertex: Point2D;
  point1: Point2D;
  point2: Point2D;
  angle: number;
} | null {
  const vertex = entity.vertex as Point2D;
  const point1 = entity.point1 as Point2D;
  const point2 = entity.point2 as Point2D;
  const angle = entity.angle as number;
  
  if (!vertex || !point1 || !point2) return null;
  
  return { vertex, point1, point2, angle };
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(point1: Point2D, point2: Point2D): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate midpoint between two points
 */
export function calculateMidpoint(point1: Point2D, point2: Point2D): Point2D {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2
  };
}

/**
 * Calculate angle between two points (in radians)
 */
export function calculateAngle(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Rotate a point around another point
 */
export function rotatePoint(point: Point2D, center: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  
  return {
    x: center.x + (dx * cos - dy * sin),
    y: center.y + (dx * sin + dy * cos)
  };
}

/**
 * Calculate perpendicular direction vector
 */
export function getPerpendicularDirection(from: Point2D, to: Point2D, normalize = true): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  // Perpendicular vector is (-dy, dx)
  let perpX = -dy;
  let perpY = dx;
  
  if (normalize) {
    const length = Math.sqrt(perpX * perpX + perpY * perpY);
    if (length > 0) {
      perpX /= length;
      perpY /= length;
    }
  }
  
  return { x: perpX, y: perpY };
}

/**
 * Check if entity should be rendered with specific styling
 */
export function shouldApplySpecialRendering(entity: EntityModel, renderMode: string): boolean {
  return (entity as any)?.[renderMode] === true;
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
    ctx.rotate((rotation * Math.PI) / 180);
  }
  callback();
  ctx.restore();
}

/**
 * Draw a path through vertices - eliminates duplicate path drawing code
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
 * Render measurement label - eliminates duplicate label rendering
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
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  renderStyledText(ctx, text, x, y);
  ctx.restore();
}

/**
 * Generate edge midpoints from vertices array - eliminates duplicate midpoint logic
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
 * Calculate line bounds - eliminates duplicate line bounds calculation
 */
export function calculateLineBounds(start: Point2D, end: Point2D) {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y)
  };
}

/**
 * Get all line segments of a polyline - eliminates duplicate segment extraction
 */
export function getPolylineSegments(points: Point2D[], isClosed: boolean): Array<{start: Point2D, end: Point2D}> {
  const segments: Array<{start: Point2D, end: Point2D}> = [];
  
  for (let i = 1; i < points.length; i++) {
    segments.push({start: points[i-1], end: points[i]});
  }
  
  // Add closing segment if closed
  if (isClosed && points.length > 2) {
    segments.push({start: points[points.length - 1], end: points[0]});
  }
  
  return segments;
}

/**
 * Render a square grip at specified position - eliminates duplicate grip rendering
 */
export function renderSquareGrip(
  ctx: CanvasRenderingContext2D,
  position: Point2D,
  size: number = 8,
  fillColor: string = UI_COLORS.GRIP_DEFAULT,
  strokeColor: string = '#000'
): void {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;

  ctx.fillRect(position.x - size/2, position.y - size/2, size, size);
  ctx.strokeRect(position.x - size/2, position.y - size/2, size, size);
  ctx.restore();
}

/**
 * Base Configuration Manager pattern - eliminates duplicate listener management
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