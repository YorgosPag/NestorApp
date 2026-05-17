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
import type { DxfScene, DxfEntityUnion, DxfLine, DxfCircle, DxfPolyline, DxfArc, DxfText } from '../canvas-v2/dxf-canvas/dxf-types';
import type { BaseEntity } from '../types/entities';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../config/tolerance-config';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault } from '../config/layer-config';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT (LayerStore lookup + legacy name fallback)
import { resolveEntityLayerName } from '../stores/LayerStore';
// ADR-358 Phase 8 — fallback to recompute stair geometry when missing (StairDoc
// from Firestore is persisted without geometry, ADR §G6 re-derivable contract).
import { computeStairGeometry } from '../systems/stairs/StairGeometryService';

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
    // eslint-disable-next-line no-console
    const stairModels = entityModels.filter((e: { type: string }) => e.type === 'stair');
    if (stairModels.length > 0) {
      // eslint-disable-next-line no-console
      console.info('[HitTestingService] setScene stair count', {
        total: entityModels.length,
        stairs: stairModels.length,
        firstStairBbox: (stairModels[0] as { geometry?: { bbox?: unknown } })?.geometry?.bbox,
        firstStairHasParams: !!(stairModels[0] as { params?: unknown })?.params,
      });
    }
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

      // eslint-disable-next-line no-console
      console.info('[HitTestingService] hitTest', {
        worldPos,
        worldTolerance,
        hits: hits.length,
        stairCount: this.currentScene?.entities.filter(e => e.type === 'stair').length,
        firstHitType: hits[0]?.data?.type,
        firstHitId: hits[0]?.data?.id,
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

    const baseModel: Omit<BaseEntity, 'type'> & { type: DxfEntityUnion['type'] } = {
      id: entity.id,
      type: entity.type,
      visible: entity.visible,
      selected: false,
      // ADR-130 + ADR-358 Phase 9D-3: id-first name via LayerStore, fallback to legacy
      layer: getLayerNameOrDefault(resolveEntityLayerName(entity)),
      color: entity.color,
      lineType: (entityWithLineType.lineType as "solid" | "dashed" | "dotted" | "dashdot") || 'solid',
      lineweight: entity.lineWidth
    };

    switch (entity.type) {
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
        const stairEntity = entity as import('../types/stair').StairEntity;
        // Defensive: legacy / partially-serialized stair entries can reach the
        // hit-tester without `params`. `computeStairGeometry` deref's
        // `params.variant.kind` so a missing-params entry crashes the entire
        // render pipeline. Treat as phantom: keep the type discriminant so
        // upstream filters work, but skip geometry — downstream `Bounds.ts`
        // returns null when `geometry.bbox` is missing and the entity drops
        // out of the spatial index harmlessly.
        const geometry = stairEntity.geometry
          ?? (stairEntity.params
            ? computeStairGeometry(stairEntity.params)
            : undefined);
        return {
          ...baseModel,
          type: 'stair',
          // Pass-through fields consumed by StairRenderer + grip pipeline.
          // We cast to EntityModel because the canvas Entity union does not
          // (yet) carry the stair discriminant. TODO Phase 9: widen Entity.
          kind: stairEntity.kind,
          params: stairEntity.params,
          geometry,
          validation: stairEntity.validation,
        } as unknown as EntityModel;
      }
      default: {
        const exhaustiveCheck: never = entity;
        return exhaustiveCheck;
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
