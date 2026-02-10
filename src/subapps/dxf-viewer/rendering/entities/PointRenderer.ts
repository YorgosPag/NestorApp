import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel } from '../types/Types';
import type { Point2D, GripInfo, RenderOptions } from '../types/Types';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isPointEntity, type Entity, type PointEntity } from '../../types/entities';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from './shared/geometry-rendering-utils';

// Extended point entity interface for renderer-specific properties
interface ExtendedPointEntity extends PointEntity {
  preview?: boolean;
}

export class PointRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-102: Use centralized type guard
    if (!isPointEntity(entity as Entity)) return;

    const pointEntity = entity as ExtendedPointEntity;
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
    // 🏢 ADR-102: Use centralized type guard
    if (!isPointEntity(entity as Entity)) return [];

    const pointEntity = entity as ExtendedPointEntity;
    return [{
      id: `${entity.id}-point`,
      entityId: entity.id,
      type: 'vertex',
      gripIndex: 0,
      position: pointEntity.position,
      isVisible: true
    }];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    // 🏢 ADR-102: Use centralized type guard
    if (!isPointEntity(entity as Entity)) return false;

    const pointEntity = entity as ExtendedPointEntity;
    const screenPos = this.worldToScreen(pointEntity.position);
    const screenTestPoint = this.worldToScreen(point);

    // 🏢 ADR-065: Use centralized distance calculation
    const distance = calculateDistance(screenPos, screenTestPoint);

    return distance <= tolerance;
  }
}