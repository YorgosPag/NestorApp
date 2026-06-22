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

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneModel, TextEntity, HatchEntity } from '../../types/entities';
import { isSlabEntity, isSlabOpeningEntity, isOpeningEntity, isWallEntity, isBeamEntity, isColumnEntity, isFoundationEntity, isMepFixtureEntity, isElectricalPanelEntity, isRailingEntity, isFurnitureEntity, isMepSegmentEntity, isMepFittingEntity, isFloorplanSymbolEntity, isMepManifoldEntity, isMepRadiatorEntity, isMepBoilerEntity, isMepWaterHeaterEntity, isMepUnderfloorEntity, isRoofEntity, isFloorFinishEntity, isThermalSpaceEntity, isSpaceSeparatorEntity, isXLineEntity, isRayEntity, isHatchEntity } from '../../types/entities';
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
import type { FoundationEntity } from '../../bim/types/foundation-types';
// ADR-470 — per-element structural component visibility override.
import type { BimElementStyleOverride } from '../../config/bim-object-styles';
// ADR-406 — MEP fixture direct entity for DXF render pipeline.
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
// ADR-408 Εύρος Β #2 — heating boiler direct entity for DXF render pipeline.
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
// ADR-408 DHW — domestic hot water heater direct entity for DXF render pipeline.
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
// ADR-408 Εύρος Β #3 — underfloor heating direct entity for DXF render pipeline.
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
// ADR-407 — railing direct entity for DXF render pipeline.
import type { RailingEntity } from '../../bim/types/railing-types';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
// ADR-417 — roof direct entity for DXF render pipeline.
import type { RoofEntity } from '../../bim/types/roof-types';
// ADR-419 — floor finish direct entity for DXF render pipeline.
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import type { ThermalSpaceEntity } from '../../bim/types/thermal-space-types';
import type { SpaceSeparatorEntity } from '../../bim/types/space-separator-types';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import type { MepFittingEntity } from '../../bim/types/mep-fitting-types';
import type { DimensionEntity } from '../../types/dimension';
import { extractFlatText } from '../../utils/text-node-utils';
import { getLayerNameOrDefault } from '../../config/layer-config';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT (LayerStore lookup + legacy name fallback)
import { resolveEntityLayerName } from '../../stores/LayerStore';
import { UI_COLORS } from '../../config/color-config';
// ADR-344 Phase 6.E — textNode style/height resolution (SRP extraction, ≤500 LOC).
import { extractFirstRunStyle, resolveTextHeight } from './dxf-text-style-extractor';
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
  // ADR-470 — per-element structural component visibility override (BIM entities only).
  const so = entity as typeof entity & { styleOverride?: BimElementStyleOverride };

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
    // ADR-470 — forward the per-element structural component visibility override so
    // the scene-level overlay passes (σοβάς/οπλισμός) honour per-element toggles too.
    ...(so.styleOverride !== undefined && { styleOverride: so.styleOverride }),
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
      // ADR-510 Φ3b/Φ3c — carry the per-segment arc/width parallel arrays through
      // to the canvas/grip path (index-aligned with vertices) so arcs render and
      // arc-midpoint grips appear. Absent ⇒ all-straight (back-compat).
      const e = entity as typeof entity & {
        vertices: Point2D[]; closed: boolean;
        bulges?: number[]; startWidths?: number[]; endWidths?: number[];
      };
      return {
        ...base, type: 'polyline' as const, vertices: e.vertices, closed: e.closed,
        ...(e.bulges ? { bulges: e.bulges } : {}),
        ...(e.startWidths ? { startWidths: e.startWidths } : {}),
        ...(e.endWidths ? { endWidths: e.endWidths } : {}),
      } as DxfEntityUnion;
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
      // ADR-186: LWPolyline → render as standard polyline.
      // ADR-510 Φ3b/Φ3c — carry bulge/width parallel arrays (see 'polyline' case).
      const e = entity as typeof entity & {
        vertices: Point2D[]; closed?: boolean;
        bulges?: number[]; startWidths?: number[]; endWidths?: number[];
      };
      return {
        ...base, type: 'polyline' as const, vertices: e.vertices, closed: e.closed ?? false,
        ...(e.bulges ? { bulges: e.bulges } : {}),
        ...(e.startWidths ? { startWidths: e.startWidths } : {}),
        ...(e.endWidths ? { endWidths: e.endWidths } : {}),
      } as DxfEntityUnion;
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
    case 'foundation': {
      // ADR-436 Slice 1 — direct entity (same pattern as column/beam). FoundationRenderer
      // reads geometry.footprint + kind + params at top level. Without this case,
      // freshly-committed foundations were silently dropped here → invisible on 2D
      // canvas (visible only in 3D which reads params directly).
      if (!isFoundationEntity(entity)) return null;
      const fnd = entity as FoundationEntity;
      return { ...base, type: 'foundation' as const, kind: fnd.kind, params: fnd.params, geometry: fnd.geometry, validation: fnd.validation } as DxfEntityUnion;
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
    case 'roof': {
      // ADR-417 — direct entity (same pattern as slab/furniture). RoofRenderer
      // reads geometry.faces + geometry.ridges + footprint at top level. Without
      // this case, freshly-committed roofs are silently dropped → invisible on
      // 2D canvas (visible only in 3D which reads params directly).
      if (!isRoofEntity(entity)) return null;
      const rf = entity as RoofEntity;
      return { ...base, type: 'roof' as const, kind: rf.kind, params: rf.params, geometry: rf.geometry, validation: rf.validation } as DxfEntityUnion;
    }
    case 'floor-finish': {
      // ADR-419 — direct entity (same pattern as slab/roof). FloorFinishRenderer
      // reads geometry.bbox + params.footprint + params.materialId at top level.
      // Without this case, freshly-committed floor-finishes are silently dropped
      // here → invisible on 2D canvas.
      if (!isFloorFinishEntity(entity)) return null;
      const ff = entity as FloorFinishEntity;
      return { ...base, type: 'floor-finish' as const, kind: ff.kind, params: ff.params, geometry: ff.geometry } as DxfEntityUnion;
    }
    case 'thermal-space': {
      // ADR-422 — analytical thermal space (IfcSpace), area-based (same pattern as
      // floor-finish). ThermalSpaceRenderer reads geometry.bbox + params.footprint +
      // params.useType at top level. Without this case freshly-committed thermal
      // spaces are silently dropped here → invisible on 2D canvas.
      if (!isThermalSpaceEntity(entity)) return null;
      const ts = entity as ThermalSpaceEntity;
      return { ...base, type: 'thermal-space' as const, kind: ts.kind, params: ts.params, geometry: ts.geometry } as DxfEntityUnion;
    }
    case 'space-separator': {
      // ADR-437 — space separator (IfcVirtualElement), direct entity (same pattern as
      // thermal-space). SpaceSeparatorRenderer reads geometry.bbox + params.start/end at
      // top level. Without this case freshly-committed separators are silently dropped
      // here → invisible on 2D canvas.
      if (!isSpaceSeparatorEntity(entity)) return null;
      const ss = entity as SpaceSeparatorEntity;
      return { ...base, type: 'space-separator' as const, kind: ss.kind, params: ss.params, geometry: ss.geometry } as DxfEntityUnion;
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
    case 'mep-manifold': {
      // ADR-408 Φ12 — plumbing manifold (same pattern as electrical-panel).
      // MepManifoldRenderer reads geometry.footprint + kind + params at top level.
      // Without this case, freshly-committed manifolds are silently dropped here →
      // invisible on 2D canvas (visible only in 3D which reads params directly).
      if (!isMepManifoldEntity(entity)) return null;
      const mfld = entity as MepManifoldEntity;
      return { ...base, type: 'mep-manifold' as const, kind: mfld.kind, params: mfld.params, geometry: mfld.geometry, validation: mfld.validation } as DxfEntityUnion;
    }
    case 'mep-radiator': {
      // ADR-408 Εύρος Β — heating radiator (same pattern as mep-manifold).
      // MepRadiatorRenderer reads geometry.footprint + kind + params at top level.
      // Without this case, freshly-committed radiators are silently dropped here →
      // invisible on 2D canvas (visible only in 3D which reads params directly).
      if (!isMepRadiatorEntity(entity)) return null;
      const rad = entity as MepRadiatorEntity;
      return { ...base, type: 'mep-radiator' as const, kind: rad.kind, params: rad.params, geometry: rad.geometry, validation: rad.validation } as DxfEntityUnion;
    }
    case 'mep-boiler': {
      // ADR-408 Εύρος Β #2 — heating boiler (same pattern as mep-radiator).
      // MepBoilerRenderer reads geometry.footprint + kind + params at top level.
      // Without this case, freshly-committed boilers are silently dropped here →
      // invisible on 2D canvas (visible only in 3D which reads params directly).
      if (!isMepBoilerEntity(entity)) return null;
      const blr = entity as MepBoilerEntity;
      return { ...base, type: 'mep-boiler' as const, kind: blr.kind, params: blr.params, geometry: blr.geometry, validation: blr.validation } as DxfEntityUnion;
    }
    case 'mep-water-heater': {
      // ADR-408 DHW — domestic hot water heater (same pattern as mep-boiler).
      // MepWaterHeaterRenderer reads geometry.footprint + kind + params at top level.
      // Without this case, freshly-committed water heaters are silently dropped here →
      // invisible on 2D canvas (visible only in 3D which reads params directly).
      if (!isMepWaterHeaterEntity(entity)) return null;
      const wh = entity as MepWaterHeaterEntity;
      return { ...base, type: 'mep-water-heater' as const, kind: wh.kind, params: wh.params, geometry: wh.geometry, validation: wh.validation } as DxfEntityUnion;
    }
    case 'mep-underfloor': {
      // ADR-408 Εύρος Β #3 — underfloor heating loop (area-based, same pattern as floor-finish).
      // MepUnderfloorRenderer reads geometry.loopPath + geometry.bbox + params.footprint at top
      // level. Without this case, freshly-committed underfloor loops are silently dropped here →
      // invisible on 2D canvas (the same trap as all BIM area entities above).
      if (!isMepUnderfloorEntity(entity)) return null;
      const uf = entity as MepUnderfloorEntity;
      return { ...base, type: 'mep-underfloor' as const, kind: uf.kind, params: uf.params, geometry: uf.geometry, validation: uf.validation } as DxfEntityUnion;
    }
    case 'hatch': {
      // ADR-507 S2 — direct entity (boundaryPaths + fill/pattern fields at top
      // level). Χωρίς αυτό το case το committed hatch έπεφτε στο default → null →
      // αόρατο στον 2D καμβά (το S1 είχε καταχωρήσει μόνο τον HatchRenderer).
      if (!isHatchEntity(entity)) return null;
      const h = entity as HatchEntity;
      return {
        ...base,
        type: 'hatch' as const,
        boundaryPaths: h.boundaryPaths,
        fillType: h.fillType,
        fillColor: h.fillColor,
        patternType: h.patternType,
        patternName: h.patternName,
        patternScale: h.patternScale,
        patternAngle: h.patternAngle,
        patternOrigin: h.patternOrigin,
        lineAngle: h.lineAngle,
        lineSpacing: h.lineSpacing,
        doubleCrossHatch: h.doubleCrossHatch,
        islandStyle: h.islandStyle,
        // ADR-507 Φ5 — gradient γέμισμα· χωρίς αυτό ο HatchRenderer βλέπει gradient:undefined
        // και πέφτει σε solid (το gradient δεν φτάνει ποτέ στον καμβά).
        gradient: h.gradient,
        drawOrder: h.drawOrder,
      } as DxfEntityUnion;
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
