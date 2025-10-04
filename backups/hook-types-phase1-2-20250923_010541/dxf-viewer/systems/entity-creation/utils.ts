/**
 * ENTITY CREATION SYSTEM UTILITIES
 * Utility functions for entity creation and drawing operations
 */

import type { DrawingTool } from './config';
import { calculateLineBounds, calculateDistance, calculateAngle } from '../../utils/renderers/shared/geometry-rendering-utils';
import { Point2D } from '../../types/shared';
import { SmartBoundsManager } from '../../utils/SmartBoundsManager';

// Point type imported from shared types

// Basic entity types for creation
export interface BaseEntity {
  id: string;
  type: string;
  layer: string;
  visible: boolean;
}

export interface LineEntity extends BaseEntity {
  type: 'line';
  start: Point2D;
  end: Point2D;
}

export interface RectangleEntity extends BaseEntity {
  type: 'rectangle';
  corner1: Point2D;
  corner2: Point2D;
}

export interface CircleEntity extends BaseEntity {
  type: 'circle';
  center: Point2D;
  radius: number;
}

export interface PolylineEntity extends BaseEntity {
  type: 'polyline';
  vertices: Point2D[];
  closed: boolean;
}

export type CreatedEntity = LineEntity | RectangleEntity | CircleEntity | PolylineEntity;


/**
 * Calculate angle between two points (in degrees)
 */
export function calculateAngleDegrees(p1: Point2D, p2: Point2D): number {
  return (calculateAngle(p1, p2) * 180) / Math.PI;
}

/**
 * Generate unique entity ID
 */
export function generateEntityId(): string {
  return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate if points form a valid entity
 */
export function validateEntityPoints(tool: DrawingTool, points: Point2D[]): boolean {
  switch (tool) {
    case 'line':
      return points.length >= 2 && calculateDistance(points[0], points[1]) > 0.001;
    
    case 'rectangle':
      if (points.length < 2) return false;
      const width = Math.abs(points[1].x - points[0].x);
      const height = Math.abs(points[1].y - points[0].y);
      return width > 0.001 && height > 0.001;
    
    case 'circle':
      return points.length >= 2 && calculateDistance(points[0], points[1]) > 0.001;
    
    case 'polyline':
      return points.length >= 2 && points.every((p, i) => 
        i === 0 || calculateDistance(points[i-1], p) > 0.001
      );
    
    default:
      return false;
  }
}

/**
 * Create entity from drawing tool and points
 */
export function createEntityFromPoints(
  tool: DrawingTool,
  points: Point2D[],
  layer: string = '0'
): CreatedEntity | null {
  if (!validateEntityPoints(tool, points)) {
    return null;
  }

  const id = generateEntityId();
  const baseEntity = { id, layer, visible: true };

  switch (tool) {
    case 'line':
      return {
        ...baseEntity,
        type: 'line',
        start: points[0],
        end: points[1],
      } as LineEntity;

    case 'rectangle':
      return {
        ...baseEntity,
        type: 'rectangle',
        corner1: points[0],
        corner2: points[1],
      } as RectangleEntity;

    case 'circle':
      const radius = calculateDistance(points[0], points[1]);
      return {
        ...baseEntity,
        type: 'circle',
        center: points[0],
        radius,
      } as CircleEntity;

    case 'polyline':
      return {
        ...baseEntity,
        type: 'polyline',
        vertices: [...points],
        closed: false,
      } as PolylineEntity;

    default:
      return null;
  }
}

/**
 * Calculate entity bounds
 */
export function calculateEntityBounds(entity: CreatedEntity): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  switch (entity.type) {
    case 'line':
      return calculateLineBounds(entity.start, entity.end);

    case 'rectangle':
      return {
        minX: Math.min(entity.corner1.x, entity.corner2.x),
        minY: Math.min(entity.corner1.y, entity.corner2.y),
        maxX: Math.max(entity.corner1.x, entity.corner2.x),
        maxY: Math.max(entity.corner1.y, entity.corner2.y),
      };

    case 'circle':
      return SmartBoundsManager.getCircleBounds(entity.center, entity.radius);

    case 'polyline':
      const xs = entity.vertices.map(v => v.x);
      const ys = entity.vertices.map(v => v.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };

    default:
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
}

/**
 * Check if a tool requires multiple points
 */
export function isMultiPointTool(tool: DrawingTool): boolean {
  return tool === 'polyline';
}

/**
 * Check if a tool creates closed shapes
 */
export function isClosedShapeTool(tool: DrawingTool): boolean {
  return ['rectangle', 'circle'].includes(tool);
}

/**
 * Get minimum points required for a tool
 */
export function getMinimumPoints(tool: DrawingTool): number {
  switch (tool) {
    case 'line':
    case 'rectangle':
    case 'circle':
    case 'polyline':
      return 2;
    default:
      return 1;
  }
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(point: Point2D, precision: number = 2): string {
  return `(${point.x.toFixed(precision)}, ${point.y.toFixed(precision)})`;
}

/**
 * Format distance for display
 */
export function formatDistance(distance: number, precision: number = 2): string {
  return `${distance.toFixed(precision)}`;
}

/**
 * Format angle for display
 */
export function formatAngle(angleRadians: number, precision: number = 1): string {
  const degrees = (angleRadians * 180) / Math.PI;
  return `${degrees.toFixed(precision)}°`;
}

/**
 * Snap point to grid
 */
export function snapToGrid(point: Point2D, gridSize: number): Point2D {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/**
 * Check if two points are approximately equal
 */
export function pointsEqual(p1: Point2D, p2: Point2D, tolerance: number = 0.001): boolean {
  return calculateDistance(p1, p2) < tolerance;
}

/**
 * Get preview entity for drawing feedback
 */
export function createPreviewEntity(
  tool: DrawingTool,
  tempPoints: Point2D[],
  currentPoint: Point2D,
  layer: string = '0'
): CreatedEntity | null {
  if (tempPoints.length === 0) return null;

  const previewPoints = [...tempPoints, currentPoint];
  
  // Only create preview if we have enough points
  if (previewPoints.length < getMinimumPoints(tool)) {
    return null;
  }

  return createEntityFromPoints(tool, previewPoints, layer);
}