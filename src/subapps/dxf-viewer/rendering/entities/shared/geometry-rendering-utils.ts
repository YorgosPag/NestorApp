/**
 * Geometry rendering utilities  
 * Consolidates duplicate geometric calculation and rendering patterns
 */

import type { Point2D } from '../../types/Types';
// ✅ ENTERPRISE FIX: Import AngleMeasurementEntity from entities
import type { AngleMeasurementEntity } from '../../../types/entities';
import type { EntityModel } from '../../types/Types';
import { UI_COLORS } from '../../../config/color-config';
import { renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';
// 🏢 ADR-042: Centralized UI Fonts, ADR-044: Centralized Line Widths
import { UI_FONTS, RENDER_LINE_WIDTHS } from '../../../config/text-rendering-config';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { degToRad } from './geometry-utils';

/**
 * Extract and validate angle measurement points from entity
 */
export function extractAngleMeasurementPoints(entity: EntityModel): {
  vertex: Point2D;
  point1: Point2D;
  point2: Point2D;
  angle: number;
} | null {
  // ✅ ENTERPRISE: Type guard for angle measurement entity
  if (entity.type !== 'angle-measurement') return null;

  const angleEntity = entity as AngleMeasurementEntity;
  const vertex = angleEntity.vertex;
  const point1 = angleEntity.point1;
  const point2 = angleEntity.point2;
  const angle = angleEntity.angle;
  
  if (!vertex || !point1 || !point2) return null;
  
  return { vertex, point1, point2, angle };
}

/**
 * Calculate distance between two points
 * ✅ CENTRALIZED: Single source of truth για distance calculation
 * Used by: snap engines, grips, drawing hooks, hit testing
 */
export function calculateDistance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ===== VECTOR MAGNITUDE =====
// 🏢 ADR-070: Centralized Vector Magnitude (2026-01-31)

/**
 * Calculate the magnitude (length) of a 2D vector
 * ✅ CENTRALIZED: Single source of truth για vector magnitude calculation
 * Used for: vector normalization, side lengths, bisector calculations
 *
 * NOTE: This differs from calculateDistance():
 * - calculateDistance(p1, p2): Distance between 2 Point2D → Math.sqrt((p2.x-p1.x)² + (p2.y-p1.y)²)
 * - vectorMagnitude(v): Length of 1 vector → Math.sqrt(v.x² + v.y²)
 *
 * @param vector - A 2D vector represented as Point2D (x, y components)
 * @returns The magnitude (length) of the vector
 *
 * @example
 * const side = { x: p2.x - p1.x, y: p2.y - p1.y };
 * const length = vectorMagnitude(side);
 */
export function vectorMagnitude(vector: Point2D): number {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
}

// ===== VECTOR NORMALIZATION =====
// 🏢 ADR-065: Centralized Vector Operations (2026-01-31)

/**
 * Normalize a vector to unit length
 * ✅ CENTRALIZED: Single source of truth for vector normalization
 * Used for: unit vectors, direction calculations, perpendicular vectors
 *
 * @param vector - A 2D vector represented as Point2D
 * @returns Unit vector (length = 1) or zero vector if input length is 0
 *
 * @example
 * const direction = { x: dx, y: dy };
 * const unit = normalizeVector(direction); // unit.x² + unit.y² ≈ 1
 */
export function normalizeVector(vector: Point2D): Point2D {
  const length = vectorMagnitude(vector);
  if (length === 0) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

/**
 * Calculate unit vector from one point to another
 * ✅ CENTRALIZED: Single source of truth for point-to-point unit vector
 * Used for: line direction, drawing helpers, measurement calculations
 *
 * @param from - Start point
 * @param to - End point
 * @returns Unit vector pointing from 'from' to 'to'
 *
 * @example
 * const unit = getUnitVector(lineStart, lineEnd);
 * // Use: unit.x, unit.y instead of unitX, unitY
 */
export function getUnitVector(from: Point2D, to: Point2D): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return normalizeVector({ x: dx, y: dy });
}

/**
 * Get perpendicular unit vector (rotated 90° counter-clockwise)
 * ✅ CENTRALIZED: Single source of truth for perpendicular unit vector
 * Used for: text offset positioning, dimension lines, marker placement
 *
 * Mathematical note: For vector (x, y), perpendicular is (-y, x)
 *
 * @param from - Start point of the line
 * @param to - End point of the line
 * @returns Perpendicular unit vector (rotated 90° CCW from direction)
 *
 * @example
 * const perp = getPerpendicularUnitVector(start, end);
 * const offsetPoint = { x: mid.x + perp.x * offset, y: mid.y + perp.y * offset };
 */
export function getPerpendicularUnitVector(from: Point2D, to: Point2D): Point2D {
  const unit = getUnitVector(from, to);
  return { x: -unit.y, y: unit.x };
}

// ===== DOT PRODUCT =====
// 🏢 ADR-072: Centralized Dot Product (2026-01-31)

/**
 * Calculate the dot product of two 2D vectors
 * ✅ CENTRALIZED: Single source of truth για dot product calculation
 * Used for: angle calculations, perpendicularity checks, projections
 *
 * Mathematical properties:
 * - v1 · v2 = |v1| * |v2| * cos(θ)
 * - If dot = 0, vectors are perpendicular
 * - If dot > 0, angle < 90°
 * - If dot < 0, angle > 90°
 *
 * @param v1 - First vector as Point2D
 * @param v2 - Second vector as Point2D
 * @returns The dot product (scalar value)
 *
 * @example
 * const dot = dotProduct(side1, side2);
 * if (Math.abs(dot) < tolerance) {
 *   // Vectors are perpendicular
 * }
 */
export function dotProduct(v1: Point2D, v2: Point2D): number {
  return v1.x * v2.x + v1.y * v2.y;
}

// ===== POINT ON CIRCLE =====
// 🏢 ADR-074: Centralized Point On Circle (2026-01-31)

/**
 * Calculate a point on a circle circumference given center, radius, and angle
 * ✅ CENTRALIZED: Single source of truth for polar-to-cartesian conversion
 * Used for: arc endpoints, grip positions, circle sampling, tessellation
 *
 * Mathematical formula:
 * - x = center.x + radius * cos(angle)
 * - y = center.y + radius * sin(angle)
 *
 * @param center - Circle center point
 * @param radius - Circle radius
 * @param angle - Angle in radians (0 = right, π/2 = up, π = left, 3π/2 = down)
 * @returns Point on the circle at the given angle
 *
 * @example
 * const startPoint = pointOnCircle(center, radius, startAngleRad);
 * const endPoint = pointOnCircle(center, radius, endAngleRad);
 */
export function pointOnCircle(center: Point2D, radius: number, angle: number): Point2D {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle)
  };
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

