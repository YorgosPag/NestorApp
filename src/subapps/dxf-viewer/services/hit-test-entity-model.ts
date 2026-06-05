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
import { computeMepFixtureGeometry } from '../bim/mep-fixtures/mep-fixture-geometry';
import { computeElectricalPanelGeometry } from '../bim/electrical-panels/electrical-panel-geometry';
import { computeMepManifoldGeometry } from '../bim/mep-manifolds/mep-manifold-geometry';
import { computeMepRadiatorGeometry } from '../bim/mep-radiators/mep-radiator-geometry';
import { computeMepBoilerGeometry } from '../bim/mep-boilers/mep-boiler-geometry';
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
        rotation: textEntity.rotation
      };
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
    default: {
      return { ...baseModel } as unknown as EntityModel;
    }
  }
}
