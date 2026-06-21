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

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isMepUnderfloorEntity } from '../../types/entities';
import type { MepUnderfloorEntity } from '../types/mep-underfloor-types';
import {
  computeMepUnderfloorGeometry,
  buildFilletedUnderfloorPath,
  resolveUnderfloorBendRadiusScene,
} from '../mep-underfloor/mep-underfloor-geometry';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { getMepUnderfloorGrips } from '../mep-underfloor/mep-underfloor-grips';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';

/**
 * Underfloor palette — hydronic heating terminal (warm red, matches radiator/boiler family).
 * The fill is slightly more translucent than the boiler so the floor plan behind shows through.
 */
const UF_STROKE = '#dc2626';
const UF_FILL = 'rgba(220, 38, 38, 0.10)';
const UF_LOOP_STROKE = '#dc2626';
const UF_LOOP_LINE_WIDTH = 2;
const UF_CONNECTOR_RADIUS_SCREEN = 5; // px — diamond half-diagonal in screen space

export class MepUnderfloorRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepUnderfloorEntity(entity)) return;
    const uf = entity as MepUnderfloorEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building + Discipline).
    // 'mep-underfloor' → plumbing via DISCIPLINE_BY_CATEGORY.
    const layer = uf.layerId ? getLayer(uf.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'mep-underfloor', layerId: uf.layerId, discipline: uf.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!uf.params?.footprint) return;
    const verts = uf.params.footprint.vertices;
    if (verts.length < 3) return;

    // Recompute geometry if the cache is absent (corruption-safe fallback).
    const geometry = uf.geometry ?? computeMepUnderfloorGeometry(uf.params);

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo — outline the footprint polygon.
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

    // 1. Translucent warm-red fill for the heating area.
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptFillTintForCanvas(UF_FILL);
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // 2. Dashed footprint outline (visual boundary of the heated zone).
    this.ctx.strokeStyle = UF_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.ctx.setLineDash([6, 4]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();

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

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isMepUnderfloorEntity(entity)) return [];
    const uf = entity as MepUnderfloorEntity;
    return getMepUnderfloorGrips(uf).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'midpoint' ? ('midpoint' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepUnderfloorEntity(entity)) return false;
    const uf = entity as MepUnderfloorEntity;
    const bb = uf.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) return false;
    return pointInPolygon(point, uf.params.footprint.vertices);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** Draw the footprint polygon as a closed path (does not stroke/fill). */
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

  /** Stroke the serpentine loopPath as a continuous polyline. */
  private drawLoopPath(path: ReadonlyArray<{ x: number; y: number }>): void {
    this.ctx.beginPath();
    this.ctx.strokeStyle = UF_LOOP_STROKE;
    this.ctx.lineWidth = UF_LOOP_LINE_WIDTH;
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
    this.ctx.strokeStyle = UF_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.ctx.stroke();
  }
}
