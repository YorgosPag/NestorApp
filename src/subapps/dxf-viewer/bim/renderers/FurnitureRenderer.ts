/**
 * FurnitureRenderer — ADR-410 (mesh silhouette via ADR-411 shared helper).
 *
 * 2D plan-view renderer for `FurnitureEntity`. Prefers the per-asset top-view
 * silhouette derived from the loaded 3D mesh (representative plan footprint +
 * interior detail lines), painted by the shared `drawMeshSilhouette` SSoT. Falls
 * back to the authored catalog rectangle + generic glyph until the glTF (and its
 * silhouette) has loaded.
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
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
import { bimMeshCache } from '../../bim-3d/library/bim-mesh-library/bim-mesh-cache';
import { drawMeshSilhouette } from './mesh-silhouette-draw';

/** BIM category → Storage library folder for furniture meshes. */
const FURNITURE_MESH_CATEGORY = 'furniture';

/** Plan-symbol palette — interior furniture (neutral tan). */
const FURNITURE_PALETTE = {
  stroke: '#8b5e34',
  fill: 'rgba(180, 130, 80, 0.16)',
  edge: 'rgba(139, 94, 52, 0.55)',
} as const;

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

    // ADR-411 — prefer the per-asset top-view silhouette + interior detail lines
    // (shared SSoT). Falls back to the authored rectangle + glyph until loaded.
    const { assetId, position, rotationDeg, sceneUnits } = furniture.params;
    const drew = drawMeshSilhouette({
      ctx: this.ctx,
      worldToScreen: (p) => this.worldToScreen(p),
      silhouette: bimMeshCache.getSilhouette(FURNITURE_MESH_CATEGORY, assetId),
      edges: bimMeshCache.getTopEdges(FURNITURE_MESH_CATEGORY, assetId),
      transform: { position, rotationDeg, sceneUnits: sceneUnits ?? 'mm' },
      palette: FURNITURE_PALETTE,
      lineWidth: RENDER_LINE_WIDTHS.NORMAL,
    });

    if (!drew) {
      // Authored footprint rectangle + generic glyph (diagonal cross).
      this.ctx.fillStyle = FURNITURE_PALETTE.fill;
      this.drawPolygonPath(verts);
      this.ctx.fill();
      this.ctx.strokeStyle = FURNITURE_PALETTE.stroke;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
      this.drawPolygonPath(verts);
      this.ctx.stroke();
      this.drawDiagonals(verts);
    }

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
