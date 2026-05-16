/**
 * StairRenderer — ADR-358 Phase 5b (G15 + §6.2 minimal).
 *
 * 2D plan-view renderer for a `StairEntity`. Reads `entity.geometry`
 * (populated by `computeStairGeometry()` — the SSoT) and draws:
 *   - treads (solid polygons, below-cut)
 *   - walkline (dashed polyline)
 *   - inner / outer stringers (solid bold)
 *   - arrow + UP/DOWN label
 *   - parametric grips (5 kinds, §5.12)
 *
 * Phase 5b is intentionally minimal — risers, treadsAboveCut (dashed), handrails,
 * cutLine zigzag, and tread labels land in Phase 6+ when the full §6.2 pipeline
 * is wired. Today the renderer is enough to support `StairEntity` selection +
 * grip editing.
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
import type { Point3D } from '../../rendering/types/Types';
import type { StairEntity } from '../../types/stair';
import { isStairEntity } from '../../types/entities';
import { getStairGrips } from '../../systems/stairs/stair-grips';
import { CAD_UI_COLORS } from '../../config/color-config';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';

const TREAD_FILL_ALPHA = 0.12;
const WALKLINE_DASH: readonly [number, number] = [6, 4];
const ARROW_HEAD_PX = 10;
const ARROW_HEAD_HALF_WIDTH_PX = 5;
const LABEL_OFFSET_PX = 8;

export class StairRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, _options: RenderOptions = {}): void {
    if (!isStairEntity(entity)) return;
    const stair = entity as StairEntity;
    const { geometry } = stair;

    this.ctx.save();
    this.drawTreads(geometry.treadsBelowCut);
    this.drawStringers(geometry.stringers.inner, geometry.stringers.outer);
    this.drawWalkline(geometry.walkline);
    this.drawArrow(geometry.arrowSymbol.start, geometry.arrowSymbol.end, geometry.arrowSymbol.label);
    this.ctx.restore();
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isStairEntity(entity)) return [];
    return getStairGrips(entity as StairEntity);
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isStairEntity(entity)) return false;
    const stair = entity as StairEntity;
    const bb = stair.geometry.bbox;
    return (
      point.x >= bb.min.x - tolerance &&
      point.x <= bb.max.x + tolerance &&
      point.y >= bb.min.y - tolerance &&
      point.y <= bb.max.y + tolerance
    );
  }

  // ─── Internal drawing helpers ───────────────────────────────────────────

  private drawTreads(treads: ReadonlyArray<ReadonlyArray<Point3D>>): void {
    if (treads.length === 0) return;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.ctx.strokeStyle = CAD_UI_COLORS.entity.default;
    this.ctx.fillStyle = `rgba(120, 144, 156, ${TREAD_FILL_ALPHA})`;

    for (const tread of treads) {
      if (tread.length < 3) continue;
      this.ctx.beginPath();
      const first = this.worldToScreen({ x: tread[0].x, y: tread[0].y });
      this.ctx.moveTo(first.x, first.y);
      for (let i = 1; i < tread.length; i++) {
        const s = this.worldToScreen({ x: tread[i].x, y: tread[i].y });
        this.ctx.lineTo(s.x, s.y);
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  private drawStringers(inner: ReadonlyArray<Point3D>, outer: ReadonlyArray<Point3D>): void {
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THICK;
    this.ctx.strokeStyle = CAD_UI_COLORS.entity.default;
    this.drawPolyline3D(inner);
    this.drawPolyline3D(outer);
  }

  private drawWalkline(walkline: ReadonlyArray<Point3D>): void {
    if (walkline.length < 2) return;
    this.ctx.save();
    this.ctx.setLineDash(WALKLINE_DASH as unknown as number[]);
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.ctx.strokeStyle = CAD_UI_COLORS.entity.default;
    this.drawPolyline3D(walkline);
    this.ctx.restore();
  }

  private drawArrow(startW: Point3D, endW: Point3D, label: 'UP' | 'DOWN'): void {
    const start = this.worldToScreen({ x: startW.x, y: startW.y });
    const end = this.worldToScreen({ x: endW.x, y: endW.y });
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.ctx.strokeStyle = CAD_UI_COLORS.entity.default;
    this.ctx.fillStyle = CAD_UI_COLORS.entity.default;

    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) {
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const tipX = end.x;
      const tipY = end.y;
      const baseX = tipX - ARROW_HEAD_PX * ux;
      const baseY = tipY - ARROW_HEAD_PX * uy;
      this.ctx.beginPath();
      this.ctx.moveTo(tipX, tipY);
      this.ctx.lineTo(baseX + ARROW_HEAD_HALF_WIDTH_PX * px, baseY + ARROW_HEAD_HALF_WIDTH_PX * py);
      this.ctx.lineTo(baseX - ARROW_HEAD_HALF_WIDTH_PX * px, baseY - ARROW_HEAD_HALF_WIDTH_PX * py);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.font = '11px sans-serif';
    this.ctx.fillStyle = CAD_UI_COLORS.entity.default;
    this.ctx.fillText(label, end.x + LABEL_OFFSET_PX, end.y - LABEL_OFFSET_PX);
  }

  private drawPolyline3D(points: ReadonlyArray<Point3D>): void {
    if (points.length < 2) return;
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: points[0].x, y: points[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const s = this.worldToScreen({ x: points[i].x, y: points[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.stroke();
  }
}
