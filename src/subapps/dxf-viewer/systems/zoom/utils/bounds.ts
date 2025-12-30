/**
 * ZOOM SYSTEM - BOUNDS UTILITIES
 * Utilities για bounds calculations και validation
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { DxfScene } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../../canvas-v2/layer-canvas/layer-types';

// === BOUNDS CREATION ===

/**
 * Δημιουργία bounds από array of points
 */
export function createBoundsFromPoints(points: Point2D[]): { min: Point2D; max: Point2D } | null {
  if (points.length === 0) return null;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) }
  };
}

/**
 * Δημιουργία bounds από DXF scene
 */
export function createBoundsFromDxfScene(scene: DxfScene | null): { min: Point2D; max: Point2D } | null {
  if (!scene || !scene.entities || scene.entities.length === 0) {
    return null;
  }

  // Use scene bounds if available
  if (scene.bounds) {
    return scene.bounds;
  }

  // Calculate bounds from entities
  const allPoints: Point2D[] = [];

  for (const entity of scene.entities) {
    switch (entity.type) {
      case 'line':
        allPoints.push(entity.start, entity.end);
        break;
      case 'circle':
        // Add circle bounding box points
        allPoints.push(
          { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
          { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
        );
        break;
      case 'arc':
        // Add arc bounding box points (simplified)
        allPoints.push(
          { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
          { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
        );
        break;
      case 'polyline':
        allPoints.push(...entity.vertices);
        break;
      case 'text':
        allPoints.push(entity.position);
        // Add approximate text bounds
        const textWidth = entity.text.length * entity.height * 0.6;
        allPoints.push({
          x: entity.position.x + textWidth,
          y: entity.position.y + entity.height
        });
        break;
    }
  }

  return createBoundsFromPoints(allPoints);
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

  return createBoundsFromPoints(allPoints);
}

/**
 * Δημιουργία combined bounds από DXF scene και layers
 */
export function createCombinedBounds(
  dxfScene: DxfScene | null,
  layers: ColorLayer[]
): { min: Point2D; max: Point2D } | null {
  const dxfBounds = createBoundsFromDxfScene(dxfScene);
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
 */
export function isValidBounds(bounds: { min: Point2D; max: Point2D } | null): boolean {
  if (!bounds) return false;

  return (
    isFinite(bounds.min.x) &&
    isFinite(bounds.min.y) &&
    isFinite(bounds.max.x) &&
    isFinite(bounds.max.y) &&
    bounds.max.x > bounds.min.x &&
    bounds.max.y > bounds.min.y
  );
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
  return {
    min: { x: 0, y: 0 },
    max: { x: viewport.width, y: viewport.height }
  };
}