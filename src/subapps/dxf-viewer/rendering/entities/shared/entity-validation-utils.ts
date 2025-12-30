/**
 * Entity validation utilities
 * Consolidates duplicate validation patterns across renderers
 */

// ✅ ENTERPRISE: Updated imports to use centralized entity types
import type { Entity, LineEntity, CircleEntity, ArcEntity, RectangleEntity, EntityModel } from '../../../types/entities';
import type { Point2D } from '../../types/Types';

/**
 * Validate line entity and extract data
 */
export function validateLineEntity(entity: EntityModel): {
  start: Point2D;
  end: Point2D;
} | null {
  if (entity.type !== 'line') return null;

  const lineEntity = entity as LineEntity;
  const start = lineEntity.start;
  const end = lineEntity.end;

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

  const circleEntity = entity as CircleEntity;
  const center = circleEntity.center;
  const radius = circleEntity.radius;

  if (!center || !radius) return null;

  return { center, radius };
}

/**
 * Validate ellipse entity and extract data
 * ⚠️ NOTE: Ellipse entity type not currently supported in centralized Entity system
 * TODO: Add ellipse support to types/entities.ts if needed
 */
export function validateEllipseEntity(entity: any): {
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

  const rectangleEntity = entity as RectangleEntity;
  // Convert x,y to topLeft for compatibility
  const topLeft = { x: rectangleEntity.x, y: rectangleEntity.y };
  const width = rectangleEntity.width;
  const height = rectangleEntity.height;

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

  const arcEntity = entity as ArcEntity;
  const center = arcEntity.center;
  const radius = arcEntity.radius;
  const startAngle = arcEntity.startAngle;
  const endAngle = arcEntity.endAngle;

  if (!center || !radius || startAngle === undefined || endAngle === undefined) return null;

  return { center, radius, startAngle, endAngle };
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟΣ ΈΛΕΓΧΟΣ ENTITY TYPE - για όλους τους renderers
 * Μείωση διπλότυπου type checking pattern
 */
export function validateEntityType(entity: Entity, expectedType: string | string[]): boolean {
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