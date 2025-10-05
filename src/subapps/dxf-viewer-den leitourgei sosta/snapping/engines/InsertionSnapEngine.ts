/**
 * Insertion Snap Engine
 * Υπεύθυνο για εύρεση insertion points σε text entities, blocks, symbols
 */

import type { Point2D } from '../../rendering/types/Types';
import { Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';

// Extended entity interfaces for insertion snap detection
interface TextEntity extends Entity {
  position?: Point2D;
  insertionPoint?: Point2D;
  alignmentPoint?: Point2D;
}

interface BlockEntity extends Entity {
  position?: Point2D;
  insertionPoint?: Point2D;
}

interface DimensionEntity extends Entity {
  defPoint?: Point2D;
  textMidPoint?: Point2D;
}

interface LeaderEntity extends Entity {
  vertices?: Point2D[];
}

interface HatchEntity extends Entity {
  seedPoints?: Point2D[];
}

interface PointEntity extends Entity {
  position?: Point2D;
}

interface LineEntity extends Entity {
  basePoint?: Point2D;
  firstPoint?: Point2D;
}

interface SplineEntity extends Entity {
  controlPoints?: Point2D[];
  fitPoints?: Point2D[];
}

export class InsertionSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.INSERTION);
  }

  initialize(entities: Entity[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const priority = 2; // High priority for insertion points
    
    const candidates = this.processCandidateLoop(
      context.entities,
      context,
      cursorPoint,
      priority,
      (entity) => this.getInsertionPoints(entity),
      (type) => `Insertion (${type})`
    );

    return { candidates };
  }

  private getInsertionPoints(entity: Entity): Array<{point: Point2D, type: string}> {
    const insertionPoints: Array<{point: Point2D, type: string}> = [];
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'text' || entityType === 'mtext') {
      const textEntity = entity as TextEntity;
      
      // Text insertion point (base point)
      if (textEntity.position || textEntity.insertionPoint) {
        const insertionPoint = textEntity.position || textEntity.insertionPoint;
        insertionPoints.push({point: insertionPoint, type: 'Text Base'});
      }
      
      // Text alignment points if available
      if (textEntity.alignmentPoint) {
        insertionPoints.push({point: textEntity.alignmentPoint, type: 'Text Alignment'});
      }
      
    } else if (entityType === 'insert' || entityType === 'block') {
      const blockEntity = entity as BlockEntity;
      
      // Block insertion point
      if (blockEntity.position || blockEntity.insertionPoint) {
        const insertionPoint = blockEntity.position || blockEntity.insertionPoint;
        insertionPoints.push({point: insertionPoint, type: 'Block Insert'});
      }
      
    } else if (entityType === 'dimension') {
      const dimEntity = entity as DimensionEntity;
      
      // Dimension definition points
      if (dimEntity.defPoint) {
        insertionPoints.push({point: dimEntity.defPoint, type: 'Dimension Point'});
      }
      
      if (dimEntity.textMidPoint) {
        insertionPoints.push({point: dimEntity.textMidPoint, type: 'Dimension Text'});
      }
      
    } else if (entityType === 'leader') {
      const leaderEntity = entity as LeaderEntity;
      
      // Leader vertices
      if (leaderEntity.vertices) {
        leaderEntity.vertices.forEach((vertex: Point2D, index: number) => {
          insertionPoints.push({
            point: vertex, 
            type: index === 0 ? 'Leader Start' : `Leader Point ${index + 1}`
          });
        });
      }
      
    } else if (entityType === 'hatch') {
      const hatchEntity = entity as HatchEntity;
      
      // Hatch seed points
      if (hatchEntity.seedPoints) {
        hatchEntity.seedPoints.forEach((seedPoint: Point2D, index: number) => {
          insertionPoints.push({point: seedPoint, type: `Hatch Seed ${index + 1}`});
        });
      }
      
    } else if (entityType === 'point') {
      const pointEntity = entity as PointEntity;
      
      // Point position
      if (pointEntity.position) {
        insertionPoints.push({point: pointEntity.position, type: 'Point'});
      }
      
    } else if (entityType === 'xline' || entityType === 'ray') {
      const lineEntity = entity as LineEntity;
      
      // Construction line base point
      if (lineEntity.basePoint || lineEntity.firstPoint) {
        const basePoint = lineEntity.basePoint || lineEntity.firstPoint;
        insertionPoints.push({point: basePoint, type: 'Base Point'});
      }
      
    } else if (entityType === 'spline') {
      const splineEntity = entity as SplineEntity;
      
      // Spline control points
      if (splineEntity.controlPoints) {
        splineEntity.controlPoints.forEach((controlPoint: Point2D, index: number) => {
          insertionPoints.push({point: controlPoint, type: `Control Point ${index + 1}`});
        });
      }
      
      // Spline fit points
      if (splineEntity.fitPoints) {
        splineEntity.fitPoints.forEach((fitPoint: Point2D, index: number) => {
          insertionPoints.push({point: fitPoint, type: `Fit Point ${index + 1}`});
        });
      }
    }
    
    return insertionPoints;
  }

  dispose(): void {
    // Nothing to dispose
  }

  getStats(): {
    insertionChecks: number;
  } {
    return {
      insertionChecks: 0 // Could add metrics
    };
  }
}