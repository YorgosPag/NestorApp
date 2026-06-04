/**
 * RoofRenderer — ADR-417 Φ1 vertical slice.
 *
 * 2D plan-view renderer για `RoofEntity`. Διαβάζει `entity.geometry`
 * (populated by `computeRoofGeometry()` — SSoT) και draws:
 *   - κάθε «νερό» (face) με translucent fill + stroke (warm red-brown palette)
 *   - γραμμές κορφιά / hip / λουκιού (ridge lines) με dashed stroke
 *   - hover halo γύρω από το footprint polygon (HOVER_HIGHLIGHT SSoT)
 *
 * Παλέτα (industry convention — warm red-brown για κεραμίδια / RC roof):
 *   - stroke  → #a04a2b  (warm red-brown, ίδιο με slab kind='roof')
 *   - fill    → rgba(160,74,43,0.18)
 *   - ridge   → #7a3420  (σκούρο κόκκινο-καφέ, dashed)
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions
 * σε high-frequency stores. Called by canvas με entity resolved upstream.
 *
 * Visibility: minimal guard `entity.visible !== false` — αποφεύγει import
 * του `resolveIsEntityVisible` γιατί η κατηγορία 'roof' δεν ήταν ακόμα
 * registered στο V/G type system (Φ2: πλήρης V/G integration).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §Φ1
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isRoofEntity } from '../../types/entities';
import type { RoofEntity } from '../types/roof-types';
import type { Point3D } from '../types/bim-base';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { HOVER_HIGHLIGHT } from '../../config/color-config';

// ─── Palette constants ────────────────────────────────────────────────────────

/** Stroke colour για το περίγραμμα κάθε face (ίδιο με slab kind='roof'). */
const ROOF_FACE_STROKE = '#a04a2b';

/** Translucent fill για κάθε face (~18% opacity). */
const ROOF_FACE_FILL = 'rgba(160,74,43,0.18)';

/** Stroke colour για γραμμές κορφιά / hip / λουκιού. */
const ROOF_RIDGE_STROKE = '#7a3420';

/** lineWidth (px) για ridge/hip/valley lines. */
const ROOF_RIDGE_LINE_WIDTH = 1.5;

/** Dash array [on, off] για ridge lines. */
const ROOF_RIDGE_DASH: readonly number[] = [6, 4];

// ─── Renderer ─────────────────────────────────────────────────────────────────

export class RoofRenderer extends BaseEntityRenderer {

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isRoofEntity(entity)) return;
    const roof = entity as RoofEntity;

    // Minimal visibility guard — V/G category integration deferred to Φ2.
    if (roof.visible === false) return;

    if (!roof.geometry || !roof.params) return;
    const footprintVerts = roof.geometry.footprint.vertices;
    if (footprintVerts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo: glow stroke around footprint polygon outline.
    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawPolygonPath(footprintVerts);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();

    // Draw each roof face: fill + stroke outline.
    for (const face of roof.geometry.faces) {
      if (face.outline.length < 3) continue;
      this.drawFace(face.outline);
    }

    // Draw ridge / hip / valley / eave lines.
    this.drawRidgeLines(roof);

    this.ctx.restore();

    this.finalizeRender(entity, options);
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // Grips wired separately by orchestrator (ADR-417 Φ2+).
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isRoofEntity(entity)) return false;
    const roof = entity as RoofEntity;
    const bb = roof.geometry?.bbox;
    if (!bb) return false;

    // Bbox quick-reject (xy only — z in bbox is metres, irrelevant for 2D).
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }

    // Detailed point-in-polygon test on footprint (ray casting).
    return pointInPolygon(point, roof.geometry.footprint.vertices);
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /**
   * Fills + strokes a single face outline polygon.
   * Vertices are Point3D (canvas-unit xy, mm z) — only xy used for 2D.
   */
  private drawFace(vertices: readonly Point3D[]): void {
    this.drawPolygonPath(vertices);
    this.ctx.fillStyle = ROOF_FACE_FILL;
    this.ctx.fill();

    this.ctx.strokeStyle = ROOF_FACE_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.ctx.setLineDash([]);
    this.ctx.stroke();
  }

  /**
   * Draws all ridge / hip / valley / eave lines από `geometry.ridges`.
   * Dashed line, warm dark-red, lineWidth 1.5.
   */
  private drawRidgeLines(roof: RoofEntity): void {
    if (roof.geometry.ridges.length === 0) return;

    this.ctx.save();
    this.ctx.strokeStyle = ROOF_RIDGE_STROKE;
    this.ctx.lineWidth = ROOF_RIDGE_LINE_WIDTH;
    this.ctx.setLineDash(ROOF_RIDGE_DASH as number[]);

    for (const ridge of roof.geometry.ridges) {
      const a = this.worldToScreen({ x: ridge.a.x, y: ridge.a.y });
      const b = this.worldToScreen({ x: ridge.b.x, y: ridge.b.y });
      this.ctx.beginPath();
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * Builds a closed canvas path from a vertex array (xy only — z ignored for 2D).
   * Mirror of SlabRenderer.drawPolygonPath.
   */
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
