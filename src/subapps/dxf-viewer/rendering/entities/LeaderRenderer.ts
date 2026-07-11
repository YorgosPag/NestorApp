/**
 * Leader Entity Renderer (ADR-635 Φάση B Batch 2 Part B)
 *
 * Draws a DXF LEADER: the callout path (open polyline, tip → text) plus a filled
 * arrowhead at the TIP (vertices[0]), pointing OUTWARD (away from the first bend).
 *
 * SSoT reuse (no hand-rolled geometry):
 *   - path stroke / hit-test → `drawVerticesPath` + `hitTestLineSegments` (the same
 *     helpers PolylineRenderer uses, this renderer is modelled line-for-line on it).
 *   - arrowhead → the ADR-362 dimension arrowhead SSoT (`getArrowheadBlock` +
 *     `renderArrowhead`), NOT a bespoke triangle. `unitPx` = the screen length of
 *     `arrowHead.size` world-units, so the arrow matches the dimension convention
 *     (1 block unit = 1 size unit).
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../types/Types';
import type { Entity, LeaderEntity } from '../../types/entities';
import { isLeaderEntity } from '../../types/entities';
import { drawVerticesPath } from './shared/geometry-rendering-utils';
import { hitTestLineSegments } from './shared/line-utils';
import { renderArrowhead } from './dimension/dim-arrowhead-renderer';
import { getArrowheadBlock } from '../../systems/dimensions/dim-arrowhead-blocks';

/** LeaderEntity arrowhead kind → dimension arrowhead SSoT block name. */
type LeaderArrowKind = 'closed' | 'open' | 'dot' | 'none';
const ARROW_BLOCK_BY_TYPE: Record<LeaderArrowKind, string> = {
  closed: 'closedFilled',
  open: 'open',
  dot: 'dot',
  none: 'none',
};

/** Below this screen distance the arrowhead is skipped (degenerate first segment). */
const MIN_ARROW_DIRECTION_PX = 1e-6;

export class LeaderRenderer extends BaseEntityRenderer {

  render(entity: EntityModel, options: RenderOptions = {}): void {
    const e = entity as Entity;
    if (!isLeaderEntity(e)) return;
    if (!e.vertices || e.vertices.length < 2) return;

    // Path + arrowhead are one geometry phase; a leader carries no per-segment
    // measurements / yellow dots (unlike the polyline tool).
    this.renderWithPhases(entity, options, () => this.renderLeaderGeometry(e));
  }

  private renderLeaderGeometry(e: LeaderEntity): void {
    if (!this.shouldRenderLines(e, {})) return;
    const screen = e.vertices.map(v => this.worldToScreen(v));
    drawVerticesPath(this.ctx, screen, false); // open path (tip → text)
    this.ctx.stroke();
    this.renderLeaderArrowhead(e);
  }

  private renderLeaderArrowhead(e: LeaderEntity): void {
    const head = e.arrowHead;
    if (!head || head.type === 'none') return;

    const tip = e.vertices[0];
    const next = e.vertices[1];
    // Outward world direction = from the first bend toward the tip.
    const dx = tip.x - next.x;
    const dy = tip.y - next.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return;
    const unit = { x: dx / len, y: dy / len };

    // Screen px for `size` world-units: project the tip and tip + unit·size, measure the gap.
    const tipScreen = this.worldToScreen(tip);
    const alongScreen = this.worldToScreen({ x: tip.x + unit.x * head.size, y: tip.y + unit.y * head.size });
    const unitPx = Math.hypot(alongScreen.x - tipScreen.x, alongScreen.y - tipScreen.y);
    if (unitPx < MIN_ARROW_DIRECTION_PX) return;

    // Resolved entity colour lives on the ctx after `setupStyle` (phase style). Read it
    // safely — strokeStyle may be a gradient/pattern in theory, never for a leader.
    const stroke = this.ctx.strokeStyle;
    const color = typeof stroke === 'string' ? stroke : '#ffffff';

    renderArrowhead(this.ctx, getArrowheadBlock(ARROW_BLOCK_BY_TYPE[head.type]), {
      screenAnchor: tipScreen,
      direction: unit,
      side: 1,
      unitPx,
      strokeColor: color,
      fillColor: color,
    });
  }

  getGrips(entity: EntityModel): GripInfo[] {
    const e = entity as Entity;
    if (!isLeaderEntity(e)) return [];
    return e.vertices.map((vertex, index) => ({
      id: `${entity.id}-vertex-${index}`,
      entityId: entity.id,
      type: 'vertex',
      gripIndex: index,
      position: vertex,
      isVisible: true,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    const e = entity as Entity;
    if (!isLeaderEntity(e)) return false;
    if (!e.vertices || e.vertices.length < 2) return false;
    return hitTestLineSegments(point, e.vertices, tolerance, false, this.worldToScreen.bind(this));
  }
}
