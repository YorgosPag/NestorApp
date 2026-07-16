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

import { BimFootprintRenderer } from './bim-footprint-renderer';
import { polygonBboxHitTest, mapBimGrips, strokePolylinePaths } from './bim-polygon-render';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import { isElectricalPanelEntity } from '../../types/entities';
import type { ElectricalPanelEntity } from '../types/electrical-panel-types';
import { buildPanelSymbol } from '../electrical-panels/electrical-panel-symbol';
import { getElectricalPanelGrips } from '../electrical-panels/electrical-panel-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
// 🏢 ADR-571: electrical-panel teal SSoT + hexToRgba SSoT (color-math.ts)
import { MEP_TEAL_COLOR } from '../../config/color-config';
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

export class ElectricalPanelRenderer extends BimFootprintRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isElectricalPanelEntity(entity)) return;
    const panel = entity as ElectricalPanelEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'electrical-panel' → electrical via DISCIPLINE_BY_CATEGORY.
    const layer = panel.layerId ? getLayer(panel.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'electrical-panel', layerId: panel.layerId, discipline: panel.discipline }, layer)) return;

    if (!panel.geometry || !panel.params) return;
    const verts = panel.geometry.footprint.vertices;
    if (verts.length < 3) return;

    this.beginPhasedBodyRender(entity, verts, options);

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

    // Panel symbol strokes (breaker-row dividers) — shared SSoT (bim-polygon-render).
    const symbol = buildPanelSymbol(panel.params, panel.geometry);
    strokePolylinePaths(this.ctx, (p) => this.worldToScreen(p), symbol.strokes);

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
    // Mapping itself is the shared BIM SSoT (mapBimGrips) — center kept, corners→vertex.
    return mapBimGrips(getElectricalPanelGrips(entity as ElectricalPanelEntity), (g) => gripGlyphShape(gripKindOf(g, 'electrical-panel')));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isElectricalPanelEntity(entity)) return false;
    const bb = (entity as ElectricalPanelEntity).geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject (tolerance) + ray-cast point-in-polygon — shared SSoT.
    return polygonBboxHitTest(bb, (entity as ElectricalPanelEntity).geometry.footprint.vertices, point, tolerance);
  }
}
