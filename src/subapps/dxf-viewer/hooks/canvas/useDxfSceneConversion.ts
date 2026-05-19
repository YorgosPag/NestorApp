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

import { useEffect, useMemo, useRef } from 'react';

import { perfMark } from '../../debug/perf-line-profile';
import type { DxfScene, DxfEntityUnion, DxfTextStyle } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfColor } from '../../text-engine/types';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneModel, TextEntity, Entity } from '../../types/entities';
import { isArrayEntity, isStairEntity, isSlabEntity, isSlabOpeningEntity, isOpeningEntity, isXLineEntity, isRayEntity } from '../../types/entities';
import type { XLineEntity, RayEntity } from '../../types/entities';
import type { StairEntity } from '../../types/stair';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { PathParams } from '../../systems/array/types';
import type { DxfTextNode, TextRun } from '../../text-engine/types';
import { extractFlatText } from '../../utils/text-node-utils';
import { expandArrayEntity } from '../../systems/array/array-expander';
import { getLayerNameOrDefault } from '../../config/layer-config';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT (LayerStore lookup + legacy name fallback)
import { resolveEntityLayerName, setLayers as setLayerStoreLayers } from '../../stores/LayerStore';
import { UI_COLORS } from '../../config/color-config';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
import { dwarn } from '../../debug';

// ============================================================================
// TYPES
// ============================================================================

type SceneEntity = NonNullable<SceneModel['entities']>[number];
type SceneLayers = NonNullable<SceneModel['layersById']>;

export interface UseDxfSceneConversionParams {
  currentScene: SceneModel | null;
}

export interface UseDxfSceneConversionReturn {
  dxfScene: DxfScene;
}

// ============================================================================
// PURE CONVERSION HELPERS (module-level, stable refs)
// ============================================================================

/**
 * ADR-358 §G7 Phase 6 — sentinel-aware projection from SceneModel → DxfScene.
 *
 * Legacy path (Phase 1-5 baseline): entity declares concrete `color` + `lineweight`
 *   → flatten to `color` hex + `lineWidth` px (preserves visual baseline).
 *
 * Sentinel path (Phase 6 LIVE): entity declares `colorMode: 'ByLayer'`/'ByBlock' OR
 * `lineweightMm` ∈ { -3 DEFAULT, -2 BYLAYER, -1 BYBLOCK } OR
 * `linetypeName: 'ByLayer'/'ByBlock'`
 *   → forward the sentinel fields, SKIP the flattened legacy fields. The renderer's
 *   `resolveStyleForRender()` then cascades live through `layersById` → layer style.
 */
