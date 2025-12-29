/**
 * Perpendicular Snap Engine
 * Υπεύθυνο για εύρεση perpendicular snap points σε γραμμές
 */

import type { Point2D } from '../../rendering/types/Types';
import { ExtendedSnapType } from '../extended-types';
import type { Entity } from '../../types/entities';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { findEntityBasedSnapCandidates, GenericSnapPoint } from './shared/snap-engine-utils';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';

export class PerpendicularSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.PERPENDICULAR);
  }

  initialize(entities: Entity[]): void {

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
      (entity, cursorPoint, _) => this.getPerpendicularPoints(entity, cursorPoint, radius * 2)
    );
  }

  private getPerpendicularPoints(entity: Entity, cursorPoint: Point2D, maxDistance: number): Array<{point: Point2D, type: string}> {
    const perpendicularPoints: Array<{point: Point2D, type: string}> = [];
    const entityType = entity.type.toLowerCase();

    if (entityType === 'line') {
      const lineEntity = entity as { start?: Point2D; end?: Point2D };
      if (lineEntity.start && lineEntity.end) {
        const perpPoint = this.getPerpendicularToLine(lineEntity.start, lineEntity.end, cursorPoint);
        if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
          perpendicularPoints.push({point: perpPoint, type: 'Line'});
        }
      }
      
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      const polylineEntity = entity as { points?: Point2D[]; vertices?: Point2D[]; closed?: boolean };
      const points = (polylineEntity.points || polylineEntity.vertices) as Point2D[] | undefined;
      const isClosed = polylineEntity.closed || false;
      
      if (points && points.length > 1) {
        // Check all line segments
        for (let i = 1; i < points.length; i++) {
          const perpPoint = this.getPerpendicularToLine(points[i-1], points[i], cursorPoint);
          if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: `Polyline Segment ${i}`});
          }
        }
        
        // Check closing segment for closed polylines
        if (isClosed && points.length > 2) {
          const perpPoint = this.getPerpendicularToLine(points[points.length - 1], points[0], cursorPoint);
          if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: 'Polyline Closing Segment'});
          }
        }
      }
      
    } else if (entityType === 'rectangle') {
      const rectangleEntity = entity as { corner1?: Point2D; corner2?: Point2D };
      if (rectangleEntity.corner1 && rectangleEntity.corner2) {
        const lines = GeometricCalculations.getRectangleLines(entity);
        lines.forEach((line, index) => {
          const perpPoint = this.getPerpendicularToLine(line.start, line.end, cursorPoint);
          if (perpPoint && calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: `Rectangle Edge ${index + 1}`});
          }
        });
      }
      
    } else if (entityType === 'circle') {
      const circleEntity = entity as { center?: Point2D; radius?: number };
      if (circleEntity.center && circleEntity.radius) {
        // Perpendicular from cursor to circle (nearest point on circle)
        const dx = cursorPoint.x - circleEntity.center.x;
        const dy = cursorPoint.y - circleEntity.center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0 && distance <= maxDistance + circleEntity.radius) {
          const scale = circleEntity.radius / distance;
          const perpPoint = {
            x: circleEntity.center.x + dx * scale,
            y: circleEntity.center.y + dy * scale
          };
          perpendicularPoints.push({point: perpPoint, type: 'Circle'});
        }
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