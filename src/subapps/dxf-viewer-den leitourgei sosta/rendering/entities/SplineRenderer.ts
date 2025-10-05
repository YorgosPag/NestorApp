/**
 * Spline Entity Renderer
 * Handles rendering of spline entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import { HoverManager } from '../../utils/hover';
import { pointToLineDistance } from './shared/geometry-utils';

export class SplineRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'spline') return;
    
    const controlPoints = entity.controlPoints as Point2D[];
    const closed = entity.closed as boolean;
    
    if (!controlPoints || controlPoints.length < 2) return;
    
    // Setup style
    this.setupStyle(entity, options);
    
    if (options.hovered) {
      // Use centralized hover manager - spline treated as polyline
      const splineAsPolyline = { ...entity, vertices: controlPoints, closed };
      HoverManager.renderHover(splineAsPolyline, this.ctx, options, this.worldToScreen.bind(this));
    } else {
      // Normal spline rendering
      const screenPoints = controlPoints.map(p => this.worldToScreen(p));
      
      this.ctx.beginPath();
      
      if (controlPoints.length === 2) {
        // Simple line for 2 points
        this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        this.ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
      } else {
        // Quadratic Bezier approximation
        this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        
        for (let i = 1; i < screenPoints.length - 1; i++) {
          const cp = screenPoints[i];
          const next = screenPoints[i + 1];
          
          // Use current point as control point, next as end point
          const midX = (cp.x + next.x) / 2;
          const midY = (cp.y + next.y) / 2;
          
          this.ctx.quadraticCurveTo(cp.x, cp.y, midX, midY);
        }
        
        // Last segment
        const lastIdx = screenPoints.length - 1;
        this.ctx.lineTo(screenPoints[lastIdx].x, screenPoints[lastIdx].y);
        
        if (closed) {
          this.ctx.closePath();
        }
      }
      
      this.ctx.stroke();
    }
    
    // Use centralized finalization
    this.finalizeRendering(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (entity.type !== 'spline') return [];
    
    const grips: GripInfo[] = [];
    const controlPoints = entity.controlPoints as Point2D[];
    
    if (!controlPoints) return grips;
    
    // Control point grips
    controlPoints.forEach((point, index) => {
      grips.push({
        entityId: entity.id,
        gripType: 'vertex',
        gripIndex: index,
        position: point,
        state: 'cold'
      });
    });
    
    return grips;
  }


}