/**
 * GRIPS SYSTEM UTILITIES
 * Re-export and organize existing grips utilities
 */

// Import types for utility functions
import type { Point2D } from '../../rendering/types/Types';
import type { GripState, GripSettings } from './config';

/**
 * Calculate distance between two points
 * ✅ CENTRALIZED: Import και re-export από centralized location
 */
import { calculateDistance as calculateGripDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
export { calculateGripDistance };

/**
 * Check if a point is within grip selection tolerance
 */
export function isWithinGripTolerance(
  gripPosition: Point2D,
  testPosition: Point2D,
  tolerance: number
): boolean {
  return calculateGripDistance(gripPosition, testPosition) <= tolerance;
}

/**
 * Get grip visual size based on state
 */
export function getGripVisualSize(
  baseSize: number,
  state: 'cold' | 'warm' | 'hot',
  dpiScale: number = 1.0
): number {
  const scaledSize = baseSize * dpiScale;
  switch (state) {
    case 'warm': return Math.round(scaledSize * 1.2);
    case 'hot': return Math.round(scaledSize * 1.4);
    case 'cold':
    default: return Math.round(scaledSize);
  }
}

/**
 * Get grip color based on state
 */
export function getGripVisualColor(
  colors: GripSettings['colors'],
  state: 'cold' | 'warm' | 'hot'
): string {
  return colors[state];
}

/**
 * Create a unique grip identifier
 */
export function createGripIdentifier(
  entityId: string,
  gripType: string,
  index?: number
): string {
  return `grip_${entityId}_${gripType}${index !== undefined ? `_${index}` : ''}`;
}

/**
 * Check if two grip states are equivalent
 */
export function areGripsEquivalent(
  gripA: GripState | null,
  gripB: GripState | null
): boolean {
  if (!gripA && !gripB) return true;
  if (!gripA || !gripB) return false;
  
  return (
    gripA.entityId === gripB.entityId &&
    gripA.gripIndex === gripB.gripIndex &&
    gripA.gripType === gripB.gripType
  );
}

/**
 * Filter grips within visible area
 */
export function filterVisibleGrips(
  grips: GripState[],
  viewBounds: { minX: number; minY: number; maxX: number; maxY: number },
  maxDistance: number = Infinity
): GripState[] {
  return grips.filter(grip => {
    const { x, y } = grip.position;
    
    // Check if within view bounds
    if (x < viewBounds.minX || x > viewBounds.maxX ||
        y < viewBounds.minY || y > viewBounds.maxY) {
      return false;
    }
    
    // Check distance from view center if specified
    if (maxDistance !== Infinity) {
      const centerX = (viewBounds.minX + viewBounds.maxX) / 2;
      const centerY = (viewBounds.minY + viewBounds.maxY) / 2;
      const distance = calculateGripDistance(
        { x, y },
        { x: centerX, y: centerY }
      );
      if (distance > maxDistance) return false;
    }
    
    return true;
  });
}

/**
 * Sort grips by distance from a point
 */
export function sortGripsByDistance(
  grips: GripState[],
  referencePoint: Point2D
): GripState[] {
  return [...grips].sort((a, b) => {
    const distanceA = calculateGripDistance(a.position, referencePoint);
    const distanceB = calculateGripDistance(b.position, referencePoint);
    return distanceA - distanceB;
  });
}

/**
 * Find the closest grip to a point
 */
export function findClosestGrip(
  grips: GripState[],
  targetPoint: Point2D,
  maxDistance: number = Infinity
): GripState | null {
  let closest: GripState | null = null;
  let minDistance = maxDistance;
  
  for (const grip of grips) {
    const distance = calculateGripDistance(grip.position, targetPoint);
    if (distance < minDistance) {
      minDistance = distance;
      closest = grip;
    }
  }
  
  return closest;
}

/**
 * Validate grip state object
 */
export function isValidGripState(grip: unknown): grip is GripState {
  return !!(
    grip &&
    typeof grip.entityId === 'string' &&
    typeof grip.gripIndex === 'number' &&
    grip.position &&
    typeof grip.position.x === 'number' &&
    typeof grip.position.y === 'number' &&
    ['vertex', 'edge', 'center', 'corner'].includes(grip.gripType)
  );
}

/**
 * Format grip coordinates for display
 */
export function formatGripCoordinates(
  grip: GripState,
  precision: number = 2
): string {
  return `${grip.gripType}(${grip.position.x.toFixed(precision)}, ${grip.position.y.toFixed(precision)})`;
}

/**
 * Calculate grip bounds for rendering optimization
 */
export function calculateGripBounds(grips: GripState[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  if (grips.length === 0) return null;
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const grip of grips) {
    minX = Math.min(minX, grip.position.x);
    minY = Math.min(minY, grip.position.y);
    maxX = Math.max(maxX, grip.position.x);
    maxY = Math.max(maxY, grip.position.y);
  }
  
  return { minX, minY, maxX, maxY };
}