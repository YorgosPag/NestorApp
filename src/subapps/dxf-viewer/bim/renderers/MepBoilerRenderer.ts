/**
 * MepBoilerRenderer — ADR-408 Εύρος Β #2.
 *
 * 2D plan-view renderer for `MepBoilerEntity`. Reads `entity.geometry`
 * (populated by `computeMepBoilerGeometry()` — SSoT) and draws:
 *   - the cabinet footprint outline (rectangle)
 *   - a translucent warm-red fill
 *   - the boiler symbol strokes (horizontal divider + flame glyph + supply/return
 *     stubs), from the `buildMepBoilerSymbol` SSoT (shared with the placement ghost)
 *   - a hover halo when highlighted
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isMepBoilerEntity } from '../../types/entities';
import type { MepBoilerEntity } from '../types/mep-boiler-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { buildMepBoilerSymbol } from '../mep-boilers/mep-boiler-symbol';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';

/**
 * Boiler palette — hydronic heating source (warm red). A boiler is the SOURCE of a
 * hydronic supply network, so it keeps a fixed warm-red identity matching the
 * radiator palette — both are "heating equipment" regardless of the pipe circuit
 * colours on its connectors.
 */
const BOILER_STROKE = '#dc2626';
const BOILER_FILL = 'rgba(220, 38, 38, 0.16)';

export class MepBoilerRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepBoilerEntity(entity)) return;
    const boiler = entity as MepBoilerEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'mep-boiler' → plumbing via DISCIPLINE_BY_CATEGORY.
    const layer = boiler.layerId ? getLayer(boiler.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'mep-boiler', layerId: boiler.layerId, discipline: boiler.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!boiler.geometry || !boiler.params) return;
    const verts = boiler.geometry.footprint.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

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
    this.ctx.setLineDash([]);

    // Fill + outline — warm-red heating equipment (boiler = hydronic source).
    this.ctx.fillStyle = BOILER_FILL;
    this.drawPolygonPath(verts);
    this.ctx.fill();
    this.ctx.strokeStyle = BOILER_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Boiler symbol — supply/return connector stubs + divider + flame glyph.
    const symbol = buildMepBoilerSymbol(boiler.params, boiler.geometry);
    for (const stroke of symbol.strokes) {
      this.drawStroke(stroke);
    }
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    for (const stroke of symbol.glyphStrokes) {
      this.drawStroke(stroke);
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // ADR-408 Εύρος Β #2 — grips (move/rotation/resize) are handled by a separate
    // agent slice (mep-boiler-grips.ts + UpdateMepBoilerParamsCommand). This renderer
    // returns an empty array until that slice lands; the grip system falls through
    // gracefully (no grips shown = no crash).
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepBoilerEntity(entity)) return false;
    const boiler = entity as MepBoilerEntity;
    const bb = boiler.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    return pointInPolygon(point, boiler.geometry.footprint.vertices);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** Stroke a world-space polyline (symbol stub / glyph) at the current style. */
  private drawStroke(stroke: ReadonlyArray<{ x: number; y: number }>): void {
    if (stroke.length < 2) return;
    this.ctx.beginPath();
    const start = this.worldToScreen({ x: stroke[0].x, y: stroke[0].y });
    this.ctx.moveTo(start.x, start.y);
    for (let i = 1; i < stroke.length; i++) {
      const s = this.worldToScreen({ x: stroke[i].x, y: stroke[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.stroke();
  }

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
