/**
 * ColumnRenderer — ADR-363 Phase 4.
 *
 * 2D plan-view renderer για `ColumnEntity`. Reads `entity.geometry`
 * (populated by `computeColumnGeometry()` — SSoT) και draws:
 *   - closed footprint polygon outline (stroke per-kind colour)
 *   - translucent fill per kind
 *
 * Per-kind palette (industry convention — RC συμπαγή φόντα, steel cooler):
 *   - rectangular → cool grey (γενική RC κολώνα)
 *   - circular    → RC grey (φέροντα κολώνα)
 *   - L-shape     → ochre (γωνία)
 *   - T-shape     → steel-blue
 *
 * Phase 4.5 (DONE): center / rotation / width / depth grips routed through
 * `applyColumnGripDrag()` + `UpdateColumnParamsCommand`.
 * Phase 4.5b (DONE): variant-specific grips για L-shape (arm-length / arm-width)
 * + T-shape (flange-length / web-thickness) εκπέμπονται από το
 * `getColumnGrips()` και διοχετεύονται μέσω του ίδιου command path. Το
 * `edge`-typed grip mapping πέφτει στο `'vertex'` bucket — αρκετό για το
 * canvas pass.
 * Phase 4.5c+ (deferred):
 *   - Hatch patterns per material category
 *   - Anchor cycling visual preview (ghost at all 9 positions)
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions
 * σε high-frequency stores. Called by canvas με entity resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isColumnEntity } from '../../types/entities';
import type { ColumnEntity, ColumnKind } from '../types/column-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getColumnGrips } from '../columns/column-grips';

/** Stroke colour per kind. */
const KIND_STROKE: Readonly<Record<ColumnKind, string>> = {
  'rectangular': '#5b6478',
  'circular':    '#3a3a40',
  'L-shape':     '#a07a2b',
  'T-shape':     '#3a5a78',
};

/** Translucent fill (rgba) per kind. ~22% opacity. */
const KIND_FILL: Readonly<Record<ColumnKind, string>> = {
  'rectangular': 'rgba(140, 158, 178, 0.22)',
  'circular':    'rgba(96, 96, 102, 0.22)',
  'L-shape':     'rgba(192, 148, 56, 0.22)',
  'T-shape':     'rgba(110, 140, 178, 0.22)',
};

export class ColumnRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isColumnEntity(entity)) return;
    const column = entity as ColumnEntity;
    if (!column.geometry || !column.params) return;
    const verts = column.geometry.footprint.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo via outline thicker glow.
    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawPolygonPath(verts);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();
    // Fill first, stroke on top so outline stays sharp.
    this.ctx.fillStyle = KIND_FILL[column.kind];
    this.drawPolygonPath(verts);
    this.ctx.fill();

    this.ctx.strokeStyle = KIND_STROKE[column.kind];
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.restore();
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-363 Phase 4.5 + 4.5b — parametric column grips:
    //   base (4): center / rotation / width / depth
    //   L-shape (+2): arm-length / arm-width (Phase 4.5b)
    //   T-shape (+2): flange-length / web-thickness (Phase 4.5b)
    //   circular (2): center / width-as-diameter
    // Commit routed through `applyColumnGripDrag()` + `UpdateColumnParamsCommand`
    // by `commitColumnGripDrag` (grip-parametric-commits). Phase 4.5c+ will
    // add hatch patterns, anchor-cycle preview, snap-to-wall corners.
    if (!isColumnEntity(entity)) return [];
    return getColumnGrips(entity as ColumnEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isColumnEntity(entity)) return false;
    const column = entity as ColumnEntity;
    const bb = column.geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject με tolerance.
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    // Detailed point-in-polygon test (ray casting).
    const verts = column.geometry.footprint.vertices;
    return pointInPolygon(point, verts);
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  private drawPolygonPath(vertices: ReadonlyArray<{ x: number; y: number }>): void {
    if (vertices.length < 3) return;
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: vertices[0].x, y: vertices[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = this.worldToScreen({ x: vertices[i].x, y: vertices[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
  }
}
