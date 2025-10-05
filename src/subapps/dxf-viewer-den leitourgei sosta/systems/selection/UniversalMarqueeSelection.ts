/**
 * 🎯 ΕΝΙΑΙΟΣ ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟΣ MARQUEE SELECTION
 *
 * ✅ ΣΩΣΤΗ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ - Όλα σε ΕΝΑ αρχείο:
 * - DXF Entities (lines, circles, polylines, etc.)
 * - Overlay Regions
 * - Color Layers
 * - Mixed selections
 *
 * ✅ ΕΝΙΑΙΟ API - Μία function για όλα
 * ✅ AutoCAD-style Window vs Crossing selection
 * ✅ Tolerance support για μικρά αντικείμενα
 * ✅ Debug logging
 */

import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { type AnySceneEntity, type SceneLayer } from '../../types/scene';
import type { Region } from '../../types/overlay';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import { UnifiedEntitySelection } from './utils';
import { calculateVerticesBounds } from '../../utils/geometry/GeometryUtils';

// ✅ ΕΝΙΑΙΟ SELECTION INTERFACE - Δουλεύει για όλα τα types
export interface UniversalSelectionInput {
  // DXF Entities (optional)
  entities?: AnySceneEntity[];
  entityLayers?: Record<string, SceneLayer>;

  // Overlay Regions (optional)
  overlays?: Region[];

  // Color Layers (optional)
  colorLayers?: ColorLayer[];

  // Selection settings
  tolerance?: number; // Default: 5 pixels
  enableDebugLogs?: boolean; // Default: false

  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ CALLBACKS - Όλη η multi-selection λογική εδώ
  onLayerSelected?: (layerId: string, position: Point2D) => void; // Individual layer callback
  currentPosition?: Point2D; // Current cursor position for callbacks
}

// ✅ ΕΝΙΑΙΟ SELECTION OUTPUT - Ενιαίο αποτέλεσμα για όλα
export interface UniversalSelectionResult {
  selectedIds: string[]; // Όλα τα επιλεγμένα IDs μαζί
  selectionType: 'window' | 'crossing';
  selectionBounds: { min: Point2D, max: Point2D };
  callbacksExecuted: number; // 🎯 ADD: Πόσα callbacks εκτελέστηκαν

  // Breakdown αν χρειάζεται (optional)
  breakdown?: {
    entityIds: string[];
    overlayIds: string[];
    layerIds: string[];
  };

  debugInfo?: {
    testedEntities: number;
    testedOverlays: number;
    testedLayers: number;
    totalTested: number;
    isCrossing: boolean;
  };
}

/**
 * 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟΣ UNIVERSAL MARQUEE SELECTOR
 *
 * ΜΙΑ ΜΟΝΟ ΚΛΑΣΗ - ΜΙΑ ΜΟΝΟ FUNCTION για όλα τα selection types
 */
export class UniversalMarqueeSelector {

