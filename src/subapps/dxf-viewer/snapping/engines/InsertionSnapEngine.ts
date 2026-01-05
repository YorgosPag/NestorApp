/**
 * Insertion Snap Engine
 * Υπεύθυνο για εύρεση insertion points σε text entities, blocks, symbols
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
// 🏢 ENTERPRISE: Import centralized entity types
import type {
  TextEntity,
  BlockEntity,
  DimensionEntity,
  PointEntity,
  SplineEntity,
  BaseEntity
} from '../../types/entities';

/**
 * 🏢 ENTERPRISE: Extended entity interfaces for insertion snap detection
 * These extend BaseEntity for entities not yet in centralized types
 */
interface InsertionTextEntity extends BaseEntity {
  position?: Point2D;
  insertionPoint?: Point2D;
  alignmentPoint?: Point2D;
}

interface InsertionBlockEntity extends BaseEntity {
  position?: Point2D;
  insertionPoint?: Point2D;
}

interface InsertionDimensionEntity extends BaseEntity {
  defPoint?: Point2D;
  textMidPoint?: Point2D;
}

interface LeaderEntity extends BaseEntity {
  type: 'leader';
  vertices?: Point2D[];
}

interface HatchEntity extends BaseEntity {
  type: 'hatch';
  seedPoints?: Point2D[];
}

interface XLineEntity extends BaseEntity {
  type: 'xline' | 'ray';
  basePoint?: Point2D;
  firstPoint?: Point2D;
}

export class InsertionSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.INSERTION);
  }

  initialize(entities: EntityModel[]): void {

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

  private getInsertionPoints(entity: EntityModel): Array<{point: Point2D, type: string}> {
    const insertionPoints: Array<{point: Point2D, type: string}> = [];
    const entityType = entity.type.toLowerCase();

    if (entityType === 'text' || entityType === 'mtext') {
      const textEntity = entity as InsertionTextEntity;

      // 🏢 ENTERPRISE: Proper type guard for Point2D | undefined
      const insertionPoint = textEntity.position ?? textEntity.insertionPoint;
      if (insertionPoint) {
        insertionPoints.push({point: insertionPoint, type: 'Text Base'});
      }

      // Text alignment points if available
      if (textEntity.alignmentPoint) {
        insertionPoints.push({point: textEntity.alignmentPoint, type: 'Text Alignment'});
      }

    } else if (entityType === 'insert' || entityType === 'block') {
      const blockEntity = entity as InsertionBlockEntity;

      // 🏢 ENTERPRISE: Proper type guard for Point2D | undefined
      const insertionPoint = blockEntity.position ?? blockEntity.insertionPoint;
      if (insertionPoint) {
        insertionPoints.push({point: insertionPoint, type: 'Block Insert'});
      }

    } else if (entityType === 'dimension') {
      const dimEntity = entity as InsertionDimensionEntity;

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

      // Point position (PointEntity has required position)
      insertionPoints.push({point: pointEntity.position, type: 'Point'});

    } else if (entityType === 'xline' || entityType === 'ray') {
      const lineEntity = entity as XLineEntity;

      // 🏢 ENTERPRISE: Proper type guard for Point2D | undefined
      const basePoint = lineEntity.basePoint ?? lineEntity.firstPoint;
      if (basePoint) {
        insertionPoints.push({point: basePoint, type: 'Base Point'});
      }

    } else if (entityType === 'spline') {
      const splineEntity = entity as SplineEntity;

      // Spline control points (SplineEntity has required controlPoints)
      splineEntity.controlPoints.forEach((controlPoint: Point2D, index: number) => {
        insertionPoints.push({point: controlPoint, type: `Control Point ${index + 1}`});
      });

      // Spline fit points (optional)
      // Note: SplineEntity in entities.ts doesn't have fitPoints, skip this for type safety
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