/**
 * 🏢 ENTERPRISE: DXF Scene Entity Handlers (introspectable per-type registry)
 *
 * @description The per-`EntityType` SceneModel→`DxfEntityUnion` projection handlers,
 * extracted from {@link convertEntity} (dxf-scene-entity-converter.ts) so that file
 * stays ≤500 LOC (Google SRP, N.7.1) AND the handled-type set becomes **introspectable**.
 *
 * ADR-587 Φ5 (TIER-2 introspectable seam) — the previous `switch (entity.type)` became a
 * type-keyed `TO_DXF_HANDLERS` registry (adapter — every case body is byte-identical,
 * only the dispatch shape changed). The keys are exported as {@link TO_DXF_SUPPORTED_TYPES}
 * and bound to the descriptor domain (`RENDERABLE_ENTITY_TYPES`) via
 * `__tests__/dxf-scene-entity-toDxf-coverage.test.ts`, mirroring the live
 * `ROTATE_HANDLERS`/`ROTATE_SUPPORTED_TYPES` seam. A new renderable type with no handler
 * lands in the coverage `no-case` set → the test breaks → forces a conscious decision
 * (add a handler, or confirm the type is DxfEntityUnion-native / rendered off this path),
 * instead of the silent `warn+null` drop that made freshly-committed BIM entities invisible
 * (the ADR-406/507/583 trap).
 *
 * **Per-site default (ADR-587 §4.6, pinned):** an absent handler ⇒ the dispatcher warns +
 * returns `null` (silent drop) — preserved verbatim in `convertEntity`, NOT homogenised here.
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
// ADR-363 — SSoT sub-entity wrapping (slab/slab-opening/opening/stair/dimension →
// nested payload field). Shared with the drag-preview wrapper (draw-real-entity-preview).
import { dxfSubEntityPayload } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { HatchEntity } from '../../types/entities';
import { isSlabEntity, isSlabOpeningEntity, isOpeningEntity, isWallEntity, isBeamEntity, isColumnEntity, isFoundationEntity, isMepFixtureEntity, isElectricalPanelEntity, isRailingEntity, isFurnitureEntity, isMepSegmentEntity, isMepFittingEntity, isFloorplanSymbolEntity, isAnnotationSymbolEntity, isScaleBarEntity, isOpeningInfoTagEntity, isMepManifoldEntity, isMepRadiatorEntity, isMepBoilerEntity, isMepWaterHeaterEntity, isMepUnderfloorEntity, isRoofEntity, isFloorFinishEntity, isThermalSpaceEntity, isSpaceSeparatorEntity, isXLineEntity, isRayEntity, isHatchEntity } from '../../types/entities';
// ADR-583 — annotation symbol (North arrow) lightweight entity for DXF render pipeline.
import type { AnnotationSymbolEntity } from '../../types/annotation-symbol';
import type { ScaleBarEntity } from '../../types/scale-bar';
// ADR-612 — opening info tag lightweight entity for DXF render pipeline.
import type { OpeningInfoTagEntity } from '../../types/opening-info-tag';
import type { XLineEntity, RayEntity } from '../../types/entities';
// ADR-363 Phase 1B — wall wrapper for DXF render pipeline.
import type { WallEntity } from '../../bim/types/wall-types';
// ADR-363 Phase 5 — beam wrapper for DXF render pipeline.
import type { BeamEntity } from '../../bim/types/beam-types';
// ADR-363 Phase 4 — column direct entity for DXF render pipeline.
import type { ColumnEntity } from '../../bim/types/column-types';
import type { FoundationEntity } from '../../bim/types/foundation-types';
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
import type { EntityType } from '../../types/base-entity';
// ADR-557 — TEXT/MTEXT → DxfText projection lives in the sibling converter (SRP).
import { convertTextEntity } from './dxf-text-entity-converter';
import { dwarn } from '../../debug';
import type { SceneEntity, DxfBaseFields } from './dxf-scene-entity-converter';

/**
 * Per-type SceneModel→`DxfEntityUnion` projection. `entity` is the scene entity,
 * `base` the shared id/layer/style fields built by `buildBase`. Returns `null` when a
 * type-guard rejects the entity shape (matches the previous per-case null returns).
 */
export type ToDxfHandler = (entity: SceneEntity, base: DxfBaseFields) => DxfEntityUnion | null;

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
 * ADR-510 Φ3b/Φ3c — κοινό polyline projection (SSoT polyline/lwpolyline): base +
 * vertices + closed, με optional per-segment bulge/width parallel arrays
 * (index-aligned) όταν υπάρχουν· absent ⇒ all-straight (back-compat).
 */
