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
import { TEXT_METRICS_RATIOS, TEXT_SIZE_LIMITS } from '../../../config/text-rendering-config';
import { calculateBoundingBox } from '../../../rendering/entities/shared/geometry-utils';
import { EMPTY_BOUNDS } from '../../../config/geometry-constants';
import { isValidPointStrict } from '../../../rendering/entities/shared/entity-validation-utils';
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
// 🏢 RE-EXPORTS FROM bounds-entity.ts (ADR-065 split)
// ============================================================================
// Backward compatibility — all entity-bounds exports available from this module
// ============================================================================

export {
  getEntityBounds,
  getEntityBoundsLegacy,
  legacyToModernBounds,
  modernToLegacyBounds,
  calculateTightBounds,
  calculateTightBoundsNormalized,
  normalizeEntityPositions,
} from './bounds-entity';

export type {
  BoundsEntity,
  LegacyBounds,
  MutableBoundsEntity,
} from './bounds-entity';