/**
 * SlabRenderer — ADR-363 Phase 3.
 *
 * 2D plan-view renderer για `SlabEntity`. Reads `entity.geometry`
 * (populated by `computeSlabGeometry()` — SSoT) και draws:
 *   - closed polygon outline (stroke per-kind colour)
 *   - translucent fill per kind
 *
 * Per-kind palette (industry convention — warm για συμπαγή στοιχεία, cool
 * για ψυχρές επιφάνειες, RC = γκρι):
 *   - floor       → warm grey (γενική πλάκα ορόφου)
 *   - ceiling     → cool blue-grey
 *   - roof        → red-brown (κεραμίδι / RC roof)
 *   - ground      → dark green (έδαφος)
 *   - foundation  → dark grey (RC θεμελίωση)
 *
 * Phase 3 NOT implemented (deferred Phase 3.5+):
 *   - Hatch patterns per reinforcement type
 *   - Vertex grips (polygon edit)
 *   - Boolean cutout για slab-openings (όταν slab-opening entity εισαχθεί)
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions
 * σε high-frequency stores. Called by canvas με entity resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isSlabEntity } from '../../types/entities';
import type { SlabEntity, SlabKind } from '../types/slab-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { HOVER_HIGHLIGHT } from '../../config/color-config';

/** Stroke colour per kind. */
const KIND_STROKE: Readonly<Record<SlabKind, string>> = {
  'floor':      '#6e6358',
  'ceiling':    '#5f7286',
  'roof':       '#a04a2b',
  'ground':     '#3d5a3a',
  'foundation': '#3a3a40',
};

/** Translucent fill (rgba) per kind. ~20% opacity. */
const KIND_FILL: Readonly<Record<SlabKind, string>> = {
  'floor':      'rgba(178, 162, 144, 0.20)',
  'ceiling':    'rgba(140, 158, 178, 0.20)',
  'roof':       'rgba(192, 92, 56, 0.20)',
  'ground':     'rgba(94, 130, 88, 0.20)',
  'foundation': 'rgba(88, 88, 96, 0.22)',
};

export class SlabRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isSlabEntity(entity)) return;
    const slab = entity as SlabEntity;
    if (!slab.geometry || !slab.params) return;
    const verts = slab.geometry.polygon.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo via outline thicker glow.
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
    // Fill first, stroke on top so outline stays sharp.
    this.ctx.fillStyle = KIND_FILL[slab.kind];
    this.drawPolygonPath(verts);
    this.ctx.fill();

    this.ctx.strokeStyle = KIND_STROKE[slab.kind];
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.restore();
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // Phase 3.5 — vertex grips για polygon edit. Phase 3 returns empty.
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isSlabEntity(entity)) return false;
    const slab = entity as SlabEntity;
    const bb = slab.geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject με tolerance.
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    // Detailed point-in-polygon test (ray casting).
    const verts = slab.geometry.polygon.vertices;
    return pointInPolygon(point, verts);
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
}
