/**
 * Entity validation utilities
 * Consolidates duplicate validation patterns across renderers
 */

// ✅ ENTERPRISE: Updated imports to use centralized entity types
import type { Entity, LineEntity, CircleEntity, ArcEntity, RectangleEntity, EllipseEntity, EntityModel } from '../../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import {
  isLineEntity,
  isCircleEntity,
  isArcEntity,
  isEllipseEntity,
  isRectangleEntity,
} from '../../../types/entities';
import type { Point2D } from '../../types/Types';

/**
 * Validate line entity and extract data
 */
export function validateLineEntity(entity: EntityModel): {
  start: Point2D;
  end: Point2D;
} | null {
  // 🏢 ADR-102: Use centralized type guard
  if (!isLineEntity(entity as Entity)) return null;

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
  // 🏢 ADR-102: Use centralized type guard
  if (!isCircleEntity(entity as Entity)) return null;

  const circleEntity = entity as CircleEntity;
  const center = circleEntity.center;
  const radius = circleEntity.radius;

  if (!center || !radius) return null;

  return { center, radius };
}

// 🏢 ADR-102: EllipseEntity now imported from centralized types/entities.ts

/**
 * Validate ellipse entity and extract data
 * ⚠️ NOTE: Ellipse entity type not currently supported in centralized Entity system
 * TODO: Add ellipse support to types/entities.ts if needed
 */
export function validateEllipseEntity(entity: EntityModel): {
  center: Point2D;
  majorAxis: number;
  minorAxis: number;
  rotation: number;
  // 🏢 ADR-646 Φ3: elliptical-arc bounds (radians, CCW from +majorAxis). Absent → full ellipse.
  startParam?: number;
  endParam?: number;
} | null {
  // 🏢 ADR-102: Use centralized type guard
  if (!isEllipseEntity(entity as Entity)) return null;

  // 🏢 ENTERPRISE: Type-safe property access
  const ellipseEntity = entity as unknown as EllipseEntity;
  const center = ellipseEntity.center;
  const majorAxis = ellipseEntity.majorAxis;
  const minorAxis = ellipseEntity.minorAxis;
  const rotation = ellipseEntity.rotation ?? 0;

  if (!center || !majorAxis || !minorAxis) return null;

  return {
    center,
    majorAxis,
    minorAxis,
    rotation,
    startParam: ellipseEntity.startParam,
    endParam: ellipseEntity.endParam,
  };
}

/**
 * Validate rectangle entity and extract data
 */
export function validateRectangleEntity(entity: EntityModel): {
  topLeft: Point2D;
  width: number;
  height: number;
} | null {
  // 🏢 ADR-102: Use centralized type guard
  if (!isRectangleEntity(entity as Entity)) return null;

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
  counterclockwise: boolean;
} | null {
  // 🏢 ADR-102: Use centralized type guard
  if (!isArcEntity(entity as Entity)) return null;

  const arcEntity = entity as ArcEntity;
  const center = arcEntity.center;
  const radius = arcEntity.radius;
  const startAngle = arcEntity.startAngle;
  const endAngle = arcEntity.endAngle;
  // 🏢 ENTERPRISE: Extract counterclockwise flag (defaults to false if not set)
  const counterclockwise = arcEntity.counterclockwise ?? false;

  // 🏢 ADR-165: Debug console.log removed for production cleanup

  if (!center || !radius || startAngle === undefined || endAngle === undefined) return null;

  return { center, radius, startAngle, endAngle, counterclockwise };
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
 * Check if point is valid (has numeric x and y coordinates).
 *
 * Narrows to `T & Point2D`, not to a bare `Point2D`: the caller's own fields survive the
 * guard. A plain `point is Point2D` silently DISCARDS them — narrowing a
 * `{x?, y?, bulge?}` vertex through it left a `Point2D` with no `bulge`, so the DXF
 * bulge could not be read after validating the very vertex that carries it. For a caller
 * passing `unknown`, `unknown & Point2D` is just `Point2D` — unchanged.
 */
export function isValidPoint<T>(point: T): point is T & Point2D {
  // ✅ ENTERPRISE: Proper type guard with explicit boolean return and object type check
  if (!point || typeof point !== 'object' || point === null) return false;
  if (!('x' in point) || !('y' in point)) return false;

  // 🏢 ENTERPRISE: Type-safe property access using Record type
  const pointRecord = point as Record<string, unknown>;
  return (
    typeof pointRecord.x === 'number' &&
    typeof pointRecord.y === 'number' &&
    !isNaN(pointRecord.x) &&
    !isNaN(pointRecord.y)
  );
}

/**
 * 🏢 ENTERPRISE: Strict point validation including Infinity check
 * Use for bounds calculations where Infinity invalidates results
 *
 * @param point - Point to validate
 * @returns true if point is valid AND finite (no NaN, no Infinity)
 */
export function isValidPointStrict(point: unknown): point is Point2D {
  if (!isValidPoint(point)) return false;
  const p = point as Point2D;
  // 🏢 ADR-161: Use Number.isFinite() for strict type checking (no coercion)
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}