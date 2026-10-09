/**
 * MepUnderfloorRenderer — ADR-408 Εύρος Β #3.
 *
 * 2D plan-view renderer for `MepUnderfloorEntity`. Reads `entity.geometry`
 * (populated by `computeMepUnderfloorGeometry()` — SSoT) and draws:
 *   - the footprint polygon (translucent warm-red fill + dashed outline)
 *   - the continuous serpentine pipe loopPath (solid 2px, hydronic-supply red)
 *   - supply (◇) and return (◇) connector diamonds at the two entry points
 *   - a hover halo when highlighted
 *
 * Area-based entity (like FloorFinish / Slab) — the footprint IS the entity;
 * there is no `position`/`rotation` host transform. Geometry is recomputed
 * from params if the cache is absent (corruption-safe, same pattern as
 * FloorFinishRenderer / MepBoilerRenderer).
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BimFootprintRenderer } from './bim-footprint-renderer';
import { applyLiveStroke } from './shared/live-stroke';
import { BIM_CATEGORY_LINE_COLORS } from '../../config/bim-object-styles';
import { hexToRgba } from '../../config/color-math';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import { isMepUnderfloorEntity } from '../../types/entities';
import type { MepUnderfloorEntity } from '../types/mep-underfloor-types';
import {
  computeMepUnderfloorGeometry,
  buildFilletedUnderfloorPath,
  resolveUnderfloorBendRadiusScene,
} from '../mep-underfloor/mep-underfloor-geometry';
import { polygonBboxHitTest, mapBimGrips } from './bim-polygon-render';
import { getMepUnderfloorGrips } from '../mep-underfloor/mep-underfloor-grips';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';

/**
 * Underfloor palette — hydronic heating terminal (warm red, matches radiator/boiler family).
 * The fill is slightly more translucent than the boiler so the floor plan behind shows through.
 */
const UF_STROKE = BIM_CATEGORY_LINE_COLORS.hydronicHeating;
const UF_FILL = hexToRgba(UF_STROKE, 0.1);
const UF_LOOP_STROKE = UF_STROKE;
const UF_LOOP_LINE_WIDTH = 2;
const UF_CONNECTOR_RADIUS_SCREEN = 5; // px — diamond half-diagonal in screen space
/** Dash pattern (screen-px on/off) for the heated-zone boundary. */
const UF_OUTLINE_DASH: readonly number[] = [6, 4];

export class MepUnderfloorRenderer extends BimFootprintRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepUnderfloorEntity(entity)) return;
    const uf = entity as MepUnderfloorEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building + Discipline).
    // 'mep-underfloor' → plumbing via DISCIPLINE_BY_CATEGORY.
    const layer = uf.layerId ? getLayer(uf.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'mep-underfloor', layerId: uf.layerId, discipline: uf.discipline }, layer)) return;

    if (!uf.params?.footprint) return;
    const verts = uf.params.footprint.vertices;
    if (verts.length < 3) return;

    // Recompute geometry if the cache is absent (corruption-safe fallback).
    const geometry = uf.geometry ?? computeMepUnderfloorGeometry(uf.params);

    this.beginPhasedBodyRender(entity, verts, options);

    // 1–2. Translucent warm-red fill for the heating area + dashed footprint outline
    //      (visual boundary of the heated zone).
    this.paintLiveBody(verts, UF_FILL, UF_STROKE, RENDER_LINE_WIDTHS.THIN, UF_OUTLINE_DASH);

    // 3. Serpentine pipe loopPath — continuous polyline at 2px solid, with the same
    //    rounded pipe bends (arc fillets) the 3D tube uses, so 2D and 3D match (the
    //    persisted loopPath is the lean corner polyline; the bends are re-derived here).
    this.ctx.setLineDash([]);
    if (geometry.loopPath.length >= 2) {
      this.drawLoopPath(buildFilletedUnderfloorPath(geometry.loopPath, resolveUnderfloorBendRadiusScene(uf.params)));
    }

    // 4. Supply ◇ and return ◇ connector diamonds at the entry edge.
    this.drawConnectorDiamond(geometry.supplyConnectorLocal);
    this.drawConnectorDiamond(geometry.returnConnectorLocal);

    this.endPhasedBodyRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isMepUnderfloorEntity(entity)) return [];
    const uf = entity as MepUnderfloorEntity;
    return mapBimGrips(getMepUnderfloorGrips(uf));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepUnderfloorEntity(entity)) return false;
    const uf = entity as MepUnderfloorEntity;
    const bb = uf.geometry?.bbox;
    if (!bb) return false;
    return polygonBboxHitTest(bb, uf.params.footprint.vertices, point, tolerance);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** Stroke the serpentine loopPath as a continuous polyline. */
  private drawLoopPath(path: ReadonlyArray<{ x: number; y: number }>): void {
    this.ctx.beginPath();
    applyLiveStroke(this.ctx, UF_LOOP_STROKE, UF_LOOP_LINE_WIDTH);
    const start = this.worldToScreen({ x: path[0].x, y: path[0].y });
    this.ctx.moveTo(start.x, start.y);
    for (let i = 1; i < path.length; i++) {
      const s = this.worldToScreen({ x: path[i].x, y: path[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.stroke();
  }

  /** Draw a ◇ diamond glyph at a world-space connector point. */
  private drawConnectorDiamond(point: { x: number; y: number }): void {
    const s = this.worldToScreen({ x: point.x, y: point.y });
    const r = UF_CONNECTOR_RADIUS_SCREEN;
    this.ctx.beginPath();
    this.ctx.moveTo(s.x, s.y - r);
    this.ctx.lineTo(s.x + r, s.y);
    this.ctx.lineTo(s.x, s.y + r);
    this.ctx.lineTo(s.x - r, s.y);
    this.ctx.closePath();
    applyLiveStroke(this.ctx, UF_STROKE, RENDER_LINE_WIDTHS.THIN);
    this.ctx.stroke();
  }
}
