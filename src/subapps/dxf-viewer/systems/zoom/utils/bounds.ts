/**
 * ZOOM SYSTEM - BOUNDS UTILITIES
 * 🏢 CANONICAL: Single source of truth για όλες τις bounds operations
 *
 * @see ADR-010: Bounds Consolidation (2026-01-04)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../../canvas-v2/layer-canvas/layer-types';
// 🏢 ADR-107: Centralized UI Size Defaults and Text Metrics Ratios
// 🏢 ADR-142: Centralized Default Font Size
import { UI_SIZE_DEFAULTS, TEXT_METRICS_RATIOS, TEXT_SIZE_LIMITS } from '../../../config/text-rendering-config';
// 🏢 ADR-114: Centralized Bounding Box Calculation
import { calculateBoundingBox } from '../../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { EMPTY_BOUNDS, DEFAULT_BOUNDS } from '../../../config/geometry-constants';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
import { createInfinityBounds, isInfinityBounds } from '../../../config/geometry-constants';
// 🏢 ADR: Centralized point validation
import { isValidPoint, isValidPointStrict } from '../../../rendering/entities/shared/entity-validation-utils';
// 🏢 ADR-034: Centralized Bounds Validation
import { SpatialUtils } from '../../../core/spatial/SpatialUtils';

// ============================================================================
// 🏢 CANONICAL TYPES
// ============================================================================

/**
 * 🏢 CANONICAL: Bounds interface - Single source of truth
 * Use this instead of inline { min: Point2D; max: Point2D }
 */
export interface Bounds {
  min: Point2D;
  max: Point2D;
}

// ============================================================================
// 🏢 BOUNDS UNION OPERATIONS
// ============================================================================

/**
 * 🏢 CANONICAL: Union two bounds objects
 * Returns the smallest bounds that contains both input bounds
 */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    min: {
      x: Math.min(a.min.x, b.min.x),
      y: Math.min(a.min.y, b.min.y)
    },
    max: {
      x: Math.max(a.max.x, b.max.x),
      y: Math.max(a.max.y, b.max.y)
    }
  };
}

// === BOUNDS CREATION ===

/**
 * 🏢 ADR-114: CENTRALIZED BOUNDS CALCULATION
 * Re-export από geometry-utils.ts (Single Source of Truth)
 *
 * @deprecated Use calculateBoundingBox from geometry-utils.ts directly
 * This alias is kept for backward compatibility
 */
export { calculateBoundingBox as createBoundsFromPoints };

/**
 * Δημιουργία bounds από DXF scene
 *
 * @param scene - The DXF scene to calculate bounds for
 * @param forceRecalculate - If true, ignores cached scene.bounds and calculates from entities.
 *                          Use this when new entities have been added dynamically (e.g., drawing tool)
 *                          Default: false (uses cached bounds for performance)
 */
