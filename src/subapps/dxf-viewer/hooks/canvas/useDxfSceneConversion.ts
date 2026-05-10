/**
 * 🏢 ENTERPRISE: useDxfSceneConversion Hook
 *
 * @description Converts a SceneModel (level-based scene) into a DxfScene
 * compatible with the Canvas V2 rendering system (DxfCanvas).
 *
 * EXTRACTED FROM: CanvasSection.tsx (lines ~663-766) — ~100 lines of conversion logic
 *
 * PERF (2026-05-10): WeakMap entity cache — when `currentScene` reference
 * changes but individual entity references stay stable, the converted
 * DxfEntityUnion is reused. Eliminates O(N) object spreads per render
 * for unchanged entities (was 667ms self-time on N=large DXF files).
 */

'use client';

import { useMemo, useRef } from 'react';

import { perfMark } from '../../debug/perf-line-profile';
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

type SceneEntity = NonNullable<SceneModel['entities']>[number];
type SceneLayers = NonNullable<SceneModel['layers']>;

export interface UseDxfSceneConversionParams {
  currentScene: SceneModel | null;
}

export interface UseDxfSceneConversionReturn {
  dxfScene: DxfScene;
}

// ============================================================================
// PURE CONVERSION HELPERS (module-level, stable refs)
// ============================================================================

function buildBase(entity: SceneEntity, layers: SceneLayers) {
  const layerInfo = entity.layer ? layers[entity.layer] : null;
  const m = entity as typeof entity & {
    measurement?: boolean;
    showEdgeDistances?: boolean;
  };
  return {
    id: entity.id,
    layer: getLayerNameOrDefault(entity.layer),
    color: String(entity.color || layerInfo?.color || UI_COLORS.WHITE),
    lineWidth: entity.lineweight || 1,
    visible: entity.visible ?? true,
    ...(m.measurement !== undefined && { measurement: m.measurement }),
    ...(m.showEdgeDistances !== undefined && { showEdgeDistances: m.showEdgeDistances }),
  };
}

function rectangleToVertices(e: {
  corner1?: Point2D; corner2?: Point2D;
  x?: number; y?: number; width?: number; height?: number;
}): Point2D[] | null {
  if (e.corner1 && e.corner2) {
    return [
      e.corner1,
      { x: e.corner2.x, y: e.corner1.y },
      e.corner2,
      { x: e.corner1.x, y: e.corner2.y },
    ];
  }
  if (e.x !== undefined && e.y !== undefined && e.width !== undefined && e.height !== undefined) {
    const c1: Point2D = { x: e.x, y: e.y };
    const c2: Point2D = { x: e.x + e.width, y: e.y + e.height };
    return [c1, { x: c2.x, y: c1.y }, c2, { x: c1.x, y: c2.y }];
  }
  return null;
}

function convertEntity(entity: SceneEntity, layers: SceneLayers): DxfEntityUnion | null {
  const base = buildBase(entity, layers);

  switch (entity.type) {
    case 'line': {
      const e = entity as typeof entity & { start: Point2D; end: Point2D };
      return { ...base, type: 'line' as const, start: e.start, end: e.end } as DxfEntityUnion;
    }
    case 'circle': {
      const e = entity as typeof entity & { center: Point2D; radius: number };
      return { ...base, type: 'circle' as const, center: e.center, radius: e.radius } as DxfEntityUnion;
    }
    case 'polyline': {
      const e = entity as typeof entity & { vertices: Point2D[]; closed: boolean };
      return { ...base, type: 'polyline' as const, vertices: e.vertices, closed: e.closed } as DxfEntityUnion;
    }
    case 'arc': {
      const e = entity as typeof entity & { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean };
      return { ...base, type: 'arc' as const, center: e.center, radius: e.radius, startAngle: e.startAngle, endAngle: e.endAngle, counterclockwise: e.counterclockwise } as DxfEntityUnion;
    }
    case 'text': {
      // ⚠️ VERIFIED WORKING: height || fontSize || DEFAULT_FONT_SIZE — DO NOT swap order (ADR-142)
      const e = entity as typeof entity & { position: Point2D; text: string; fontSize?: number; height?: number; rotation?: number };
      const textHeight = e.height || e.fontSize || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE;
      return { ...base, type: 'text' as const, position: e.position, text: e.text, height: textHeight, rotation: e.rotation } as DxfEntityUnion;
    }
    case 'angle-measurement': {
      const e = entity as typeof entity & { vertex: Point2D; point1: Point2D; point2: Point2D; angle: number };
      return { ...base, type: 'angle-measurement' as const, vertex: e.vertex, point1: e.point1, point2: e.point2, angle: e.angle } as DxfEntityUnion;
    }
    case 'lwpolyline': {
      // ADR-186: LWPolyline → render as standard polyline
      const e = entity as typeof entity & { vertices: Point2D[]; closed: boolean };
      return { ...base, type: 'polyline' as const, vertices: e.vertices, closed: e.closed ?? false } as DxfEntityUnion;
    }
    case 'rectangle': {
      const e = entity as typeof entity & {
        corner1?: Point2D; corner2?: Point2D;
        x?: number; y?: number; width?: number; height?: number;
      };
      const verts = rectangleToVertices(e);
      if (!verts) {
        dwarn('useDxfSceneConversion', 'Rectangle entity missing geometry:', entity.id);
        return null;
      }
      return { ...base, type: 'polyline' as const, vertices: verts, closed: true } as DxfEntityUnion;
    }
    default:
      dwarn('useDxfSceneConversion', 'Unsupported entity type:', entity.type);
      return null;
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useDxfSceneConversion({
  currentScene,
}: UseDxfSceneConversionParams): UseDxfSceneConversionReturn {

  // Per-entity conversion cache. Keyed by entity object identity — when
  // SceneModel.entities is rebuilt but individual entries keep the same ref
  // (the common case for incremental scene updates), conversion is skipped.
  const cacheRef = useRef<WeakMap<object, DxfEntityUnion>>(new WeakMap());

  const dxfScene = useMemo<DxfScene>(() => perfMark('useDxfSceneConversion.memo', () => {
    const entities = currentScene?.entities ?? [];
    const layers = currentScene?.layers ?? {};
    const cache = cacheRef.current;
    const converted: DxfEntityUnion[] = [];

    for (const entity of entities) {
      let result = cache.get(entity);
      if (!result) {
        const c = convertEntity(entity, layers);
        if (c) {
          result = c;
          cache.set(entity, c);
        }
      }
      if (result) converted.push(result);
    }

    return {
      entities: converted,
      layers: Object.keys(layers),
      bounds: currentScene?.bounds ?? null,
    };
  }), [currentScene]);

  return { dxfScene };
}
