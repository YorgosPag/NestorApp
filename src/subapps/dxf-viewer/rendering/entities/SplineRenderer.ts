/**
 * Spline Entity Renderer
 * Handles rendering of spline entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import type { SplineEntity, Entity } from '../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isSplineEntity } from '../../types/entities';
// 🏢 ADR-073: Centralized Midpoint Calculation
import { pointToLineDistance, calculateMidpoint } from './shared/geometry-utils';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';

export class SplineRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-102: Use centralized type guard
    if (!isSplineEntity(entity as Entity)) return;

    const splineEntity = entity as SplineEntity;
    const controlPoints = splineEntity.controlPoints as Point2D[];
    const closed = splineEntity.closed as boolean;

    if (!controlPoints || controlPoints.length < 2) return;

    const renderGeometry = () => {
      const screenPoints = controlPoints.map(p => this.worldToScreen(p));
      this.ctx.beginPath();

      if (controlPoints.length === 2) {
        this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        this.ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
      } else {
        this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length - 1; i++) {
          const cp = screenPoints[i];
          const next = screenPoints[i + 1];
          // 🏢 ADR-073: Centralized midpoint calculation
          const mid = calculateMidpoint(cp, next);
          this.ctx.quadraticCurveTo(cp.x, cp.y, mid.x, mid.y);
        }
        const lastIdx = screenPoints.length - 1;
        this.ctx.lineTo(screenPoints[lastIdx].x, screenPoints[lastIdx].y);
        if (closed) this.ctx.closePath();
      }

      this.ctx.stroke();
    };

    this.renderWithPhases(entity, options, renderGeometry);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // 🏢 ADR-102: Use centralized type guard
    if (!isSplineEntity(entity as Entity)) return [];

    const grips: GripInfo[] = [];
    // ✅ ENTERPRISE FIX: Safe type casting for entity-specific properties
    const splineEntity = entity as SplineEntity; // 🏢 ENTERPRISE: Type-safe casting
    const controlPoints = splineEntity.controlPoints as Point2D[];
    
    if (!controlPoints) return grips;
    
    // Control point grips
    controlPoints.forEach((point, index) => {
      grips.push({
        id: `${entity.id}-vertex-${index}`,
        entityId: entity.id,
        type: 'vertex',
        gripIndex: index,
        position: point,
        isVisible: true
      });
    });
    
    return grips;
  }

  // 🏢 ADR-105: Use centralized fallback tolerance
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = TOLERANCE_CONFIG.HIT_TEST_FALLBACK): boolean {
    // 🏢 ADR-102: Use centralized type guard
    if (!isSplineEntity(entity as Entity)) return false;

    // ✅ ENTERPRISE FIX: Safe type casting for entity-specific properties
    const splineEntity = entity as SplineEntity; // 🏢 ENTERPRISE: Type-safe casting
    const controlPoints = splineEntity.controlPoints as Point2D[];

    if (!controlPoints || controlPoints.length < 2) return false;

    // For spline hit testing, we approximate with line segments between control points
    const screenPoint = this.worldToScreen(point);

    for (let i = 0; i < controlPoints.length - 1; i++) {
      const screenStart = this.worldToScreen(controlPoints[i]);
      const screenEnd = this.worldToScreen(controlPoints[i + 1]);

      const distance = pointToLineDistance(screenPoint, screenStart, screenEnd);
      if (distance <= tolerance) return true;
    }

    // Check closing segment if closed
    const closed = splineEntity.closed as boolean;
    if (closed && controlPoints.length > 2) {
      const screenStart = this.worldToScreen(controlPoints[controlPoints.length - 1]);
      const screenEnd = this.worldToScreen(controlPoints[0]);

      const distance = pointToLineDistance(screenPoint, screenStart, screenEnd);
      if (distance <= tolerance) return true;
    }

    return false;
  }
}