export function createBoundsFromDxfScene(
  scene: DxfScene | null,
  forceRecalculate: boolean = false
): { min: Point2D; max: Point2D } | null {
  if (!scene || !scene.entities || scene.entities.length === 0) {
    return null;
  }

  // Use scene bounds if available AND not forcing recalculation
  // 🏢 FIX (2026-01-04): forceRecalculate allows Zoom-to-Fit to include
  // dynamically added entities (e.g., lines drawn with drawing tool)
  if (scene.bounds && !forceRecalculate) {
    return scene.bounds;
  }

  // Calculate bounds from entities
  const allPoints: Point2D[] = [];

  for (const entity of scene.entities) {
    switch (entity.type) {
      case 'line':
        // 🛡️ GUARD: Ensure start/end exist and have valid finite coordinates
        // 🏢 ADR: Use centralized isValidPointStrict for bounds calculations
        if (isValidPointStrict(entity.start) && isValidPointStrict(entity.end)) {
          allPoints.push(entity.start, entity.end);
        }
        break;
      case 'circle':
        // 🛡️ GUARD: Ensure center/radius exist and are finite
        // 🏢 ADR: Use centralized isValidPointStrict for bounds calculations
        // 🏢 ADR-161: Use Number.isFinite() for strict type checking (no coercion)
        if (isValidPointStrict(entity.center) && Number.isFinite(entity.radius)) {
          allPoints.push(
            { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
            { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
          );
        }
        break;
      case 'arc':
        // 🛡️ GUARD: Ensure center/radius exist and are finite
        // 🏢 ADR: Use centralized isValidPointStrict for bounds calculations
        // 🏢 ADR-161: Use Number.isFinite() for strict type checking (no coercion)
        if (isValidPointStrict(entity.center) && Number.isFinite(entity.radius)) {
          allPoints.push(
            { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
            { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
          );
        }
        break;
      case 'polyline':
        // 🛡️ GUARD: Ensure vertices exist and are valid
        // 🏢 ADR: Use centralized isValidPointStrict for bounds calculations
        if (entity.vertices && Array.isArray(entity.vertices)) {
          const validVertices = entity.vertices.filter(isValidPointStrict);
          allPoints.push(...validVertices);
        }
        break;
      case 'text':
        // 🛡️ GUARD: Ensure position exists and is finite
        // 🏢 ADR: Use centralized isValidPointStrict for bounds calculations
        if (isValidPointStrict(entity.position)) {
          allPoints.push(entity.position);
          // 🏢 ADR-107: Use centralized text metrics ratio for width estimation
          // 🏢 ADR-142: Use centralized DEFAULT_FONT_SIZE for fallback
          const textWidth = (entity.text?.length || 1) * (entity.height || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE) * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;
          allPoints.push({
            x: entity.position.x + textWidth,
            y: entity.position.y + (entity.height || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE)
          });
        }
        break;
    }
  }

  return calculateBoundingBox(allPoints);
}

/**
 * Δημιουργία bounds από color layers
 */
export function createBoundsFromLayers(layers: ColorLayer[]): { min: Point2D; max: Point2D } | null {
  if (layers.length === 0) return null;

  const allPoints: Point2D[] = [];

  for (const layer of layers) {
    if (layer.polygons && layer.polygons.length > 0) {
      // Process all polygons in the layer
      for (const polygon of layer.polygons) {
        if (polygon && polygon.vertices && polygon.vertices.length > 0) {
          // LayerPolygon.vertices are already Point2D objects {x, y}
          allPoints.push(...polygon.vertices);
        }
      }
    }
  }

  return calculateBoundingBox(allPoints);
}

/**
 * Δημιουργία combined bounds από DXF scene και layers
 *
 * @param dxfScene - The DXF scene
 * @param layers - Color layers
 * @param forceRecalculate - If true, recalculates bounds from entities instead of using cached scene.bounds.
 *                          Use for Zoom-to-Fit when dynamically added entities need to be included.
 *                          Default: false
 */
export function createCombinedBounds(
  dxfScene: DxfScene | null,
  layers: ColorLayer[],
  forceRecalculate: boolean = false
): { min: Point2D; max: Point2D } | null {
  const dxfBounds = createBoundsFromDxfScene(dxfScene, forceRecalculate);
  const layerBounds = createBoundsFromLayers(layers);

  if (!dxfBounds && !layerBounds) return null;
  if (!dxfBounds) return layerBounds;
  if (!layerBounds) return dxfBounds;

  // Union both bounds
  return {
    min: {
      x: Math.min(dxfBounds.min.x, layerBounds.min.x),
      y: Math.min(dxfBounds.min.y, layerBounds.min.y)
    },
    max: {
      x: Math.max(dxfBounds.max.x, layerBounds.max.x),
      y: Math.max(dxfBounds.max.y, layerBounds.max.y)
    }
  };
}

// === BOUNDS VALIDATION ===

/**
 * Έλεγχος αν bounds είναι valid
 * 🏢 ADR-034: Delegates to centralized SpatialUtils.isValidRect
 */
export function isValidBounds(bounds: { min: Point2D; max: Point2D } | null): boolean {
  return SpatialUtils.isValidRect(bounds);
}

/**
 * Έλεγχος αν bounds έχει minimum size
 */
export function hasMinimumSize(
  bounds: { min: Point2D; max: Point2D },
  minSize: number = 0.001
): boolean {
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  return width >= minSize && height >= minSize;
}

// === BOUNDS MANIPULATION ===

/**
 * Επέκταση bounds με padding
 */
export function expandBounds(
  bounds: { min: Point2D; max: Point2D },
  padding: number
): { min: Point2D; max: Point2D } {
  return {
    min: {
      x: bounds.min.x - padding,
      y: bounds.min.y - padding
    },
    max: {
      x: bounds.max.x + padding,
      y: bounds.max.y + padding
    }
  };
}

/**
 * Κανονικοποίηση bounds (ensure min < max)
 */
export function normalizeBounds(bounds: {
  min: Point2D;
  max: Point2D;
}): { min: Point2D; max: Point2D } {
  return {
    min: {
      x: Math.min(bounds.min.x, bounds.max.x),
      y: Math.min(bounds.min.y, bounds.max.y)
    },
    max: {
      x: Math.max(bounds.min.x, bounds.max.x),
      y: Math.max(bounds.min.y, bounds.max.y)
    }
  };
}

// === BOUNDS PROPERTIES ===

/**
 * Υπολογισμός width/height από bounds
 */
export function getBoundsDimensions(bounds: { min: Point2D; max: Point2D }): {
  width: number;
  height: number;
  area: number;
} {
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;

  return {
    width,
    height,
    area: width * height
  };
}

/**
 * Υπολογισμός aspect ratio από bounds
 */
export function getBoundsAspectRatio(bounds: { min: Point2D; max: Point2D }): number {
  const { width, height } = getBoundsDimensions(bounds);
  return height === 0 ? 1 : width / height;
}

/**
 * Υπολογισμός center point από bounds
 * ✅ MOVED FROM calculations.ts - Centralization
 */
export function getBoundsCenter(bounds: { min: Point2D; max: Point2D }): Point2D {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2
  };
}

// === DEFAULT BOUNDS ===

/**
 * Default bounds για κενό scene
 */
export function getDefaultBounds(): { min: Point2D; max: Point2D } {
  return {
    min: { x: -100, y: -100 },
    max: { x: 100, y: 100 }
  };
}

/**
 * Viewport bounds (0,0 to width,height)
 */
export function getViewportBounds(viewport: { width: number; height: number }): {
  min: Point2D;
  max: Point2D;
} {
  // 🏢 ADR-118: Use EMPTY_BOUNDS pattern for min coordinate
  return {
    min: { ...EMPTY_BOUNDS.min },
    max: { x: viewport.width, y: viewport.height }
  };
}

// ============================================================================
// 🏢 ENTITY BOUNDS CALCULATION
// ============================================================================
// Centralized bounds calculation for individual entities
// ============================================================================

/**
 * 🏢 CANONICAL: Entity interface for bounds calculation
 * Supports all common entity types without coupling to specific type systems
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
 * 🏢 CANONICAL: Legacy bounds format for backward compatibility
 */
export interface LegacyBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 🏢 CANONICAL: Get bounds for a single entity
 * Returns modern Bounds format { min, max }
 *
 * @param entity - The entity to calculate bounds for
 * @returns Bounds object or null if entity type not supported
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
        // 🏢 ADR-158: Centralized Infinity Bounds Initialization
        const polyBounds = createInfinityBounds();

        for (const vertex of entity.vertices) {
          // 🏢 ADR: Use centralized isValidPoint for coordinate validation
          if (isValidPoint(vertex)) {
            polyBounds.minX = Math.min(polyBounds.minX, vertex.x);
            polyBounds.minY = Math.min(polyBounds.minY, vertex.y);
            polyBounds.maxX = Math.max(polyBounds.maxX, vertex.x);
            polyBounds.maxY = Math.max(polyBounds.maxY, vertex.y);
          }
        }

        // 🏢 ADR-158: Use centralized isInfinityBounds check
        if (!isInfinityBounds(polyBounds)) {
          return { min: { x: polyBounds.minX, y: polyBounds.minY }, max: { x: polyBounds.maxX, y: polyBounds.maxY } };
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
        // 🏢 ADR-107: Use centralized text metrics ratio for width estimation
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

/**
 * 🏢 CANONICAL: Get bounds in legacy format { minX, minY, maxX, maxY }
 * For backward compatibility with older code
 *
 * @deprecated Prefer getEntityBounds() which returns modern Bounds format
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
 * 🏢 CANONICAL: Convert legacy bounds to modern Bounds format
 */
export function legacyToModernBounds(legacy: LegacyBounds): Bounds {
  return {
    min: { x: legacy.minX, y: legacy.minY },
    max: { x: legacy.maxX, y: legacy.maxY }
  };
}

/**
 * 🏢 CANONICAL: Convert modern Bounds to legacy format
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
// 🏢 SCENE BOUNDS NORMALIZATION
// ============================================================================
// Functions for calculating tight bounds and normalizing entity positions
// ============================================================================

/**
 * 🏢 CANONICAL: Mutable entity interface for position normalization
 * Extends BoundsEntity with mutable position properties
 */
export interface MutableBoundsEntity extends BoundsEntity {
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  vertices?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  position?: { x: number; y: number };
}

/**
 * 🏢 CANONICAL: Calculate tight bounds from entity array
 *
 * Calculates precise bounds from all entities and normalizes positions
 * so that bottom-left corner is at (0,0).
 *
 * @param entities - Array of entities to calculate bounds for
 * @param normalize - If true, also normalizes entity positions (default: false)
 * @returns Normalized bounds with bottom-left at (0,0)
 */
export function calculateTightBounds(
  entities: BoundsEntity[],
  normalize: boolean = false
): Bounds {
  // 🏢 ADR-118: Use centralized DEFAULT_BOUNDS for empty entity array
  if (entities.length === 0) {
    return { ...DEFAULT_BOUNDS };
  }

  // 🏢 ADR-158: Centralized Infinity Bounds Initialization
  const bounds = createInfinityBounds();

  // ΒΗΜΑ 1: Εύρεση ΑΚΡΙΒΩΝ bounds
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

  // 🏢 ADR-158: Use centralized isInfinityBounds check
  if (isInfinityBounds(bounds)) {
    console.warn('Invalid bounds calculated, using defaults');
    // 🏢 ADR-118: Use centralized DEFAULT_BOUNDS for invalid bounds fallback
    return { ...DEFAULT_BOUNDS };
  }

  // ΒΗΜΑ 2: Optional normalization
  if (normalize) {
    const offsetX = -bounds.minX;
    const offsetY = -bounds.minY;
    normalizeEntityPositions(entities as MutableBoundsEntity[], offsetX, offsetY);

    // Return normalized bounds
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
 * 🏢 CANONICAL: Calculate tight bounds and normalize positions
 *
 * Wrapper for calculateTightBounds with normalize=true
 *
 * @param entities - Array of entities to normalize
 * @returns Normalized bounds with bottom-left at (0,0)
 */
export function calculateTightBoundsNormalized(entities: MutableBoundsEntity[]): Bounds {
  return calculateTightBounds(entities, true);
}

/**
 * 🏢 CANONICAL: Normalize entity positions
 *
 * Applies offset to all entities so that bottom-left corner is at (0,0).
 * Mutates entities in place for performance.
 *
 * @param entities - Array of entities to normalize
 * @param offsetX - X offset to apply
 * @param offsetY - Y offset to apply
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
              // 🏢 ADR: Use centralized isValidPoint for coordinate validation
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