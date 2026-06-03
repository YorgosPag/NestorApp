/**
 * FurnitureRenderer — ADR-410.
 *
 * 2D plan-view renderer for `FurnitureEntity`. Reads `entity.geometry`
 * (populated by `computeFurnitureGeometry()` — SSoT) and draws:
 *   - the authored footprint outline (rectangle)
 *   - a translucent fill
 *   - a diagonal plan glyph (the generic furniture cross)
 *   - a hover halo when highlighted
 *
 * The 2D representation is authored (footprint from the catalog) — it never
 * needs the glTF mesh to be loaded (ADR-410 decision 5).
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isFurnitureEntity } from '../../types/entities';
import type { FurnitureEntity } from '../types/furniture-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';

/** Plan-symbol palette — interior furniture (neutral tan outline). */
const FURNITURE_STROKE = '#8b5e34';
const FURNITURE_FILL = 'rgba(180, 130, 80, 0.16)';

export class FurnitureRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isFurnitureEntity(entity)) return;
    const furniture = entity as FurnitureEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'furniture' → interior via DISCIPLINE_BY_CATEGORY.
    const layer = furniture.layerId ? getLayer(furniture.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'furniture', layerId: furniture.layerId, discipline: furniture.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!furniture.geometry || !furniture.params) return;
    const verts = furniture.geometry.footprint.vertices;
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

    // Fill + outline.
    this.ctx.fillStyle = FURNITURE_FILL;
    this.drawPolygonPath(verts);
    this.ctx.fill();
    this.ctx.strokeStyle = FURNITURE_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Diagonal plan glyph (generic furniture cross) — corner-to-corner.
    this.drawDiagonals(verts);

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // ADR-410 slice — parametric 2D grips deferred. Move/rotate is available via
    // the entity-agnostic hot-grip / 3D gizmo path; no per-vertex grips here yet.
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isFurnitureEntity(entity)) return false;
    const furniture = entity as FurnitureEntity;
    const bb = furniture.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    return pointInPolygon(point, furniture.geometry.footprint.vertices);
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

  /** Two corner-to-corner diagonals (generic furniture plan glyph). */
  private drawDiagonals(vertices: ReadonlyArray<{ x: number; y: number }>): void {
    if (vertices.length < 4) return;
    const p = vertices.map((v) => this.worldToScreen({ x: v.x, y: v.y }));
    this.ctx.beginPath();
    this.ctx.moveTo(p[0].x, p[0].y);
    this.ctx.lineTo(p[2].x, p[2].y);
    this.ctx.moveTo(p[1].x, p[1].y);
    this.ctx.lineTo(p[3].x, p[3].y);
    this.ctx.stroke();
  }
}
