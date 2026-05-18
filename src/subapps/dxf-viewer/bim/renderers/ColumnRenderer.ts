/**
 * ColumnRenderer — ADR-363 Phase 4.
 *
 * 2D plan-view renderer για `ColumnEntity`. Reads `entity.geometry`
 * (populated by `computeColumnGeometry()` — SSoT) και draws:
 *   - closed footprint polygon outline (stroke per-kind colour)
 *   - translucent fill per kind
 *   - per-material hatch (Phase 4.5c.2/4.5c.3)
 *   - variant dimension labels for L/T when highlighted (Phase 4.5c.3)
 *
 * Per-kind palette (industry convention — RC συμπαγή φόντα, steel cooler):
 *   - rectangular → cool grey (γενική RC κολώνα)
 *   - circular    → RC grey (φέροντα κολώνα)
 *   - L-shape     → ochre (γωνία)
 *   - T-shape     → steel-blue
 *
 * Phase 4.5 (DONE): center / rotation / width / depth grips.
 * Phase 4.5b (DONE): variant-specific grips (L-shape arm / T-shape flange).
 * Phase 4.5c.1 (DONE): anchor ghost preview via `ColumnAnchorGhostRenderer`.
 * Phase 4.5c.2 (DONE): per-material hatch for non-circular kinds.
 * Phase 4.5c.3 (DONE): circular column hatch (RC concentric rings; steel/masonry/
 *   wood via bbox clip) + variant dimension labels for L/T highlighted state.
 * Phase 4.5c.4 (deferred): snap-to-wall-corners + grid-intersections.
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions.
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
import {
  computeHatchPlan,
  computeCircularHatchPlan,
  resolveMaterialKey,
  HATCH_STROKE_RGBA,
  HATCH_LINE_WIDTH_PX,
  RC_DOT_RADIUS_PX,
  type ColumnMaterialKey,
  type HatchPlan,
} from '../columns/column-hatch-patterns';

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
    // Fill first, hatch clipped inside, stroke on top so outline stays sharp.
    this.ctx.fillStyle = KIND_FILL[column.kind];
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // Phase 4.5c.2/4.5c.3 — per-material hatch (all kinds, incl. circular).
    this.drawMaterialHatch(column);

    this.ctx.strokeStyle = KIND_STROKE[column.kind];
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.restore();

    // Phase 4.5c.3 — variant dimension labels (L/T when highlighted).
    if (phaseState.phase === 'highlighted') {
      this.drawVariantDimensionLabels(column);
    }

    if (options.grips) {
      this.renderGrips(entity, options);
    }
  }

  /**
   * Phase 4.5c.2/4.5c.3 — per-material hatch pattern inside footprint clip.
   * Mirror του `SlabRenderer.drawReinforcementHatch` pattern.
   *
   * Circular kind (Phase 4.5c.3): routes through `computeCircularHatchPlan()`
   *   which returns concentric arcs for RC, bbox-clipped lines for others.
   * Non-circular: routes through `computeHatchPlan(bbox, key)` (Phase 4.5c.2).
   * Skip: `transform.scale < 0.001` (invisible zoom-out, perf saver).
   */
  private drawMaterialHatch(column: ColumnEntity): void {
    if (this.transform.scale < 0.001) return;

    const key: ColumnMaterialKey = resolveMaterialKey(column.params.material);
    const plan: HatchPlan = column.kind === 'circular'
      ? computeCircularHatchPlan(
          { x: column.params.position.x, y: column.params.position.y },
          column.params.width / 2,
          key,
        )
      : computeHatchPlan(column.geometry.bbox, key);

    if (plan.lines.length === 0 && plan.dots.length === 0 && plan.arcs.length === 0) return;

    this.ctx.save();
    this.drawPolygonPath(column.geometry.footprint.vertices);
    this.ctx.clip();
    this.ctx.strokeStyle = HATCH_STROKE_RGBA;
    this.ctx.fillStyle = HATCH_STROKE_RGBA;
    this.ctx.lineWidth = HATCH_LINE_WIDTH_PX[key];
    this.ctx.setLineDash([]);

    for (const line of plan.lines) {
      const a = this.worldToScreen(line.start);
      const b = this.worldToScreen(line.end);
      this.ctx.beginPath();
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();
    }
    for (const dot of plan.dots) {
      const s = this.worldToScreen(dot.center);
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, RC_DOT_RADIUS_PX, 0, Math.PI * 2);
      this.ctx.fill();
    }
    for (const arc of plan.arcs) {
      const s = this.worldToScreen(arc.center);
      const rPx = arc.radiusMm * this.transform.scale;
      if (rPx < 0.5) continue;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, rPx, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  /**
   * Phase 4.5c.3 — Draw dimension labels for L-shape (armLength + armWidth)
   * and T-shape (flangeLength + webThickness) when column is highlighted.
   *
   * Uses footprint vertex midpoints to position labels; vertex order matches
   * `buildLshapeLocal` and `buildTshapeLocal` in `column-geometry.ts`.
   * Pure canvas draw — ZERO store subscriptions (ADR-040 compliant).
   */
  private drawVariantDimensionLabels(column: ColumnEntity): void {
    if (column.kind !== 'L-shape' && column.kind !== 'T-shape') return;
    const verts = column.geometry.footprint.vertices;

    this.ctx.save();
    this.ctx.font = '8px sans-serif';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    if (column.kind === 'L-shape' && verts.length === 6) {
      this.drawDimLabel(verts[3], verts[4], `${Math.round(column.params.depth / 3)} `);
      this.drawDimLabel(verts[0], verts[3], `${Math.round(column.params.width / 3)} `);
    } else if (column.kind === 'T-shape' && verts.length === 8) {
      const fl = column.params.tshape?.flangeLength ?? column.params.width;
      const wt = column.params.tshape?.webThickness ?? Math.round(column.params.depth / 3);
      this.drawDimLabel(verts[4], verts[5], `${Math.round(fl)} `);
      this.drawDimLabel(verts[1], verts[2], `${Math.round(wt)} `);
    }

    this.ctx.restore();
  }

  /**
   * Draw a small dimension label at the midpoint of segment [a, b] with a
   * short perpendicular tick mark.
   */
  private drawDimLabel(
    a: Readonly<{ x: number; y: number }>,
    b: Readonly<{ x: number; y: number }>,
    text: string,
  ): void {
    const sa = this.worldToScreen(a);
    const sb = this.worldToScreen(b);
    const mx = (sa.x + sb.x) / 2;
    const my = (sa.y + sb.y) / 2;
    const dx = sb.x - sa.x;
    const dy = sb.y - sa.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 6) return;
    const nx = -dy / len;
    const ny = dx / len;
    const OFFSET_PX = 9;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    this.ctx.lineWidth = 0.7;
    this.ctx.setLineDash([2, 2]);
    this.ctx.beginPath();
    this.ctx.moveTo(sa.x, sa.y);
    this.ctx.lineTo(sb.x, sb.y);
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.fillText(text, mx + nx * OFFSET_PX, my + ny * OFFSET_PX);
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
