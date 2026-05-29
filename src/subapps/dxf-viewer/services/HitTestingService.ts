/**
 * ΚΕΝΤΡΙΚΟ HIT TESTING SERVICE
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Όλη η hit testing λογική σε ένα σημείο
 * Αντικαθιστά διάσπαρτες hitTest methods σε διάφορους renderers
 */

import { createHitTester, HitTester } from '../rendering/hitTesting/HitTester';
import { CoordinateTransforms } from '../rendering/core/CoordinateTransforms';
import type {
  Point2D,
  ViewTransform,
  Viewport,
  EntityModel
} from '../rendering/types/Types';
import type { DxfScene, DxfEntityUnion, DxfLine, DxfCircle, DxfPolyline, DxfArc, DxfText, DxfDimension } from '../canvas-v2/dxf-canvas/dxf-types';
import type { BaseEntity } from '../types/entities';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../config/tolerance-config';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault } from '../config/layer-config';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT (LayerStore lookup + legacy name fallback)
import { resolveEntityLayerName } from '../stores/LayerStore';
// ADR-358 Phase 8 — fallback to recompute stair geometry when missing (StairDoc
// from Firestore is persisted without geometry, ADR §G6 re-derivable contract).
import { computeStairGeometry } from '../bim/geometry/stairs/StairGeometryService';
import { computeColumnGeometry } from '../bim/geometry/column-geometry';
import { buildBimEntityModel } from '../bim/utils/bim-entity-passthrough';
import type { BimElementType } from '../bim/types/bim-base';

export interface HitTestResult {
  entityId: string | null;
  entity?: { type: string; layer?: string; [key: string]: unknown };  // ✅ ENTERPRISE FIX: Added entity property for accessing entity data
  entityType?: string;
  layer?: string;
  distance?: number;
}

export interface HitTestOptions {
  tolerance?: number;
  maxResults?: number;
  layerFilter?: string[];
  typeFilter?: string[];
  includeInvisible?: boolean;
}

/**
 * ✅ ΚΕΝΤΡΙΚΟ HIT TESTING SERVICE
 * Χρησιμοποιεί το υπάρχον HitTester αλλά παρέχει unified API
 */
export class HitTestingService {
  private hitTester: HitTester;
  private currentScene: DxfScene | null = null;

  constructor() {
    this.hitTester = createHitTester([], true);
  }

  /**
   * ✅ UPDATE SCENE ENTITIES
   * Ενημερώνει τα entities που θα χρησιμοποιηθούν για hit testing
   */
  updateScene(scene: DxfScene | null): void {
    this.currentScene = scene;

    if (!scene || !scene.entities.length) {
      this.hitTester.setEntities([], true);
      return;
    }

    // Convert DxfEntityUnion to EntityModel
    const entityModels = scene.entities.map(entity => this.convertToEntityModel(entity));
    // 🏢 ENTERPRISE: Type-safe cast - EntityModel extends BaseEntity which is compatible with Entity
    this.hitTester.setEntities(entityModels as import('../types/entities').Entity[], true);
  }

