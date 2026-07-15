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
  Viewport
} from '../rendering/types/Types';
import type { DxfScene } from '../canvas-v2/dxf-canvas/dxf-types';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../config/tolerance-config';
// 🏢 N.7.1 — DxfEntityUnion → EntityModel conversion extracted to keep this
// service under the 500-line file limit. SSoT: hit-test-entity-model.ts.
import { convertDxfEntityToEntityModel } from './hit-test-entity-model';

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
    // 🚀 ADR-040 cursor-lag Φ12.1 — skip the O(n) re-map + spatial-index rebuild when the
    // scene reference is UNCHANGED. This is called from the render loop on EVERY dirty
    // frame, incl. every hover-entity change. Rebuilding the hit-test index per hover was
    // O(n) `convertDxfEntityToEntityModel` allocation + QuadTree rebuild → heavy GC churn
    // → cursor jank that scaled with entity count (worst on Chrome/V8, even snaps OFF).
    // DxfScene is immutable — replaced by reference on every mutation (the SAME invariant
    // the bitmap cache relies on via `sceneRef !== scene`), so ref-equality is a correct,
    // sufficient guard: the index rebuilds ONLY on a real scene change.
    if (scene === this.currentScene) return;
    this.currentScene = scene;

    if (!scene || !scene.entities.length) {
      this.hitTester.setEntities([], true);
      return;
    }

    // Convert DxfEntityUnion to EntityModel
    const entityModels = scene.entities.map(entity => convertDxfEntityToEntityModel(entity));
    // 🏢 ENTERPRISE: Type-safe cast - EntityModel extends BaseEntity which is compatible with Entity
    this.hitTester.setEntities(entityModels as import('../types/entities').Entity[], true);
  }

  /**
   * SSoT core — screen→world + pixel→world tolerance + spatial query.
   * De-dupes `hitTest` (top-1) and `hitTestAll` (cycling) so they never drift apart (N.18).
   *
   * 🏢 AutoCAD/MicroStation standard: pixel tolerance → world units, scaling inversely with
   * zoom (high zoom → tighter world tolerance, always pixel-consistent).
   */
  private queryHitsAt(
    screenPos: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
    options: HitTestOptions,
    defaultMaxResults: number,
  ): ReturnType<HitTester['hitTestPoint']> {
    const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);
    const pixelTolerance = options.tolerance || TOLERANCE_CONFIG.ENTITY_HOVER_PIXELS;
    const worldTolerance = pixelTolerance / transform.scale;
    return this.hitTester.hitTestPoint(worldPos, {
      tolerance: worldTolerance,
      maxResults: options.maxResults || defaultMaxResults,
      useSpatialIndex: true,
      layerFilter: options.layerFilter,
      typeFilter: options.typeFilter,
      includeInvisible: options.includeInvisible || false,
    });
  }

  /** Map a spatial-query hit → the service's public HitTestResult shape. */
  private toHitResult(hit: ReturnType<HitTester['hitTestPoint']>[number]): HitTestResult {
    return {
      entityId: hit.data?.id || null, // ✅ ENTERPRISE FIX: Use data.id from SpatialQueryResult
      entityType: hit.data?.type || 'unknown', // ✅ Use data.type
      // ADR-358 Phase 9D-5b-i: id-only resolver SSoT (HitTester.layer is already resolver-populated).
      layer: hit.layer,
      distance: hit.distance,
    };
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
      const hits = this.queryHitsAt(screenPos, transform, viewport, options, 1);
      return hits.length > 0 ? this.toHitResult(hits[0]) : { entityId: null };
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
      return this.queryHitsAt(screenPos, transform, viewport, options, 50)
        .map((hit) => this.toHitResult(hit));
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
 * ⚠️ NO module-level singleton export (ADR-659 SSoT).
 *
 * Hit-testing is accessed ONLY through the DI container: `serviceRegistry.get('hit-testing')`.
 * The registry owns the ONE instance; the render loop feeds it the scene via `updateScene()`
 * on every dirty frame. A second `export const hitTestingService = new HitTestingService()`
 * here used to create a parallel, scene-less "zombie" that silently returned [] — the
 * root-cause bug behind selection-cycling never working. Do not reintroduce it. Big-player /
 * enterprise DI practice: one container, one access path, zero parallel globals.
 */
