import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import { isXLineEntity } from '../../types/entities';
import { clipParametricLine } from '../utils/line-clipping';
import { pointToInfiniteLineDistance } from '../utils/point-to-line-distance';

export class XLineRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isXLineEntity(entity)) return;
    const { basePoint, direction } = entity;

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

  hitTest(_entity: EntityModel, _point: Point2D, _tolerance: number): boolean {
    // Phase 5 — pointToInfiniteLineDistance not yet wired
    return false;
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