function toPolylineUnion(
  base: DxfBaseFields,
  vertices: Point2D[],
  closed: boolean,
  arrays: { bulges?: number[]; startWidths?: number[]; endWidths?: number[] },
): DxfEntityUnion {
  return {
    ...base, type: 'polyline' as const, vertices, closed,
    ...(arrays.bulges ? { bulges: arrays.bulges } : {}),
    ...(arrays.startWidths ? { startWidths: arrays.startWidths } : {}),
    ...(arrays.endWidths ? { endWidths: arrays.endWidths } : {}),
  } as DxfEntityUnion;
}

// ADR-557 — TEXT/MTEXT share one arm (projection lives in the sibling converter, SRP).
const convertTextArm: ToDxfHandler = (entity, base) => convertTextEntity(entity, base);

/**
 * Introspectable SceneModel→`DxfEntityUnion` seam (ADR-587 Φ5). ΕΝΑ type-keyed
 * registry αντί για `switch (entity.type)`, ώστε τα keys να δένονται στο descriptor
 * domain μέσω coverage test (`__tests__/dxf-scene-entity-toDxf-coverage.test.ts`).
 *
 * **Adapter, όχι rewrite** (ADR-587 §4.1): κάθε case έγινε handler με ΤΑΥΤΟΣΗΜΟ body·
 * ζει στο ΙΔΙΟ layer (hooks/canvas) → μηδέν layering inversion/cycle (το type-only
 * back-import προς τον converter σβήνεται στο runtime). Απόντος handler ⇒ ο τύπος
 * πέφτει στο `warn+null` default του dispatcher (per-site default, ADR-587 §4.6).
 */
