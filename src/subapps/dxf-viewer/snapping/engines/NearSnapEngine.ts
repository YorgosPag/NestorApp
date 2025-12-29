/**
 * Near Snap Engine
 * Υπεύθυνο για εύρεση snap points κοντά στο cursor χωρίς ειδική γεωμετρική λογική
 */

import type { Point2D } from '../../rendering/types/Types';
import { Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findEntityBasedSnapCandidates, GenericSnapPoint, processRectangleSnapping } from './shared/snap-engine-utils';

export class NearSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.NEAR);
  }

  initialize(entities: Entity[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    // Use shared entity-based snap candidate finder to eliminate duplication
    return findEntityBasedSnapCandidates(
      context.entities,
      cursorPoint,
      context,
      {
        snapType: ExtendedSnapType.NEAR,
        displayName: 'Near',
        priority: 9  // Lower priority - general purpose fallback
      },
      (entity, cursorPoint, radius) => this.getNearPoints(entity, cursorPoint, radius)
    );
  }

  private getNearPoints(entity: Entity, cursorPoint: Point2D, radius: number): Array<{point: Point2D, type: string}> {
    const nearPoints: Array<{point: Point2D, type: string}> = [];
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'line') {
      if (entity.start && entity.end) {
        // Sample points along the line
        const samplePoints = this.sampleLinePoints(entity.start, entity.end, 5);
        samplePoints.forEach((point, index) => {
          nearPoints.push({point, type: `Line Point ${index + 1}`});
        });
      }
      
    } else if (entityType === 'circle') {
      if (entity.center && entity.radius) {
        // Sample points around the circle
        const samplePoints = this.sampleCirclePoints(entity.center, entity.radius, 8);
        samplePoints.forEach((point, index) => {
          nearPoints.push({point, type: `Circle Point ${index + 1}`});
        });
      }
      
    } else if (entityType === 'arc') {
      if (entity.center && entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
        // Sample points along the arc
        const samplePoints = this.sampleArcPoints(entity.center, entity.radius, entity.startAngle, entity.endAngle, 5);
        samplePoints.forEach((point, index) => {
          nearPoints.push({point, type: `Arc Point ${index + 1}`});
        });
      }
      
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      const points = (entity.points || ('vertices' in entity ? entity.vertices : undefined)) as Point2D[] | undefined;
      if (points) {
        // All vertices
        points.forEach((point: Point2D, index: number) => {
          nearPoints.push({point, type: `Vertex ${index + 1}`});
        });
        
        // Sample points along edges
        for (let i = 1; i < points.length; i++) {
          const edgeSamples = this.sampleLinePoints(points[i-1], points[i], 3);
          edgeSamples.forEach((point, sampleIndex) => {
            nearPoints.push({point, type: `Edge ${i} Point ${sampleIndex + 1}`});
          });
        }
        
        // Closing edge for closed polylines
        const isClosed = 'closed' in entity ? entity.closed : false;
        if (isClosed && points.length > 2) {
          const edgeSamples = this.sampleLinePoints(points[points.length - 1], points[0], 3);
          edgeSamples.forEach((point, sampleIndex) => {
            nearPoints.push({point, type: `Closing Edge Point ${sampleIndex + 1}`});
          });
        }
      }
      
    } else if (entityType === 'rectangle') {
      const rectEntity = entity as { corner1?: Point2D; corner2?: Point2D };
      processRectangleSnapping(rectEntity, (corner, index, type) => {
        nearPoints.push({point: corner, type});
      });
        
      // Sample points along edges
      const lines = GeometricCalculations.getRectangleLines(rectEntity);
      lines.forEach((line, lineIndex) => {
        const edgeSamples = this.sampleLinePoints(line.start, line.end, 3);
        edgeSamples.forEach((point, sampleIndex) => {
          nearPoints.push({point, type: `Edge ${lineIndex + 1} Point ${sampleIndex + 1}`});
        });
      });
    }
    
    return nearPoints;
  }

  private sampleLinePoints(start: Point2D, end: Point2D, count: number): Point2D[] {
    const points: Point2D[] = [];
    
    for (let i = 1; i < count - 1; i++) {
      const t = i / (count - 1);
      points.push({
        x: start.x + t * (end.x - start.x),
        y: start.y + t * (end.y - start.y)
      });
    }
    
    return points;
  }

  private sampleCirclePoints(center: Point2D, radius: number, count: number): Point2D[] {
    const points: Point2D[] = [];
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      });
    }
    
    return points;
  }

  private sampleArcPoints(center: Point2D, radius: number, startAngle: number, endAngle: number, count: number): Point2D[] {
    const points: Point2D[] = [];
    
    let angleRange = endAngle - startAngle;
    if (angleRange < 0) angleRange += 2 * Math.PI;
    
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const angle = startAngle + t * angleRange;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      });
    }
    
    return points;
  }

  dispose(): void {
    // Nothing to dispose
  }

  getStats(): {
    nearChecks: number;
  } {
    return {
      nearChecks: 0 // Could add metrics
    };
  }
}