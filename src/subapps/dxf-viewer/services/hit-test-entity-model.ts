/**
 * HIT-TEST ENTITY MODEL CONVERSION (SSoT)
 * ✅ Extracted from HitTestingService.ts (N.7.1 — 500-line file limit).
 *
 * Pure conversion `DxfEntityUnion → EntityModel` consumed by the spatial
 * index. Each BIM branch carries a geometry-recompute fallback because
 * Firestore-persisted entities omit the re-derivable `geometry` cache —
 * without `geometry.bbox` BoundsCalculator drops the entity from the index
 * and hover / click selection silently fails.
 */

import type {
  EntityModel
} from '../rendering/types/Types';
import type { DxfEntityUnion, DxfLine, DxfCircle, DxfPolyline, DxfArc, DxfText, DxfDimension } from '../canvas-v2/dxf-canvas/dxf-types';
import type { BaseEntity } from '../types/entities';
import { computeStairGeometry } from '../bim/geometry/stairs/StairGeometryService';
import { computeColumnGeometry } from '../bim/geometry/column-geometry';
import { computeFoundationGeometry } from '../bim/geometry/foundation-geometry';
import { computeMepFixtureGeometry } from '../bim/mep-fixtures/mep-fixture-geometry';
import { computeElectricalPanelGeometry } from '../bim/electrical-panels/electrical-panel-geometry';
import { computeMepManifoldGeometry } from '../bim/mep-manifolds/mep-manifold-geometry';
import { computeMepRadiatorGeometry } from '../bim/mep-radiators/mep-radiator-geometry';
import { computeMepBoilerGeometry } from '../bim/mep-boilers/mep-boiler-geometry';
import { computeMepWaterHeaterGeometry } from '../bim/mep-water-heaters/mep-water-heater-geometry';
import { computeMepUnderfloorGeometry } from '../bim/mep-underfloor/mep-underfloor-geometry';
import { computeMepSegmentGeometry } from '../bim/geometry/mep-segment-geometry';
import { computeMepFittingGeometry } from '../bim/geometry/mep-fitting-geometry';
import { computeFurnitureGeometry } from '../bim/furniture/furniture-geometry';
import { computeFloorplanSymbolGeometry } from '../bim/floorplan-symbols/floorplan-symbol-geometry';
import { computeRoofGeometry } from '../bim/geometry/roof-geometry';
import { buildBimEntityModel } from '../bim/utils/bim-entity-passthrough';
import type { BimElementType } from '../bim/types/bim-base';

/**
 * ✅ CONVERT DxfEntityUnion to EntityModel
 * Κεντρικοποιημένη conversion logic (SSoT for the spatial index).
 */
