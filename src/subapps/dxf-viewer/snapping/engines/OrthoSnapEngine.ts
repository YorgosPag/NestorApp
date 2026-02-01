/**
 * Ortho Snap Engine
 * Υπεύθυνο για εύρεση orthogonal snap points (0°, 90°, 180°, 270°)
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, SnapCandidate } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-087: Centralized Snap Engine Configuration
// 🏢 ADR-149: Centralized Snap Engine Priorities
import { SNAP_SEARCH_RADIUS, SNAP_RADIUS_MULTIPLIERS, SNAP_GEOMETRY, SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

export class OrthoSnapEngine extends BaseSnapEngine {
  private lastPoint: Point2D | null = null;

  constructor() {
    super(ExtendedSnapType.ORTHO);
  }

  initialize(entities: EntityModel[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    // 🏢 ADR-149: Use centralized snap engine priorities
    const priority = SNAP_ENGINE_PRIORITIES.ORTHO;
    
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.ORTHO);
    
    // Need a reference point for orthogonal snapping
    // Try to find the last drawn point or use nearby endpoints
    const referencePoint = this.findReferencePoint(cursorPoint, context);
    
    if (referencePoint) {
      // 🏢 ADR-087: Use centralized snap radius multiplier
      const orthoPoints = this.getOrthogonalPoints(referencePoint, cursorPoint, radius * SNAP_RADIUS_MULTIPLIERS.STANDARD);
      
      for (const orthoPoint of orthoPoints) {
        const distance = calculateDistance(cursorPoint, orthoPoint.point);
        
        if (distance <= radius) {
          const candidate = this.createCandidate(
            orthoPoint.point,
            `Ortho (${orthoPoint.type})`,
            distance,
            priority,
            orthoPoint.entityId
          );
          
          candidates.push(candidate);
          
          if (candidates.length >= context.maxCandidates) break;
        }
      }
    }

    return { candidates };
  }

  private findReferencePoint(cursorPoint: Point2D, context: SnapEngineContext): Point2D | null {
    // If we have a stored last point, use it
    if (this.lastPoint) {
      return this.lastPoint;
    }
    
    // Otherwise, find the closest endpoint as reference
    let closestPoint: Point2D | null = null;
    let closestDistance = Infinity;
    // 🏢 ADR-087: Use centralized search radius
    const searchRadius = SNAP_SEARCH_RADIUS.REFERENCE_POINT;
    
    // Guard against non-iterable entities
    if (!Array.isArray(context.entities)) {
      console.warn('[OrthoSnapEngine] entities is not an array:', typeof context.entities, context.entities);
      return null;
    }
    
    for (const entity of context.entities) {
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;
      if (!entity.visible) continue;
      
      const endpoints = GeometricCalculations.getEntityEndpoints(entity);
      
      for (const endpoint of endpoints) {
        const distance = calculateDistance(cursorPoint, endpoint);
        if (distance < closestDistance && distance <= searchRadius) {
          closestDistance = distance;
          closestPoint = endpoint;
        }
      }
    }
    
    return closestPoint;
  }

  private getOrthogonalPoints(referencePoint: Point2D, cursorPoint: Point2D, maxDistance: number): Array<{point: Point2D, type: string, entityId?: string}> {
    const orthoPoints: Array<{point: Point2D, type: string, entityId?: string}> = [];

    // 🏢 ADR-065: Use centralized distance calculation
    const distance = calculateDistance(cursorPoint, referencePoint);

    if (distance === 0 || distance > maxDistance) {
      return orthoPoints;
    }

    // Calculate direction vector for angle determination
    const dx = cursorPoint.x - referencePoint.x;
    const dy = cursorPoint.y - referencePoint.y;

    // Horizontal snap (0° and 180°)
    const horizontalPoint = {
      x: cursorPoint.x,
      y: referencePoint.y
    };
    
    // Vertical snap (90° and 270°)
    const verticalPoint = {
      x: referencePoint.x,
      y: cursorPoint.y
    };
    
    // Check which orthogonal point is closer to cursor
    const horizontalDistance = calculateDistance(cursorPoint, horizontalPoint);
    const verticalDistance = calculateDistance(cursorPoint, verticalPoint);
    
    if (horizontalDistance <= maxDistance) {
      const angle = dx > 0 ? '0°' : '180°';
      orthoPoints.push({
        point: horizontalPoint,
        type: `Horizontal (${angle})`
      });
    }
    
    if (verticalDistance <= maxDistance) {
      const angle = dy > 0 ? '90°' : '270°';
      orthoPoints.push({
        point: verticalPoint,
        type: `Vertical (${angle})`
      });
    }
    
    // Also try diagonal orthogonal points (45°, 135°, 225°, 315°)
    // 🏢 ADR-087: Use centralized geometry constant (INV_SQRT_2 for efficiency)
    const diagonalDistance = distance * SNAP_GEOMETRY.INV_SQRT_2;
    
    if (diagonalDistance <= maxDistance) {
      // 45° diagonal
      const diagonal45 = {
        x: referencePoint.x + Math.sign(dx) * diagonalDistance,
        y: referencePoint.y + Math.sign(dx) * diagonalDistance
      };
      
      // 135° diagonal  
      const diagonal135 = {
        x: referencePoint.x - Math.sign(dx) * diagonalDistance,
        y: referencePoint.y + Math.sign(dx) * diagonalDistance
      };
      
      const dist45 = calculateDistance(cursorPoint, diagonal45);
      const dist135 = calculateDistance(cursorPoint, diagonal135);
      
      if (dist45 <= maxDistance) {
        orthoPoints.push({
          point: diagonal45,
          type: 'Diagonal (45°)'
        });
      }
      
      if (dist135 <= maxDistance) {
        orthoPoints.push({
          point: diagonal135,
          type: 'Diagonal (135°)'
        });
      }
    }
    
    return orthoPoints;
  }

  setLastPoint(point: Point2D): void {
    this.lastPoint = point;
  }

  clearLastPoint(): void {
    this.lastPoint = null;
  }

  dispose(): void {
    this.lastPoint = null;
  }

  getStats(): {
    orthoChecks: number;
    lastPoint: Point2D | null;
  } {
    return {
      orthoChecks: 0, // Could add metrics
      lastPoint: this.lastPoint
    };
  }
}