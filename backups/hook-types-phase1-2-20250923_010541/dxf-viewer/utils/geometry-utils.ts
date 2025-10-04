/**
 * Centralized Geometry Utilities
 * Common geometric calculations to eliminate duplicates across renderers
 */

import type { Point2D } from '../systems/rulers-grid/config';

/**
 * Calculate distance from a point to a line segment
 * Used in hit testing across multiple renderers
 */
export function pointToLineDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  // Use the nearest point function and calculate distance to it
  const nearestPoint = getNearestPointOnLine(point, lineStart, lineEnd, true);
  const dx = point.x - nearestPoint.x;
  const dy = point.y - nearestPoint.y;
  return Math.sqrt(dx * dx + dy * dy);
}


/**
 * Get the nearest point on a line to a given point
 * Used in snapping engines and geometric calculations
 */
export function getNearestPointOnLine(point: Point2D, lineStart: Point2D, lineEnd: Point2D, clamp = true): Point2D {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) {
    return lineStart; // Line is actually a point
  }

  let param = dot / lenSq;

  // Clamp to line segment if requested
  if (clamp) {
    if (param < 0) param = 0;
    if (param > 1) param = 1;
  }

  return {
    x: lineStart.x + param * C,
    y: lineStart.y + param * D
  };
}

/**
 * Calculate the parameter (t) of a point's projection onto a line
 * Returns 0-1 for points on the segment, <0 or >1 for points beyond the segment
 * Used in extension and perpendicular snap engines
 */
export function getLineParameter(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) {
    return 0; // Line is actually a point
  }

  return dot / lenSq;
}

/**
 * Shared canvas zoom utility functions to eliminate duplicates
 */
export const createCanvasZoomActions = (
  canvasRef: React.RefObject<any>,
  updateZoom: () => void
) => ({
  zoomIn: () => {
    canvasRef.current?.zoomIn();
    updateZoom();
  },
  zoomOut: () => {
    canvasRef.current?.zoomOut();
    updateZoom();
  },
  fitToView: () => {
    canvasRef.current?.fitToView();
    updateZoom();
  }
});

/**
 * Calculate distance between two points
 * Used in grip interaction and entity operations
 */
export function pointDistance(point1: Point2D, point2: Point2D): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate polygon area using shoelace formula
 * Used in polyline measurements
 */
export function calculatePolygonArea(vertices: Point2D[]): number {
  if (vertices.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Calculate polygon centroid (center of mass)
 * Used in polyline area label positioning
 */
export function calculatePolygonCentroid(vertices: Point2D[]): Point2D {
  if (vertices.length === 0) return { x: 0, y: 0 };
  
  let x = 0, y = 0;
  vertices.forEach(vertex => {
    x += vertex.x;
    y += vertex.y;
  });
  
  return {
    x: x / vertices.length,
    y: y / vertices.length
  };
}