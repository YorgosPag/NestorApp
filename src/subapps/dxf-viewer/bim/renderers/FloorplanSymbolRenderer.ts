/**
 * FloorplanSymbolRenderer — ADR-415 Φ1.
 *
 * 2D plan-view renderer for `FloorplanSymbolEntity`. Reads `entity.geometry`
 * (populated by `computeFloorplanSymbolGeometry()` — SSoT) and draws:
 *   - the footprint outline (closed polygon)
 *   - a translucent fill
 *   - the kind-identifying vector strokes (WC cistern + bowl), from the
 *     `buildFloorplanSymbol` SSoT (shared with any placement ghost)
 *   - a hover halo when highlighted
 *
 * Pure vector — no mesh silhouette, no colour-by-system (cf. MepFixtureRenderer).
 * The V/G category + discipline are resolved from `params.category` via the
 * category engine (`resolveSymbolCategoryConfig`).
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isFloorplanSymbolEntity } from '../../types/entities';
import type { FloorplanSymbolEntity } from '../types/floorplan-symbol-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { buildFloorplanSymbol } from '../floorplan-symbols/floorplan-symbol-symbol';
import { resolveSymbolCategoryConfig } from '../floorplan-symbols/floorplan-symbol-categories';
import { getFloorplanSymbolGrips } from '../floorplan-symbols/floorplan-symbol-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';

export class FloorplanSymbolRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isFloorplanSymbolEntity(entity)) return;
    const symbol = entity as FloorplanSymbolEntity;

    if (!symbol.geometry || !symbol.params) return;
    const verts = symbol.geometry.footprint.vertices;
    if (verts.length < 3) return;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). category → BimCategory + discipline + palette via the engine.
    const { bimCategory, stroke: symbolStroke, fill: symbolFill } = resolveSymbolCategoryConfig(symbol.params.category);
    const layer = symbol.layerId ? getLayer(symbol.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: bimCategory, layerId: symbol.layerId, discipline: symbol.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

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

    // Fill + outline (category palette).
    this.ctx.fillStyle = symbolFill;
    this.drawPolygonPath(verts);
    this.ctx.fill();
    this.ctx.strokeStyle = symbolStroke;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Kind-identifying vector strokes (the WC cistern + bowl).
    const built = buildFloorplanSymbol(symbol.params, symbol.geometry);
    for (const stroke of built.strokes) {
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
    // ADR-415 — parametric grips: move (centre) + rotation + 4 corner resize.
    // 1:1 mirror of `FurnitureRenderer.getGrips`: move/rotation handles get their
    // icon glyph from the shared `gripGlyphShape` registry SSoT, corners stay
    // square. Drag is routed through `applyFloorplanSymbolGripDrag()` +
    // `UpdateFloorplanSymbolParamsCommand` by `commitFloorplanSymbolGripDrag`.
    if (!isFloorplanSymbolEntity(entity)) return [];
    return getFloorplanSymbolGrips(entity as FloorplanSymbolEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
      shape: gripGlyphShape(gripKindOf(g, 'floorplan-symbol')),
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isFloorplanSymbolEntity(entity)) return false;
    const symbol = entity as FloorplanSymbolEntity;
    const bb = symbol.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    return pointInPolygon(point, symbol.geometry.footprint.vertices);
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
