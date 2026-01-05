/**
 * Parallel Snap Engine
 * Υπεύθυνο για εύρεση parallel snap points σε σχέση με υπάρχουσες γραμμές
 *
 * 🏢 ENTERPRISE CENTRALIZATION (2025-01-05):
 * - Uses centralized Entity types from types/entities.ts
 * - Uses type guards for safe property access
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, SnapCandidate } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ENTERPRISE: Import centralized type guards
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity
} from '../../types/entities';

export class ParallelSnapEngine extends BaseSnapEngine {
  private referenceLine: {start: Point2D, end: Point2D} | null = null;

  constructor() {
    super(ExtendedSnapType.PARALLEL);
  }

  initialize(entities: EntityModel[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    const priority = 4; // Medium-high priority
    
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.PARALLEL);
    
    // Find potential reference lines near cursor
    const referenceLines = this.findReferenceLines(cursorPoint, radius * 3, context);
    
    for (const refLine of referenceLines) {
      // Calculate line direction vector
      const dx = refLine.end.x - refLine.start.x;
      const dy = refLine.end.y - refLine.start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length === 0) continue;
      
      // Normalized direction vector
      const dirX = dx / length;
      const dirY = dy / length;
      
      // Project cursor point onto the parallel line passing through nearest reference point
      const nearestRefPoint = getNearestPointOnLine(cursorPoint, refLine.start, refLine.end, false);
      
      // Create parallel line candidates at different distances
      const distances = [0, 50, 100, 150]; // Grid-like distances
      
      for (const dist of distances) {
        // Perpendicular direction
        const perpX = -dirY;
        const perpY = dirX;
        
        // Points on parallel lines
        const parallelPoint1 = {
          x: nearestRefPoint.x + perpX * dist,
          y: nearestRefPoint.y + perpY * dist
        };
        
        const parallelPoint2 = {
          x: nearestRefPoint.x - perpX * dist,
          y: nearestRefPoint.y - perpY * dist
        };
        
        // Check if points are close to cursor
        const distance1 = calculateDistance(cursorPoint, parallelPoint1);
        const distance2 = calculateDistance(cursorPoint, parallelPoint2);
        
        if (distance1 <= radius) {
          const candidate = this.createCandidate(
            parallelPoint1,
            `Parallel (${dist}px)`,
            distance1,
            priority,
            refLine.entityId
          );
          candidates.push(candidate);
        }
        
        if (distance2 <= radius) {
          const candidate = this.createCandidate(
            parallelPoint2,
            `Parallel (${dist}px)`,
            distance2,
            priority,
            refLine.entityId
          );
          candidates.push(candidate);
        }
        
        if (candidates.length >= context.maxCandidates) break;
      }
      
      if (candidates.length >= context.maxCandidates) break;
    }

    return { candidates };
  }

  private findReferenceLines(cursorPoint: Point2D, searchRadius: number, context: SnapEngineContext): Array<{start: Point2D, end: Point2D, entityId: string}> {
    const lines: Array<{start: Point2D, end: Point2D, entityId: string}> = [];
    
    // Guard against non-iterable entities
    if (!Array.isArray(context.entities)) {
      console.warn('[ParallelSnapEngine] entities is not an array:', typeof context.entities, context.entities);
      return lines;
    }
    
    for (const entity of context.entities) {
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;
      if (!entity.visible) continue;

      // 🏢 ENTERPRISE: Use type guards for safe property access
      if (isLineEntity(entity)) {
        const distance = GeometricCalculations.distancePointToLine(cursorPoint, entity.start, entity.end);
        if (distance <= searchRadius) {
          lines.push({
            start: entity.start,
            end: entity.end,
            entityId: entity.id
          });
        }
      } else if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
        const vertices = entity.vertices;
        if (vertices && vertices.length > 1) {
          for (let i = 1; i < vertices.length; i++) {
            const distance = GeometricCalculations.distancePointToLine(cursorPoint, vertices[i-1], vertices[i]);
            if (distance <= searchRadius) {
              lines.push({
                start: vertices[i-1],
                end: vertices[i],
                entityId: entity.id
              });
            }
          }
        }
      }
    }
    
    // Sort by distance to cursor
    lines.sort((a, b) => {
      const distA = Math.min(
        GeometricCalculations.distancePointToLine(cursorPoint, a.start, a.end)
      );
      const distB = Math.min(
        GeometricCalculations.distancePointToLine(cursorPoint, b.start, b.end)
      );
      return distA - distB;
    });
    
    return lines.slice(0, 3); // Limit to 3 reference lines
  }

  // Using centralized geometry utility - eliminates duplication

  dispose(): void {
    this.referenceLine = null;
  }

  getStats(): {
    parallelChecks: number;
  } {
    return {
      parallelChecks: 0 // Could add metrics
    };
  }
}