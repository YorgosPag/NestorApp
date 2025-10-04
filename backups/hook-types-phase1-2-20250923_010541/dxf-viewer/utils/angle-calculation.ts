/**
 * Centralized Angle Calculation Utilities
 * Eliminates duplication across angle calculation logic
 */

import type { Point2D } from '../systems/rulers-grid/config';

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
  const dot = vec1.x * vec2.x + vec1.y * vec2.y;
  const cross = vec1.x * vec2.y - vec1.y * vec2.x;
  let angle = Math.atan2(cross, dot);
  
  // Convert to positive angle (0 to 2π)
  if (angle < 0) angle += 2 * Math.PI;
  
  // Use interior angle (smaller angle)
  const interiorAngle = angle > Math.PI ? 2 * Math.PI - angle : angle;
  const degrees = interiorAngle * (180 / Math.PI);
  
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
  
  // Determine arc direction (shortest path)
  let angleDiff = endAngle - startAngle;
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
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
  let angleDiff = endAngle - startAngle;
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  const bisectorAngle = startAngle + angleDiff / 2;
  
  return { angleDiff, bisectorAngle };
}