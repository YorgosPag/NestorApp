/**
 * COLOR LAYER UTILITIES
 * Κεντρικοποιημένες μέθοδοι για μετατροπή ColorLayer → OverlayEntities
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Αποφυγή διάσπαρτου κώδικα
 */

import type { ColorLayer } from '../canvas-v2/layer-canvas/layer-types';
import type { Point2D } from '../rendering/types/Types';

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

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const entity of overlayEntities) {
      for (const vertex of entity.vertices) {
        minX = Math.min(minX, vertex.x);
        minY = Math.min(minY, vertex.y);
        maxX = Math.max(maxX, vertex.x);
        maxY = Math.max(maxY, vertex.y);
      }
    }

    return {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY }
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