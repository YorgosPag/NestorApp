/**
 * Perpendicular Snap Engine
 * Υπεύθυνο για εύρεση perpendicular snap points σε γραμμές
 *
 * 🏢 ENTERPRISE CENTRALIZATION (2025-01-05):
 * - Uses centralized Entity types from types/entities.ts
 * - Uses type guards for safe property access
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { findEntityBasedSnapCandidates, GenericSnapPoint } from './shared/snap-engine-utils';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ENTERPRISE: Import centralized type guards
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isRectangleEntity,
  isCircleEntity
} from '../../types/entities';

export class PerpendicularSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.PERPENDICULAR);
  }

  initialize(entities: EntityModel[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    // Use shared entity-based snap candidate finder to eliminate duplication
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.PERPENDICULAR);
    return findEntityBasedSnapCandidates(
      context.entities,
      cursorPoint,
      context,
      {
        snapType: ExtendedSnapType.PERPENDICULAR,
        displayName: 'Perpendicular',
        priority: 4  // Medium-high priority
      },
      (entity, cursorPoint, _) => {
        // Extract only Point2D from the rich point data structure
        const richPoints = this.getPerpendicularPoints(entity as EntityModel, cursorPoint, radius * 2);
        return richPoints.map(p => p.point);
      }
    );
  }

  private getPerpendicularPoints(entity: EntityModel, cursorPoint: Point2D, maxDistance: number): Array<{point: Point2D, type: string}> {
    const perpendicularPoints: Array<{point: Point2D, type: string}> = [];

    // 🏢 ENTERPRISE: Use type guards for safe property access
    if (isLineEntity(entity)) {
      const perpPoint = this.getPerpendicularToLine(entity.start, entity.end, cursorPoint);
      if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
        perpendicularPoints.push({point: perpPoint, type: 'Line'});
      }

    } else if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
      const vertices = entity.vertices;
      const isClosed = entity.closed || false;

      if (vertices && vertices.length > 1) {
        // Check all line segments
        for (let i = 1; i < vertices.length; i++) {
          const perpPoint = this.getPerpendicularToLine(vertices[i-1], vertices[i], cursorPoint);
          if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: `Polyline Segment ${i}`});
          }
        }

        // Check closing segment for closed polylines
        if (isClosed && vertices.length > 2) {
          const perpPoint = this.getPerpendicularToLine(vertices[vertices.length - 1], vertices[0], cursorPoint);
          if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: 'Polyline Closing Segment'});
          }
        }
      }

    } else if (isRectangleEntity(entity)) {
      const lines = GeometricCalculations.getRectangleLines(entity);
      lines.forEach((line, index) => {
        const perpPoint = this.getPerpendicularToLine(line.start, line.end, cursorPoint);
        if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
          perpendicularPoints.push({point: perpPoint, type: `Rectangle Edge ${index + 1}`});
        }
      });

    } else if (isCircleEntity(entity)) {
      // Perpendicular from cursor to circle (nearest point on circle)
      const dx = cursorPoint.x - entity.center.x;
      const dy = cursorPoint.y - entity.center.y;
      // 🏢 ADR-065: Use centralized distance calculation
      const distance = calculateDistance(cursorPoint, entity.center);

      if (distance > 0 && distance <= maxDistance + entity.radius) {
        const scale = entity.radius / distance;
        const perpPoint = {
          x: entity.center.x + dx * scale,
          y: entity.center.y + dy * scale
        };
        perpendicularPoints.push({point: perpPoint, type: 'Circle'});
      }
    }

    return perpendicularPoints;
  }

  private getPerpendicularToLine(lineStart: Point2D, lineEnd: Point2D, externalPoint: Point2D): Point2D | null {
    // Use shared geometry utility for consistency
    // For perpendicular snap, we want the foot of perpendicular even if outside segment
    return getNearestPointOnLine(externalPoint, lineStart, lineEnd, false);
  }

  dispose(): void {
    // Nothing to dispose
  }

  getStats(): {
    perpendicularChecks: number;
  } {
    return {
      perpendicularChecks: 0 // Could add metrics
    };
  }
}