  /**
   * 🚀 Η ΜΟΝΑΔΙΚΗ FUNCTION που χρειάζεται
   *
   * Χειρίζεται όλα τα selection types με ενιαίο API:
   * - Entities, Overlays, ColorLayers σε μία κλήση
   * - Ενιαίο αποτέλεσμα με όλα τα επιλεγμένα IDs
   * - AutoCAD-style Window vs Crossing logic
   */
  static performSelection(
    startPoint: Point2D,
    endPoint: Point2D,
    transform: ViewTransform,
    canvasRect: DOMRect,
    input: UniversalSelectionInput
  ): UniversalSelectionResult {

    const {
      entities = [],
      entityLayers = {},
      overlays = [],
      colorLayers = [],
      tolerance = 5,
      enableDebugLogs = false,
      onLayerSelected, // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ CALLBACK
      currentPosition
    } = input;

    // ✅ COORDINATE SETUP - CSS coordinates (no DPR scaling needed)
    const viewport: Viewport = {
      width: canvasRect.width,
      height: canvasRect.height
    };

    // Screen coordinates for comparison - normalize για DPR consistency
    const marqueeScreenBounds = {
      min: {
        x: Math.min(startPoint.x, endPoint.x),
        y: Math.min(startPoint.y, endPoint.y)
      },
      max: {
        x: Math.max(startPoint.x, endPoint.x),
        y: Math.max(startPoint.y, endPoint.y)
      }
    };

    // World coordinates για entity selection (που χρειάζεται world coords)
    const marqueeWorldStart = CoordinateTransforms.screenToWorld(startPoint, transform, viewport);
    const marqueeWorldEnd = CoordinateTransforms.screenToWorld(endPoint, transform, viewport);
    const marqueeWorldBounds = {
      min: {
        x: Math.min(marqueeWorldStart.x, marqueeWorldEnd.x),
        y: Math.min(marqueeWorldStart.y, marqueeWorldEnd.y)
      },
      max: {
        x: Math.max(marqueeWorldStart.x, marqueeWorldEnd.x),
        y: Math.max(marqueeWorldStart.y, marqueeWorldEnd.y)
      }
    };

    // ✅ AUTOCAD-STYLE SELECTION LOGIC
    const isCrossing = startPoint.x > endPoint.x;
    const selectionType = isCrossing ? 'crossing' : 'window';

    if (enableDebugLogs) {
      console.log('🎯 UNIVERSAL MARQUEE SELECTOR (CSS COORDS):', {
        startPoint,
        endPoint,
        selectionType,
        viewport,
        marqueeScreenBounds,
        marqueeWorldBounds,
        entityCount: entities.length,
        overlayCount: overlays.length,
        layerCount: colorLayers.length,
        totalItems: entities.length + overlays.length + colorLayers.length
      });
    }

    // ✅ ΕΝΙΑΙΟΣ ΣΥΛΛΕΚΤΗΣ ΕΠΙΛΟΓΩΝ - Όλα μαζί
    const allSelectedIds: string[] = [];
    const breakdown = {
      entityIds: [] as string[],
      overlayIds: [] as string[],
      layerIds: [] as string[]
    };

    // 1. ENTITY SELECTION
    if (entities.length > 0) {
      const entityIds = UnifiedEntitySelection.findEntitiesInMarquee(
        startPoint, endPoint, entities, transform, canvasRect
      );
      breakdown.entityIds = entityIds;
      allSelectedIds.push(...entityIds);

      if (enableDebugLogs) {
        console.log('🎯 ENTITY SELECTION:', {
          tested: entities.length,
          selected: entityIds.length,
          ids: entityIds
        });
      }
    }

    // 2. OVERLAY SELECTION (χρησιμοποιεί screen coordinates)
    if (overlays.length > 0) {
      const overlayIds = this.selectItemsInMarquee(
        overlays.map(o => ({ id: o.id, vertices: o.vertices })),
        marqueeScreenBounds,
        isCrossing,
        tolerance,
        'OVERLAY',
        enableDebugLogs,
        transform,
        viewport
      );
      breakdown.overlayIds = overlayIds;
      allSelectedIds.push(...overlayIds);
    }

    // 3. COLOR LAYER SELECTION (χρησιμοποιεί screen coordinates)
    if (colorLayers.length > 0) {
      const layerIds = this.selectColorLayersInMarquee(
        colorLayers,
        marqueeScreenBounds,
        isCrossing,
        tolerance,
        enableDebugLogs,
        transform,
        viewport
      );
      breakdown.layerIds = layerIds;
      allSelectedIds.push(...layerIds);
    }

    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ MULTI-SELECTION LOGIC
    let callbacksExecuted = 0;
    if (onLayerSelected && currentPosition && allSelectedIds.length > 0) {
      if (enableDebugLogs) {
        console.log('🎯 UNIVERSAL SELECTOR: Executing multi-selection callbacks:', {
          totalSelected: allSelectedIds.length,
          selectedIds: allSelectedIds
        });
      }

      // Call onLayerSelected for each selected layer
      allSelectedIds.forEach((layerId, index) => {
        if (enableDebugLogs) {
          console.log(`🎯 UNIVERSAL SELECTOR: Executing callback ${index + 1}/${allSelectedIds.length} for layer: ${layerId}`);
        }
        onLayerSelected(layerId, currentPosition);
        callbacksExecuted++;
      });

      if (enableDebugLogs) {
        console.log(`🎯 UNIVERSAL SELECTOR: Multi-selection completed - ${callbacksExecuted} callbacks executed`);
      }
    }

    // ✅ ΕΝΙΑΙΟ ΑΠΟΤΕΛΕΣΜΑ
    return {
      selectedIds: allSelectedIds,
      selectionType,
      selectionBounds: marqueeWorldBounds,
      callbacksExecuted,
      breakdown,
      debugInfo: enableDebugLogs ? {
        testedEntities: entities.length,
        testedOverlays: overlays.length,
        testedLayers: colorLayers.length,
        totalTested: entities.length + overlays.length + colorLayers.length,
        isCrossing
      } : undefined
    };
  }

