/**
 * UNIFIED ENTITY SELECTION SERVICE
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Screen-space hit testing για accurate entity selection
 * Βασισμένο στο working code από backups (19-08-2025)
 *
 * @see CLAUDE.md - Rule #12: ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ = ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΑ
 */

import { CoordinateTransforms } from '../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../rendering/types/Types';
import type { DxfScene, DxfEntityUnion } from '../canvas-v2/dxf-canvas/dxf-types';

export interface EntityHitResult {
  entityId: string;
  distance: number;
  point: Point2D;
}

/**
 * ✅ UNIFIED ENTITY SELECTION ENGINE
 * Screen-space hit testing για accurate entity selection
 */
export class UnifiedEntitySelectionService {
  private currentScene: DxfScene | null = null;

  /**
   * ✅ UPDATE SCENE ENTITIES
   */
  updateScene(scene: DxfScene | null): void {
    this.currentScene = scene;
    console.log('✅ UnifiedEntitySelection: Scene updated', {
      hasScene: !!scene,
      entityCount: scene?.entities?.length || 0
    });
  }

  /**
   * ✅ FIND ENTITY AT POINT (Screen-space hit testing)
   * Αυτή είναι η κρίσιμη μέθοδος που βρίσκει entity με κλικ!
   */
  findEntityAtPoint(
    screenPoint: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
    tolerance: number = 8
  ): EntityHitResult | null {
    if (!this.currentScene || !this.currentScene.entities.length) {
      console.warn('⚠️ UnifiedEntitySelection: No scene or entities', {
        hasScene: !!this.currentScene,
        entityCount: this.currentScene?.entities?.length || 0
      });
      return null;
    }

    console.log('🔍 UnifiedEntitySelection: Finding entity at point', {
      screenPoint,
      entityCount: this.currentScene.entities.length,
      tolerance,
      transform,
      viewport
    });

    let closestHit: EntityHitResult | null = null;
    let minDistance = tolerance;

    for (const entity of this.currentScene.entities) {
      // Skip invisible entities
      if (!entity.visible) continue;

      // ✅ ΚΡΙΣΙΜΟ: Calculate distance in SCREEN SPACE!
      const distance = this.getDistanceToEntity(screenPoint, entity, transform, viewport);

      if (distance <= tolerance && distance < minDistance) {
        minDistance = distance;
        closestHit = {
          entityId: entity.id,
          distance,
          point: screenPoint
        };
      }
    }

    console.log('🔍 UnifiedEntitySelection: Hit test result', {
      found: !!closestHit,
      entityId: closestHit?.entityId,
      distance: closestHit?.distance
    });

    return closestHit;
  }

  /**
   * ✅ CALCULATE DISTANCE TO ENTITY (Screen-space)
   * Υπολογίζει την απόσταση σε screen coordinates!
   */
  private getDistanceToEntity(
    screenPoint: Point2D,
    entity: DxfEntityUnion,
    transform: ViewTransform,
    viewport: Viewport
  ): number {
    // ✅ LINE: Distance από σημείο σε ευθύγραμμο τμήμα
    if (entity.type === 'line' && entity.start && entity.end) {
      // Convert world points to screen space
      const startScreen = CoordinateTransforms.worldToScreen(entity.start, transform, viewport);
      const endScreen = CoordinateTransforms.worldToScreen(entity.end, transform, viewport);
      return this.pointSegmentDistance(screenPoint, startScreen, endScreen);
    }

    // ✅ CIRCLE: Distance από σημείο σε περιφέρεια κύκλου
    if (entity.type === 'circle' && entity.center && entity.radius) {
      const centerScreen = CoordinateTransforms.worldToScreen(entity.center, transform, viewport);
      const distanceToCenter = Math.hypot(screenPoint.x - centerScreen.x, screenPoint.y - centerScreen.y);
      const screenRadius = entity.radius * transform.scale;
      // Distance to circle circumference
      return Math.abs(distanceToCenter - screenRadius);
    }

    // ✅ ARC: Similar to circle but check angle bounds
    if (entity.type === 'arc' && entity.center && entity.radius) {
      const centerScreen = CoordinateTransforms.worldToScreen(entity.center, transform, viewport);
      const distanceToCenter = Math.hypot(screenPoint.x - centerScreen.x, screenPoint.y - centerScreen.y);
      const screenRadius = entity.radius * transform.scale;

      // TODO: Check if point angle is within arc start/end angles
      // For now, treat as full circle
      return Math.abs(distanceToCenter - screenRadius);
    }

    // ✅ POLYLINE: Distance to closest segment
    if (entity.type === 'polyline' && (entity as any).vertices) {
      const vertices = (entity as any).vertices as Point2D[];
      let minDist = Infinity;

      for (let i = 0; i < vertices.length - 1; i++) {
        const startScreen = CoordinateTransforms.worldToScreen(vertices[i], transform, viewport);
        const endScreen = CoordinateTransforms.worldToScreen(vertices[i + 1], transform, viewport);
        const dist = this.pointSegmentDistance(screenPoint, startScreen, endScreen);
        minDist = Math.min(minDist, dist);
      }

      return minDist;
    }

    // ✅ TEXT: Distance to text bounding box center
    if (entity.type === 'text' && entity.position) {
      const posScreen = CoordinateTransforms.worldToScreen(entity.position, transform, viewport);
      return Math.hypot(screenPoint.x - posScreen.x, screenPoint.y - posScreen.y);
    }

    return Infinity;
  }

  /**
   * ✅ POINT-TO-SEGMENT DISTANCE
   * Μαθηματικά ακριβής υπολογισμός απόστασης σημείου από ευθύγραμμο τμήμα
   */
  private pointSegmentDistance(p: Point2D, a: Point2D, b: Point2D): number {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = p.x - a.x;
    const wy = p.y - a.y;
    const vv = vx * vx + vy * vy;

    // If segment is a point
    if (vv === 0) {
      return Math.hypot(wx, wy);
    }

    // Project point onto line, clamped to segment
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv));
    const projx = a.x + t * vx;
    const projy = a.y + t * vy;

    return Math.hypot(p.x - projx, p.y - projy);
  }
}

/**
 * ✅ SINGLETON INSTANCE
 */
export const unifiedEntitySelectionService = new UnifiedEntitySelectionService();
