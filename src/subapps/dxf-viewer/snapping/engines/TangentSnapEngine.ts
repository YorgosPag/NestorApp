/**
 * Tangent Snap Engine
 * Υπεύθυνο για εύρεση snap points εφαπτόμενων σε circles/arcs
 */

import type { Point2D } from '../../rendering/types/Types';
import { ExtendedSnapType } from '../extended-types';
import type { Entity } from '../../types/entities';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findCircleBasedSnapCandidates } from './shared/snap-engine-utils';

export class TangentSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.TANGENT);
  }

  initialize(entities: Entity[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    // Use shared circle-based snap candidate finder to eliminate duplication
    return findCircleBasedSnapCandidates(
      context.entities,
      cursorPoint,
      context,
      {
        snapType: ExtendedSnapType.TANGENT,
        displayName: 'Tangent',
        priority: 3  // High priority for precision
      },
      (center, radius, cursorPoint) => this.getTangentPoints(center, radius, cursorPoint)
    );
  }

  private getTangentPoints(circleCenter: Point2D, circleRadius: number, externalPoint: Point2D): Point2D[] {
    const dx = externalPoint.x - circleCenter.x;
    const dy = externalPoint.y - circleCenter.y;
    const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
    
    // If point is inside or on the circle, no external tangents exist
    if (distanceToCenter <= circleRadius) {
      return [];
    }
    
    // Calculate tangent points using geometry
    const tangentDistance = Math.sqrt(distanceToCenter * distanceToCenter - circleRadius * circleRadius);
    const angle = Math.atan2(dy, dx);
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