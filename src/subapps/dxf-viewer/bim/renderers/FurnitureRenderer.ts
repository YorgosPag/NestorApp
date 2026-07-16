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

import { BimFootprintRenderer } from './bim-footprint-renderer';
import { polygonBboxHitTest, mapBimGrips } from './bim-polygon-render';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import { isFurnitureEntity } from '../../types/entities';
import type { FurnitureEntity } from '../types/furniture-types';
import { projectPointTo2D } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';
import { bimMeshCache } from '../../bim-3d/library/bim-mesh-library/bim-mesh-cache';
import { drawMeshSilhouette } from './mesh-silhouette-draw';
import { getFurnitureGrips } from '../furniture/furniture-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';

/** BIM category → Storage library folder for furniture meshes. */
const FURNITURE_MESH_CATEGORY = 'furniture';

/** Plan-symbol palette — interior furniture (neutral tan). */
const FURNITURE_PALETTE = {
  stroke: '#8b5e34',
  fill: 'rgba(180, 130, 80, 0.16)',
  edge: 'rgba(139, 94, 52, 0.55)',
} as const;

export class FurnitureRenderer extends BimFootprintRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isFurnitureEntity(entity)) return;
    const furniture = entity as FurnitureEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'furniture' → interior via DISCIPLINE_BY_CATEGORY.
    const layer = furniture.layerId ? getLayer(furniture.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'furniture', layerId: furniture.layerId, discipline: furniture.discipline }, layer)) return;

    if (!furniture.geometry || !furniture.params) return;
    const verts = furniture.geometry.footprint.vertices;
    if (verts.length < 3) return;

    this.beginPhasedBodyRender(entity, verts, options);

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
      // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
      this.ctx.fillStyle = adaptFillTintForCanvas(FURNITURE_PALETTE.fill);
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

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-410 — parametric grips: move (centre) + rotation + 4 corner resize.
    // Mirror of `MepFixtureRenderer.getGrips`; move/rotation handles get their
    // icon glyph from the shared `gripGlyphShape` registry SSoT, corners stay
    // square. Drag is routed through `applyFurnitureGripDrag()` +
    // `UpdateFurnitureParamsCommand` by `commitFurnitureGripDrag`.
    if (!isFurnitureEntity(entity)) return [];
    // Mapping itself is the shared BIM SSoT (mapBimGrips) — center kept, corners→vertex.
    return mapBimGrips(getFurnitureGrips(entity as FurnitureEntity), (g) => gripGlyphShape(gripKindOf(g, 'furniture')));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isFurnitureEntity(entity)) return false;
    const bb = (entity as FurnitureEntity).geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject (tolerance) + ray-cast point-in-polygon — shared SSoT.
    return polygonBboxHitTest(bb, (entity as FurnitureEntity).geometry.footprint.vertices, point, tolerance);
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /** Two corner-to-corner diagonals (generic furniture plan glyph). */
  private drawDiagonals(vertices: ReadonlyArray<{ x: number; y: number }>): void {
    if (vertices.length < 4) return;
    const p = vertices.map((v) => this.worldToScreen(projectPointTo2D(v)));
    this.ctx.beginPath();
    this.ctx.moveTo(p[0].x, p[0].y);
    this.ctx.lineTo(p[2].x, p[2].y);
    this.ctx.moveTo(p[1].x, p[1].y);
    this.ctx.lineTo(p[3].x, p[3].y);
    this.ctx.stroke();
  }
}
