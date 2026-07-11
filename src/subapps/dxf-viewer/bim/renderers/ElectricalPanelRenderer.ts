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
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isElectricalPanelEntity } from '../../types/entities';
import type { ElectricalPanelEntity } from '../types/electrical-panel-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { buildPanelSymbol } from '../electrical-panels/electrical-panel-symbol';
import { getElectricalPanelGrips } from '../electrical-panels/electrical-panel-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
// 🏢 ADR-571: electrical-panel teal SSoT + hexToRgba SSoT (color-math.ts)
import { HOVER_HIGHLIGHT, MEP_TEAL_COLOR } from '../../config/color-config';
import { hexToRgba } from '../../config/color-math';
import { getLayer } from '../../stores/LayerStore';
// ADR-375 Φ D — content stroke (πάχος + pattern + χρώμα) από το κεντρικό pen-table SSoT.
import { applyBimContentStroke } from './shared/bim-entity-stroke';

/**
 * Panel fill — electrical distribution board (teal). ADR-408 Φ5: the panel is
 * a circuit **source**, not a member, so it is NOT coloured by system (Revit:
 * Electrical Equipment carries no circuit colour). The outline stroke colour now
 * comes from the `electrical-panel` category (teal) via the SSoT resolver.
 */
const PANEL_FILL = hexToRgba(MEP_TEAL_COLOR, 0.18);

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

    // Fill + outline (equipment teal — panels are not coloured by circuit).
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptFillTintForCanvas(PANEL_FILL);
    this.drawPolygonPath(verts);
    this.ctx.fill();
    // ADR-375 Φ D — content outline: πάχος + pattern + teal χρώμα από το SSoT (αντί
    // hardcoded NORMAL + PANEL_STROKE). Οι breaker-row γραμμές κληρονομούν το ίδιο pen.
    applyBimContentStroke(
      this.ctx,
      { category: 'electrical-panel', cutState: 'projection', layer },
      { scale: this.transform.scale, applyColor: true },
    );
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
    // ADR-408 Φ3 — parametric grips (wall-parity): move (centre) + rotation + 4
    // corner resize (rectangular-only). Mirror of `MepFixtureRenderer.getGrips`;
    // the move/rotation handles get their icon glyph from the shared
    // `gripGlyphShape` registry SSoT, corners stay square. Drag is routed through
    // `applyElectricalPanelGripDrag()` + `UpdateElectricalPanelParamsCommand` by
    // `commitElectricalPanelGripDrag` (grip-parametric-commits).
    if (!isElectricalPanelEntity(entity)) return [];
    return getElectricalPanelGrips(entity as ElectricalPanelEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
      shape: gripGlyphShape(gripKindOf(g, 'electrical-panel')),
    }));
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
