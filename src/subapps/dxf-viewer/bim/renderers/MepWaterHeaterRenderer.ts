/**
 * MepWaterHeaterRenderer — ADR-408 DHW (domestic hot water heater / θερμοσίφωνας).
 *
 * 2D plan-view renderer for `MepWaterHeaterEntity`. Reads `entity.geometry`
 * (populated by `computeMepWaterHeaterGeometry()` — SSoT) and draws:
 *   - the cabinet footprint outline (rectangle)
 *   - a translucent blue fill (DHW = cold-water inlet + hot-water outlet, distinct
 *     from the warm-red heating boiler palette)
 *   - the water heater symbol strokes (cold/hot connector stubs + DHW tank glyph —
 *     inscribed circle + water level + heating element zig-zag), from the
 *     `buildMepWaterHeaterSymbol` SSoT (shared with the placement ghost)
 *   - a hover halo when highlighted
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BimFootprintRenderer } from './bim-footprint-renderer';
import { liveStrokeWidthPx } from '../../config/adaptive-entity-color';
import { BIM_CATEGORY_LINE_COLORS } from '../../config/bim-object-styles';
import { hexToRgba } from '../../config/color-math';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { MepWaterHeaterEntity } from '../types/mep-water-heater-types';
import { polygonBboxHitTest, strokePolylinePaths } from './bim-polygon-render';
import { buildMepWaterHeaterSymbol } from '../mep-water-heaters/mep-water-heater-symbol';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';

/** Local type guard (mirrors the one pending in entities.ts integration step). */
function isMepWaterHeaterEntity(entity: Entity): entity is MepWaterHeaterEntity {
  return entity.type === 'mep-water-heater';
}

/**
 * Water heater palette — domestic-hot-water source (blue). A water heater is the
 * SOURCE of a DHW supply network, so it gets a clear blue identity to distinguish it
 * from the warm-red hydronic heating equipment (boiler / radiator). Blue = water.
 */
const WATER_HEATER_STROKE = BIM_CATEGORY_LINE_COLORS.domesticHotWater;
const WATER_HEATER_FILL = hexToRgba(WATER_HEATER_STROKE, 0.14);

export class MepWaterHeaterRenderer extends BimFootprintRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepWaterHeaterEntity(entity)) return;
    const waterHeater = entity as MepWaterHeaterEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'mep-water-heater' → plumbing via DISCIPLINE_BY_CATEGORY.
    const layer = waterHeater.layerId ? getLayer(waterHeater.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'mep-water-heater', layerId: waterHeater.layerId, discipline: waterHeater.discipline }, layer)) return;

    if (!waterHeater.geometry || !waterHeater.params) return;
    const verts = waterHeater.geometry.footprint.vertices;
    if (verts.length < 3) return;

    this.beginPhasedBodyRender(entity, verts, options);

    // Fill + outline — blue DHW equipment (water heater = domestic-hot-water source).
    this.paintLiveBody(verts, WATER_HEATER_FILL, WATER_HEATER_STROKE, RENDER_LINE_WIDTHS.NORMAL);

    // Water heater symbol — cold/hot connector stubs + DHW tank glyph.
    const symbol = buildMepWaterHeaterSymbol(waterHeater.params, waterHeater.geometry);
    strokePolylinePaths(this.ctx, (p) => this.worldToScreen(p), symbol.strokes);
    this.ctx.lineWidth = liveStrokeWidthPx(RENDER_LINE_WIDTHS.THIN);
    strokePolylinePaths(this.ctx, (p) => this.worldToScreen(p), symbol.glyphStrokes);

    this.endPhasedBodyRender(entity, options);
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // ADR-408 DHW — grips (move/rotation/resize) are handled by a separate
    // agent slice (mep-water-heater-grips.ts + UpdateMepWaterHeaterParamsCommand).
    // This renderer returns an empty array until that slice lands; the grip system
    // falls through gracefully (no grips shown = no crash).
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepWaterHeaterEntity(entity)) return false;
    const waterHeater = entity as MepWaterHeaterEntity;
    const bb = waterHeater.geometry?.bbox;
    if (!bb) return false;
    return polygonBboxHitTest(bb, waterHeater.geometry.footprint.vertices, point, tolerance);
  }

}
