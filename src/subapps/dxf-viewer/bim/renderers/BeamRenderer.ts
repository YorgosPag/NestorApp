/**
 * BeamRenderer — ADR-363 Phase 5 + 5.5c.
 *
 * 2D plan-view renderer για `BeamEntity`. Reads `entity.geometry`
 * (populated by `computeBeamGeometry()` — SSoT) και draws:
 *   - dashed outline polygon (industry convention για beam hidden above
 *     floor — dashed stroke + light translucent fill)
 *   - per-material hatch pattern (Phase 5.5c) — polygon-clipped pass μεταξύ
 *     fill και stroke, mirror του Phase 4.5c.2 `ColumnRenderer.drawMaterialHatch`.
 *   - axis centerline (thinner dashed)
 *   - hover halo via outline glow
 *   - depth indicator (Phase 5.5c) — dashed leader line + "d=X" label από
 *     axis midpoint προς το depth handle, μόνο όταν highlighted. Communicates
 *     το out-of-plane structural depth που δεν είναι ορατό σε plan view.
 *
 * Per-kind palette:
 *   - straight    → steel grey (γενική RC δοκός)
 *   - curved      → warm brown (καμπυλωτή — visual distinction)
 *   - cantilever  → red-accent (πρόβολος — emphasize structural risk)
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions
 * σε high-frequency stores. Called by canvas με entity resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5.5c
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isBeamEntity } from '../../types/entities';
import type { BeamEntity, BeamKind } from '../types/beam-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getBeamGrips, beamDepthHandlePosition } from '../beams/beam-grips';
import {
  computeBeamHatchPlan,
  resolveBeamMaterialKey,
  BEAM_HATCH_STROKE_RGBA,
  BEAM_HATCH_LINE_WIDTH_PX,
  BEAM_RC_DOT_RADIUS_PX,
  type BeamMaterialKey,
  type BeamHatchPlan,
} from '../beams/beam-hatch-patterns';

/** Stroke colour per kind. */
const KIND_STROKE: Readonly<Record<BeamKind, string>> = {
  'straight':   '#5b6478',
  'curved':     '#8a5a2b',
  'cantilever': '#9a3a3a',
};

/** Translucent fill (rgba) per kind. ~15% opacity — lighter than column/slab
 *  γιατί το beam είναι "hidden above" στο plan view. */
const KIND_FILL: Readonly<Record<BeamKind, string>> = {
  'straight':   'rgba(140, 158, 178, 0.15)',
  'curved':     'rgba(192, 140, 70, 0.15)',
  'cantilever': 'rgba(192, 80, 80, 0.15)',
};

const OUTLINE_DASH: readonly [number, number] = [8, 4];
const AXIS_DASH: readonly [number, number] = [4, 3];

