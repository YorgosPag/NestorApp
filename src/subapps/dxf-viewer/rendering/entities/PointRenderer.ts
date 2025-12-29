import { BaseEntityRenderer } from './BaseEntityRenderer';
import { EntityModel } from '../../../types/entities';
import type { Point2D, GripInfo, RenderOptions } from '../types/Types';
import { UI_COLORS } from '../../config/color-config';

// Extended point entity interface
interface PointEntity extends EntityModel {
  type: 'point';
  position: Point2D;
  size?: number;
  preview?: boolean;
}

export class PointRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'point') return;

    const pointEntity = entity as PointEntity;
    const position = pointEntity.position;
    const size = pointEntity.size || 2;

    this.renderSimplePoint(position, size, pointEntity);
  }

  private renderSimplePoint(position: Point2D, size: number, entity: PointEntity): void {
    const screenPos = this.worldToScreen(position);

    // Αφαίρεση φούξιας μπαλίτσας από σταυρόνημα - δεν θέλουμε preview entities
    const isPreview = entity.preview === true;
    if (isPreview) {
      return; // Δεν εμφανίζουμε καθόλου preview points
    } else {
      this.ctx.fillStyle = UI_COLORS.DEBUG_RULER; // Κυανό
    }

    // ⚡ NUCLEAR: POINT CIRCLE ELIMINATED
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (entity.type !== 'point') return [];

    const pointEntity = entity as PointEntity;
    return [{
      entityId: entity.id,
      gripType: 'corner',
      gripIndex: 0,
      position: pointEntity.position,
      state: 'cold'
    }];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (entity.type !== 'point') return false;

    const pointEntity = entity as PointEntity;
    const screenPos = this.worldToScreen(pointEntity.position);
    const screenTestPoint = this.worldToScreen(point);

    const distance = Math.sqrt(
      Math.pow(screenPos.x - screenTestPoint.x, 2) +
      Math.pow(screenPos.y - screenTestPoint.y, 2)
    );

    return distance <= tolerance;
  }
}