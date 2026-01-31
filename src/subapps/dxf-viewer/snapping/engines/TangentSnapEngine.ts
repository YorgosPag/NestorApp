/**
 * Tangent Snap Engine
 * Υπεύθυνο για εύρεση snap points εφαπτόμενων σε circles/arcs
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findCircleBasedSnapCandidates } from './shared/snap-engine-utils';
// 🏢 ADR-065: Centralized Distance Calculation
// 🏢 ADR-066: Centralized Angle Calculation
import { calculateDistance, calculateAngle } from '../../rendering/entities/shared/geometry-rendering-utils';

export class TangentSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.TANGENT);
  }

  initialize(entities: EntityModel[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    // Use shared circle-based snap candidate finder to eliminate duplication
    // 🏢 ENTERPRISE FIX: Use closure to capture cursorPoint since callback receives entity
    return findCircleBasedSnapCandidates(
      context.entities,
      cursorPoint,
      context,
      {
        snapType: ExtendedSnapType.TANGENT,
        displayName: 'Tangent',
        priority: 3  // High priority for precision
      },
      (center, radius, _entity) => this.getTangentPoints(center, radius, cursorPoint)
    );
  }

  private getTangentPoints(circleCenter: Point2D, circleRadius: number, externalPoint: Point2D): Point2D[] {
    // 🏢 ADR-065: Use centralized distance calculation
    const distanceToCenter = calculateDistance(externalPoint, circleCenter);
    
    // If point is inside or on the circle, no external tangents exist
    if (distanceToCenter <= circleRadius) {
      return [];
    }
    
    // Calculate tangent points using geometry
    const tangentDistance = Math.sqrt(distanceToCenter * distanceToCenter - circleRadius * circleRadius);
    // 🏢 ADR-066: Use centralized angle calculation (fixes undefined dx/dy bug)
    const angle = calculateAngle(circleCenter, externalPoint);
    const tangentAngle = Math.asin(circleRadius / distanceToCenter);
    
    // Two tangent points
    const angle1 = angle + tangentAngle;
    const angle2 = angle - tangentAngle;
    
    const tangentPoint1 = {
      x: circleCenter.x + circleRadius * Math.cos(angle1 + Math.PI / 2),
      y: circleCenter.y + circleRadius * Math.sin(angle1 + Math.PI / 2)
    };
    
    const tangentPoint2 = {
      x: circleCenter.x + circleRadius * Math.cos(angle2 - Math.PI / 2),
      y: circleCenter.y + circleRadius * Math.sin(angle2 - Math.PI / 2)
    };
    
    return [tangentPoint1, tangentPoint2];
  }

  dispose(): void {
    // Nothing to dispose
  }

  getStats(): {
    tangentChecks: number;
  } {
    return {
      tangentChecks: 0 // Could add metrics
    };
  }
}