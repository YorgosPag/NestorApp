/**
 * Centralized Angle Calculation Utilities
 * Eliminates duplication across angle calculation logic
 */

import type { Point2D } from '../rendering/types/Types';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
// 🏢 ADR-068: Centralized Angle Normalization
// 🏢 ADR-077: Centralized TAU Constant
// 🏢 ADR-134: Centralized Angle Difference Normalization
import { radToDeg, normalizeAngleRad, TAU, normalizeAngleDiff } from '../rendering/entities/shared/geometry-utils';
// 🏢 ADR-072: Centralized Dot Product
import { dotProduct } from '../rendering/entities/shared/geometry-rendering-utils';

export interface AngleData {
  degrees: number;
  startAngle: number;
  endAngle: number;
  clockwise: boolean;
}

/**
 * Calculate angle data between three vertices
 * Centralized to eliminate duplication across renderers and hover utilities
 */
export function calculateAngleData(
  prevVertex: Point2D, 
  currentVertex: Point2D, 
  nextVertex: Point2D,
  prevScreen: Point2D,
  currentScreen: Point2D,
  nextScreen: Point2D
): AngleData {
  // Calculate vectors in world coordinates for accurate angle
  const vec1 = {
    x: prevVertex.x - currentVertex.x,
    y: prevVertex.y - currentVertex.y
  };
  const vec2 = {
    x: nextVertex.x - currentVertex.x,
    y: nextVertex.y - currentVertex.y
  };
  
  // Calculate angle between vectors using dot product and cross product
  // 🏢 ADR-072: Use centralized dot product
  const dot = dotProduct(vec1, vec2);
  const cross = vec1.x * vec2.y - vec1.y * vec2.x;
  // 🏢 ADR-068: Use centralized angle normalization
  const angle = normalizeAngleRad(Math.atan2(cross, dot));
  
  // Use interior angle (smaller angle)
  const interiorAngle = angle > Math.PI ? TAU - angle : angle;
  // 🏢 ADR-067: Use centralized angle conversion
  const degrees = radToDeg(interiorAngle);
  
  // Calculate angles for arc drawing (in screen coordinates)
  const screenVec1 = {
    x: prevScreen.x - currentScreen.x,
    y: prevScreen.y - currentScreen.y
  };
  const screenVec2 = {
    x: nextScreen.x - currentScreen.x,
    y: nextScreen.y - currentScreen.y
  };
  
  const startAngle = Math.atan2(screenVec1.y, screenVec1.x);
  const endAngle = Math.atan2(screenVec2.y, screenVec2.x);
  
  // 🏢 ADR-134: Use centralized angle difference normalization
  const angleDiff = normalizeAngleDiff(endAngle - startAngle);

  const clockwise = angleDiff < 0;
  
  return { degrees, startAngle, endAngle, clockwise };
}

/**
 * Calculate bisector angle and normalized angle difference
 * Eliminates duplicate angle normalization logic
 */
export function calculateAngleBisector(startAngle: number, endAngle: number): {
  angleDiff: number;
  bisectorAngle: number;
} {
  // 🏢 ADR-134: Use centralized angle difference normalization
  const angleDiff = normalizeAngleDiff(endAngle - startAngle);

  const bisectorAngle = startAngle + angleDiff / 2;

  return { angleDiff, bisectorAngle };
}