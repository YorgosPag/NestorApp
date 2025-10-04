import { BaseEntityRenderer } from './BaseEntityRenderer';
import { EntityModel } from '../../../types/scene';
import { Point2D } from '../../../types/geometry';

interface RenderOptions {
  isSelected?: boolean;
  isHighlighted?: boolean;
  opacity?: number;
}

export class PointRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'point') return;

    const position = (entity as any).position as Point2D;
    const size = (entity as any).size as number || 2;

    this.renderSimplePoint(position, size, entity);
  }

  private renderSimplePoint(position: Point2D, size: number, entity: EntityModel): void {
    const screenPos = this.worldToScreen(position);

    // Αφαίρεση φούξιας μπαλίτσας από σταυρόνημα - δεν θέλουμε preview entities
    const isPreview = (entity as any).preview === true;
    if (isPreview) {
      return; // Δεν εμφανίζουμε καθόλου preview points
    } else {
      this.ctx.fillStyle = '#00FFFF'; // Κυανό
    }

    // ⚡ NUCLEAR: POINT CIRCLE ELIMINATED
  }
}