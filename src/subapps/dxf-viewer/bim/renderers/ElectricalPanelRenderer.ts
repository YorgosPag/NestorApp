/**
 * ElectricalPanelRenderer — ADR-408 Φ3.
 *
 * 2D plan-view renderer for `ElectricalPanelEntity`. Reads `entity.geometry`
 * (populated by `computeElectricalPanelGeometry()` — SSoT) and draws:
 *   - the footprint outline (rectangle)
 *   - a translucent fill
 *   - the panel symbol strokes (breaker-row dividers), from the
 *     `buildPanelSymbol` SSoT (shared with the placement ghost)
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
import { isElectricalPanelEntity } from '../../types/entities';
import type { ElectricalPanelEntity } from '../types/electrical-panel-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { buildPanelSymbol } from '../electrical-panels/electrical-panel-symbol';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';
import { useMepSystemStore } from '../mep-systems/mep-system-store';
import {
  getEntitySystemColorIndexCached,
  resolveEntitySystemColor,
  hexToRgba,
} from '../mep-systems/mep-system-color';

/** Panel palette — electrical distribution board (teal projection, unassigned). */
const PANEL_STROKE = '#0d9488';
const PANEL_FILL = 'rgba(13, 148, 136, 0.18)';
/** Translucent fill alpha for the colour-by-system (ADR-408 Φ5) override. */
const SYSTEM_FILL_ALPHA = 0.18;

export class ElectricalPanelRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isElectricalPanelEntity(entity)) return;
    const panel = entity as ElectricalPanelEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'electrical-panel' → electrical via DISCIPLINE_BY_CATEGORY.
    const layer = panel.layerId ? getLayer(panel.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'electrical-panel', layerId: panel.layerId, discipline: panel.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!panel.geometry || !panel.params) return;
    const verts = panel.geometry.footprint.vertices;
    if (verts.length < 3) return;

    // ADR-408 Φ5 — colour-by-system: a panel that is a circuit source paints with
    // that circuit's colour; a panel feeding no circuit keeps the teal default.
    const systems = useMepSystemStore.getState().getSystems();
    const systemColor = systems.length > 0
      ? resolveEntitySystemColor(panel.id, getEntitySystemColorIndexCached(systems))
      : null;
    const strokeColor = systemColor ?? PANEL_STROKE;
    const fillColor = systemColor ? hexToRgba(systemColor, SYSTEM_FILL_ALPHA) : PANEL_FILL;

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

    // Fill + outline (colour-by-system override, ADR-408 Φ5).
    this.ctx.fillStyle = fillColor;
    this.drawPolygonPath(verts);
    this.ctx.fill();
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Panel symbol strokes (breaker-row dividers).
    const symbol = buildPanelSymbol(panel.params, panel.geometry);
    for (const stroke of symbol.strokes) {
      if (stroke.length < 2) continue;
      this.ctx.beginPath();
      const start = this.worldToScreen({ x: stroke[0].x, y: stroke[0].y });
      this.ctx.moveTo(start.x, start.y);
      for (let i = 1; i < stroke.length; i++) {
        const s = this.worldToScreen({ x: stroke[i].x, y: stroke[i].y });
        this.ctx.lineTo(s.x, s.y);
      }
      this.ctx.stroke();
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isElectricalPanelEntity(entity)) return [];
    const panel = entity as ElectricalPanelEntity;
    const p = panel.params.position;
    return [{
      id: `${panel.id}-grip-0`,
      position: { x: p.x, y: p.y },
      type: 'center' as const,
      entityId: panel.id,
      isVisible: true,
      gripIndex: 0,
    }];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isElectricalPanelEntity(entity)) return false;
    const panel = entity as ElectricalPanelEntity;
    const bb = panel.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    return pointInPolygon(point, panel.geometry.footprint.vertices);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

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
