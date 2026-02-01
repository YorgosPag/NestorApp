/**
 * COLOR LAYER UTILITIES
 * Κεντρικοποιημένες μέθοδοι για μετατροπή ColorLayer → OverlayEntities
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Αποφυγή διάσπαρτου κώδικα
 */

import type { ColorLayer } from '../canvas-v2/layer-canvas/layer-types';
import type { Point2D } from '../rendering/types/Types';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
import { createInfinityBounds } from '../config/geometry-constants';

export interface OverlayEntity {
  id: string;
  vertices: Point2D[];
}

export class ColorLayerUtils {
  /**
   * Μετατρέπει ColorLayer[] σε OverlayEntity[] για bounds calculations
   */
  static toOverlayEntities(colorLayers: ColorLayer[]): OverlayEntity[] {
    return colorLayers.flatMap(layer =>
      layer.polygons.map(polygon => ({
        id: polygon.id,
        vertices: polygon.vertices
      }))
    );
  }

  /**
   * Υπολογίζει bounds από ColorLayer[]
   */
  static calculateBounds(colorLayers: ColorLayer[]): { min: Point2D; max: Point2D } | null {
    const overlayEntities = this.toOverlayEntities(colorLayers);
    if (overlayEntities.length === 0) return null;

    // 🏢 ADR-158: Centralized Infinity Bounds Initialization
    const bounds = createInfinityBounds();

    for (const entity of overlayEntities) {
      for (const vertex of entity.vertices) {
        bounds.minX = Math.min(bounds.minX, vertex.x);
        bounds.minY = Math.min(bounds.minY, vertex.y);
        bounds.maxX = Math.max(bounds.maxX, vertex.x);
        bounds.maxY = Math.max(bounds.maxY, vertex.y);
      }
    }

    return {
      min: { x: bounds.minX, y: bounds.minY },
      max: { x: bounds.maxX, y: bounds.maxY }
    };
  }

  /**
   * Ελέγχει αν υπάρχουν visible layers
   */
  static hasVisibleLayers(colorLayers: ColorLayer[]): boolean {
    return colorLayers.some(layer => layer.visible && layer.polygons.length > 0);
  }

  /**
   * Φιλτράρει μόνο τα visible layers
   */
  static getVisibleLayers(colorLayers: ColorLayer[]): ColorLayer[] {
    return colorLayers.filter(layer => layer.visible);
  }
}