  /**
   * 🔧 ΕΝΙΑΙΑ SELECTION LOGIC για vertices-based items (overlays)
   */
  private static selectItemsInMarquee(
    items: Array<{ id: string, vertices: Point2D[] }>,
    marqueeBounds: { min: Point2D, max: Point2D },
    isCrossing: boolean,
    tolerance: number,
    itemType: string,
    enableDebugLogs: boolean,
    transform: ViewTransform,
    viewport: Viewport
  ): string[] {

    const selectedIds: string[] = [];

    for (const item of items) {
      // 🔥 FIX: Convert world coordinates to screen coordinates before calculating bounds
      const screenVertices = item.vertices.map(vertex =>
        CoordinateTransforms.worldToScreen(vertex, transform, viewport)
      );
      const itemBounds = this.calculateBounds(screenVertices);
      if (!itemBounds) continue;

      let selected = false;

      if (isCrossing) {
        selected = this.boundsIntersect(itemBounds, marqueeBounds);
      } else {
        selected = this.isFullyInsideWithTolerance(itemBounds, marqueeBounds, tolerance);
      }

      if (selected) {
        selectedIds.push(item.id);
      }

      if (enableDebugLogs) {
        console.log(`🎯 ${isCrossing ? 'CROSSING' : 'WINDOW'} [${itemType} ${item.id}]:`, {
          itemBounds,
          marqueeScreenBounds: marqueeBounds,
          worldVertices: item.vertices.slice(0, 3),
          screenVertices: screenVertices.slice(0, 3),
          selected
        });
      }
    }

    return selectedIds;
  }

  /**
   * 🔧 ΕΝΙΑΙΑ COLOR LAYER SELECTION LOGIC
   */
  private static selectColorLayersInMarquee(
    layers: ColorLayer[],
    marqueeBounds: { min: Point2D, max: Point2D },
    isCrossing: boolean,
    tolerance: number,
    enableDebugLogs: boolean,
    transform: ViewTransform,
    viewport: Viewport
  ): string[] {

    const selectedIds: string[] = [];

    for (const layer of layers) {
      if (!layer.visible) continue;

      // Test each polygon in the layer
      let layerSelected = false;

      for (const polygon of layer.polygons) {
        // 🔥 RE-FIXED: Polygon vertices are in WORLD coordinates, must transform to screen
        // to match marquee bounds (screen coordinates) - consistent με LayerRenderer
        const screenVertices = polygon.vertices.map(vertex =>
          CoordinateTransforms.worldToScreen(vertex, transform, viewport)
        );
        const polygonBounds = this.calculateBounds(screenVertices);
        if (!polygonBounds) continue;

        let selected = false;

        if (isCrossing) {
          selected = this.boundsIntersect(polygonBounds, marqueeBounds);
        } else {
          selected = this.isFullyInsideWithTolerance(polygonBounds, marqueeBounds, tolerance);
        }

        if (selected) {
          layerSelected = true;
          break;
        }

        if (enableDebugLogs) {
          console.log(`🎯 ${isCrossing ? 'CROSSING' : 'WINDOW'} [Layer ${layer.id}, Polygon ${polygon.id}]:`, {
            polygonBounds: polygonBounds,
            marqueeScreenBounds: marqueeBounds,
            worldVertices: polygon.vertices.slice(0, 3),
            screenVertices: screenVertices.slice(0, 3),
            selected
          });
        }
      }

      if (layerSelected) {
        selectedIds.push(layer.id);

        if (enableDebugLogs) {
          console.log(`🎯 LAYER SELECTED: ${layer.id}`);
        }
      }
    }

    return selectedIds;
  }

  /**
   * 🔧 ΕΝΙΑΙΑ BOUNDS CALCULATION - Uses centralized method
   */
  private static calculateBounds(vertices: Point2D[]): { min: Point2D, max: Point2D } | null {
    return calculateVerticesBounds(vertices);
  }

  /**
   * 🔧 ΕΝΙΑΙΑ BOUNDS INTERSECTION TEST
   */
  private static boundsIntersect(
    bounds1: { min: Point2D, max: Point2D },
    bounds2: { min: Point2D, max: Point2D }
  ): boolean {
    return !(
      bounds1.max.x < bounds2.min.x ||
      bounds1.min.x > bounds2.max.x ||
      bounds1.max.y < bounds2.min.y ||
      bounds1.min.y > bounds2.max.y
    );
  }

  /**
   * 🔧 ΕΝΙΑΙΑ WINDOW SELECTION WITH TOLERANCE
   */
  private static isFullyInsideWithTolerance(
    itemBounds: { min: Point2D, max: Point2D },
    marqueeBounds: { min: Point2D, max: Point2D },
    tolerance: number
  ): boolean {

    const itemWidth = itemBounds.max.x - itemBounds.min.x;
    const itemHeight = itemBounds.max.y - itemBounds.min.y;

    // For very small items, use intersect logic instead of fully-inside
    if (itemWidth < tolerance || itemHeight < tolerance) {
      return this.boundsIntersect(itemBounds, marqueeBounds);
    }

    // For normal-sized items, require fully inside
    return (
      itemBounds.min.x >= marqueeBounds.min.x &&
      itemBounds.max.x <= marqueeBounds.max.x &&
      itemBounds.min.y >= marqueeBounds.min.y &&
      itemBounds.max.y <= marqueeBounds.max.y
    );
  }
}