// ===== VECTOR ANGLE =====
// 🏢 ADR-078: Centralized Vector Angle (2026-01-31)

/**
 * Calculate the angle of a 2D vector from the positive X-axis (in radians)
 * ✅ CENTRALIZED: Single source of truth for vector angle calculation
 * Used for: unit vector angles, direction calculations, arc drawing
 *
 * Mathematical formula: atan2(y, x) → angle in radians [-π, π]
 *
 * NOTE: This differs from calculateAngle():
 * - calculateAngle(from, to): Angle between 2 Point2D → direction from 'from' to 'to'
 * - vectorAngle(v): Angle of a single vector from origin → direction of vector itself
 *
 * @param vector - A 2D vector represented as Point2D (x, y components)
 * @returns Angle in radians from positive X-axis, range [-π, π]
 *
 * @example
 * const prevUnit = { x: dx / len, y: dy / len };
 * const angle = vectorAngle(prevUnit); // Direction angle of unit vector
 */
export function vectorAngle(vector: Point2D): number {
  return Math.atan2(vector.y, vector.x);
}

// ===== ANGLE BETWEEN VECTORS =====
// 🏢 ADR-078: Centralized Angle Between Vectors (2026-01-31)

/**
 * Calculate the signed angle between two 2D vectors (in radians)
 * ✅ CENTRALIZED: Single source of truth for angle-between-vectors calculation
 * Used for: angle measurements, rotation calculations, polygon angle detection
 *
 * Mathematical formula: atan2(cross, dot) where:
 * - dot = v1·v2 = v1.x*v2.x + v1.y*v2.y (scalar product)
 * - cross = v1×v2 = v1.x*v2.y - v1.y*v2.x (determinant / signed area)
 *
 * Result properties:
 * - Positive angle: v2 is counter-clockwise from v1
 * - Negative angle: v2 is clockwise from v1
 * - Range: [-π, π] radians
 *
 * @param v1 - First vector as Point2D
 * @param v2 - Second vector as Point2D
 * @returns Signed angle in radians between the vectors
 *
 * @example
 * const vector1 = { x: point1.x - vertex.x, y: point1.y - vertex.y };
 * const vector2 = { x: point2.x - vertex.x, y: point2.y - vertex.y };
 * const angleRad = angleBetweenVectors(vector1, vector2);
 */
