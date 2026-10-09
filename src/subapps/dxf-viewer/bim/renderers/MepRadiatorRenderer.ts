/**
 * MepRadiatorRenderer — ADR-408 Εύρος Β #1.
 *
 * 2D plan-view renderer for `MepRadiatorEntity`. Reads `entity.geometry`
 * (populated by `computeMepRadiatorGeometry()` — SSoT) and draws:
 *   - the panel footprint outline (rectangle)
 *   - a translucent warm-red fill
 *   - the radiator symbol strokes (fin bars + supply/return stubs), from the
 *     `buildMepRadiatorSymbol` SSoT (shared with the placement ghost)
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
import { isMepRadiatorEntity } from '../../types/entities';
import type { MepRadiatorEntity } from '../types/mep-radiator-types';
import { polygonBboxHitTest, mapBimGrips, strokePolylinePaths } from './bim-polygon-render';
import { buildMepRadiatorSymbol } from '../mep-radiators/mep-radiator-symbol';
import { getMepRadiatorGrips } from '../mep-radiators/mep-radiator-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';

/**
 * Radiator palette — hydronic heating terminal (warm red). A radiator is a network
 * MEMBER, but in 2D plan it keeps a fixed warm-red identity (heating equipment) so
 * it reads as a radiator regardless of the supply/return circuit colours on its
 * connected pipes.
 */
const RADIATOR_STROKE = BIM_CATEGORY_LINE_COLORS.hydronicHeating;
const RADIATOR_FILL = hexToRgba(RADIATOR_STROKE, 0.16);

export class MepRadiatorRenderer extends BimFootprintRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepRadiatorEntity(entity)) return;
    const radiator = entity as MepRadiatorEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'mep-radiator' → plumbing via DISCIPLINE_BY_CATEGORY.
    const layer = radiator.layerId ? getLayer(radiator.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'mep-radiator', layerId: radiator.layerId, discipline: radiator.discipline }, layer)) return;

    if (!radiator.geometry || !radiator.params) return;
    const verts = radiator.geometry.footprint.vertices;
    if (verts.length < 3) return;

    this.beginPhasedBodyRender(entity, verts, options);

    // Fill + outline — warm-red heating equipment.
    this.paintLiveBody(verts, RADIATOR_FILL, RADIATOR_STROKE, RENDER_LINE_WIDTHS.NORMAL);

    // Radiator symbol — supply/return connector stubs + thin fin bars.
    const symbol = buildMepRadiatorSymbol(radiator.params, radiator.geometry);
    strokePolylinePaths(this.ctx, (p) => this.worldToScreen(p), symbol.strokes);
    this.ctx.lineWidth = liveStrokeWidthPx(RENDER_LINE_WIDTHS.THIN);
    strokePolylinePaths(this.ctx, (p) => this.worldToScreen(p), symbol.finStrokes);

    this.endPhasedBodyRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-408 Εύρος Β — parametric grips (wall-parity): move (centre) + rotation + 4
    // corner resize. Mirror of `MepManifoldRenderer.getGrips`; routed through
    // `applyMepRadiatorGripDrag()` + `UpdateMepRadiatorParamsCommand`.
    if (!isMepRadiatorEntity(entity)) return [];
    return mapBimGrips(getMepRadiatorGrips(entity as MepRadiatorEntity), (g) =>
      gripGlyphShape(gripKindOf(g, 'mep-radiator')),
    );
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepRadiatorEntity(entity)) return false;
    const radiator = entity as MepRadiatorEntity;
    const bb = radiator.geometry?.bbox;
    if (!bb) return false;
    return polygonBboxHitTest(bb, radiator.geometry.footprint.vertices, point, tolerance);
  }

}
