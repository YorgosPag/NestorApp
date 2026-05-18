import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import { isXLineEntity } from '../../types/entities';
import { clipParametricLine } from '../utils/line-clipping';
import { pointToInfiniteLineDistance } from '../utils/point-to-line-distance';

export class XLineRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isXLineEntity(entity)) return;
    const { basePoint, secondPoint } = entity;
    const direction = entity.direction ?? (
      secondPoint
        ? (() => {
            const dx = secondPoint.x - basePoint.x;
            const dy = secondPoint.y - basePoint.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            return len < 1e-10 ? null : { x: dx / len, y: dy / len };
          })()
        : null
    );
    if (!direction) return;

    this.renderWithPhases(entity, options, () => {
      const viewport = this.getViewportWorldBounds();
      const clipped = clipParametricLine(
        basePoint,
        direction,
        { min: -Infinity, max: Infinity },
        viewport
      );
      if (!clipped) return;

      const screenStart = this.worldToScreen(clipped.start);
      const screenEnd = this.worldToScreen(clipped.end);

      this.ctx.beginPath();
      this.ctx.moveTo(screenStart.x, screenStart.y);
      this.ctx.lineTo(screenEnd.x, screenEnd.y);
      this.ctx.stroke();
    });
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // Phase 11 — grip strategy not yet implemented
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isXLineEntity(entity)) return false;
    if (!entity.direction) return false;
    const dist = pointToInfiniteLineDistance(point, entity.basePoint, entity.direction);
    return dist <= tolerance;
  }

  private getViewportWorldBounds() {
    const rect = this.ctx.canvas.getBoundingClientRect();
    const { scale, offsetX, offsetY } = this.transform;
    return {
      minX: (0 - offsetX) / scale,
      minY: (0 - offsetY) / scale,
      maxX: (rect.width - offsetX) / scale,
      maxY: (rect.height - offsetY) / scale,
    };
  }
}
