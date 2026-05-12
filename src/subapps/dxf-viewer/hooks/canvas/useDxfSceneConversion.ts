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
import type { DxfScene, DxfEntityUnion, DxfTextStyle } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneModel } from '../../types/entities';
import type { DxfTextNode, TextRun } from '../../text-engine/types';
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

/**
 * ADR-344 Phase 6.E — Extract plain text string from textNode paragraphs.
 * Used when the scene entity (e.g. from CreateTextCommand) has no flat `text` field.
 */
function extractFlatText(textNode: DxfTextNode): string {
  return textNode.paragraphs
    .map(p => (p.runs ?? [])
      .filter(r => !('top' in r))
      .map(r => (r as TextRun).text)
      .join(''))
    .join('\n');
}

/**
 * ADR-344 Phase 6.E — Extract canvas-renderable style from the first run of textNode.
 * Returns undefined when textNode is absent or yields no style fields.
 */
function extractFirstRunStyle(entity: SceneEntity): DxfTextStyle | undefined {
  const withNode = entity as { textNode?: DxfTextNode };
  if (!withNode.textNode) return undefined;
  const result: DxfTextStyle = {};

  // Node-level: attachment → textAlign (H) + textBaseline (V).
  const attachment = withNode.textNode.attachment;
  if (attachment) {
    const row = attachment[0]; // 'TL'[0]='T', 'ML'[0]='M', 'BL'[0]='B'
    const col = attachment[1]; // 'TL'[1]='L', 'TC'[1]='C', 'TR'[1]='R'
    if (col === 'C') result.textAlign = 'center';
    else if (col === 'R') result.textAlign = 'right';
    // 'L' = default 'left', omit
    if (row === 'M') result.textBaseline = 'middle';
    else if (row === 'B') result.textBaseline = 'bottom';
    // 'T' = default 'top', omit
  }

  // Run-level: first run style (bold / italic / underline / font / color).
  const para = withNode.textNode.paragraphs?.[0];
  const run = para?.runs?.[0];
  if (run && !('top' in run)) {
    const s = (run as TextRun).style;
    if (s) {
      if (s.bold !== undefined) result.bold = s.bold;
      if (s.italic !== undefined) result.italic = s.italic;
      if (s.underline !== undefined) result.underline = s.underline;
      if (s.fontFamily) result.fontFamily = s.fontFamily;
      if (s.color) {
        // DxfColor can be a truthy string (#rrggbb) or DXF-special constant.
        const c = s.color;
        if (typeof c === 'string' && c) result.runColor = c;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * ADR-344 Phase 6.E — Resolve text height: prefer first run's textNode height,
 * fall back to flat entity.height / entity.fontSize / default.
 */
function resolveTextHeight(entity: SceneEntity): number {
  const withNode = entity as { textNode?: DxfTextNode; height?: number; fontSize?: number };
  const run = withNode.textNode?.paragraphs?.[0]?.runs?.[0];
  if (run && !('top' in run)) {
    const h = (run as TextRun).style?.height;
    if (h !== undefined && h > 0) return h;
  }
  return withNode.height || withNode.fontSize || TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE;
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
      const e = entity as typeof entity & { position: Point2D; text?: string; rotation?: number };
      const withNode = entity as { textNode?: DxfTextNode };
      // ADR-344 Phase 6.E: entities from CreateTextCommand have no flat text — derive it.
      const flatText = e.text ?? (withNode.textNode ? extractFlatText(withNode.textNode) : '');
      const textHeight = resolveTextHeight(entity);
      const textStyle = extractFirstRunStyle(entity);
      return {
        ...base,
        type: 'text' as const,
        position: e.position,
        text: flatText,
        height: textHeight,
        rotation: e.rotation,
        ...(textStyle && { textStyle }),
      } as DxfEntityUnion;
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
