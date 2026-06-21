/**
 * FloorFinishRenderer — ADR-419.
 *
 * 2D plan-view renderer για `FloorFinishEntity`. Reads `entity.geometry` +
 * `entity.params` (populated by `computeFloorFinishGeometry()` — SSoT) και draws:
 *   - closed polygon outline (stroke per-material colour)
 *   - translucent fill per material (~20% opacity)
 *   - hatch pattern clipped by polygon: wood/tile/dot/solid
 *
 * ADR-040 micro-leaf compliance: pure renderer με ZERO subscriptions
 * σε high-frequency stores. Called by canvas με entity resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isFloorFinishEntity } from '../../types/entities';
import type { FloorFinishEntity } from '../types/floor-finish-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getFloorFinishGrips } from '../floor-finishes/floor-finish-grips';
import {
  getFloorFinishColor,
  getFloorFinishHatchType,
} from '../floor-finishes/floor-finish-material-catalog';
import { hexToRgba } from '../utils/bim-vg-fill-tint';
import { adaptBimBodyFill } from '../utils/bim-body-fill';

const HATCH_STROKE = 'rgba(0, 0, 0, 0.15)';
const HATCH_LINE_WIDTH = 0.5;

/** World-space spacing (mm) for each hatch family. */
const HATCH_SPACING_MM = {
  wood: 150,
  tile: 300,
  dot:  200,
  solid: 0,
} as const;

export class FloorFinishRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isFloorFinishEntity(entity)) return;
    const ff = entity as FloorFinishEntity;
    if (!ff.params?.footprint) return;
    const verts = ff.params.footprint.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo.
    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = HOVER_HIGHLIGHT.ENTITY.glowExtraWidth + 1.5;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawPolygonPath(verts);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();

    const color = getFloorFinishColor(ff.params.materialId);
    const hatch = getFloorFinishHatchType(ff.params.materialId);

    // Translucent fill (22% opacity) — reuse `hexToRgba` SSoT (ADR-375· N.0.2 boy-scout,
    // αφαίρεση inline hex parse· κοινό με WallCoveringRenderer ADR-511).
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptBimBodyFill(hexToRgba(color, 0.22) ?? color);
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // Hatch pattern clipped inside polygon.
    if (hatch !== 'solid' && ff.geometry?.bbox) {
      this.drawHatch(ff, hatch);
    }

    // Outline stroke.
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.2;
    this.ctx.setLineDash([4, 4]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    this.ctx.restore();
    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isFloorFinishEntity(entity)) return [];
    return getFloorFinishGrips(entity as FloorFinishEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'midpoint' ? ('midpoint' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isFloorFinishEntity(entity)) return false;
    const ff = entity as FloorFinishEntity;
    const bb = ff.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) return false;
    return pointInPolygon(point, ff.params.footprint.vertices);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

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

  private drawHatch(
    ff: FloorFinishEntity,
    hatch: 'wood' | 'tile' | 'dot',
  ): void {
    const bbox = ff.geometry!.bbox;
    const spacingMm = HATCH_SPACING_MM[hatch];
    if (!Number.isFinite(spacingMm) || spacingMm <= 0) return;

    this.ctx.save();
    this.drawPolygonPath(ff.params.footprint.vertices);
    this.ctx.clip();
    this.ctx.strokeStyle = HATCH_STROKE;
    this.ctx.fillStyle = HATCH_STROKE;
    this.ctx.lineWidth = HATCH_LINE_WIDTH;
    this.ctx.setLineDash([]);

    if (hatch === 'dot') {
      this.drawDotGrid(bbox, spacingMm);
    } else if (hatch === 'wood') {
      this.drawParallelLines(bbox, spacingMm, 'horizontal');
    } else {
      this.drawParallelLines(bbox, spacingMm, 'horizontal');
      this.drawParallelLines(bbox, spacingMm, 'vertical');
    }
    this.ctx.restore();
  }

  private drawParallelLines(
    bbox: FloorFinishEntity['geometry']['bbox'],
    spacingMm: number,
    orientation: 'horizontal' | 'vertical',
  ): void {
    if (orientation === 'horizontal') {
      const startY = Math.ceil(bbox.min.y / spacingMm) * spacingMm;
      for (let y = startY; y <= bbox.max.y; y += spacingMm) {
        const s = this.worldToScreen({ x: bbox.min.x, y });
        const e = this.worldToScreen({ x: bbox.max.x, y });
        this.ctx.beginPath();
        this.ctx.moveTo(s.x, s.y);
        this.ctx.lineTo(e.x, e.y);
        this.ctx.stroke();
      }
    } else {
      const startX = Math.ceil(bbox.min.x / spacingMm) * spacingMm;
      for (let x = startX; x <= bbox.max.x; x += spacingMm) {
        const s = this.worldToScreen({ x, y: bbox.min.y });
        const e = this.worldToScreen({ x, y: bbox.max.y });
        this.ctx.beginPath();
        this.ctx.moveTo(s.x, s.y);
        this.ctx.lineTo(e.x, e.y);
        this.ctx.stroke();
      }
    }
  }

  private drawDotGrid(
    bbox: FloorFinishEntity['geometry']['bbox'],
    spacingMm: number,
  ): void {
    const startX = Math.ceil(bbox.min.x / spacingMm) * spacingMm;
    const startY = Math.ceil(bbox.min.y / spacingMm) * spacingMm;
    for (let x = startX; x <= bbox.max.x; x += spacingMm) {
      for (let y = startY; y <= bbox.max.y; y += spacingMm) {
        const s = this.worldToScreen({ x, y });
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
}
