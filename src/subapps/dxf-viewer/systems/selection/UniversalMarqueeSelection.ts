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
// 🏢 ADR-089: Centralized Point-In-Bounds
import { SpatialUtils } from '../../core/spatial/SpatialUtils';

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
        // 🏢 ENTERPRISE (2026-01-25): Use accurate polygon-to-rectangle intersection
        selected = this.polygonIntersectsRectangle(screenVertices, marqueeBounds);
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
          // 🏢 ENTERPRISE (2026-01-25): Use accurate polygon-to-rectangle intersection
          // instead of bounding box intersection to avoid false positives with overlapping layers
          selected = this.polygonIntersectsRectangle(screenVertices, marqueeBounds);
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
   * 🔧 ΕΝΙΑΙΑ BOUNDS INTERSECTION TEST (for bounding boxes only)
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
   * 🏢 ENTERPRISE (2026-01-25): Accurate polygon-to-rectangle intersection test
   * Used for crossing selection to avoid false positives with overlapping layers
   *
   * Returns true if:
   * 1. Any vertex of the polygon is inside the selection rectangle, OR
   * 2. Any edge of the polygon intersects the selection rectangle, OR
   * 3. The selection rectangle is entirely inside the polygon
   */
  private static polygonIntersectsRectangle(
    polygonVertices: Point2D[],
    rectBounds: { min: Point2D, max: Point2D }
  ): boolean {
    if (polygonVertices.length < 3) return false;

    // 1. Check if any polygon vertex is inside the rectangle
    // 🏢 ADR-089: Centralized Point-In-Bounds
    for (const vertex of polygonVertices) {
      if (SpatialUtils.pointInRect(vertex, rectBounds)) {
        return true;
      }
    }

    // 2. Check if any polygon edge intersects the rectangle
    for (let i = 0; i < polygonVertices.length; i++) {
      const p1 = polygonVertices[i];
      const p2 = polygonVertices[(i + 1) % polygonVertices.length];

      if (this.lineIntersectsRectangle(p1, p2, rectBounds)) {
        return true;
      }
    }

    // 3. Check if rectangle center is inside the polygon (rectangle entirely inside polygon)
    const rectCenter: Point2D = {
      x: (rectBounds.min.x + rectBounds.max.x) / 2,
      y: (rectBounds.min.y + rectBounds.max.y) / 2
    };
    if (this.pointInPolygon(rectCenter, polygonVertices)) {
      return true;
    }

    return false;
  }

  /**
   * 🏢 ENTERPRISE (2026-01-25): Line segment to rectangle intersection test
   */
  private static lineIntersectsRectangle(
    p1: Point2D,
    p2: Point2D,
    rect: { min: Point2D, max: Point2D }
  ): boolean {
    // Check if line intersects any of the 4 rectangle edges
    const rectCorners = [
      { x: rect.min.x, y: rect.min.y }, // bottom-left
      { x: rect.max.x, y: rect.min.y }, // bottom-right
      { x: rect.max.x, y: rect.max.y }, // top-right
      { x: rect.min.x, y: rect.max.y }  // top-left
    ];

    for (let i = 0; i < 4; i++) {
      const r1 = rectCorners[i];
      const r2 = rectCorners[(i + 1) % 4];
      if (this.lineSegmentsIntersect(p1, p2, r1, r2)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 🏢 ENTERPRISE (2026-01-25): Line segment intersection test using cross product
   */
  private static lineSegmentsIntersect(
    p1: Point2D, p2: Point2D,
    p3: Point2D, p4: Point2D
  ): boolean {
    const d1 = this.direction(p3, p4, p1);
    const d2 = this.direction(p3, p4, p2);
    const d3 = this.direction(p1, p2, p3);
    const d4 = this.direction(p1, p2, p4);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }

    // Check collinear cases
    if (d1 === 0 && this.onSegment(p3, p4, p1)) return true;
    if (d2 === 0 && this.onSegment(p3, p4, p2)) return true;
    if (d3 === 0 && this.onSegment(p1, p2, p3)) return true;
    if (d4 === 0 && this.onSegment(p1, p2, p4)) return true;

    return false;
  }

  private static direction(pi: Point2D, pj: Point2D, pk: Point2D): number {
    return (pk.x - pi.x) * (pj.y - pi.y) - (pj.x - pi.x) * (pk.y - pi.y);
  }

  private static onSegment(pi: Point2D, pj: Point2D, pk: Point2D): boolean {
    return Math.min(pi.x, pj.x) <= pk.x && pk.x <= Math.max(pi.x, pj.x) &&
           Math.min(pi.y, pj.y) <= pk.y && pk.y <= Math.max(pi.y, pj.y);
  }

  /**
   * 🏢 ENTERPRISE (2026-01-25): Point in polygon test using ray casting
   */
  private static pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
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