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

import { BimFootprintRenderer } from './bim-footprint-renderer';
import { polygonBboxHitTest, mapBimGrips, strokePolylinePaths } from './bim-polygon-render';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import { isFloorplanSymbolEntity } from '../../types/entities';
import type { FloorplanSymbolEntity } from '../types/floorplan-symbol-types';
import { buildFloorplanSymbol } from '../floorplan-symbols/floorplan-symbol-symbol';
import { resolveSymbolCategoryConfig } from '../floorplan-symbols/floorplan-symbol-categories';
import { getFloorplanSymbolGrips } from '../floorplan-symbols/floorplan-symbol-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';

export class FloorplanSymbolRenderer extends BimFootprintRenderer {
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

    this.beginPhasedBodyRender(entity, verts, options);

    // Fill + outline (category palette).
    this.ctx.fillStyle = symbolFill;
    this.drawPolygonPath(verts);
    this.ctx.fill();
    this.ctx.strokeStyle = symbolStroke;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Kind-identifying vector strokes (the WC cistern + bowl) — shared SSoT (bim-polygon-render).
    const built = buildFloorplanSymbol(symbol.params, symbol.geometry);
    strokePolylinePaths(this.ctx, (p) => this.worldToScreen(p), built.strokes);

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
    // Mapping itself is the shared BIM SSoT (mapBimGrips) — center kept, corners→vertex.
    return mapBimGrips(getFloorplanSymbolGrips(entity as FloorplanSymbolEntity), (g) => gripGlyphShape(gripKindOf(g, 'floorplan-symbol')));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isFloorplanSymbolEntity(entity)) return false;
    const bb = (entity as FloorplanSymbolEntity).geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject (tolerance) + ray-cast point-in-polygon — shared SSoT.
    return polygonBboxHitTest(bb, (entity as FloorplanSymbolEntity).geometry.footprint.vertices, point, tolerance);
  }
}
