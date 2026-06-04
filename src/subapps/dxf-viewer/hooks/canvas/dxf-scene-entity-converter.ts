/**
 * 🏢 ENTERPRISE: DXF Scene Entity Converter (pure, module-level)
 *
 * @description Pure SceneModel-entity → DxfEntityUnion conversion helpers.
 * Extracted from useDxfSceneConversion.ts to keep that file ≤500 LOC (Google SRP).
 *
 * SSoT: BOTH the cached hook path ({@link useDxfSceneConversion}) and the
 * uncached snapshot path ({@link convertSceneToDxf}) consume {@link convertEntity}
 * — zero duplication of the per-entity projection logic.
 */

import type { DxfEntityUnion, DxfTextStyle } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfColor } from '../../text-engine/types';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneModel, TextEntity } from '../../types/entities';
import { isSlabEntity, isSlabOpeningEntity, isOpeningEntity, isWallEntity, isBeamEntity, isColumnEntity, isMepFixtureEntity, isElectricalPanelEntity, isRailingEntity, isFurnitureEntity, isMepSegmentEntity, isMepFittingEntity, isFloorplanSymbolEntity, isXLineEntity, isRayEntity } from '../../types/entities';
import type { XLineEntity, RayEntity } from '../../types/entities';
import type { StairEntity } from '../../bim/types/stair-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
// ADR-363 Phase 1B — wall wrapper for DXF render pipeline.
import type { WallEntity } from '../../bim/types/wall-types';
// ADR-363 Phase 5 — beam wrapper for DXF render pipeline.
import type { BeamEntity } from '../../bim/types/beam-types';
// ADR-363 Phase 4 — column direct entity for DXF render pipeline.
import type { ColumnEntity } from '../../bim/types/column-types';
// ADR-406 — MEP fixture direct entity for DXF render pipeline.
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
// ADR-407 — railing direct entity for DXF render pipeline.
import type { RailingEntity } from '../../bim/types/railing-types';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import type { MepFittingEntity } from '../../bim/types/mep-fitting-types';
import type { DimensionEntity } from '../../types/dimension';
import type { DxfTextNode, TextRun } from '../../text-engine/types';
import { extractFlatText } from '../../utils/text-node-utils';
import { getLayerNameOrDefault } from '../../config/layer-config';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT (LayerStore lookup + legacy name fallback)
import { resolveEntityLayerName } from '../../stores/LayerStore';
import { UI_COLORS } from '../../config/color-config';
import { TEXT_SIZE_LIMITS } from '../../config/text-rendering-config';
import { dwarn } from '../../debug';

export type SceneEntity = NonNullable<SceneModel['entities']>[number];
export type SceneLayers = NonNullable<SceneModel['layersById']>;

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

