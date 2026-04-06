/**
 * ZOOM SYSTEM - ENTITY BOUNDS UTILITIES
 * Extracted from bounds.ts for SRP (ADR-065)
 *
 * Contains:
 * - Entity-level bounds calculation (getEntityBounds)
 * - Legacy bounds format converters
 * - Tight bounds calculation + position normalization
 *
 * @see ADR-010: Bounds Consolidation
 */

import type { Point2D } from '../../../rendering/types/Types';
import { UI_SIZE_DEFAULTS, TEXT_METRICS_RATIOS } from '../../../config/text-rendering-config';
import { DEFAULT_BOUNDS } from '../../../config/geometry-constants';
import { createInfinityBounds, isInfinityBounds } from '../../../config/geometry-constants';
import { isValidPoint } from '../../../rendering/entities/shared/entity-validation-utils';
import type { Bounds } from './bounds';

// ============================================================================
// ENTITY BOUNDS CALCULATION
// ============================================================================

/**
 * Entity interface for bounds calculation.
 * Supports all common entity types without coupling to specific type systems.
 */
export interface BoundsEntity {
  type: string;
  start?: Point2D;
  end?: Point2D;
  vertices?: Point2D[];
  center?: Point2D;
  radius?: number;
  position?: Point2D;
  text?: string;
  height?: number;
  x?: number;
  y?: number;
  width?: number;
}

/**
 * Legacy bounds format for backward compatibility.
 */
export interface LegacyBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Mutable entity interface for position normalization.
 */
export interface MutableBoundsEntity extends BoundsEntity {
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  vertices?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  position?: { x: number; y: number };
}

// ============================================================================
// ENTITY BOUNDS
// ============================================================================

/**
 * Get bounds for a single entity.
 * Returns modern Bounds format { min, max }.
 */
export function getEntityBounds(entity: BoundsEntity): Bounds | null {
  switch (entity.type) {
    case 'line': {
      if (entity.start && entity.end) {
        return {
          min: {
            x: Math.min(entity.start.x, entity.end.x),
            y: Math.min(entity.start.y, entity.end.y)
          },
          max: {
            x: Math.max(entity.start.x, entity.end.x),
            y: Math.max(entity.start.y, entity.end.y)
          }
        };
      }
      break;
    }

    case 'polyline':
    case 'lwpolyline': {
      if (entity.vertices && Array.isArray(entity.vertices) && entity.vertices.length > 0) {
        const polyBounds = createInfinityBounds();

        for (const vertex of entity.vertices) {
          if (isValidPoint(vertex)) {
            polyBounds.minX = Math.min(polyBounds.minX, vertex.x);
            polyBounds.minY = Math.min(polyBounds.minY, vertex.y);
            polyBounds.maxX = Math.max(polyBounds.maxX, vertex.x);
            polyBounds.maxY = Math.max(polyBounds.maxY, vertex.y);
          }
        }

        if (!isInfinityBounds(polyBounds)) {
          return {
            min: { x: polyBounds.minX, y: polyBounds.minY },
            max: { x: polyBounds.maxX, y: polyBounds.maxY }
          };
        }
      }
      break;
    }

    case 'circle':
    case 'arc': {
      if (entity.center && entity.radius !== undefined) {
        return {
          min: {
            x: entity.center.x - entity.radius,
            y: entity.center.y - entity.radius
          },
          max: {
            x: entity.center.x + entity.radius,
            y: entity.center.y + entity.radius
          }
        };
      }
      break;
    }

    case 'text': {
      if (entity.position) {
        const textWidth = (entity.text?.length || 5) * (entity.height || UI_SIZE_DEFAULTS.TEXT_HEIGHT_FALLBACK) * TEXT_METRICS_RATIOS.CHAR_WIDTH_WIDE;
        const textHeight = entity.height || UI_SIZE_DEFAULTS.TEXT_HEIGHT_FALLBACK;
        return {
          min: { x: entity.position.x, y: entity.position.y },
          max: {
            x: entity.position.x + textWidth,
            y: entity.position.y + textHeight
          }
        };
      }
      break;
    }

    case 'rectangle':
    case 'rect': {
      if (entity.x !== undefined && entity.y !== undefined &&
          entity.width !== undefined && entity.height !== undefined) {
        return {
          min: { x: entity.x, y: entity.y },
          max: { x: entity.x + entity.width, y: entity.y + entity.height }
        };
      }
      break;
    }

    case 'point':
    case 'block': {
      if (entity.position) {
        return {
          min: { x: entity.position.x, y: entity.position.y },
          max: { x: entity.position.x, y: entity.position.y }
        };
      }
      break;
    }
  }

  return null;
}