export function angleBetweenVectors(v1: Point2D, v2: Point2D): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = v1.x * v2.y - v1.y * v2.x;
  return Math.atan2(cross, dot);
}

// ============================================================================
// 🏢 ENTERPRISE NOTE (2026-01-26): Polygon Calculations Centralized
// ============================================================================
// The following functions are available from geometry-utils.ts (Single Source of Truth):
// - calculatePolygonArea()
// - calculatePolylineLength()
// - calculatePolygonPerimeter()
// - calculatePolygonCentroid()
//
// Import from: './geometry-utils' for polygon calculations
// This file focuses on RENDERING utilities (canvas operations, grips, labels)
// ============================================================================

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
  // ✅ ENTERPRISE FIX: Safe property access with type guard
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
    // 🏢 ADR-067: Use centralized angle conversion
    ctx.rotate(degToRad(rotation));
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
  ctx.font = UI_FONTS.ARIAL.SMALL; // 🏢 ADR-042: Centralized UI Font
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  renderStyledTextWithOverride(ctx, text, x, y);
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

// ===== RECTANGLE BOUNDS =====
// 🏢 ADR-080: Rectangle Bounds Centralization (2026-01-31)

/**
 * Rectangle bounds interface for bounding box calculations
 * Used by: zoom window, selection marquee, ghost rendering, preview rendering
 */
export interface RectBounds {
  x: number;      // Math.min(p1.x, p2.x)
  y: number;      // Math.min(p1.y, p2.y)
  width: number;  // Math.abs(p2.x - p1.x)
  height: number; // Math.abs(p2.y - p1.y)
}

/**
 * Calculate rectangle bounds from two corner points
 * ✅ CENTRALIZED: Single source of truth για bounding box calculation
 * Used by: zoom window, selection marquee, ghost rendering, preview rendering
 *
 * Mathematical formula:
 * - x = Math.min(p1.x, p2.x)
 * - y = Math.min(p1.y, p2.y)
 * - width = Math.abs(p2.x - p1.x)
 * - height = Math.abs(p2.y - p1.y)
 *
 * @param p1 - First corner point
 * @param p2 - Second corner point (opposite corner)
 * @returns RectBounds with x, y, width, height
 *
 * @example
 * const { x, y, width, height } = rectFromTwoPoints(corner1, corner2);
 * ctx.strokeRect(x, y, width, height);
 *
 * @example
 * const { x: left, y: top, width, height } = rectFromTwoPoints(startPoint, currentPoint);
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
  strokeColor: string = UI_COLORS.BLACK
): void {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = RENDER_LINE_WIDTHS.GRIP_OUTLINE; // 🏢 ADR-044

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