export const TO_DXF_HANDLERS: Partial<Record<EntityType, ToDxfHandler>> = {
  line: (entity, base) => {
    const e = entity as typeof entity & { start: Point2D; end: Point2D };
    return { ...base, type: 'line' as const, start: e.start, end: e.end } as DxfEntityUnion;
  },
  circle: (entity, base) => {
    const e = entity as typeof entity & { center: Point2D; radius: number };
    return { ...base, type: 'circle' as const, center: e.center, radius: e.radius } as DxfEntityUnion;
  },
  polyline: (entity, base) => {
    // ADR-510 Φ3b/Φ3c — carry the per-segment arc/width parallel arrays through
    // to the canvas/grip path (index-aligned with vertices) so arcs render and
    // arc-midpoint grips appear. Absent ⇒ all-straight (back-compat).
    const e = entity as typeof entity & {
      vertices: Point2D[]; closed: boolean;
      bulges?: number[]; startWidths?: number[]; endWidths?: number[];
    };
    return toPolylineUnion(base, e.vertices, e.closed, e);
  },
  arc: (entity, base) => {
    const e = entity as typeof entity & { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean };
    return { ...base, type: 'arc' as const, center: e.center, radius: e.radius, startAngle: e.startAngle, endAngle: e.endAngle, counterclockwise: e.counterclockwise } as DxfEntityUnion;
  },
  // ADR-557 — TEXT/MTEXT projection lives in the sibling converter (SRP).
  mtext: convertTextArm,
  text: convertTextArm,
  'angle-measurement': (entity, base) => {
    const e = entity as typeof entity & { vertex: Point2D; point1: Point2D; point2: Point2D; angle: number };
    return { ...base, type: 'angle-measurement' as const, vertex: e.vertex, point1: e.point1, point2: e.point2, angle: e.angle } as DxfEntityUnion;
  },
  lwpolyline: (entity, base) => {
    // ADR-186: LWPolyline → render as standard polyline.
    // ADR-510 Φ3b/Φ3c — carry bulge/width parallel arrays (see 'polyline' case).
    const e = entity as typeof entity & {
      vertices: Point2D[]; closed?: boolean;
      bulges?: number[]; startWidths?: number[]; endWidths?: number[];
    };
    return toPolylineUnion(base, e.vertices, e.closed ?? false, e);
  },
  rectangle: (entity, base) => {
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
  },
  stair: (entity, base) => {
    // ADR-358 Phase 5b — wrap StairEntity into DxfStair (no expansion). The
    // StairRenderer renders directly from `stairEntity.geometry`, and grip
    // computation reads the parametric grips from the StairEntity params via
    // `getStairGrips()`. SSoT: zero geometry duplication. Sub-entity field via
    // `dxfSubEntityPayload` (shared with the drag-preview wrapper).
    return { ...base, type: 'stair' as const, ...dxfSubEntityPayload(entity) } as DxfEntityUnion;
  },
  dimension: (entity, base) => {
    // ADR-362 — wrap DimensionEntity into DxfDimension so DxfRenderer +
    // buildDimensionLookup() see it. Without this case, freshly-committed dims
    // from useDimensionCreate were silently dropped here → invisible on canvas.
    return { ...base, type: 'dimension' as const, ...dxfSubEntityPayload(entity) } as DxfEntityUnion;
  },
  slab: (entity, base) => {
    // ADR-363 Phase 3.7 — wrap SlabEntity. SlabRenderer renders geometry.polygon
    // fill + hatch. Per-frame slabOpeningsBySlab map cuts boolean holes.
    return isSlabEntity(entity)
      ? { ...base, type: 'slab' as const, ...dxfSubEntityPayload(entity) } as DxfEntityUnion
      : null;
  },
  'slab-opening': (entity, base) => {
    // ADR-363 Phase 3.7 — wrap SlabOpeningEntity. SlabOpeningRenderer draws
    // dashed outline + kind annotation over the host slab cutout.
    return isSlabOpeningEntity(entity)
      ? { ...base, type: 'slab-opening' as const, ...dxfSubEntityPayload(entity) } as DxfEntityUnion
      : null;
  },
  opening: (entity, base) => {
    // ADR-363 Phase 2 (deferred pipeline) — wrap OpeningEntity. OpeningRenderer
    // draws outline + kind overlay; per-frame openingsByWall map drives WallRenderer
    // boolean cutouts so openings visually punch through wall fills.
    return isOpeningEntity(entity)
      ? { ...base, type: 'opening' as const, ...dxfSubEntityPayload(entity) } as DxfEntityUnion
      : null;
  },
  wall: (entity, base) => {
    // ADR-363 Phase 1B — direct entity (no wallEntity wrapper). Fields spread at
    // top level so geometry.bbox is accessible to BoundsCalculator spatial index
    // and HitTestingService without unwrapping (mirrors wall/opening/column/beam
    // "direct entities" contract in HitTestingService convertToEntityModel).
    if (!isWallEntity(entity)) return null;
    const w = entity as WallEntity;
    return { ...base, type: 'wall' as const, kind: w.kind, params: w.params, geometry: w.geometry, validation: w.validation } as DxfEntityUnion;
  },
  beam: (entity, base) => {
    // ADR-363 Phase 5 — direct entity (same pattern as wall). BeamRenderer
    // reads geometry.outline/axisPolyline + params fields at top level.
    if (!isBeamEntity(entity)) return null;
    const b = entity as BeamEntity;
    return { ...base, type: 'beam' as const, kind: b.kind, params: b.params, geometry: b.geometry, validation: b.validation } as DxfEntityUnion;
  },
  column: (entity, base) => {
    // ADR-363 Phase 4 — direct entity (same pattern as wall/beam). ColumnRenderer
    // reads geometry.footprint + kind + params fields at top level.
    // Without this case, freshly-committed columns were silently dropped here →
    // invisible on 2D canvas (visible only in 3D which reads params directly).
    if (!isColumnEntity(entity)) return null;
    const col = entity as ColumnEntity;
    return { ...base, type: 'column' as const, kind: col.kind, params: col.params, geometry: col.geometry, validation: col.validation } as DxfEntityUnion;
  },
  foundation: (entity, base) => {
    // ADR-436 Slice 1 — direct entity (same pattern as column/beam). FoundationRenderer
    // reads geometry.footprint + kind + params at top level. Without this case,
    // freshly-committed foundations were silently dropped here → invisible on 2D
    // canvas (visible only in 3D which reads params directly).
    if (!isFoundationEntity(entity)) return null;
    const fnd = entity as FoundationEntity;
    return { ...base, type: 'foundation' as const, kind: fnd.kind, params: fnd.params, geometry: fnd.geometry, validation: fnd.validation } as DxfEntityUnion;
  },
  'mep-fixture': (entity, base) => {
    // ADR-406 — direct entity (same pattern as wall/beam/column). MepFixtureRenderer
    // reads geometry.footprint + kind + params fields at top level. Without this
    // case, freshly-committed fixtures were silently dropped here → invisible on
    // 2D canvas (visible only in 3D which reads params directly).
    if (!isMepFixtureEntity(entity)) return null;
    const fx = entity as MepFixtureEntity;
    return { ...base, type: 'mep-fixture' as const, kind: fx.kind, params: fx.params, geometry: fx.geometry, validation: fx.validation } as DxfEntityUnion;
  },
  'electrical-panel': (entity, base) => {
    // ADR-408 Φ3 — direct entity (same pattern as mep-fixture). ElectricalPanelRenderer
    // reads geometry.footprint + kind + params fields at top level. Without this case,
    // freshly-committed panels were silently dropped here → invisible on 2D canvas
    // (visible only in 3D which reads params directly).
    if (!isElectricalPanelEntity(entity)) return null;
    const pnl = entity as ElectricalPanelEntity;
    return { ...base, type: 'electrical-panel' as const, kind: pnl.kind, params: pnl.params, geometry: pnl.geometry, validation: pnl.validation } as DxfEntityUnion;
  },
  railing: (entity, base) => {
    // ADR-407 — direct entity (same pattern as wall/beam/column/mep-fixture).
    // RailingRenderer reads geometry.resolvedPath + params fields at top level.
    // Without this case, freshly-committed railings were silently dropped here →
    // invisible on 2D canvas (visible only in 3D which reads params directly).
    if (!isRailingEntity(entity)) return null;
    const rl = entity as RailingEntity;
    return { ...base, type: 'railing' as const, kind: rl.kind, params: rl.params, geometry: rl.geometry, validation: rl.validation } as DxfEntityUnion;
  },
  furniture: (entity, base) => {
    // ADR-410 — direct entity (same pattern as mep-fixture). FurnitureRenderer
    // reads geometry.footprint + kind + params fields at top level. Without this
    // case, freshly-committed furniture was silently dropped here → invisible on
    // 2D canvas (visible only in 3D which reads params directly).
    if (!isFurnitureEntity(entity)) return null;
    const fn = entity as FurnitureEntity;
    return { ...base, type: 'furniture' as const, kind: fn.kind, params: fn.params, geometry: fn.geometry, validation: fn.validation } as DxfEntityUnion;
  },
  roof: (entity, base) => {
    // ADR-417 — direct entity (same pattern as slab/furniture). RoofRenderer
    // reads geometry.faces + geometry.ridges + footprint at top level. Without
    // this case, freshly-committed roofs are silently dropped → invisible on
    // 2D canvas (visible only in 3D which reads params directly).
    if (!isRoofEntity(entity)) return null;
    const rf = entity as RoofEntity;
    return { ...base, type: 'roof' as const, kind: rf.kind, params: rf.params, geometry: rf.geometry, validation: rf.validation } as DxfEntityUnion;
  },
  'floor-finish': (entity, base) => {
    // ADR-419 — direct entity (same pattern as slab/roof). FloorFinishRenderer
    // reads geometry.bbox + params.footprint + params.materialId at top level.
    // Without this case, freshly-committed floor-finishes are silently dropped
    // here → invisible on 2D canvas.
    if (!isFloorFinishEntity(entity)) return null;
    const ff = entity as FloorFinishEntity;
    return { ...base, type: 'floor-finish' as const, kind: ff.kind, params: ff.params, geometry: ff.geometry } as DxfEntityUnion;
  },
  'thermal-space': (entity, base) => {
    // ADR-422 — analytical thermal space (IfcSpace), area-based (same pattern as
    // floor-finish). ThermalSpaceRenderer reads geometry.bbox + params.footprint +
    // params.useType at top level. Without this case freshly-committed thermal
    // spaces are silently dropped here → invisible on 2D canvas.
    if (!isThermalSpaceEntity(entity)) return null;
    const ts = entity as ThermalSpaceEntity;
    return { ...base, type: 'thermal-space' as const, kind: ts.kind, params: ts.params, geometry: ts.geometry } as DxfEntityUnion;
  },
  'space-separator': (entity, base) => {
    // ADR-437 — space separator (IfcVirtualElement), direct entity (same pattern as
    // thermal-space). SpaceSeparatorRenderer reads geometry.bbox + params.start/end at
    // top level. Without this case freshly-committed separators are silently dropped
    // here → invisible on 2D canvas.
    if (!isSpaceSeparatorEntity(entity)) return null;
    const ss = entity as SpaceSeparatorEntity;
    return { ...base, type: 'space-separator' as const, kind: ss.kind, params: ss.params, geometry: ss.geometry } as DxfEntityUnion;
  },
  'floorplan-symbol': (entity, base) => {
    // ADR-415 — direct entity (same pattern as furniture/mep-fixture).
    // FloorplanSymbolRenderer reads geometry.footprint + kind + params at top
    // level. Without this case, freshly-committed symbols were silently dropped
    // here → invisible on 2D canvas (the same trap as the BIM entities above).
    if (!isFloorplanSymbolEntity(entity)) return null;
    const fs = entity as FloorplanSymbolEntity;
    return { ...base, type: 'floorplan-symbol' as const, kind: fs.kind, params: fs.params, geometry: fs.geometry, validation: fs.validation } as DxfEntityUnion;
  },
  'annotation-symbol': (entity, base) => {
    // ADR-583 — lightweight non-BIM annotation (North arrow). Flat fields spread
    // at top level (position/kind/symbolId/sizeMm/rotation); AnnotationSymbolRenderer
    // reads them + the catalog glyph. Without this case the freshly-placed symbol
    // fell to `default` → null → invisible on the 2D canvas (the same drop trap as
    // the BIM entities above).
    if (!isAnnotationSymbolEntity(entity)) return null;
    const as = entity as AnnotationSymbolEntity;
    return {
      ...base, type: 'annotation-symbol' as const,
      position: as.position, kind: as.kind, symbolId: as.symbolId, sizeMm: as.sizeMm,
      ...(as.rotation !== undefined ? { rotation: as.rotation } : {}),
    } as DxfEntityUnion;
  },
  'scale-bar': (entity, base) => {
    // ADR-583 Φ2 — lightweight non-BIM graphic scale-bar (sibling of annotation-symbol).
    // Flat params spread at top level; ScaleBarRenderer reads them + computeScaleBarGeometry.
    // The DERIVED `geometry` cache is intentionally NOT forwarded (recomputed at render).
    // Without this case the freshly-placed bar fell to `default` → null → invisible + un-grippable.
    if (!isScaleBarEntity(entity)) return null;
    const sb = entity as ScaleBarEntity;
    return {
      ...base, type: 'scale-bar' as const,
      position: sb.position, angleRad: sb.angleRad, length: sb.length, unit: sb.unit,
      divisions: sb.divisions, subdivisions: sb.subdivisions, style: sb.style,
      barHeightMm: sb.barHeightMm, labelHeightMm: sb.labelHeightMm, labelPlacement: sb.labelPlacement,
    } as DxfEntityUnion;
  },
  'opening-info-tag': (entity, base) => {
    // ADR-612 — lightweight non-BIM opening info tag (sibling of scale-bar). Flat params
    // spread at top level; OpeningInfoTagRenderer reads them + computeOpeningInfoTagGeometry.
    // The DERIVED `geometry` cache is intentionally NOT forwarded (recomputed at render).
    // Without this case the freshly-placed tag fell to `default` → null → invisible + un-grippable.
    if (!isOpeningInfoTagEntity(entity)) return null;
    const oit = entity as OpeningInfoTagEntity;
    return {
      ...base, type: 'opening-info-tag' as const,
      position: oit.position, angleRad: oit.angleRad, widthMm: oit.widthMm,
      topText: oit.topText, bottomLeftText: oit.bottomLeftText, bottomRightText: oit.bottomRightText,
    } as DxfEntityUnion;
  },
  'mep-segment': (entity, base) => {
    // ADR-408 Φ8 — direct entity (same pattern as beam). MepSegmentRenderer reads
    // geometry.outline + axisPolyline + params at top level. Without this case,
    // freshly-committed segments are silently dropped here → invisible on 2D.
    if (!isMepSegmentEntity(entity)) return null;
    const seg = entity as MepSegmentEntity;
    return { ...base, type: 'mep-segment' as const, kind: seg.kind, params: seg.params, geometry: seg.geometry, validation: seg.validation } as DxfEntityUnion;
  },
  'mep-fitting': (entity, base) => {
    // ADR-408 Φ11 — auto pipe fitting (same pattern as mep-segment/fixture).
    // MepFittingRenderer reads geometry.footprint + params.position/incidents at
    // top level. Without this case, auto-reconciled fittings are silently dropped
    // here → invisible on 2D even though they exist in the scene (furniture trap).
    if (!isMepFittingEntity(entity)) return null;
    const fit = entity as MepFittingEntity;
    return { ...base, type: 'mep-fitting' as const, kind: fit.kind, params: fit.params, geometry: fit.geometry, validation: fit.validation } as DxfEntityUnion;
  },
  'mep-manifold': (entity, base) => {
    // ADR-408 Φ12 — plumbing manifold (same pattern as electrical-panel).
    // MepManifoldRenderer reads geometry.footprint + kind + params at top level.
    // Without this case, freshly-committed manifolds are silently dropped here →
    // invisible on 2D canvas (visible only in 3D which reads params directly).
    if (!isMepManifoldEntity(entity)) return null;
    const mfld = entity as MepManifoldEntity;
    return { ...base, type: 'mep-manifold' as const, kind: mfld.kind, params: mfld.params, geometry: mfld.geometry, validation: mfld.validation } as DxfEntityUnion;
  },
  'mep-radiator': (entity, base) => {
    // ADR-408 Εύρος Β — heating radiator (same pattern as mep-manifold).
    // MepRadiatorRenderer reads geometry.footprint + kind + params at top level.
    // Without this case, freshly-committed radiators are silently dropped here →
    // invisible on 2D canvas (visible only in 3D which reads params directly).
    if (!isMepRadiatorEntity(entity)) return null;
    const rad = entity as MepRadiatorEntity;
    return { ...base, type: 'mep-radiator' as const, kind: rad.kind, params: rad.params, geometry: rad.geometry, validation: rad.validation } as DxfEntityUnion;
  },
  'mep-boiler': (entity, base) => {
    // ADR-408 Εύρος Β #2 — heating boiler (same pattern as mep-radiator).
    // MepBoilerRenderer reads geometry.footprint + kind + params at top level.
    // Without this case, freshly-committed boilers are silently dropped here →
    // invisible on 2D canvas (visible only in 3D which reads params directly).
    if (!isMepBoilerEntity(entity)) return null;
    const blr = entity as MepBoilerEntity;
    return { ...base, type: 'mep-boiler' as const, kind: blr.kind, params: blr.params, geometry: blr.geometry, validation: blr.validation } as DxfEntityUnion;
  },
  'mep-water-heater': (entity, base) => {
    // ADR-408 DHW — domestic hot water heater (same pattern as mep-boiler).
    // MepWaterHeaterRenderer reads geometry.footprint + kind + params at top level.
    // Without this case, freshly-committed water heaters are silently dropped here →
    // invisible on 2D canvas (visible only in 3D which reads params directly).
    if (!isMepWaterHeaterEntity(entity)) return null;
    const wh = entity as MepWaterHeaterEntity;
    return { ...base, type: 'mep-water-heater' as const, kind: wh.kind, params: wh.params, geometry: wh.geometry, validation: wh.validation } as DxfEntityUnion;
  },
  'mep-underfloor': (entity, base) => {
    // ADR-408 Εύρος Β #3 — underfloor heating loop (area-based, same pattern as floor-finish).
    // MepUnderfloorRenderer reads geometry.loopPath + geometry.bbox + params.footprint at top
    // level. Without this case, freshly-committed underfloor loops are silently dropped here →
    // invisible on 2D canvas (the same trap as all BIM area entities above).
    if (!isMepUnderfloorEntity(entity)) return null;
    const uf = entity as MepUnderfloorEntity;
    return { ...base, type: 'mep-underfloor' as const, kind: uf.kind, params: uf.params, geometry: uf.geometry, validation: uf.validation } as DxfEntityUnion;
  },
  hatch: (entity, base) => {
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
  },
  xline: (entity, base) => {
    // ADR-359 Phase 11 — wrap XLineEntity for grip computation pipeline.
    return isXLineEntity(entity)
      ? { ...base, type: 'xline' as const, xlineEntity: entity as XLineEntity } as DxfEntityUnion
      : null;
  },
  ray: (entity, base) => {
    // ADR-359 Phase 11 — wrap RayEntity for grip computation pipeline.
    return isRayEntity(entity)
      ? { ...base, type: 'ray' as const, rayEntity: entity as RayEntity } as DxfEntityUnion
      : null;
  },
};

/**
 * Types με ρητό SceneModel→`DxfEntityUnion` handler (keys του `TO_DXF_HANDLERS`) —
 * δένονται στο descriptor domain μέσω coverage test. Mirror του `ROTATE_SUPPORTED_TYPES`.
 */
export const TO_DXF_SUPPORTED_TYPES: readonly EntityType[] =
  Object.keys(TO_DXF_HANDLERS) as EntityType[];