  /**
   * ✅ ΚΕΝΤΡΙΚΗ HIT TEST METHOD
   * Μοναδικό σημείο για όλα τα hit testing needs
   */
  hitTest(
    screenPos: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
    options: HitTestOptions = {}
  ): HitTestResult {
    if (!this.currentScene || !this.currentScene.entities.length) {
      return { entityId: null };
    }

    try {
      // Convert screen position to world position
      const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);

      // 🏢 AutoCAD/MicroStation standard: Convert pixel tolerance → world units
      // Tolerance is defined in pixels and scales inversely with zoom.
      // At high zoom (large scale), world tolerance shrinks → more precise.
      // At low zoom (small scale), world tolerance grows — but stays pixel-consistent.
      const pixelTolerance = options.tolerance || TOLERANCE_CONFIG.ENTITY_HOVER_PIXELS;
      const worldTolerance = pixelTolerance / transform.scale;

      // Perform hit test using centralized HitTester
      const hits = this.hitTester.hitTestPoint(worldPos, {
        tolerance: worldTolerance,
        maxResults: options.maxResults || 1,
        useSpatialIndex: true,
        layerFilter: options.layerFilter,
        typeFilter: options.typeFilter,
        includeInvisible: options.includeInvisible || false
      });

      // Return the first hit
      if (hits.length > 0) {
        const hit = hits[0];
        return {
          entityId: hit.data?.id || null, // ✅ ENTERPRISE FIX: Use data.id from SpatialQueryResult
          entityType: hit.data?.type || 'unknown', // ✅ Use data.type
          // ADR-358 Phase 9D-5b-i: id-only resolver SSoT (HitTester.layer is already resolver-populated).
          layer: hit.layer,
          distance: hit.distance
        };
      }

      return { entityId: null };
    } catch (error) {
      console.error('🔥 HitTestingService: Hit testing failed:', error);
      return { entityId: null };
    }
  }

  /**
   * ADR-357 Phase 15 (G13): Return ALL entities at a screen point for cycling.
   * Unlike hitTest() which returns only the first hit, this returns up to maxResults entries.
   */
  hitTestAll(
    screenPos: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
    options: HitTestOptions = {}
  ): HitTestResult[] {
    if (!this.currentScene || !this.currentScene.entities.length) return [];
    try {
      const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);
      const pixelTolerance = options.tolerance || TOLERANCE_CONFIG.ENTITY_HOVER_PIXELS;
      const worldTolerance = pixelTolerance / transform.scale;
      const hits = this.hitTester.hitTestPoint(worldPos, {
        tolerance: worldTolerance,
        maxResults: options.maxResults || 50,
        useSpatialIndex: true,
        layerFilter: options.layerFilter,
        typeFilter: options.typeFilter,
        includeInvisible: options.includeInvisible || false,
      });
      return hits.map((hit) => ({
        entityId: hit.data?.id || null,
        entityType: hit.data?.type || 'unknown',
        layer: hit.layer,
        distance: hit.distance,
      }));
    } catch {
      return [];
    }
  }

  /**
   * ✅ BULK HIT TEST for multiple positions
   * Χρήσιμο για selection rectangles, κλπ
   */
  hitTestMultiple(
    positions: Point2D[],
    transform: ViewTransform,
    viewport: Viewport,
    options: HitTestOptions = {}
  ): HitTestResult[] {
    return positions.map(pos => this.hitTest(pos, transform, viewport, options));
  }

  /**
   * ✅ HIT TEST BY LAYER
   * Ειδικό hit test μόνο για συγκεκριμένα layers
   */
  hitTestLayer(
    screenPos: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
    layerNames: string[],
    options: HitTestOptions = {}
  ): HitTestResult {
    return this.hitTest(screenPos, transform, viewport, {
      ...options,
      layerFilter: layerNames
    });
  }

  /**
   * ✅ CONVERT DxfEntityUnion to EntityModel
   * Κεντρικοποιημένη conversion logic
   */
  private convertToEntityModel(entity: DxfEntityUnion): EntityModel {
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

  /**
   * ✅ MAP ENTITY GEOMETRY
   * Κεντρικοποιημένη geometry mapping
   */
  // (deprecated) Geometry mapping is now handled inline in convertToEntityModel.

  /**
   * ✅ GET STATISTICS
   * Debugging και performance monitoring
   */
  getStatistics() {
    return this.hitTester.getStatistics();
  }

  /**
   * ✅ CONFIGURE HIT TESTING
   * Runtime configuration changes
   */
  configure(options: { tolerance?: number; maxResults?: number }) {
    this.hitTester.configure(options);
  }
}

/**
 * ✅ SINGLETON INSTANCE
 * Κεντρική instance για όλη την εφαρμογή
 */
export const hitTestingService = new HitTestingService();
