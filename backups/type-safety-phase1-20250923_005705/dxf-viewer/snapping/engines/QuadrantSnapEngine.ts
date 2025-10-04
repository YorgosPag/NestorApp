/**
 * Quadrant Snap Engine
 * Υπεύθυνο για εύρεση snap points στα quadrant points των circles/arcs
 */

import { Point2D, Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findCircleBasedSnapCandidates } from './shared/snap-engine-utils';

export class QuadrantSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.QUADRANT);
  }

  initialize(entities: Entity[]): void {
    console.log('🎯 QuadrantSnapEngine: Initialize with', entities.length, 'entities');
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    // Use shared circle-based snap candidate finder to eliminate duplication
    return findCircleBasedSnapCandidates(
      context.entities,
      cursorPoint,
      context,
      {
        snapType: ExtendedSnapType.QUADRANT,
        displayName: 'Quadrant',
        priority: 6  // Medium priority
      },
      (center, radius, _) => this.getCircleQuadrants(center, radius)
    );
  }

  private getCircleQuadrants(center: Point2D, radius: number): Point2D[] {
    return [
      { x: center.x + radius, y: center.y },     // 0° (Right)
      { x: center.x, y: center.y + radius },     // 90° (Top)
      { x: center.x - radius, y: center.y },     // 180° (Left)
      { x: center.x, y: center.y - radius }      // 270° (Bottom)
    ];
  }

  dispose(): void {
    // Nothing to dispose
  }

  getStats(): {
    quadrantChecks: number;
  } {
    return {
      quadrantChecks: 0 // Could add metrics
    };
  }
}