/**
 * Entity validation utilities
 * Consolidates duplicate validation patterns across renderers
 */

import type { EntityModel } from '../../types/Types';
import type { Point2D } from '../../types/Types';

/**
 * Validate line entity and extract data
 */
export function validateLineEntity(entity: EntityModel): {
  start: Point2D;
  end: Point2D;
} | null {
  if (entity.type !== 'line') return null;
  
  const start = entity.start as Point2D;
  const end = entity.end as Point2D;
  
  if (!start || !end) return null;
  
  return { start, end };
}

/**
 * Validate circle entity and extract data
 */
export function validateCircleEntity(entity: EntityModel): {
  center: Point2D;
  radius: number;
} | null {
  if (entity.type !== 'circle') return null;
  
  const center = entity.center as Point2D;
  const radius = entity.radius as number;
  
  if (!center || !radius) return null;
  
  return { center, radius };
}

/**
 * Validate ellipse entity and extract data
 */
export function validateEllipseEntity(entity: EntityModel): {
  center: Point2D;
  majorAxis: number;
  minorAxis: number;
  rotation: number;
} | null {
  if (entity.type !== 'ellipse') return null;
  
  const center = entity.center as Point2D;
  const majorAxis = entity.majorAxis as number;
  const minorAxis = entity.minorAxis as number;
  const rotation = entity.rotation as number || 0;
  
  if (!center || !majorAxis || !minorAxis) return null;
  
  return { center, majorAxis, minorAxis, rotation };
}

/**
 * Validate rectangle entity and extract data
 */
export function validateRectangleEntity(entity: EntityModel): {
  topLeft: Point2D;
  width: number;
  height: number;
} | null {
  if (entity.type !== 'rectangle') return null;
  
  const topLeft = entity.topLeft as Point2D;
  const width = entity.width as number;
  const height = entity.height as number;
  
  if (!topLeft || !width || !height) return null;
  
  return { topLeft, width, height };
}

/**
 * Validate arc entity and extract data
 */
export function validateArcEntity(entity: EntityModel): {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
} | null {
  if (entity.type !== 'arc') return null;
  
  const center = entity.center as Point2D;
  const radius = entity.radius as number;
  const startAngle = entity.startAngle as number;
  const endAngle = entity.endAngle as number;
  
  if (!center || !radius || startAngle === undefined || endAngle === undefined) return null;
  
  return { center, radius, startAngle, endAngle };
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟΣ ΈΛΕΓΧΟΣ ENTITY TYPE - για όλους τους renderers
 * Μείωση διπλότυπου type checking pattern
 */
export function validateEntityType(entity: EntityModel, expectedType: string | string[]): boolean {
  const types = Array.isArray(expectedType) ? expectedType : [expectedType];
  return types.includes(entity.type);
}

/**
 * Check if point is valid (has numeric x and y coordinates)
 */
export function isValidPoint(point: unknown): point is Point2D {
  // ✅ ENTERPRISE: Proper type guard with explicit boolean return and object type check
  return Boolean(
    point &&
    typeof point === 'object' &&
    point !== null &&
    'x' in point &&
    'y' in point &&
    typeof (point as any).x === 'number' &&
    typeof (point as any).y === 'number' &&
    !isNaN((point as any).x) &&
    !isNaN((point as any).y)
  );
}