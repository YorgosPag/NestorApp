/**
 * WallRenderer — ADR-363 Phase 1 (G1).
 *
 * 2D plan-view renderer για `WallEntity`. Reads `entity.geometry`
 * (populated by `computeWallGeometry()` — the SSoT) and draws:
 *   - outer + inner edges (solid polylines, lineweight by category)
 *   - translucent category fill (concrete / brick / stone tint)
 *   - axis polyline (dashed thin, optional — visual SSoT for the centerline)
 *
 * Phase 1 keeps it deterministic — no per-layer hatch patterns, no opening
 * cutout (Phase 2). Hover halo follows the stair pattern: OBB outline around
 * the wall footprint via a single `drawPerimeterOutline()` pass.
 *
 * ADR-040 micro-leaf compliance: pure renderer class; ZERO subscriptions to
 * high-frequency stores. Called by the canvas with the entity already
 * resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §5.9
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../../rendering/types/Types';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { WallCategory, WallEntity } from '../types/wall-types';
import type { Point3D } from '../types/bim-base';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getWallGrips } from '../walls/wall-grips';

/** Translucent fill colour per category (CAD industry convention). */
const CATEGORY_FILL: Readonly<Record<WallCategory, string>> = {
  exterior:  'rgba(120, 144, 156, 0.18)', // concrete slate
  interior:  'rgba(205, 158, 110, 0.16)', // brick warm
  partition: 'rgba(205, 158, 110, 0.10)', // brick lighter
  parapet:   'rgba(120, 144, 156, 0.22)', // concrete deeper
  fence:     'rgba(141, 110, 99, 0.18)',  // stone brown
};

/** Line weight per category (thicker for structural walls). */
const CATEGORY_LINE_WIDTH: Readonly<Record<WallCategory, number>> = {
  exterior:  RENDER_LINE_WIDTHS.THICK,
  interior:  RENDER_LINE_WIDTHS.NORMAL,
  partition: RENDER_LINE_WIDTHS.NORMAL,
  parapet:   RENDER_LINE_WIDTHS.THICK,
  fence:     RENDER_LINE_WIDTHS.THICK,
};

const AXIS_DASH: readonly [number, number] = [6, 4];

export class WallRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isWallEntity(entity)) return;
    const wall = entity as WallEntity;
    if (!wall.geometry || !wall.params) return;

    // Hover halo via OBB outline (stair pattern). Per-edge glow loses to the
    // category fill rectangle in the main pass, so a dedicated outline pass
    // guarantees a continuous halo around the wall footprint.
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    if (phaseState.phase === 'highlighted') {
      const entityLineWidth = Math.max(
        1,
        (entity as EntityModel & { lineWidth?: number }).lineWidth || 1,
      );
      this.ctx.save();
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = entityLineWidth + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawPerimeterOutline(wall);
      this.ctx.restore();
    }

    // Main pass — phase style + fill + stroke.
    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.drawFootprint(wall);
    this.drawAxis(wall);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-363 Phase 1C — parametric wall grips (endpoint / midpoint / thickness
    // / curve / polyline-vertex). Commit routed through `applyWallGripDrag()`
    // + `UpdateWallParamsCommand` by `commitWallGripDrag` (grip-commit-adapter).
    if (!isWallEntity(entity)) return [];
    return getWallGrips(entity as WallEntity);
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isWallEntity(entity)) return false;
    const wall = entity as WallEntity;
    const bb = wall.geometry?.bbox;
    if (!bb) return false;
    return (
      point.x >= bb.min.x - tolerance &&
      point.x <= bb.max.x + tolerance &&
      point.y >= bb.min.y - tolerance &&
      point.y <= bb.max.y + tolerance
    );
  }

  // ─── Internal drawing helpers ──────────────────────────────────────────────

  /**
   * Draws the outer + inner edges as a closed polygon, filled translucent
   * with the category tint, then stroked at category-specific line weight.
   * The fill is suppressed when only edges are wanted (e.g. preview phase
   * before commit) — Phase 1 always fills since walls are committed entities.
   */
  private drawFootprint(wall: WallEntity): void {
    const outer = wall.geometry.outerEdge.points;
    const inner = wall.geometry.innerEdge.points;
    if (outer.length < 2 || inner.length < 2) return;

    const cat = wall.params.category;
    this.ctx.fillStyle = CATEGORY_FILL[cat];
    this.ctx.lineWidth = CATEGORY_LINE_WIDTH[cat];

    // Build closed polygon: outer (start→end) + inner (end→start) reverses
    // so the perimeter is well-oriented for fill.
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: outer[0].x, y: outer[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < outer.length; i++) {
      const s = this.worldToScreen({ x: outer[i].x, y: outer[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    for (let i = inner.length - 1; i >= 0; i--) {
      const s = this.worldToScreen({ x: inner[i].x, y: inner[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  /** Axis polyline rendered dashed-thin (centerline visual aid). */
  private drawAxis(wall: WallEntity): void {
    const axis = wall.geometry.axisPolyline.points;
    if (axis.length < 2) return;
    this.ctx.save();
    this.ctx.setLineDash(AXIS_DASH as unknown as number[]);
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.drawPolyline(axis);
    this.ctx.restore();
  }

  /**
   * Hover halo: tight OBB of the footprint vertices (outer + inner). Stair
   * pattern (ADR-358 §G15) — per-edge halo on composite entities is clobbered
   * by the next stroke, so a single OBB pass guarantees a continuous halo.
   */
  private drawPerimeterOutline(wall: WallEntity): void {
    const outer = wall.geometry.outerEdge.points;
    const inner = wall.geometry.innerEdge.points;
    if (outer.length < 2 || inner.length < 2) return;

    this.ctx.beginPath();
    const first = this.worldToScreen({ x: outer[0].x, y: outer[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < outer.length; i++) {
      const s = this.worldToScreen({ x: outer[i].x, y: outer[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    for (let i = inner.length - 1; i >= 0; i--) {
      const s = this.worldToScreen({ x: inner[i].x, y: inner[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private drawPolyline(points: ReadonlyArray<Point3D>): void {
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