export function convertDxfEntityToEntityModel(entity: DxfEntityUnion): EntityModel {
  // Type guard: Τα DXF entities μπορεί να έχουν optional lineType property
  const entityWithLineType = entity as typeof entity & { lineType?: string };

  const baseModel: Omit<BaseEntity, 'type'> & { type: string } = {
    id: entity.id,
    type: entity.type,
    visible: entity.visible,
    selected: false,
    layerId: entity.layerId ?? '',
    color: entity.color,
    lineType: (entityWithLineType.lineType as "solid" | "dashed" | "dotted" | "dashdot") || 'solid',
    lineweight: entity.lineWidth
  };

  switch (entity.type as string) {
    case 'line': {
      const lineEntity = entity as DxfLine;
      return {
        ...baseModel,
        type: 'line',
        start: lineEntity.start,
        end: lineEntity.end
      };
    }
    case 'circle': {
      const circleEntity = entity as DxfCircle;
      return {
        ...baseModel,
        type: 'circle',
        center: circleEntity.center,
        radius: circleEntity.radius
      };
    }
    case 'polyline': {
      const polylineEntity = entity as DxfPolyline;
      return {
        ...baseModel,
        type: 'polyline',
        vertices: polylineEntity.vertices,
        closed: polylineEntity.closed
      };
    }
    case 'arc': {
      const arcEntity = entity as DxfArc;
      return {
        ...baseModel,
        type: 'arc',
        center: arcEntity.center,
        radius: arcEntity.radius,
        startAngle: arcEntity.startAngle,
        endAngle: arcEntity.endAngle,
        counterclockwise: arcEntity.counterclockwise
      };
    }
    case 'text': {
      const textEntity = entity as DxfText;
      return {
        ...baseModel,
        type: 'text',
        position: textEntity.position,
        text: textEntity.text,
        height: textEntity.height,
        rotation: textEntity.rotation,
        // ADR-557 Φ-attachment (Giorgio 2026-07-07) — carry the SAME style fields the RENDER
        // EntityModel does (`dxf-renderer-entity-model.ts` case 'text'), so the hover hit-test's
        // `resolveTextBox` derives the IDENTICAL box the hover frame draws. Without these the
        // spatial-index entity lost justification (textStyle) + X-scale (widthFactor) + MTEXT
        // frame (width) → the hit zone drifted from the glowing rectangle.
        ...(textEntity.textStyle && { textStyle: textEntity.textStyle }),
        ...(textEntity.widthFactor != null && { widthFactor: textEntity.widthFactor }),
        ...(textEntity.width != null && { width: textEntity.width }),
      } as unknown as EntityModel;
    }
    case 'angle-measurement': {
      const angleEntity = entity as import('../canvas-v2/dxf-canvas/dxf-types').DxfAngleMeasurement;
      return {
        ...baseModel,
        type: 'angle-measurement',
        vertex: angleEntity.vertex,
        point1: angleEntity.point1,
        point2: angleEntity.point2,
        angle: angleEntity.angle
      };
    }
    // ADR-358 Phase 8 — StairEntity passthrough so hit-testing can index it.
    // The `geometry.bbox` field powers spatial broad-phase via BoundsCalculator
    // (Bounds.ts `case 'stair'`). Without this branch the entity fell through
    // to the `never` default and was silently dropped from the index.
    //
    // Geometry recompute fallback: `StairDoc` (ADR §G6) intentionally omits
    // `geometry` from Firestore persistence (re-derivable from params), so
    // a stair loaded from Storage / re-hydrated from Firestore may arrive
    // here with `entity.geometry === undefined`. We rebuild via the SSoT
    // `computeStairGeometry(params)` to guarantee bbox is always present —
    // otherwise spatial-index broad-phase silently drops the entity and
    // single-click selection fails.
    case 'stair': {
      // The scene can carry stair entities in TWO shapes:
      //   1. raw `StairEntity` — pushed directly by `useSpecialTools.onStairCreated`
      //      (`params/geometry/kind/validation` at the root).
      //   2. `DxfStair` wrapper — produced by `useDxfSceneConversion` for the
      //      canvas pipeline (`stairEntity: { params, geometry, ... }`).
      // Resolve from whichever shape so we never publish a stair to the
      // spatial index without its parametric payload.
      type StairLike = Partial<import('../bim/types/stair-types').StairEntity> & {
        stairEntity?: Partial<import('../bim/types/stair-types').StairEntity>;
      };
      const raw = entity as unknown as StairLike;
      const stairData = (raw.params ? raw : raw.stairEntity) ?? raw;
      const geometry = stairData.geometry
        ?? (stairData.params ? computeStairGeometry(stairData.params) : undefined);
      return {
        ...baseModel,
        type: 'stair',
        // Pass-through fields consumed by StairRenderer + grip pipeline.
        // We cast to EntityModel because the canvas Entity union does not
        // (yet) carry the stair discriminant. TODO Phase 9: widen Entity.
        kind: stairData.kind,
        params: stairData.params,
        geometry,
        validation: stairData.validation,
      } as unknown as EntityModel;
    }
    // ADR-397 — column needs a geometry-recompute fallback (mirror stair):
    // a Firestore-loaded `ColumnEntity` may arrive before its geometry cache is
    // hydrated; without `geometry.bbox` BoundsCalculator drops it from the
    // spatial index → body-click selection silently fails.
    case 'column': {
      const col = entity as unknown as Partial<import('../bim/types/column-types').ColumnEntity>;
      const geometry = col.geometry ?? (col.params ? computeColumnGeometry(col.params) : undefined);
      return buildBimEntityModel('column', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-436 Slice 1 — foundation needs a geometry-recompute fallback (mirror column):
    // a Firestore-loaded FoundationEntity may arrive before its geometry cache is
    // hydrated; without geometry.bbox BoundsCalculator drops it from the spatial
    // index → body-click selection silently fails.
    case 'foundation': {
      const fnd = entity as unknown as Partial<import('../bim/types/foundation-types').FoundationEntity>;
      const geometry = fnd.geometry ?? (fnd.params ? computeFoundationGeometry(fnd.params) : undefined);
      return buildBimEntityModel('foundation', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-406 — mep-fixture needs a geometry-recompute fallback (mirror column):
    // a Firestore-loaded MepFixtureEntity may arrive before its geometry cache is
    // hydrated; without `geometry.bbox` BoundsCalculator drops it from the spatial
    // index → body-click selection silently fails.
    case 'mep-fixture': {
      const fx = entity as unknown as Partial<import('../bim/types/mep-fixture-types').MepFixtureEntity>;
      const geometry = fx.geometry ?? (fx.params ? computeMepFixtureGeometry(fx.params) : undefined);
      return buildBimEntityModel('mep-fixture', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-408 Φ3 — electrical panel needs the same geometry-recompute fallback.
    case 'electrical-panel': {
      const pnl = entity as unknown as Partial<import('../bim/types/electrical-panel-types').ElectricalPanelEntity>;
      const geometry = pnl.geometry ?? (pnl.params ? computeElectricalPanelGeometry(pnl.params) : undefined);
      return buildBimEntityModel('electrical-panel', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-408 Φ12 — plumbing manifold needs the same geometry-recompute fallback (mirror electrical-panel):
    // a Firestore-loaded MepManifoldEntity may arrive before its geometry cache is hydrated;
    // without `geometry.bbox` BoundsCalculator drops it from the spatial index → no hover/select.
    case 'mep-manifold': {
      const mfld = entity as unknown as Partial<import('../bim/types/mep-manifold-types').MepManifoldEntity>;
      const geometry = mfld.geometry ?? (mfld.params ? computeMepManifoldGeometry(mfld.params) : undefined);
      return buildBimEntityModel('mep-manifold', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-408 Εύρος Β — heating radiator needs the same geometry-recompute fallback (mirror mep-manifold):
    // a Firestore-loaded MepRadiatorEntity may arrive before its geometry cache is hydrated;
    // without `geometry.bbox` BoundsCalculator drops it from the spatial index → no hover/select.
    case 'mep-radiator': {
      const rad = entity as unknown as Partial<import('../bim/types/mep-radiator-types').MepRadiatorEntity>;
      const geometry = rad.geometry ?? (rad.params ? computeMepRadiatorGeometry(rad.params) : undefined);
      return buildBimEntityModel('mep-radiator', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-408 Εύρος Β #2 — heating boiler needs the same geometry-recompute fallback (mirror mep-radiator):
    // a Firestore-loaded MepBoilerEntity may arrive before its geometry cache is hydrated;
    // without `geometry.bbox` BoundsCalculator drops it from the spatial index → no hover/select.
    case 'mep-boiler': {
      const blr = entity as unknown as Partial<import('../bim/types/mep-boiler-types').MepBoilerEntity>;
      const geometry = blr.geometry ?? (blr.params ? computeMepBoilerGeometry(blr.params) : undefined);
      return buildBimEntityModel('mep-boiler', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-408 DHW — domestic hot water heater needs the same geometry-recompute fallback (mirror mep-boiler):
    // a Firestore-loaded MepWaterHeaterEntity may arrive before its geometry cache is hydrated;
    // without `geometry.bbox` BoundsCalculator drops it from the spatial index → no hover/select.
    case 'mep-water-heater': {
      const wh = entity as unknown as Partial<import('../bim/types/mep-water-heater-types').MepWaterHeaterEntity>;
      const geometry = wh.geometry ?? (wh.params ? computeMepWaterHeaterGeometry(wh.params) : undefined);
      return buildBimEntityModel('mep-water-heater', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-408 Εύρος Β #3 — underfloor heating loop needs the same geometry-recompute fallback
    // (mirror mep-boiler / floor-finish): a Firestore-loaded MepUnderfloorEntity may arrive before
    // its geometry cache is hydrated; without `geometry.bbox` BoundsCalculator drops it from the
    // spatial index → hover-highlight + click selection silently fail.
    case 'mep-underfloor': {
      const uf = entity as unknown as Partial<import('../bim/types/mep-underfloor-types').MepUnderfloorEntity>;
      const geometry = uf.geometry ?? (uf.params ? computeMepUnderfloorGeometry(uf.params) : undefined);
      return buildBimEntityModel('mep-underfloor', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-408 Φ8 — MEP segment needs the same geometry-recompute fallback (mirror beam).
    case 'mep-segment': {
      const seg = entity as unknown as Partial<import('../bim/types/mep-segment-types').MepSegmentEntity>;
      const geometry = seg.geometry ?? (seg.params ? computeMepSegmentGeometry(seg.params) : undefined);
      return buildBimEntityModel('mep-segment', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-408 Φ11 — MEP fitting needs the same geometry-recompute fallback (mirror segment):
    // an auto-derived / Firestore-loaded MepFittingEntity may arrive before its geometry
    // cache is hydrated; without `geometry.bbox` BoundsCalculator drops it from the spatial
    // index → no hover-highlight and click selection silently fails.
    case 'mep-fitting': {
      const fit = entity as unknown as Partial<import('../bim/types/mep-fitting-types').MepFittingEntity>;
      const geometry = fit.geometry ?? (fit.params ? computeMepFittingGeometry(fit.params) : undefined);
      return buildBimEntityModel('mep-fitting', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-410 — furniture needs the same geometry-recompute fallback (mirror mep-fixture):
    // a Firestore-loaded FurnitureEntity may arrive before its geometry cache is
    // hydrated; without `geometry.bbox` BoundsCalculator drops it from the spatial
    // index → no hover-highlight and body-click selection silently fails.
    case 'furniture': {
      const fn = entity as unknown as Partial<import('../bim/types/furniture-types').FurnitureEntity>;
      const geometry = fn.geometry ?? (fn.params ? computeFurnitureGeometry(fn.params) : undefined);
      return buildBimEntityModel('furniture', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-415 — floorplan symbol needs the same geometry-recompute fallback
    // (mirror furniture): a Firestore-loaded FloorplanSymbolEntity may arrive
    // before its geometry cache is hydrated; without `geometry.bbox`
    // BoundsCalculator drops it from the spatial index → no hover/select.
    case 'floorplan-symbol': {
      const fs = entity as unknown as Partial<import('../bim/types/floorplan-symbol-types').FloorplanSymbolEntity>;
      const geometry = fs.geometry ?? (fs.params ? computeFloorplanSymbolGeometry(fs.params) : undefined);
      return buildBimEntityModel('floorplan-symbol', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-417 — roof is a DIRECT entity (mirror wall/beam, no DXF wrapper) but
    // needs the geometry-recompute fallback (mirror column / mep-segment): the
    // RoofDoc persists params only (`geometry` re-derivable, intentionally
    // omitted from Firestore), so a Firestore-loaded RoofEntity arrives with
    // `geometry === undefined` → without recompute BoundsCalculator drops it
    // from the spatial index → 2D body-click selection silently fails (only the
    // 3D viewport could select the roof).
    case 'roof': {
      const rf = entity as unknown as Partial<import('../bim/types/roof-types').RoofEntity>;
      const geometry = rf.geometry ?? (rf.params ? computeRoofGeometry(rf.params) : undefined);
      return buildBimEntityModel('roof', { ...(entity as object), geometry } as typeof entity, baseModel);
    }
    // ADR-419 — floor-finish is a direct entity (params + geometry at top level, like wall/beam/roof).
    // Without this case the entity falls to `default` which omits geometry → BoundsCalculator cannot
    // build the spatial index entry → hit-test never finds the entity → selection silently fails.
    case 'floor-finish':
      return buildBimEntityModel('floor-finish', entity, baseModel);
    // ADR-422 L0 — thermal space is a direct entity (params + geometry at top level, like floor-finish).
    // Without this case it fell to `default` which drops geometry → BoundsCalculator returned null →
    // the space never entered the spatial index → click-selection silently failed (console: «Unknown
    // entity type: thermal-space» + QuadTree «Item outside index bounds» flood).
    case 'thermal-space':
      return buildBimEntityModel('thermal-space', entity, baseModel);
    // ADR-437 — space separator is a direct entity (params + geometry at top level, like
    // thermal-space). Same silent-drop hazard: without this case it falls to `default`,
    // geometry is dropped → Bounds null → never indexed → click-selection fails silently.
    case 'space-separator':
      return buildBimEntityModel('space-separator', entity, baseModel);
    // ADR-363 Phases 1B/5 — wall/beam are direct entities (no DXF wrapper).
    // `geometry.bbox` powers spatial broad-phase via BoundsCalculator.calculateBimEntityBounds.
    // SSoT: buildBimEntityModel in bim/utils/bim-entity-passthrough.ts.
    case 'wall':
    case 'beam':
      return buildBimEntityModel(entity.type as BimElementType, entity, baseModel);
    // ADR-363 Bug 1 v2 fix (2026-05-25) — `opening` IS wrapped στο
    // useDxfSceneConversion.ts:306-312 ως `{ ...base, type: 'opening',
    // openingEntity: <OpeningEntity> }`. Πρέπει να unwrap-ed mirror των slab/
    // slab-opening branches παρακάτω. Χωρίς αυτό, ο wrapper δεν είχε
    // `geometry`/`params` στο top level → `BoundsCalculator.calculateBimEntityBounds`
    // επέστρεφε null → opening εξαφανιζόταν από spatial index → πάντα κέρδιζε
    // το wall στο hit-test.
    case 'opening': {
      type DxfOpeningLike = { openingEntity: unknown };
      const inner = (entity as unknown as DxfOpeningLike).openingEntity;
      return buildBimEntityModel('opening', inner, baseModel);
    }
    // ADR-363 Phase 3.7 — slab/slab-opening ARE wrapped (DxfSlab.slabEntity / DxfSlabOpening.slabOpeningEntity).
    // Must unwrap to inner entity so geometry/kind/params reach BoundsCalculator and hit-tests.
    case 'slab': {
      type DxfSlabLike = { slabEntity: unknown };
      const inner = (entity as unknown as DxfSlabLike).slabEntity;
      return buildBimEntityModel('slab', inner, baseModel);
    }
    case 'slab-opening': {
      type DxfSlabOpeningLike = { slabOpeningEntity: unknown };
      const inner = (entity as unknown as DxfSlabOpeningLike).slabOpeningEntity;
      return buildBimEntityModel('slab-opening', inner, baseModel);
    }
    // ADR-362 Phase I3 — dimension passthrough so hit-testing can index
    // DimensionEntity via the spatial index. The DxfDimension wrapper carries
    // the full discriminated-union DimensionEntity (with defPoints + textMidpoint).
    // We spread it so BoundsCalculator `case 'dimension'` + performDetailedHitTest
    // `case 'dimension'` can access defPoints directly on the EntityModel.
    case 'dimension': {
      const dxfDim = entity as unknown as DxfDimension;
      const dimEntity = dxfDim.dimensionEntity;
      return {
        ...dimEntity,
        id: baseModel.id,
        layerId: baseModel.layerId,
        color: baseModel.color,
        visible: baseModel.visible,
        selected: baseModel.selected,
        lineType: baseModel.lineType,
        lineweight: baseModel.lineweight,
      } as unknown as EntityModel;
    }
    // ADR-359 Phase 11 — xline/ray ARE wrapped (DxfXLine.xlineEntity / DxfRay.rayEntity).
    // Must unwrap to get basePoint/direction into the EntityModel for BoundsCalculator + hit-tests.
    case 'xline': {
      type DxfXLineLike = { xlineEntity: { basePoint?: unknown; direction?: unknown; secondPoint?: unknown } };
      const xl = (entity as unknown as DxfXLineLike).xlineEntity;
      return { ...baseModel, type: 'xline', basePoint: xl.basePoint, direction: xl.direction, secondPoint: xl.secondPoint } as unknown as EntityModel;
    }
    case 'ray': {
      type DxfRayLike = { rayEntity: { basePoint?: unknown; direction?: unknown; secondPoint?: unknown } };
      const r = (entity as unknown as DxfRayLike).rayEntity;
      return { ...baseModel, type: 'ray', basePoint: r.basePoint, direction: r.direction, secondPoint: r.secondPoint } as unknown as EntityModel;
    }
    // ADR-507 — hatch is a DIRECT entity (boundaryPaths at top level, like floor-finish).
    // Without this case it fell to `default` which strips boundaryPaths →
    // BoundsCalculator.calculateHatchBounds returns null → hatch never enters the
    // spatial index → hover + click-selection silently fail.
    case 'hatch': {
      type HatchLike = { boundaryPaths?: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>> };
      return { ...baseModel, type: 'hatch', boundaryPaths: (entity as unknown as HatchLike).boundaryPaths } as unknown as EntityModel;
    }
    // ADR-583 — annotation symbol (North arrow): a lightweight DIRECT entity carrying
    // position + sizeMm at top level. Without this case it fell to `default`, which
    // strips position → BoundsCalculator.calculateAnnotationSymbolBounds reads
    // undefined.position → the symbol never enters the spatial index → hover +
    // click-selection silently fail.
    case 'annotation-symbol': {
      type AnnoLike = { position?: { x: number; y: number }; kind?: string; symbolId?: string; sizeMm?: number; rotation?: number };
      const a = entity as unknown as AnnoLike;
      return {
        ...baseModel, type: 'annotation-symbol',
        position: a.position, kind: a.kind, symbolId: a.symbolId, sizeMm: a.sizeMm, rotation: a.rotation,
      } as unknown as EntityModel;
    }
    // ADR-583 Φ2 — graphic scale-bar (sibling of annotation-symbol): a lightweight
    // DIRECT entity carrying the flat span/annotative params at top level. Without this
    // case it fell to `default`, which strips them → BoundsCalculator.calculateScaleBarBounds
    // reads undefined.position → the bar never enters the spatial index → hover-highlight +
    // click-selection silently fail (it stayed only MARQUEE-selectable via the Twin-B bounds).
    case 'scale-bar': {
      type ScaleBarLike = {
        position?: { x: number; y: number }; angleRad?: number; length?: number; unit?: string;
        divisions?: number; subdivisions?: number; style?: string;
        barHeightMm?: number; labelHeightMm?: number; labelPlacement?: string;
      };
      const s = entity as unknown as ScaleBarLike;
      return {
        ...baseModel, type: 'scale-bar',
        position: s.position, angleRad: s.angleRad, length: s.length, unit: s.unit,
        divisions: s.divisions, subdivisions: s.subdivisions, style: s.style,
        barHeightMm: s.barHeightMm, labelHeightMm: s.labelHeightMm, labelPlacement: s.labelPlacement,
      } as unknown as EntityModel;
    }
    // ADR-612 — opening info tag (sibling of scale-bar): a lightweight DIRECT
    // entity carrying the flat position/angle/width/text params at top level.
    // Without this case it fell to `default`, which strips them → the tag never
    // enters the spatial index → hover-highlight + click-selection silently fail.
    case 'opening-info-tag': {
      type OpeningInfoTagLike = {
        position?: { x: number; y: number }; angleRad?: number; widthMm?: number;
        topText?: string; bottomLeftText?: string; bottomRightText?: string;
      };
      const o = entity as unknown as OpeningInfoTagLike;
      return {
        ...baseModel, type: 'opening-info-tag',
        position: o.position, angleRad: o.angleRad, widthMm: o.widthMm,
        topText: o.topText, bottomLeftText: o.bottomLeftText, bottomRightText: o.bottomRightText,
      } as unknown as EntityModel;
    }
    default: {
      return { ...baseModel } as unknown as EntityModel;
    }
  }
}
