/**
 * ZOOM SYSTEM - CALCULATIONS
 * Μαθηματικές πράξεις για zoom operations
 */

import type { Point2D, ViewTransform } from '../../../rendering/types/Types';
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικής υπηρεσίας αντί για διπλότυπη fit logic
import { FitToViewService } from '../../../services/FitToViewService';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';

// === TRANSFORM CALCULATIONS ===

/**
 * Υπολογισμός νέου transform για zoom με center point
 * ✅ ARCHITECTURAL FIX: Proper handling of SCREEN OFFSETS using CoordinateTransforms
 *
 * Goal: Keep the world point under 'center' (screen coords) fixed during zoom
 *
 * Algorithm:
 * 1. Convert center to world coordinates using OLD transform and CoordinateTransforms
 * 2. Calculate new offsets so that same world point appears at same screen position
 * 3. Use proper viewport dimensions for accurate conversion
 */
export function calculateZoomTransform(
  currentTransform: ViewTransform,
  newScale: number,
  center: Point2D,
  viewport: { width: number; height: number }
): ViewTransform {
  // Step 1: Convert center (screen) to world using OLD transform
  const worldCenter = CoordinateTransforms.screenToWorld(center, currentTransform, viewport);

  // Step 2: Calculate what the offsets should be for NEW scale
  // so that worldCenter still appears at 'center' screen position
  //
  // From worldToScreen formula:
  //   screenX = left + worldX * scale + offsetX
  //   screenY = (height - top) - worldY * scale - offsetY
  //
  // Solving for offsets:
  //   offsetX = screenX - left - worldX * scale
  //   offsetY = (height - top) - screenY - worldY * scale

  const { left, top } = { left: 80, top: 30 }; // COORDINATE_LAYOUT.MARGINS

  const newOffsetX = center.x - left - worldCenter.x * newScale;
  const newOffsetY = (viewport.height - top) - center.y - worldCenter.y * newScale;

  return {
    scale: newScale,
    offsetX: newOffsetX,
    offsetY: newOffsetY
  };
}

/**
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Υπολογισμός fit-to-bounds transform - WRAPPER για κεντρική υπηρεσία
 * 🔥 ΔΙΠΛΟΤΥΠΟ ΑΦΑΙΡΕΘΗΚΕ: Αντικαταστάθηκε με FitToViewService
 */
export function calculateFitTransform(
  bounds: { min: Point2D; max: Point2D },
  viewport: { width: number; height: number },
  padding: number = 100,
  maxScale: number = 200,
  minScale: number = 0.01,
  alignToOrigin: boolean = false
): ViewTransform {
  // 🛡️ GUARD: Validate viewport before calculations
  if (!viewport || viewport.width <= 0 || viewport.height <= 0 || !isFinite(viewport.width) || !isFinite(viewport.height)) {
    console.error('🚨 calculateFitTransform: Invalid viewport!');
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }

  // Convert padding pixels to percentage for FitToViewService
  // 🛡️ GUARD: Ensure paddingPercentage is finite
  const paddingPercentage = Math.max(padding * 2, viewport.width * 0.1) / viewport.width;

  if (!isFinite(paddingPercentage)) {
    console.error('🚨 calculateFitTransform: Invalid paddingPercentage!');
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }

  const result = FitToViewService.calculateFitToViewFromBounds(
    bounds,
    viewport,
    {
      padding: paddingPercentage,
      maxScale,
      minScale,
      alignToOrigin
    }
  );

  if (result.success && result.transform) {
    return result.transform;
  }

  // Fallback για edge cases
  console.warn('🚨 calculateFitTransform: FitToViewService failed, using fallback', result);
  return { scale: 1, offsetX: 0, offsetY: 0 };
}

/**
 * Υπολογισμός bounds normalization (bottom-left to origin)
 */
export function calculateNormalizedTransform(
  bounds: { min: Point2D; max: Point2D },
  viewport: { width: number; height: number },
  padding: number = 100
): ViewTransform {
  const fitTransform = calculateFitTransform(bounds, viewport, padding);

  // Additional offset to move bottom-left corner to origin
  const offsetX = -bounds.min.x * fitTransform.scale + padding;
  const offsetY = -bounds.min.y * fitTransform.scale + padding;

  return {
    scale: fitTransform.scale,
    offsetX,
    offsetY
  };
}

// === COORDINATE CONVERSIONS ===

// ✅ ΔΙΠΛΟΤΥΠΟ ΑΦΑΙΡΕΘΗΚΕ: Χρήση κεντρικής CoordinateTransforms για συνέπεια
// 🚨 REMOVED: Local screenToWorld function - ασυνεπής με margins
// Use CoordinateTransforms.screenToWorld() instead for consistency

// Removed duplicate worldToScreen function - use CoordinateTransforms.worldToScreen() instead

// === BOUNDS CALCULATIONS ===

/**
 * Υπολογισμός visible world bounds
 * ✅ FIXED: Χρήση κεντρικής CoordinateTransforms για συνέπεια με margins
 */
export function getVisibleBounds(
  transform: ViewTransform,
  viewport: { width: number; height: number }
): { min: Point2D; max: Point2D } {
  const topLeft = CoordinateTransforms.screenToWorld({ x: 0, y: 0 }, transform, viewport);
  const bottomRight = CoordinateTransforms.screenToWorld(
    { x: viewport.width, y: viewport.height },
    transform,
    viewport
  );

  return {
    min: { x: topLeft.x, y: topLeft.y },
    max: { x: bottomRight.x, y: bottomRight.y }
  };
}

/**
 * Έλεγχος αν point είναι εντός bounds
 */
export function isPointInBounds(
  point: Point2D,
  bounds: { min: Point2D; max: Point2D }
): boolean {
  return (
    point.x >= bounds.min.x &&
    point.x <= bounds.max.x &&
    point.y >= bounds.min.y &&
    point.y <= bounds.max.y
  );
}

/**
 * Υπολογισμός bounds union (combine multiple bounds)
 */
export function unionBounds(
  bounds1: { min: Point2D; max: Point2D },
  bounds2: { min: Point2D; max: Point2D }
): { min: Point2D; max: Point2D } {
  return {
    min: {
      x: Math.min(bounds1.min.x, bounds2.min.x),
      y: Math.min(bounds1.min.y, bounds2.min.y)
    },
    max: {
      x: Math.max(bounds1.max.x, bounds2.max.x),
      y: Math.max(bounds1.max.y, bounds2.max.y)
    }
  };
}

// === SCALE UTILITIES ===

/**
 * Clamp scale within limits
 */
export function clampScale(
  scale: number,
  minScale: number,
  maxScale: number
): number {
  return Math.max(minScale, Math.min(maxScale, scale));
}

/**
 * Υπολογισμός επόμενου zoom level
 */
export function getNextZoomLevel(
  currentScale: number,
  direction: 'in' | 'out',
  factor: number,
  minScale: number,
  maxScale: number
): number {
  const newScale = direction === 'in'
    ? currentScale * factor
    : currentScale / factor;

  return clampScale(newScale, minScale, maxScale);
}

// === DISTANCE & GEOMETRY ===

/**
 * Υπολογισμός απόστασης μεταξύ δύο σημείων
 */
export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Υπολογισμός center point από bounds
 */
export function getBoundsCenter(bounds: { min: Point2D; max: Point2D }): Point2D {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2
  };
}

/**
 * Υπολογισμός viewport center
 */
export function getViewportCenter(viewport: { width: number; height: number }): Point2D {
  return {
    x: viewport.width / 2,
    y: viewport.height / 2
  };
}