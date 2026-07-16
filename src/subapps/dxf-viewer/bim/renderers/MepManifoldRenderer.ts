/**
 * MepManifoldRenderer — ADR-408 Φ12.
 *
 * 2D plan-view renderer for `MepManifoldEntity`. Reads `entity.geometry`
 * (populated by `computeMepManifoldGeometry()` — SSoT) and draws:
 *   - the footprint outline (rectangle)
 *   - a translucent fill
 *   - the manifold symbol strokes (inlet stub + outlet stubs), from the
 *     `buildMepManifoldSymbol` SSoT (shared with the placement ghost)
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
import { isMepManifoldEntity } from '../../types/entities';
import type { MepManifoldEntity } from '../types/mep-manifold-types';
import { paintPolygonHoverHalo, polygonBboxHitTest, mapBimGrips, tracePolygonScreenPath, strokePolylinePaths } from './bim-polygon-render';
import { buildMepManifoldSymbol, resolveManifoldPalette } from '../mep-manifolds/mep-manifold-symbol';
// 🏢 ADR-571: hexToRgba SSoT (fill derived from strokeHex — μηδέν rgb tuple)
import { hexToRgba } from '../../config/color-math';
import { getMepManifoldGrips } from '../mep-manifolds/mep-manifold-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';

/**
 * Manifold fill translucency. Colours come from the `resolveManifoldPalette` SSoT
 * (ADR-408 Φ12/Φ14) — water manifold = cyan-teal equipment (a circuit **source**,
 * NOT coloured by system); drainage collector (φρεάτιο) = brown (CIBSE sanitary).
 */
const MANIFOLD_FILL_ALPHA = 0.18;

export class MepManifoldRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepManifoldEntity(entity)) return;
    const manifold = entity as MepManifoldEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'mep-manifold' → plumbing via DISCIPLINE_BY_CATEGORY.
    const layer = manifold.layerId ? getLayer(manifold.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'mep-manifold', layerId: manifold.layerId, discipline: manifold.discipline }, layer)) return;

    if (!manifold.geometry || !manifold.params) return;
    const verts = manifold.geometry.footprint.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    paintPolygonHoverHalo(this.ctx, (p) => this.worldToScreen(p), verts, phaseState.phase === 'highlighted');

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();
    this.ctx.setLineDash([]);

    // Fill + outline — equipment cyan-teal for a water manifold; brown for a
    // drainage collector (φρεάτιο). Manifolds are not coloured by circuit (source).
    const palette = resolveManifoldPalette(manifold.params.kind);
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptFillTintForCanvas(hexToRgba(palette.strokeHex, MANIFOLD_FILL_ALPHA));
    tracePolygonScreenPath(this.ctx, (p) => this.worldToScreen(p), verts);
    this.ctx.fill();
    this.ctx.strokeStyle = palette.strokeHex;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    tracePolygonScreenPath(this.ctx, (p) => this.worldToScreen(p), verts);
    this.ctx.stroke();

    // Manifold symbol strokes (inlet stub + outlet stubs).
    const symbol = buildMepManifoldSymbol(manifold.params, manifold.geometry);
    strokePolylinePaths(this.ctx, (p) => this.worldToScreen(p), symbol.strokes);

    // ADR-408 Φ14 — drainage collector (φρεάτιο) grating: parallel bars inside the
    // footprint, thinner than the stubs so the catch-basin reads at a glance.
    if (symbol.gratingStrokes) {
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
      strokePolylinePaths(this.ctx, (p) => this.worldToScreen(p), symbol.gratingStrokes);
    }

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-408 Φ12 — parametric grips (wall-parity): move (centre) + rotation + 4
    // corner resize (rectangular-only). Mirror of `ElectricalPanelRenderer.getGrips`;
    // the move/rotation handles get their icon glyph from the shared
    // `gripGlyphShape` registry SSoT, corners stay square. Drag is routed through
    // `applyMepManifoldGripDrag()` + `UpdateMepManifoldParamsCommand` by
    // `commitMepManifoldGripDrag` (grip-parametric-commits).
    if (!isMepManifoldEntity(entity)) return [];
    return mapBimGrips(getMepManifoldGrips(entity as MepManifoldEntity), (g) =>
      gripGlyphShape(gripKindOf(g, 'mep-manifold')),
    );
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepManifoldEntity(entity)) return false;
    const manifold = entity as MepManifoldEntity;
    const bb = manifold.geometry?.bbox;
    if (!bb) return false;
    return polygonBboxHitTest(bb, manifold.geometry.footprint.vertices, point, tolerance);
  }

}
