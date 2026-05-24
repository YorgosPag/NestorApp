/**
 * 🎯 ΕΝΙΑΙΟΣ ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟΣ MARQUEE SELECTION
 *
 * ✅ ΣΩΣΤΗ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ - Όλα σε ΕΝΑ API:
 * - DXF Entities (lines, circles, polylines, etc.)
 * - Overlay Regions
 * - Color Layers
 * - Mixed selections + Lasso (free-form polygon)
 */

import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { isPointInPolygon, segmentsIntersect } from '../../utils/geometry/GeometryUtils';
import { UnifiedEntitySelection } from './utils';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import {
  selectItemsInMarquee,
  selectColorLayersInMarquee,
} from './universal-marquee-geometry';

export type { UniversalSelectionInput, UniversalSelectionResult } from './universal-marquee-types';
import type { UniversalSelectionInput, UniversalSelectionResult } from './universal-marquee-types';

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

    // 🏢 ADR-105: Use centralized fallback tolerance as default
    const {
      entities = [],
      entityLayers = {},
      overlays = [],
      colorLayers = [],
      tolerance = TOLERANCE_CONFIG.HIT_TEST_FALLBACK,
      enableDebugLogs = false,
      onLayerSelected,
      currentPosition
    } = input;

    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };

    const marqueeScreenBounds = {
      min: { x: Math.min(startPoint.x, endPoint.x), y: Math.min(startPoint.y, endPoint.y) },
      max: { x: Math.max(startPoint.x, endPoint.x), y: Math.max(startPoint.y, endPoint.y) }
    };

    const marqueeWorldStart = CoordinateTransforms.screenToWorld(startPoint, transform, viewport);
    const marqueeWorldEnd = CoordinateTransforms.screenToWorld(endPoint, transform, viewport);
    const marqueeWorldBounds = {
      min: { x: Math.min(marqueeWorldStart.x, marqueeWorldEnd.x), y: Math.min(marqueeWorldStart.y, marqueeWorldEnd.y) },
      max: { x: Math.max(marqueeWorldStart.x, marqueeWorldEnd.x), y: Math.max(marqueeWorldStart.y, marqueeWorldEnd.y) }
    };

    const isCrossing = startPoint.x > endPoint.x;
    const selectionType = isCrossing ? 'crossing' : 'window';

    if (enableDebugLogs) {
      console.log('🎯 UNIVERSAL MARQUEE SELECTOR (CSS COORDS):', {
        startPoint, endPoint, selectionType, viewport,
        marqueeScreenBounds, marqueeWorldBounds,
        entityCount: entities.length, overlayCount: overlays.length, layerCount: colorLayers.length,
        totalItems: entities.length + overlays.length + colorLayers.length
      });
    }

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
        console.log('🎯 ENTITY SELECTION:', { tested: entities.length, selected: entityIds.length, ids: entityIds });
      }
    }

    // 2. OVERLAY SELECTION (screen coordinates)
    if (overlays.length > 0) {
      const overlayIds = selectItemsInMarquee(
        overlays.map(o => ({ id: o.id, vertices: o.vertices })),
        marqueeScreenBounds, isCrossing, tolerance, 'OVERLAY', enableDebugLogs, transform, viewport
      );
      breakdown.overlayIds = overlayIds;
      allSelectedIds.push(...overlayIds);
    }

    // 3. COLOR LAYER SELECTION (screen coordinates)
    if (colorLayers.length > 0) {
      const layerIds = selectColorLayersInMarquee(
        colorLayers, marqueeScreenBounds, isCrossing, tolerance, enableDebugLogs, transform, viewport
      );
      breakdown.layerIds = layerIds;
      allSelectedIds.push(...layerIds);
    }

    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ MULTI-SELECTION LOGIC
    let callbacksExecuted = 0;
    if (onLayerSelected && currentPosition && allSelectedIds.length > 0) {
      if (enableDebugLogs) {
        console.log('🎯 UNIVERSAL SELECTOR: Executing multi-selection callbacks:', {
          totalSelected: allSelectedIds.length, selectedIds: allSelectedIds
        });
      }
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
   * Lasso selection — free-form polygon selection (AutoCAD 3rd selection mode).
   *
   * mode='window'  (CW lasso):   entity fully inside lasso polygon
   * mode='crossing' (CCW lasso): entity intersects or is inside lasso polygon
   */
  static performLassoSelection(
    lassoScreenPath: readonly Point2D[],
    mode: 'window' | 'crossing',
    transform: ViewTransform,
    canvasRect: DOMRect,
    input: Pick<UniversalSelectionInput, 'entities' | 'colorLayers' | 'enableDebugLogs'>,
  ): UniversalSelectionResult {
    const { entities = [], colorLayers = [], enableDebugLogs = false } = input;

    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };
    const lassoMutable = lassoScreenPath as Point2D[];

    const allSelectedIds: string[] = [];
    const breakdown = { entityIds: [] as string[], overlayIds: [] as string[], layerIds: [] as string[] };

    // 1. Entity selection — window/crossing via UnifiedEntitySelection (world-space).
    if (entities.length > 0) {
      const ids = UnifiedEntitySelection.findEntitiesInLasso(lassoMutable, entities, transform, canvasRect, mode);
      breakdown.entityIds = ids;
      allSelectedIds.push(...ids);
    }

    // 2. Color layer selection — lasso polygon vs layer polygons (screen-space).
    if (colorLayers.length > 0) {
      const screenLasso = lassoMutable;
      const layerIds: string[] = [];

      for (const layer of colorLayers) {
        if (!layer.visible) continue;
        let layerSelected = false;

        for (const polygon of layer.polygons) {
          const screenVerts = polygon.vertices.map(v => CoordinateTransforms.worldToScreen(v, transform, viewport));

          if (mode === 'window') {
            layerSelected = screenVerts.every(v => isPointInPolygon(v, screenLasso));
          } else {
            const anyInside = screenVerts.some(v => isPointInPolygon(v, screenLasso));
            if (anyInside) {
              layerSelected = true;
            } else {
              outer: for (let li = 0; li < screenLasso.length; li++) {
                const la = screenLasso[li];
                const lb = screenLasso[(li + 1) % screenLasso.length];
                for (let pi = 0; pi < screenVerts.length; pi++) {
                  const pa = screenVerts[pi];
                  const pb = screenVerts[(pi + 1) % screenVerts.length];
                  if (segmentsIntersect(la, lb, pa, pb)) {
                    layerSelected = true;
                    break outer;
                  }
                }
              }
            }
          }

          if (layerSelected) break;
        }

        if (layerSelected) {
          layerIds.push(layer.id);
          allSelectedIds.push(layer.id);
        }
      }

      breakdown.layerIds = layerIds;
    }

    if (enableDebugLogs) {
      console.log('🎯 LASSO SELECTOR:', {
        mode, pathPoints: lassoScreenPath.length,
        entities: entities.length, colorLayers: colorLayers.length,
        selected: allSelectedIds.length, breakdown,
      });
    }

    const worldPts = lassoMutable.map(p => CoordinateTransforms.screenToWorld(p, transform, viewport));
    const xs = worldPts.map(p => p.x);
    const ys = worldPts.map(p => p.y);
    const selectionBounds = {
      min: { x: Math.min(...xs), y: Math.min(...ys) },
      max: { x: Math.max(...xs), y: Math.max(...ys) },
    };

    return {
      selectedIds: allSelectedIds,
      selectionType: mode,
      selectionBounds,
      callbacksExecuted: 0,
      breakdown,
    };
  }
}