export function convertEntity(entity: SceneEntity, layers: SceneLayers, layersById?: SceneLayers): DxfEntityUnion | null {
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
    case 'dimension': {
      // ADR-362 — wrap DimensionEntity into DxfDimension so DxfRenderer +
      // buildDimensionLookup() see it. Without this case, freshly-committed dims
      // from useDimensionCreate were silently dropped here → invisible on canvas.
      return { ...base, type: 'dimension' as const, dimensionEntity: entity as DimensionEntity } as DxfEntityUnion;
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
    case 'wall': {
      // ADR-363 Phase 1B — direct entity (no wallEntity wrapper). Fields spread at
      // top level so geometry.bbox is accessible to BoundsCalculator spatial index
      // and HitTestingService without unwrapping (mirrors wall/opening/column/beam
      // "direct entities" contract in HitTestingService convertToEntityModel).
      if (!isWallEntity(entity)) return null;
      const w = entity as WallEntity;
      return { ...base, type: 'wall' as const, kind: w.kind, params: w.params, geometry: w.geometry, validation: w.validation } as DxfEntityUnion;
    }
    case 'beam': {
      // ADR-363 Phase 5 — direct entity (same pattern as wall). BeamRenderer
      // reads geometry.outline/axisPolyline + params fields at top level.
      if (!isBeamEntity(entity)) return null;
      const b = entity as BeamEntity;
      return { ...base, type: 'beam' as const, kind: b.kind, params: b.params, geometry: b.geometry, validation: b.validation } as DxfEntityUnion;
    }
    case 'column': {
      // ADR-363 Phase 4 — direct entity (same pattern as wall/beam). ColumnRenderer
      // reads geometry.footprint + kind + params fields at top level.
      // Without this case, freshly-committed columns were silently dropped here →
      // invisible on 2D canvas (visible only in 3D which reads params directly).
      if (!isColumnEntity(entity)) return null;
      const col = entity as ColumnEntity;
      return { ...base, type: 'column' as const, kind: col.kind, params: col.params, geometry: col.geometry, validation: col.validation } as DxfEntityUnion;
    }
    case 'mep-fixture': {
      // ADR-406 — direct entity (same pattern as wall/beam/column). MepFixtureRenderer
      // reads geometry.footprint + kind + params fields at top level. Without this
      // case, freshly-committed fixtures were silently dropped here → invisible on
      // 2D canvas (visible only in 3D which reads params directly).
      if (!isMepFixtureEntity(entity)) return null;
      const fx = entity as MepFixtureEntity;
      return { ...base, type: 'mep-fixture' as const, kind: fx.kind, params: fx.params, geometry: fx.geometry, validation: fx.validation } as DxfEntityUnion;
    }
    case 'electrical-panel': {
      // ADR-408 Φ3 — direct entity (same pattern as mep-fixture). ElectricalPanelRenderer
      // reads geometry.footprint + kind + params fields at top level. Without this case,
      // freshly-committed panels were silently dropped here → invisible on 2D canvas
      // (visible only in 3D which reads params directly).
      if (!isElectricalPanelEntity(entity)) return null;
      const pnl = entity as ElectricalPanelEntity;
      return { ...base, type: 'electrical-panel' as const, kind: pnl.kind, params: pnl.params, geometry: pnl.geometry, validation: pnl.validation } as DxfEntityUnion;
    }
    case 'railing': {
      // ADR-407 — direct entity (same pattern as wall/beam/column/mep-fixture).
      // RailingRenderer reads geometry.resolvedPath + params fields at top level.
      // Without this case, freshly-committed railings were silently dropped here →
      // invisible on 2D canvas (visible only in 3D which reads params directly).
      if (!isRailingEntity(entity)) return null;
      const rl = entity as RailingEntity;
      return { ...base, type: 'railing' as const, kind: rl.kind, params: rl.params, geometry: rl.geometry, validation: rl.validation } as DxfEntityUnion;
    }
    case 'furniture': {
      // ADR-410 — direct entity (same pattern as mep-fixture). FurnitureRenderer
      // reads geometry.footprint + kind + params fields at top level. Without this
      // case, freshly-committed furniture was silently dropped here → invisible on
      // 2D canvas (visible only in 3D which reads params directly).
      if (!isFurnitureEntity(entity)) return null;
      const fn = entity as FurnitureEntity;
      return { ...base, type: 'furniture' as const, kind: fn.kind, params: fn.params, geometry: fn.geometry, validation: fn.validation } as DxfEntityUnion;
    }
    case 'floorplan-symbol': {
      // ADR-415 — direct entity (same pattern as furniture/mep-fixture).
      // FloorplanSymbolRenderer reads geometry.footprint + kind + params at top
      // level. Without this case, freshly-committed symbols were silently dropped
      // here → invisible on 2D canvas (the same trap as the BIM entities above).
      if (!isFloorplanSymbolEntity(entity)) return null;
      const fs = entity as FloorplanSymbolEntity;
      return { ...base, type: 'floorplan-symbol' as const, kind: fs.kind, params: fs.params, geometry: fs.geometry, validation: fs.validation } as DxfEntityUnion;
    }
    case 'mep-segment': {
      // ADR-408 Φ8 — direct entity (same pattern as beam). MepSegmentRenderer reads
      // geometry.outline + axisPolyline + params at top level. Without this case,
      // freshly-committed segments are silently dropped here → invisible on 2D.
      if (!isMepSegmentEntity(entity)) return null;
      const seg = entity as MepSegmentEntity;
      return { ...base, type: 'mep-segment' as const, kind: seg.kind, params: seg.params, geometry: seg.geometry, validation: seg.validation } as DxfEntityUnion;
    }
    case 'mep-fitting': {
      // ADR-408 Φ11 — auto pipe fitting (same pattern as mep-segment/fixture).
      // MepFittingRenderer reads geometry.footprint + params.position/incidents at
      // top level. Without this case, auto-reconciled fittings are silently dropped
      // here → invisible on 2D even though they exist in the scene (furniture trap).
      if (!isMepFittingEntity(entity)) return null;
      const fit = entity as MepFittingEntity;
      return { ...base, type: 'mep-fitting' as const, kind: fit.kind, params: fit.params, geometry: fit.geometry, validation: fit.validation } as DxfEntityUnion;
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
