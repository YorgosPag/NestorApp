import { BaseEntityRenderer } from './BaseEntityRenderer';
import { EntityModel } from '../../../types/scene';
import type { Point2D } from '../types/Types';
import { UI_COLORS } from '../../config/color-config';

// Extended point entity interface
interface PointEntity extends EntityModel {
  type: 'point';
  position: Point2D;
  size?: number;
  preview?: boolean;
}

interface RenderOptions {
  isSelected?: boolean;
  isHighlighted?: boolean;
  opacity?: number;
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
}