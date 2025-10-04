/**
 * Perpendicular Snap Engine
 * Υπεύθυνο για εύρεση perpendicular snap points σε γραμμές
 */

import { Point2D, Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findEntityBasedSnapCandidates, GenericSnapPoint } from './shared/snap-engine-utils';
import { getNearestPointOnLine } from '../../utils/geometry-utils';

export class PerpendicularSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.PERPENDICULAR);
  }

  initialize(entities: Entity[]): void {
    console.log('🎯 PerpendicularSnapEngine: Initialize with', entities.length, 'entities');
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
      if (entity.start && entity.end) {
        const perpPoint = this.getPerpendicularToLine(entity.start, entity.end, cursorPoint);
        if (perpPoint && GeometricCalculations.calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
          perpendicularPoints.push({point: perpPoint, type: 'Line'});
        }
      }
      
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      const points = entity.points || (entity as any).vertices;
      const isClosed = (entity as any).closed;
      
      if (points && points.length > 1) {
        // Check all line segments
        for (let i = 1; i < points.length; i++) {
          const perpPoint = this.getPerpendicularToLine(points[i-1], points[i], cursorPoint);
          if (perpPoint && GeometricCalculations.calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: `Polyline Segment ${i}`});
          }
        }
        
        // Check closing segment for closed polylines
        if (isClosed && points.length > 2) {
          const perpPoint = this.getPerpendicularToLine(points[points.length - 1], points[0], cursorPoint);
          if (perpPoint && GeometricCalculations.calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: 'Polyline Closing Segment'});
          }
        }
      }
      
    } else if (entityType === 'rectangle') {
      const rectEntity = entity as any;
      if (rectEntity.corner1 && rectEntity.corner2) {
        const lines = GeometricCalculations.getRectangleLines(rectEntity);
        lines.forEach((line, index) => {
          const perpPoint = this.getPerpendicularToLine(line.start, line.end, cursorPoint);
          if (perpPoint && GeometricCalculations.calculateDistance(cursorPoint, perpPoint) <= maxDistance) {
            perpendicularPoints.push({point: perpPoint, type: `Rectangle Edge ${index + 1}`});
          }
        });
      }
      
    } else if (entityType === 'circle') {
      if (entity.center && entity.radius) {
        // Perpendicular from cursor to circle (nearest point on circle)
        const dx = cursorPoint.x - entity.center.x;
        const dy = cursorPoint.y - entity.center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0 && distance <= maxDistance + entity.radius) {
          const scale = entity.radius / distance;
          const perpPoint = {
            x: entity.center.x + dx * scale,
            y: entity.center.y + dy * scale
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