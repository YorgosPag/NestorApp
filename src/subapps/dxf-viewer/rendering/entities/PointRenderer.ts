import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel } from '../types/Types';
import type { Point2D, GripInfo, RenderOptions } from '../types/Types';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isPointEntity, type Entity, type PointEntity } from '../../types/entities';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from './shared/geometry-rendering-utils';
// ADR-635 Φάση C — $PDMODE/$PDSIZE decode SSoT (figure + enclosures + size math).
import { decodePdMode, resolvePointGlyphSize, type PointGlyphSpec } from './shared/point-glyph';

// Extended point entity interface for renderer-specific properties
interface ExtendedPointEntity extends PointEntity {
  preview?: boolean;
}

/** Fixed screen radius (px) of the `dot` figure — $PDSIZE never grows the dot in AutoCAD. */
const DOT_RADIUS_PX = 1.5;

export class PointRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-102: Use centralized type guard
    if (!isPointEntity(entity as Entity)) return;

    const pointEntity = entity as ExtendedPointEntity;
    // The crosshair ghost point must never stamp a glyph (legacy «φούξια μπαλίτσα» fix).
    if (pointEntity.preview === true) return;

    // ADR-635 Φάση C — draw the AutoCAD $PDMODE glyph through the shared 3-phase flow
    // (resolved BYLAYER colour + phase style + grips), replacing the NUCLEAR no-op.
    this.renderWithPhases(entity, options, () => this.renderPointGlyph(pointEntity));
  }

  private renderPointGlyph(entity: ExtendedPointEntity): void {
    const spec = decodePdMode(entity.pdMode ?? 0);
    const center = this.worldToScreen(entity.position);
    const pxPerWorld = this.pixelsPerWorldUnit(entity.position);
    const viewportH = this.ctx.canvas.getBoundingClientRect().height;
    const fullSize = resolvePointGlyphSize(entity.pdSize ?? 0, pxPerWorld, viewportH);
    const half = fullSize / 2;

    // Resolved entity colour is already on the ctx (phase style); fall back to the legacy cyan.
    const stroke = this.ctx.strokeStyle;
    const color = typeof stroke === 'string' ? stroke : UI_COLORS.DEBUG_RULER;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 1;
    this.drawFigure(spec, center, half);
    this.ctx.restore();
  }

  /** Stamp the decoded figure + enclosures around `center` (screen px, `half` = size/2). */
  private drawFigure(spec: PointGlyphSpec, center: Point2D, half: number): void {
    const { x, y } = center;
    const ctx = this.ctx;

    switch (spec.figure) {
      case 'dot':
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS_PX, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'plus':
        this.line(x - half, y, x + half, y);
        this.line(x, y - half, x, y + half);
        break;
      case 'cross':
        this.line(x - half, y - half, x + half, y + half);
        this.line(x - half, y + half, x + half, y - half);
        break;
      case 'tick':
        // Short vertical tick UP from the point (screen Y grows downward → −half).
        this.line(x, y, x, y - half);
        break;
      case 'none':
        break; // enclosures may still draw
    }

    if (spec.circle) {
      ctx.beginPath();
      ctx.arc(x, y, half, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (spec.square) {
      ctx.strokeRect(x - half, y - half, half * 2, half * 2);
    }
  }

  private line(x1: number, y1: number, x2: number, y2: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  /** Screen px per one world unit at `p` (isotropic transform → measure a unit step in X). */
  private pixelsPerWorldUnit(p: Point2D): number {
    const a = this.worldToScreen(p);
    const b = this.worldToScreen({ x: p.x + 1, y: p.y });
    return Math.hypot(b.x - a.x, b.y - a.y);
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