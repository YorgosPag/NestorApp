/**
 * Entity Validation Utilities
 * Shared validation logic for entity properties across renderers and hover systems
 */

import type { Point2D } from '../rendering/types/Types';
import type { ArcEntity } from '../types/scene';

/**
 * Base entity interface for validation
 */
interface BaseEntity {
  center?: Point2D;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  majorAxisEndpoint?: Point2D;
  minorAxisRatio?: number;
  startParameter?: number;
  endParameter?: number;
}

/**
 * Arc validation result
 */
export interface ValidatedArc {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

/**
 * Ellipse validation result  
 */
export interface ValidatedEllipse {
  center: Point2D;
  majorAxisEndpoint: Point2D;
  minorAxisRatio: number;
  startParameter?: number;
  endParameter?: number;
}

/**
 * Validate arc entity properties
 */
export function validateArcEntity(entity: BaseEntity): ValidatedArc | null {
  const center = entity.center as Point2D;
  const radius = entity.radius as number;
  const startAngle = entity.startAngle as number;
  const endAngle = entity.endAngle as number;
  
  if (!center || !radius || startAngle == null || endAngle == null) return null;
  
  return { center, radius, startAngle, endAngle };
}

/**
 * Validate ellipse entity properties
 */
export function validateEllipseEntity(entity: BaseEntity): ValidatedEllipse | null {
  const center = entity.center as Point2D;
  const majorAxisEndpoint = entity.majorAxisEndpoint as Point2D;
  const minorAxisRatio = entity.minorAxisRatio as number;
  
  if (!center || !majorAxisEndpoint || minorAxisRatio == null) return null;
  
  return {
    center,
    majorAxisEndpoint,
    minorAxisRatio,
    startParameter: entity.startParameter,
    endParameter: entity.endParameter
  };
}