/**
 * 📍 SNAP DISTANCE UTILITIES
 *
 * Distance calculations για snap functionality
 *
 * @module floor-plan-system/snapping/engine/snap-distance
 */

import { SnapPoint, SnapResult, SnapSettings } from '../types';
import { SNAP_MODE_PRIORITY } from '../config';

/**
 * Calculate 2D Euclidean distance between two points
 *
 * @param x1 - First point X
 * @param y1 - First point Y
 * @param x2 - Second point X
 * @param y2 - Second point Y
 * @returns Distance in pixels
 */
export function calculateDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find nearest snap point within snap radius
 *
 * @param cursorX - Cursor X coordinate
 * @param cursorY - Cursor Y coordinate
 * @param snapPoints - Array of available snap points
 * @param settings - Snap settings (radius, enabled modes, etc.)
 * @returns SnapResult if found, null otherwise
 */
export function findNearestSnapPoint(
  cursorX: number,
  cursorY: number,
  snapPoints: SnapPoint[],
  settings: SnapSettings
): SnapResult | null {
  if (!settings.enabled || snapPoints.length === 0) {
    return null;
  }

  let nearestPoint: SnapPoint | null = null;
  let nearestDistance = Infinity;

  // Filter snap points by enabled modes
  const filteredPoints = snapPoints.filter(point =>
    settings.enabledModes.includes(point.mode)
  );

  // Find nearest point within snap radius
  for (const point of filteredPoints) {
    const distance = calculateDistance(cursorX, cursorY, point.x, point.y);

    if (distance <= settings.radius) {
      // If this point is closer, or same distance but higher priority
      if (
        distance < nearestDistance ||
        (distance === nearestDistance &&
          nearestPoint &&
          SNAP_MODE_PRIORITY[point.mode] > SNAP_MODE_PRIORITY[nearestPoint.mode])
      ) {
        nearestPoint = point;
        nearestDistance = distance;
      }
    }
  }

  if (nearestPoint) {
    return {
      point: nearestPoint,
      distance: nearestDistance,
      isActive: true
    };
  }

  return null;
}

/**
 * Filter snap points by distance (closest N points)
 *
 * Useful for performance optimization - only check closest points
 *
 * @param cursorX - Cursor X coordinate
 * @param cursorY - Cursor Y coordinate
 * @param snapPoints - Array of snap points
 * @param maxPoints - Maximum number of points to return
 * @returns Closest N snap points
 */
export function getClosestSnapPoints(
  cursorX: number,
  cursorY: number,
  snapPoints: SnapPoint[],
  maxPoints: number = 10
): SnapPoint[] {
  // Calculate distance for each point
  const pointsWithDistance = snapPoints.map(point => ({
    point,
    distance: calculateDistance(cursorX, cursorY, point.x, point.y)
  }));

  // Sort by distance
  pointsWithDistance.sort((a, b) => a.distance - b.distance);

  // Return closest N points
  return pointsWithDistance
    .slice(0, maxPoints)
    .map(item => item.point);
}

/**
 * Check if cursor is within snap radius of any point
 *
 * @param cursorX - Cursor X coordinate
 * @param cursorY - Cursor Y coordinate
 * @param snapPoints - Array of snap points
 * @param radius - Snap radius in pixels
 * @returns True if within radius of any point
 */
export function isWithinSnapRadius(
  cursorX: number,
  cursorY: number,
  snapPoints: SnapPoint[],
  radius: number
): boolean {
  return snapPoints.some(
    point => calculateDistance(cursorX, cursorY, point.x, point.y) <= radius
  );
}