// ============================================================================
// LEGACY FORMAT CONVERTERS
// ============================================================================

/**
 * Get bounds in legacy format { minX, minY, maxX, maxY }.
 * @deprecated Prefer getEntityBounds() which returns modern Bounds format.
 */
export function getEntityBoundsLegacy(entity: BoundsEntity): LegacyBounds | null {
  const bounds = getEntityBounds(entity);
  if (!bounds) return null;

  return {
    minX: bounds.min.x,
    minY: bounds.min.y,
    maxX: bounds.max.x,
    maxY: bounds.max.y
  };
}

/**
 * Convert legacy bounds to modern Bounds format.
 */
export function legacyToModernBounds(legacy: LegacyBounds): Bounds {
  return {
    min: { x: legacy.minX, y: legacy.minY },
    max: { x: legacy.maxX, y: legacy.maxY }
  };
}

/**
 * Convert modern Bounds to legacy format.
 */
export function modernToLegacyBounds(modern: Bounds): LegacyBounds {
  return {
    minX: modern.min.x,
    minY: modern.min.y,
    maxX: modern.max.x,
    maxY: modern.max.y
  };
}

// ============================================================================
// SCENE BOUNDS NORMALIZATION
// ============================================================================

/**
 * Calculate tight bounds from entity array.
 *
 * Calculates precise bounds from all entities and optionally normalizes
 * positions so that bottom-left corner is at (0,0).
 */
export function calculateTightBounds(
  entities: BoundsEntity[],
  normalize: boolean = false
): Bounds {
  if (entities.length === 0) {
    return { ...DEFAULT_BOUNDS };
  }

  const bounds = createInfinityBounds();

  for (const entity of entities) {
    try {
      const entityBounds = getEntityBounds(entity);
      if (entityBounds) {
        bounds.minX = Math.min(bounds.minX, entityBounds.min.x);
        bounds.minY = Math.min(bounds.minY, entityBounds.min.y);
        bounds.maxX = Math.max(bounds.maxX, entityBounds.max.x);
        bounds.maxY = Math.max(bounds.maxY, entityBounds.max.y);
      }
    } catch (error) {
      console.warn('Error processing entity bounds:', entity, error);
    }
  }

  if (isInfinityBounds(bounds)) {
    console.warn('Invalid bounds calculated, using defaults');
    return { ...DEFAULT_BOUNDS };
  }

  if (normalize) {
    const offsetX = -bounds.minX;
    const offsetY = -bounds.minY;
    normalizeEntityPositions(entities as MutableBoundsEntity[], offsetX, offsetY);

    return {
      min: { x: 0, y: 0 },
      max: { x: bounds.maxX - bounds.minX, y: bounds.maxY - bounds.minY }
    };
  }

  return {
    min: { x: bounds.minX, y: bounds.minY },
    max: { x: bounds.maxX, y: bounds.maxY }
  };
}

/**
 * Calculate tight bounds and normalize positions.
 * Wrapper for calculateTightBounds with normalize=true.
 */
export function calculateTightBoundsNormalized(entities: MutableBoundsEntity[]): Bounds {
  return calculateTightBounds(entities, true);
}

/**
 * Normalize entity positions.
 * Applies offset to all entities so that bottom-left corner is at (0,0).
 * Mutates entities in place for performance.
 */
export function normalizeEntityPositions(
  entities: MutableBoundsEntity[],
  offsetX: number,
  offsetY: number
): void {
  for (const entity of entities) {
    try {
      switch (entity.type) {
        case 'line': {
          if (entity.start && entity.end) {
            entity.start.x += offsetX;
            entity.start.y += offsetY;
            entity.end.x += offsetX;
            entity.end.y += offsetY;
          }
          break;
        }

        case 'polyline':
        case 'lwpolyline': {
          if (entity.vertices && Array.isArray(entity.vertices)) {
            for (const vertex of entity.vertices) {
              if (isValidPoint(vertex)) {
                vertex.x += offsetX;
                vertex.y += offsetY;
              }
            }
          }
          break;
        }

        case 'circle':
        case 'arc': {
          if (entity.center) {
            entity.center.x += offsetX;
            entity.center.y += offsetY;
          }
          break;
        }

        case 'text':
        case 'point':
        case 'block': {
          if (entity.position) {
            entity.position.x += offsetX;
            entity.position.y += offsetY;
          }
          break;
        }

        case 'rectangle':
        case 'rect': {
          if (entity.x !== undefined && entity.y !== undefined) {
            (entity as { x: number; y: number }).x += offsetX;
            (entity as { x: number; y: number }).y += offsetY;
          }
          break;
        }
      }
    } catch (error) {
      console.warn('Error normalizing entity:', entity, error);
    }
  }
}