function buildBase(entity: SceneEntity, layers: SceneLayers, layersById?: SceneLayers) {
  // ADR-358 Phase 9D-3: id-first name resolution via LayerStore, fallback to legacy
  const resolvedLayerName = resolveEntityLayerName(entity);
  // ADR-358 Phase 9E-5: id-first layer object lookup (layersById), name-keyed fallback.
  const layerInfo = (entity.layerId && layersById ? layersById[entity.layerId] : undefined)
    ?? (resolvedLayerName ? layers[resolvedLayerName] : null);
  const m = entity as typeof entity & {
    measurement?: boolean;
    showEdgeDistances?: boolean;
  };

  const colorByLayer = entity.colorMode === 'ByLayer' || entity.colorMode === 'ByBlock';
  const lwSentinel = entity.lineweightMm !== undefined
    && (entity.lineweightMm === -3 || entity.lineweightMm === -2 || entity.lineweightMm === -1);
  const ltSentinel = entity.linetypeName === 'ByLayer' || entity.linetypeName === 'ByBlock';

  return {
    id: entity.id,
    // ADR-358 Phase 9D-3: id-first name resolution + ADR-130 default fallback
    layer: getLayerNameOrDefault(resolvedLayerName),
    // ADR-358 Phase 9D-2 — forward stable layerId when present. Resolves to id lookup
    // path in DxfRenderer/HitTester once Phase 9E re-keys scene.layers by id.
    ...(entity.layerId !== undefined && { layerId: entity.layerId }),
    // Phase 6: omit `color` when entity opts into ByLayer/ByBlock cascade. Resolver
    // reads `colorMode` + `layersById[layer].color` at render time.
    ...(colorByLayer
      ? {}
      : { color: String(entity.color || layerInfo?.color || UI_COLORS.WHITE) }),
    // Phase 6: omit `lineWidth` when entity declares a sentinel lineweight.
    // Resolver converts `layer.lineweight` mm → px via `lineweightToPx()`.
    ...(lwSentinel ? {} : { lineWidth: entity.lineweight || 1 }),
    visible: entity.visible ?? true,
    // ─── Sentinel forwarding (Phase 6 §G7) ─────────────────────────────
    ...(entity.colorMode !== undefined && { colorMode: entity.colorMode }),
    ...(entity.colorAci !== undefined && { colorAci: entity.colorAci }),
    ...(entity.colorTrueColor !== undefined && { colorTrueColor: entity.colorTrueColor }),
    ...((ltSentinel || entity.linetypeName) && { linetypeName: entity.linetypeName }),
    ...(entity.lineweightMm !== undefined && { lineweightMm: entity.lineweightMm }),
    ...(entity.transparency !== undefined && { transparency: entity.transparency }),
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
      if (s.overline !== undefined) result.overline = s.overline;
      if (s.strikethrough !== undefined) result.strikethrough = s.strikethrough;
      if (s.fontFamily) result.fontFamily = s.fontFamily;
      if (s.color) {
        const c = s.color as DxfColor;
        if (c.kind === 'TrueColor') {
          result.runColor = `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
        }
        // ByLayer / ByBlock → inherit entity color, omit runColor
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

function convertEntity(entity: SceneEntity, layers: SceneLayers, layersById?: SceneLayers): DxfEntityUnion | null {
  const base = buildBase(entity, layers, layersById);

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
    case 'mtext':
    case 'text': {
      const e = entity as typeof entity & { position: Point2D; text?: string; rotation?: number };
      const withNode = entity as TextEntity;
      // ADR-344 Phase 6.E: entities from CreateTextCommand have no flat text — derive it.
      // mtext normalised to 'text' because DxfEntityUnion has no mtext variant.
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
    case 'stair': {
      // ADR-358 Phase 5b — wrap StairEntity into DxfStair (no expansion). The
      // StairRenderer renders directly from `stairEntity.geometry`, and grip
      // computation reads the parametric grips from the StairEntity params via
      // `getStairGrips()`. SSoT: zero geometry duplication.
      const e = entity as StairEntity;
      return { ...base, type: 'stair' as const, stairEntity: e } as DxfEntityUnion;
    }
    case 'slab': {
      // ADR-363 Phase 3.7 — wrap SlabEntity. SlabRenderer renders geometry.polygon
      // fill + hatch. Per-frame slabOpeningsBySlab map cuts boolean holes.
      return isSlabEntity(entity)
        ? { ...base, type: 'slab' as const, slabEntity: entity as SlabEntity } as DxfEntityUnion
        : null;
    }
    case 'slab-opening': {
      // ADR-363 Phase 3.7 — wrap SlabOpeningEntity. SlabOpeningRenderer draws
      // dashed outline + kind annotation over the host slab cutout.
      return isSlabOpeningEntity(entity)
        ? { ...base, type: 'slab-opening' as const, slabOpeningEntity: entity as SlabOpeningEntity } as DxfEntityUnion
        : null;
    }
    case 'opening': {
      // ADR-363 Phase 2 (deferred pipeline) — wrap OpeningEntity. OpeningRenderer
      // draws outline + kind overlay; per-frame openingsByWall map drives WallRenderer
      // boolean cutouts so openings visually punch through wall fills.
      return isOpeningEntity(entity)
        ? { ...base, type: 'opening' as const, openingEntity: entity as OpeningEntity } as DxfEntityUnion
        : null;
    }
    case 'xline': {
      // ADR-359 Phase 11 — wrap XLineEntity for grip computation pipeline.
      return isXLineEntity(entity)
        ? { ...base, type: 'xline' as const, xlineEntity: entity as XLineEntity } as DxfEntityUnion
        : null;
    }
    case 'ray': {
      // ADR-359 Phase 11 — wrap RayEntity for grip computation pipeline.
      return isRayEntity(entity)
        ? { ...base, type: 'ray' as const, rayEntity: entity as RayEntity } as DxfEntityUnion
        : null;
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
  // ADR-353: 1:N cache for array entities (one ArrayEntity → multiple DxfEntityUnion items).
  const arrayCacheRef = useRef<WeakMap<object, DxfEntityUnion[]>>(new WeakMap());

  const dxfScene = useMemo<DxfScene>(() => perfMark('useDxfSceneConversion.memo', () => {
    const entities = currentScene?.entities ?? [];
    const layers = currentScene?.layersById ?? {};
    // ADR-358 Phase 9E-5: id-keyed primary for buildBase layerInfo lookup.
    const layersById = currentScene?.layersById;
    const cache = cacheRef.current;
    const arrayCache = arrayCacheRef.current;
    const converted: DxfEntityUnion[] = [];

    for (const entity of entities) {
      // ADR-353: ArrayEntity expands 1→N items before conversion.
      if (isArrayEntity(entity)) {
        let items = arrayCache.get(entity);
        if (!items) {
          const pathEnt = entity.arrayKind === 'path' && entity.params.kind === 'path'
            ? (entities as Entity[]).find(e => e.id === (entity.params as PathParams).pathEntityId)
            : undefined;
          const expanded = expandArrayEntity(entity, pathEnt);
          items = expanded.reduce<DxfEntityUnion[]>((acc, e) => {
            const c = convertEntity(e, layers, layersById);
            if (c) acc.push(c);
            return acc;
          }, []);
          if (items.length > 0) arrayCache.set(entity, items);
        }
        for (const item of items) converted.push(item);
        continue;
      }

      let result = cache.get(entity);
      if (!result) {
        const c = convertEntity(entity, layers, layersById);
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
      // ADR-358 Phase 9E-5 — id-first primary; name-keyed layers as legacy fallback.
      layersById: currentScene?.layersById,
      bounds: currentScene?.bounds ?? null,
    };
  }), [currentScene]);

  // ADR-358 §5.6.bis Phase 10 prerequisite — hydrate LayerStore from the
  // SceneModel snapshot whenever the current scene changes. This bridges the
  // cold SceneModel.layersById to the runtime LayerStore SSoT consumed by:
  //   - Phase 7 CurrentLayerPicker / Phase 8 AdminLayerManager (UI subscribers)
  //   - Phase 10 LayerIsolate/Off/Freeze/Lock commands (mutate via upsertLayer)
  // Idempotent — `setLayers` no-ops on identical input.
  useEffect(() => {
    const layersById = currentScene?.layersById;
    if (!layersById) return;
    setLayerStoreLayers(Object.values(layersById));
  }, [currentScene]);

  return { dxfScene };
}
