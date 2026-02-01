/**
 * Insertion Snap Engine
 * Υπεύθυνο για εύρεση insertion points σε text entities, blocks, symbols
 *
 * 🏢 ENTERPRISE CENTRALIZATION (2025-01-05):
 * - Uses centralized Entity types from types/entities.ts
 * - Uses type guards for safe property access
 * - Uses runtime type checks for non-centralized entity types
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
// 🏢 ENTERPRISE: Import centralized entity types and type guards
import type {
  PointEntity,
  SplineEntity,
  LeaderEntity,
  HatchEntity,
  XLineEntity,
  RayEntity
} from '../../types/entities';
import {
  isTextEntity,
  isMTextEntity,
  isBlockEntity,
  isDimensionEntity,
  isPointEntity,
  isSplineEntity,
  isLeaderEntity,
  isHatchEntity,
  isXLineEntity,
  isRayEntity
} from '../../types/entities';
// 🏢 ADR-149: Centralized Snap Engine Priorities
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

/**
 * 🏢 ENTERPRISE: Helper interfaces for non-centralized entity data access
 * These are used for runtime type checking, not inheritance
 */
interface InsertionPointData {
  position?: Point2D;
  insertionPoint?: Point2D;
  alignmentPoint?: Point2D;
  defPoint?: Point2D;
  textMidPoint?: Point2D;
  vertices?: Point2D[];
  seedPoints?: Point2D[];
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
    // 🏢 ADR-149: Use centralized snap engine priorities
    const priority = SNAP_ENGINE_PRIORITIES.INSERTION;
    
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

    // 🏢 ENTERPRISE: Use type guards for centralized entity types
    if (isTextEntity(entity) || isMTextEntity(entity)) {
      // TextEntity has required position
      insertionPoints.push({point: entity.position, type: 'Text Base'});

      // Check for alignment point (use runtime check for optional property)
      const data = entity as unknown as InsertionPointData;
      if (data.alignmentPoint) {
        insertionPoints.push({point: data.alignmentPoint, type: 'Text Alignment'});
      }

    } else if (isBlockEntity(entity)) {
      // BlockEntity has required position
      insertionPoints.push({point: entity.position, type: 'Block Insert'});

    } else if (isDimensionEntity(entity)) {
      // DimensionEntity - use runtime checks for optional properties
      const data = entity as unknown as InsertionPointData;
      if (data.defPoint) {
        insertionPoints.push({point: data.defPoint, type: 'Dimension Point'});
      }
      if (data.textMidPoint) {
        insertionPoints.push({point: data.textMidPoint, type: 'Dimension Text'});
      }

    } else if (isLeaderEntity(entity)) {
      // 🏢 ENTERPRISE: LeaderEntity with type-safe vertices access
      entity.vertices.forEach((vertex: Point2D, index: number) => {
        insertionPoints.push({
          point: vertex,
          type: index === 0 ? 'Leader Start' : `Leader Point ${index + 1}`
        });
      });

    } else if (isHatchEntity(entity)) {
      // 🏢 ENTERPRISE: HatchEntity with type-safe seedPoints access
      if (entity.seedPoints) {
        entity.seedPoints.forEach((seedPoint: Point2D, index: number) => {
          insertionPoints.push({point: seedPoint, type: `Hatch Seed ${index + 1}`});
        });
      }

    } else if (isPointEntity(entity)) {
      // PointEntity has required position
      insertionPoints.push({point: entity.position, type: 'Point'});

    } else if (isXLineEntity(entity)) {
      // 🏢 ENTERPRISE: XLineEntity with type-safe basePoint access
      insertionPoints.push({point: entity.basePoint, type: 'XLine Base Point'});

    } else if (isRayEntity(entity)) {
      // 🏢 ENTERPRISE: RayEntity with type-safe basePoint access
      insertionPoints.push({point: entity.basePoint, type: 'Ray Origin'});

    } else if (isSplineEntity(entity)) {
      // SplineEntity has required controlPoints
      entity.controlPoints.forEach((controlPoint: Point2D, index: number) => {
        insertionPoints.push({point: controlPoint, type: `Control Point ${index + 1}`});
      });
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