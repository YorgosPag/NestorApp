/**
 * 🎯 SPATIAL UTILITIES
 * Centralized utility functions για spatial operations
 * Χρησιμοποιείται από όλα τα spatial index implementations
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SpatialBounds } from './ISpatialIndex';
// 🏢 ADR-071: Centralized clamp function
import { clamp } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-070: Centralized Vector Magnitude
import { vectorMagnitude } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-034: Centralized Empty Spatial Bounds
import { EMPTY_SPATIAL_BOUNDS } from '../../config/geometry-constants';
// 🏢 ADR-034: Centralized Validation Bounds
import { SPATIAL_BOUNDS } from '../../config/validation-bounds-config';

/**
 * 🔧 BOUNDS OPERATIONS
 * Core functions για spatial bounds calculations
 */
export class SpatialUtils {

  /**
   * Create bounds from array of points
   */
  static boundsFromPoints(points: Point2D[]): SpatialBounds {
    if (points.length === 0) {
      // 🏢 ADR-034: Centralized Empty Spatial Bounds
      return EMPTY_SPATIAL_BOUNDS;
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Test if two bounds intersect
   */
  static boundsIntersect(a: SpatialBounds, b: SpatialBounds): boolean {
    return !(
      a.maxX < b.minX ||
      a.minX > b.maxX ||
      a.maxY < b.minY ||
      a.minY > b.maxY
    );
  }

  /**
   * Test if bounds A contains bounds B completely
   */
  static boundsContains(container: SpatialBounds, contained: SpatialBounds): boolean {
    return (
      container.minX <= contained.minX &&
      container.minY <= contained.minY &&
      container.maxX >= contained.maxX &&
      container.maxY >= contained.maxY
    );
  }

  /**
   * Test if point is inside bounds (SpatialBounds format)
   * 🏢 ADR-089: Centralized Point-In-Bounds (2026-01-31)
   * ✅ CANONICAL: Single source of truth for bounds checking
   */
  static pointInBounds(point: Point2D, bounds: SpatialBounds): boolean {
    return (
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY
    );
  }

  /**
   * Test if point is inside rect (min/max Point2D format)
   * 🏢 ADR-089: Centralized Point-In-Bounds (2026-01-31)
   * ✅ NEW: For { min: Point2D, max: Point2D } format
   * Used by: selection marquee, rendering bounds checks
   */
  static pointInRect(point: Point2D, rect: { min: Point2D; max: Point2D }): boolean {
    return (
      point.x >= rect.min.x &&
      point.x <= rect.max.x &&
      point.y >= rect.min.y &&
      point.y <= rect.max.y
    );
  }

  /**
   * Calculate distance from point to bounds
   * Returns 0 if point is inside bounds
   */
  static distanceToPoint(point: Point2D, bounds: SpatialBounds): number {
    const dx = Math.max(0, Math.max(bounds.minX - point.x, point.x - bounds.maxX));
    const dy = Math.max(0, Math.max(bounds.minY - point.y, point.y - bounds.maxY));
    // 🏢 ADR-070: Use centralized vector magnitude
    return vectorMagnitude({ x: dx, y: dy });
  }

  /**
   * Expand bounds by margin in all directions
   */
  static expandBounds(bounds: SpatialBounds, margin: number): SpatialBounds {
    return {
      minX: bounds.minX - margin,
      minY: bounds.minY - margin,
      maxX: bounds.maxX + margin,
      maxY: bounds.maxY + margin
    };
  }

  /**
   * Calculate center point of bounds
   */
  static boundsCenter(bounds: SpatialBounds): Point2D {
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    };
  }

  /**
   * Calculate area of bounds
   */
  static boundsArea(bounds: SpatialBounds): number {
    return (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  }

  /**
   * Union of two bounds (smallest bounds that contains both)
   */
  static boundsUnion(a: SpatialBounds, b: SpatialBounds): SpatialBounds {
    return {
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY)
    };
  }

  /**
   * 🎯 CAD-SPECIFIC UTILITIES
   */

  /**
   * Check if bounds are suitable for QuadTree (large area, many items)
   */
  static isQuadTreeSuitable(bounds: SpatialBounds, itemCount: number): boolean {
    const area = this.boundsArea(bounds);
    const density = itemCount / area;

    // QuadTree is better for:
    // - Large areas with moderate density
    // - Complex hit testing scenarios
    return area > 10000 && density < 0.1;
  }

  /**
   * Check if bounds are suitable for Grid (small area, dense items)
   */
  static isGridSuitable(bounds: SpatialBounds, itemCount: number): boolean {
    const area = this.boundsArea(bounds);
    const density = itemCount / area;

    // Grid is better for:
    // - Smaller areas with higher density
    // - Fast snapping operations
    return area <= 10000 || density >= 0.1;
  }

  /**
   * Calculate optimal grid size for given bounds and item count
   */
  static calculateOptimalGridSize(bounds: SpatialBounds, itemCount: number): number {
    const area = this.boundsArea(bounds);
    const averageItemArea = area / Math.max(itemCount, 1);
    const cellSize = Math.sqrt(averageItemArea);

    // 🏢 ADR-034: Using centralized validation bounds
    return clamp(cellSize, SPATIAL_BOUNDS.GRID_CELL_SIZE.min, SPATIAL_BOUNDS.GRID_CELL_SIZE.max);
  }

  /**
   * 🔍 VALIDATION UTILITIES
   */

  /**
   * Validate bounds are not degenerate (SpatialBounds format)
   * 🏢 ADR-034: Centralized Bounds Validation
   * ✅ CANONICAL: For { minX, minY, maxX, maxY } format (allows min == max)
   */
  static isValidBounds(bounds: SpatialBounds): boolean {
    return (
      bounds.minX <= bounds.maxX &&
      bounds.minY <= bounds.maxY &&
      Number.isFinite(bounds.minX) &&
      Number.isFinite(bounds.minY) &&
      Number.isFinite(bounds.maxX) &&
      Number.isFinite(bounds.maxY)
    );
  }

  /**
   * Validate bounds in { min, max } format
   * 🏢 ADR-034: Centralized Bounds Validation (2026-02-01)
   * ✅ CANONICAL: For { min: Point2D, max: Point2D } format with null check
   * ⚠️ STRICT: Requires max > min (not equal) for valid non-degenerate bounds
   * Used by: zoom bounds calculations, viewport validation
   */
  static isValidRect(bounds: { min: Point2D; max: Point2D } | null): boolean {
    if (!bounds) return false;
    return (
      Number.isFinite(bounds.min.x) &&
      Number.isFinite(bounds.min.y) &&
      Number.isFinite(bounds.max.x) &&
      Number.isFinite(bounds.max.y) &&
      bounds.max.x > bounds.min.x &&
      bounds.max.y > bounds.min.y
    );
  }

  /**
   * Sanitize bounds to ensure they are valid
   */
  static sanitizeBounds(bounds: SpatialBounds): SpatialBounds {
    const sanitized = {
      minX: Number.isFinite(bounds.minX) ? bounds.minX : 0,
      minY: Number.isFinite(bounds.minY) ? bounds.minY : 0,
      maxX: Number.isFinite(bounds.maxX) ? bounds.maxX : 0,
      maxY: Number.isFinite(bounds.maxY) ? bounds.maxY : 0
    };

    // Ensure min <= max
    if (sanitized.minX > sanitized.maxX) {
      [sanitized.minX, sanitized.maxX] = [sanitized.maxX, sanitized.minX];
    }
    if (sanitized.minY > sanitized.maxY) {
      [sanitized.minY, sanitized.maxY] = [sanitized.maxY, sanitized.minY];
    }

    return sanitized;
  }
}