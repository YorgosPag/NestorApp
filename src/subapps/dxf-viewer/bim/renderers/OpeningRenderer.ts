/**
 * OpeningRenderer — ADR-363 Phase 2 (G3).
 *
 * 2D plan-view renderer για `OpeningEntity`. Reads `entity.geometry`
 * (populated by `computeOpeningGeometry()` — the SSoT) and draws:
 *   - cutout rectangle outline (solid, thin)
 *   - kind-specific overlay:
 *       · door / french-door → dashed hinge swing arc + jamb leaf line
 *       · window / fixed → double-line glazing inside the outline
 *       · sliding-door → split mid-line + slide arrows
 *
 * Phase 2 NOT implemented (deferred):
 *   - Boolean cutout στο wall fill (visual "hole" — currently the opening
 *     is rendered ON TOP of the wall fill; renders correctly but the wall
 *     fill remains unbroken underneath).
 *   - Move-along-wall grips (Phase 2.5).
 *
 * ADR-040 micro-leaf compliance: pure renderer class; ZERO subscriptions to
 * high-frequency stores. Called by the canvas with the entity resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isOpeningEntity } from '../../types/entities';
import type { OpeningEntity, OpeningKind } from '../types/opening-types';
import { isHingedKind, isGlazedKind } from '../types/opening-types';
import type { Point3D } from '../types/bim-base';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { HOVER_HIGHLIGHT } from '../../config/color-config';

/** Stroke colour per kind (industry convention — door warm, window cool). */
const KIND_STROKE: Readonly<Record<OpeningKind, string>> = {
  'door':         '#c97c2f', // burnt orange (timber door)
  'window':       '#2d72b8', // cool blue (glazed)
  'sliding-door': '#7c5fa1', // muted purple (sliding rail)
  'french-door':  '#b96b2c', // amber (double-leaf timber)
  'fixed':        '#3d7a6f', // teal (fixed glazing)
};

const HINGE_DASH: readonly [number, number] = [4, 3];
const SLIDING_DASH: readonly [number, number] = [10, 4];
const GLAZING_INSET_RATIO = 0.25; // 25% of thickness inset for double-line glass

export class OpeningRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isOpeningEntity(entity)) return;
    const opening = entity as OpeningEntity;
    if (!opening.geometry || !opening.params) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo: outline thicker + glow colour.
    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawOutline(opening);
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.strokeStyle = KIND_STROKE[opening.kind];
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;

    this.drawOutline(opening);
    this.drawKindOverlay(opening);
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // Phase 2.5 — drag-along-wall grips. Phase 2 returns empty.
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isOpeningEntity(entity)) return false;
    const opening = entity as OpeningEntity;
    const bb = opening.geometry?.bbox;
    if (!bb) return false;
    return (
      point.x >= bb.min.x - tolerance &&
      point.x <= bb.max.x + tolerance &&
      point.y >= bb.min.y - tolerance &&
      point.y <= bb.max.y + tolerance
    );
  }

  // ─── Internal drawing helpers ──────────────────────────────────────────────

  private drawOutline(opening: OpeningEntity): void {
    const vertices = opening.geometry.outline.vertices;
    if (vertices.length < 3) return;
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: vertices[0].x, y: vertices[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i++) {
      const s = this.worldToScreen({ x: vertices[i].x, y: vertices[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private drawKindOverlay(opening: OpeningEntity): void {
    if (isHingedKind(opening.kind)) {
      this.drawHingeArc(opening);
      return;
    }
    if (opening.kind === 'sliding-door') {
      this.drawSlidingIndicator(opening);
      return;
    }
    if (isGlazedKind(opening.kind)) {
      this.drawGlazing(opening);
    }
  }

  /** Dashed quarter-arc swing indicator for door / french-door. */
  private drawHingeArc(opening: OpeningEntity): void {
    const arc = opening.geometry.hingeArc;
    if (!arc || arc.points.length < 2) return;
    this.ctx.save();
    this.ctx.setLineDash(HINGE_DASH as unknown as number[]);
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.drawPolyline(arc.points);
    this.ctx.restore();
  }

  /** Sliding-door visual cue: long-dashed line down the middle. */
  private drawSlidingIndicator(opening: OpeningEntity): void {
    const verts = opening.geometry.outline.vertices;
    if (verts.length < 4) return;
    // Outline order is start-outer, end-outer, end-inner, start-inner.
    // Midpoints of the two long edges form the slide track.
    const mid = (a: Point3D, b: Point3D): Point3D => ({
      x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0,
    });
    const trackStart = mid(verts[0], verts[3]);
    const trackEnd = mid(verts[1], verts[2]);
    this.ctx.save();
    this.ctx.setLineDash(SLIDING_DASH as unknown as number[]);
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.drawPolyline([trackStart, trackEnd]);
    this.ctx.restore();
  }

  /** Glazed visual: inset double-line inside the outline. */
  private drawGlazing(opening: OpeningEntity): void {
    const verts = opening.geometry.outline.vertices;
    if (verts.length < 4) return;
    // Inset the outline by GLAZING_INSET_RATIO toward the centroid.
    const cx = (verts[0].x + verts[1].x + verts[2].x + verts[3].x) / 4;
    const cy = (verts[0].y + verts[1].y + verts[2].y + verts[3].y) / 4;
    const inset: Point3D[] = verts.map((v) => ({
      x: v.x + (cx - v.x) * GLAZING_INSET_RATIO,
      y: v.y + (cy - v.y) * GLAZING_INSET_RATIO,
      z: 0,
    }));
    this.ctx.save();
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: inset[0].x, y: inset[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < inset.length; i++) {
      const s = this.worldToScreen({ x: inset[i].x, y: inset[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawPolyline(points: ReadonlyArray<Point3D>): void {
    if (points.length < 2) return;
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: points[0].x, y: points[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const s = this.worldToScreen({ x: points[i].x, y: points[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.stroke();
  }
}
