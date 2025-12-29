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
  entity?: { type: string; layer?: string; [key: string]: any };  // ✅ ENTERPRISE FIX: Added entity property for accessing entity data
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
    this.hitTester.setEntities(entityModels as any[], true);
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

      // Perform hit test using centralized HitTester
      const hits = this.hitTester.hitTestPoint(worldPos, {
        tolerance: options.tolerance || 5,
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

    const baseModel: EntityModel = {
      id: entity.id,
      type: entity.type,
      visible: entity.visible,
      selected: false,
      layer: entity.layer || 'default',
      color: entity.color,
      lineType: entityWithLineType.lineType || 'solid',
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

      case 'polyline': {
        // Type guard: Polyline entities έχουν vertices property
        const polyline = entity as typeof entity & { vertices?: Point2D[]; points?: Point2D[] };
        return {
          points: polyline.points || polyline.vertices || []
        };
      }

      case 'arc':
        // Arc entities ήδη έχουν τα properties στο DxfArc type
        return {
          center: entity.center,
          radius: entity.radius,
          startAngle: entity.startAngle,
          endAngle: entity.endAngle
        };

      case 'text':
        // Text entities ήδη έχουν τα properties στο DxfText type
        return {
          position: entity.position,
          text: entity.text,
          height: entity.height
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