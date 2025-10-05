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
import type { DxfScene, DxfEntityUnion } from '../canvas-v2/dxf-canvas/dxf-types';

export interface HitTestResult {
  entityId: string | null;
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
      console.warn('⚠️ HitTestingService: updateScene called with no entities', {
        hasScene: !!scene,
        entityCount: scene?.entities?.length || 0
      });
      this.hitTester.setEntities([], true);
      return;
    }

    // Convert DxfEntityUnion to EntityModel
    const entityModels = scene.entities.map(entity => this.convertToEntityModel(entity));
    this.hitTester.setEntities(entityModels, true);

    console.log('✅ HitTestingService: Scene updated with entities', {
      entityCount: entityModels.length,
      sampleEntities: entityModels.slice(0, 3).map(e => ({ id: e.id, type: e.type, layer: e.layer }))
    });
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
      console.warn('⚠️ HitTestingService: No scene or entities available for hit testing', {
        hasScene: !!this.currentScene,
        entityCount: this.currentScene?.entities?.length || 0
      });
      return { entityId: null };
    }

    try {
      // Convert screen position to world position
      const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);

      console.log('🔍 HitTestingService: Performing hit test', {
        screenPos,
        worldPos,
        entityCount: this.currentScene.entities.length,
        tolerance: options.tolerance || 5,
        transform,
        viewport
      });

      // Perform hit test using centralized HitTester
      const hits = this.hitTester.hitTestPoint(worldPos, {
        tolerance: options.tolerance || 5,
        maxResults: options.maxResults || 1,
        useSpatialIndex: true,
        layerFilter: options.layerFilter,
        typeFilter: options.typeFilter,
        includeInvisible: options.includeInvisible || false
      });

      console.log('🔍 HitTestingService: Hit test results', {
        hitCount: hits.length,
        hits: hits.map(h => ({
          id: h.item.id,
          layer: h.layer,
          hitType: h.hitType,
          distance: h.distance
        }))
      });

      // Return the first hit
      if (hits.length > 0) {
        const hit = hits[0];
        return {
          entityId: hit.item.id, // ✅ SpatialItem.id contains the entity ID
          entityType: hit.data?.type || 'unknown', // ✅ Type από data payload
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
    const baseModel: EntityModel = {
      id: entity.id,
      type: entity.type,
      visible: entity.visible,
      selected: false,
      layer: entity.layer || 'default',
      color: entity.color,
      lineType: (entity as any).lineType || 'solid',
      lineWeight: entity.lineWidth,
      ...this.mapEntityGeometry(entity)
    };

    return baseModel;
  }

  /**
   * ✅ MAP ENTITY GEOMETRY
   * Κεντρικοποιημένη geometry mapping
   */
  private mapEntityGeometry(entity: DxfEntityUnion): Partial<EntityModel> {
    switch (entity.type) {
      case 'line':
        return {
          start: entity.start,
          end: entity.end
        };

      case 'circle':
        return {
          center: entity.center,
          radius: entity.radius
        };

      case 'polyline':
        return {
          points: (entity as any).points || (entity as any).vertices || []
        };

      case 'arc':
        return {
          center: entity.center,
          radius: entity.radius,
          startAngle: (entity as any).startAngle,
          endAngle: (entity as any).endAngle
        };

      case 'text':
        return {
          position: entity.position,
          text: (entity as any).text,
          height: (entity as any).height
        };

      default:
        return {};
    }
  }

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