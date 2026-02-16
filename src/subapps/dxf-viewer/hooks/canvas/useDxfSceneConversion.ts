/**
 * 🏢 ENTERPRISE: useDxfSceneConversion Hook
 *
 * @description Converts a SceneModel (level-based scene) into a DxfScene
 * compatible with the Canvas V2 rendering system (DxfCanvas).
 *
 * EXTRACTED FROM: CanvasSection.tsx (lines ~663-766) — ~100 lines of conversion logic
 *
 * RESPONSIBILITIES:
 * 1. Map SceneModel entities → DxfEntityUnion (line, circle, polyline, arc, text, angle-measurement, rectangle→polyline)
 * 2. Resolve layer colors from scene layer definitions
 * 3. Forward measurement flags (showEdgeDistances) for distance label rendering
 * 4. Handle null/undefined scenes gracefully (empty DxfScene)
 *
 * COUPLING: ZERO with viewport/selection/overlay/drawing logic
 * DEPENDENCIES: currentScene (injected), config imports (stable)
 */

'use client';

import { useMemo } from 'react';

import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/entities';
import { getLayerNameOrDefault } from '../../config/layer-config';
import { UI_COLORS } from '../../config/color-config';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
import { dwarn } from '../../debug';

// ============================================================================
// TYPES
// ============================================================================

export interface UseDxfSceneConversionParams {
  /** Current scene from level system (null when no level/scene active) */
  currentScene: SceneModel | null;
}

export interface UseDxfSceneConversionReturn {
  /** Converted DxfScene ready for DxfCanvas rendering */
  dxfScene: DxfScene;
}

// ============================================================================
// HOOK
// ============================================================================

export function useDxfSceneConversion({
  currentScene,
}: UseDxfSceneConversionParams): UseDxfSceneConversionReturn {

  const dxfScene = useMemo<DxfScene>(() => {
    const entities = currentScene?.entities ?? [];
    const layers = currentScene?.layers ?? {};

    const converted: DxfEntityUnion[] = [];

    for (const entity of entities) {
      const layerInfo = entity.layer ? layers[entity.layer] : null;

      // Measurement flags for distance label rendering (from useUnifiedDrawing)
      const entityWithMeasurement = entity as typeof entity & {
        measurement?: boolean;
        showEdgeDistances?: boolean;
      };

      const base = {
        id: entity.id,
        layer: getLayerNameOrDefault(entity.layer),
        color: String(entity.color || layerInfo?.color || UI_COLORS.WHITE),
        lineWidth: entity.lineweight || 1,
        visible: entity.visible ?? true,
        ...(entityWithMeasurement.measurement !== undefined && { measurement: entityWithMeasurement.measurement }),
        ...(entityWithMeasurement.showEdgeDistances !== undefined && { showEdgeDistances: entityWithMeasurement.showEdgeDistances }),
      };

      switch (entity.type) {
        case 'line': {
          const e = entity as typeof entity & { start: Point2D; end: Point2D };
          converted.push({ ...base, type: 'line' as const, start: e.start, end: e.end } as DxfEntityUnion);
          break;
        }
        case 'circle': {
          const e = entity as typeof entity & { center: Point2D; radius: number };
          converted.push({ ...base, type: 'circle' as const, center: e.center, radius: e.radius } as DxfEntityUnion);
          break;
        }
        case 'polyline': {
          const e = entity as typeof entity & { vertices: Point2D[]; closed: boolean };
          converted.push({ ...base, type: 'polyline' as const, vertices: e.vertices, closed: e.closed } as DxfEntityUnion);
          break;
        }
        case 'arc': {
          const e = entity as typeof entity & { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean };
          converted.push({ ...base, type: 'arc' as const, center: e.center, radius: e.radius, startAngle: e.startAngle, endAngle: e.endAngle, counterclockwise: e.counterclockwise } as DxfEntityUnion);
          break;
        }
        case 'text': {
          // ╔════════════════════════════════════════════════════════════════════╗
          // ║ ⚠️ VERIFIED WORKING - height || fontSize || DEFAULT_FONT_SIZE     ║
          // ║ ΜΗΝ αλλάξετε σε fontSize || height - ΧΑΛΑΕΙ τα κείμενα!          ║
          // ║ 🏢 ADR-142: Centralized DEFAULT_FONT_SIZE for fallback           ║
          // ╚════════════════════════════════════════════════════════════════════╝
          const e = entity as typeof entity & { position: Point2D; text: string; fontSize?: number; height?: number; rotation?: number };
          const textHeight = e.height || e.fontSize || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE;
          converted.push({ ...base, type: 'text' as const, position: e.position, text: e.text, height: textHeight, rotation: e.rotation } as DxfEntityUnion);
          break;
        }
        case 'angle-measurement': {
          const e = entity as typeof entity & { vertex: Point2D; point1: Point2D; point2: Point2D; angle: number };
          converted.push({ ...base, type: 'angle-measurement' as const, vertex: e.vertex, point1: e.point1, point2: e.point2, angle: e.angle } as DxfEntityUnion);
          break;
        }
        case 'rectangle': {
          // DXF Standard: rectangles stored as closed polylines (4 vertices)
          const e = entity as typeof entity & { corner1: Point2D; corner2: Point2D };
          const { corner1, corner2 } = e;
          const vertices: Point2D[] = [
            corner1,
            { x: corner2.x, y: corner1.y },
            corner2,
            { x: corner1.x, y: corner2.y },
          ];
          converted.push({ ...base, type: 'polyline' as const, vertices, closed: true } as DxfEntityUnion);
          break;
        }
        default:
          dwarn('useDxfSceneConversion', 'Unsupported entity type:', entity.type);
          break;
      }
    }

    return {
      entities: converted,
      layers: Object.keys(layers),
      bounds: currentScene?.bounds ?? null,
    };
  }, [currentScene]);

  return { dxfScene };
}