export class BeamRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isBeamEntity(entity)) return;
    const beam = entity as BeamEntity;
    if (!beam.geometry || !beam.params) return;
    const verts = beam.geometry.outline.vertices;
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

    // Translucent fill first.
    this.ctx.fillStyle = KIND_FILL[beam.kind];
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // Phase 5.5c — per-material hatch clipped inside footprint.
    this.drawMaterialHatch(beam);

    // Dashed outline (industry convention για hidden beam in plan view).
    this.ctx.strokeStyle = KIND_STROKE[beam.kind];
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.ctx.setLineDash(OUTLINE_DASH as unknown as number[]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Axis centerline — thinner dashed.
    const axis = beam.geometry.axisPolyline.points;
    if (axis.length >= 2) {
      this.ctx.setLineDash(AXIS_DASH as unknown as number[]);
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
      this.drawPolyline(axis);
    }

    this.ctx.restore();

    // Phase 5.5c — depth indicator (out-of-plane visual hint) μόνο όταν
    // highlighted. Renderάρει dashed leader line από axis midpoint προς το
    // depth handle + label "d=Xmm". Outside save/restore ώστε να μη
    // κληρονομεί το dash pattern του outline.
    if (phaseState.phase === 'highlighted') {
      this.drawDepthIndicator(beam);
    }

    this.finalizeRender(entity, options);
  }

  /**
   * Phase 5.5c — per-material hatch pattern inside footprint clip. Mirror του
   * `ColumnRenderer.drawMaterialHatch` (Phase 4.5c.2). Axis orientation
   * περνάει στο pattern computer ώστε `glulam` grain να ευθυγραμμίζεται με
   * την κατεύθυνση του δοκαριού. Skip σε extreme zoom-out (perf saver).
   */
  private drawMaterialHatch(beam: BeamEntity): void {
    if (this.transform.scale < 0.001) return;

    const key: BeamMaterialKey = resolveBeamMaterialKey(beam.params.material);
    const start = beam.params.startPoint;
    const end = beam.params.endPoint;
    const plan: BeamHatchPlan = computeBeamHatchPlan(
      beam.geometry.bbox,
      { ux: end.x - start.x, uy: end.y - start.y },
      key,
    );

    if (plan.lines.length === 0 && plan.dots.length === 0) return;

    this.ctx.save();
    this.drawPolygonPath(beam.geometry.outline.vertices);
    this.ctx.clip();
    this.ctx.strokeStyle = BEAM_HATCH_STROKE_RGBA;
    this.ctx.fillStyle = BEAM_HATCH_STROKE_RGBA;
    this.ctx.lineWidth = BEAM_HATCH_LINE_WIDTH_PX[key];
    this.ctx.setLineDash([]);

    for (const line of plan.lines) {
      const a = this.worldToScreen(line.start);
      const b = this.worldToScreen(line.end);
      this.ctx.beginPath();
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();
    }
    for (const dot of plan.dots) {
      const s = this.worldToScreen(dot.center);
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, BEAM_RC_DOT_RADIUS_PX, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  /**
   * Phase 5.5c — out-of-plane depth indicator. Dashed leader line από axis
   * midpoint προς το `beam-depth` grip θέση + small label "d=Xmm" δίπλα στο
   * grip. Communicates ότι το depth ζει στον z-axis (δεν φαίνεται σε plan).
   * Renderάρει μόνο όταν highlighted ώστε να μην προσθέτει visual noise.
   * Skip σε degenerate axis (depth handle position = null).
   */
  private drawDepthIndicator(beam: BeamEntity): void {
    const handlePos = beamDepthHandlePosition(beam.params);
    if (!handlePos) return;

    const start = beam.params.startPoint;
    const end = beam.params.endPoint;
    const midWorld: Point2D = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const a = this.worldToScreen(midWorld);
    const b = this.worldToScreen(handlePos);

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    this.ctx.lineWidth = 0.8;
    this.ctx.setLineDash([3, 3]);
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.save();
    this.ctx.font = '9px sans-serif';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.70)';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    const label = `d=${Math.round(beam.params.depth)}`;
    this.ctx.fillText(label, b.x + 6, b.y);
    this.ctx.restore();
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-363 Phase 5.5a + 5.5b + 5.5c — parametric beam grips (start / end /
    // midpoint / curve control + width + depth dimension handles). Commit
    // routed through `applyBeamGripDrag()` + `UpdateBeamParamsCommand` by
    // `commitBeamGripDrag` (grip-commit-adapter). Mapping below is generic:
    // `center` → 'center' (midpoint translate), όλα τα υπόλοιπα
    // ('vertex' / 'edge') → 'vertex' στο canvas renderer.
    if (!isBeamEntity(entity)) return [];
    return getBeamGrips(entity as BeamEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isBeamEntity(entity)) return false;
    const beam = entity as BeamEntity;
    const bb = beam.geometry?.bbox;
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
    // Detailed point-in-polygon test (ray casting) on outline.
    const verts = beam.geometry.outline.vertices;
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

  private drawPolyline(points: ReadonlyArray<{ x: number; y: number }>): void {
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
