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
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { linePatternToDashArray } from '../../config/bim-line-patterns';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { getBeamGrips, beamDepthHandlePosition } from '../beams/beam-grips';
import { getBimEntityKeyPoints2D } from '../utils/bim-entity-points';
import {
  computeBeamHatchPlan,
  resolveBeamMaterialKey,
  BEAM_HATCH_STROKE_RGBA,
  BEAM_HATCH_LINE_WIDTH_PX,
  BEAM_RC_DOT_RADIUS_PX,
  type BeamMaterialKey,
  type BeamHatchPlan,
} from '../beams/beam-hatch-patterns';
import {
  computeIProfileOutline,
  computeHProfileOutline,
  SECTION_PROFILE_W_PX,
  SECTION_PROFILE_H_PX,
  SECTION_WEB_W_PX,
  SECTION_FLANGE_T_PX,
  SECTION_H_FLANGE_T_PX,
  SECTION_OFFSET_PX,
  SECTION_MIN_SCALE,
  SECTION_MIN_BEAM_LEN_PX,
  SECTION_FILL_COLOR,
  SECTION_STROKE_COLOR,
  SECTION_LINE_WIDTH_PX,
  SECTION_SYMBOL_W_MIN_PX,
  SECTION_SYMBOL_W_MAX_PX,
  SECTION_SYMBOL_BEAM_W_RATIO,
} from '../beams/beam-section-profile';

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

// Phase 5.5j — anchor pulse visual constants.
const ANCHOR_PULSE_HZ = 1.2;
const ANCHOR_PULSE_RADIUS_PX = 7;
const ANCHOR_PULSE_LINE_W_PX = 1.5;

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

    // ADR-377 C.2 — hidden-lines subcategory (dashed outline convention).
    const _beamLayer = beam.layerId ? getLayer(beam.layerId) : null;
    const _beamLayerOverride = _beamLayer ? {
      lineweightMm: isConcreteLineweight(_beamLayer.lineweight) ? _beamLayer.lineweight : undefined,
      color: _beamLayer.color ?? undefined,
    } : undefined;
    const _beamZTop = beam.params.topElevation + (beam.params.zOffset ?? 0);
    const _beamDs = useDrawingScaleStore.getState();
    const _beamCutState = resolveCutState(
      { zBottomMm: _beamZTop - beam.params.depth, zTopMm: _beamZTop, category: 'beam' },
      _beamDs.viewRange,
    );
    const { lineWidthPx: _beamPx, linePattern: _beamPat, color: _beamCol } = resolveSubcategoryStyle({
      category: 'beam', subcategoryKey: 'hidden-lines',
      cutState: _beamCutState, scaleDenominator: _beamDs.drawingScale,
      dpi: 96, objectStyles: _beamDs.objectStyles,
      elementOverride: beam.styleOverride, layerOverride: _beamLayerOverride,
    });
    this.ctx.strokeStyle = KIND_STROKE[beam.kind];
    this.ctx.lineWidth = _beamPx;
    this.ctx.setLineDash(linePatternToDashArray(_beamPat) as number[]);
    if (_beamCol !== null) this.ctx.strokeStyle = _beamCol;
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
    // Phase 5.5h — steel I/H section-profile symbol (hover+selection only).
    if (phaseState.phase === 'highlighted') {
      this.drawDepthIndicator(beam);
      this.drawSectionProfile(beam);
      this.drawAnchorPulse(beam);
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
    const [start, end] = getBimEntityKeyPoints2D(beam);
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

    const [start, end] = getBimEntityKeyPoints2D(beam);
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

  /**
   * Phase 5.5h + 5.5j — steel I/H cross-section profile symbol (Revit/Tekla).
   *
   * Symbol size adapts to beam screen width (Phase 5.5j): width is clamped to
   * [SECTION_SYMBOL_W_MIN_PX, SECTION_SYMBOL_W_MAX_PX] so it remains legible
   * across zoom levels. All proportional sub-dimensions (web, flange, offset)
   * scale uniformly with the computed width.
   */
  private drawSectionProfile(beam: BeamEntity): void {
    if (resolveBeamMaterialKey(beam.params.material) !== 'steel') return;
    if (this.transform.scale < SECTION_MIN_SCALE) return;

    const _spDs = useDrawingScaleStore.getState();
    const _spLayer = beam.layerId ? getLayer(beam.layerId) : null;
    const _spLayerOverride = _spLayer ? {
      lineweightMm: isConcreteLineweight(_spLayer.lineweight) ? _spLayer.lineweight : undefined,
      color: _spLayer.color ?? undefined,
    } : undefined;
    const _spZTop = beam.params.topElevation + (beam.params.zOffset ?? 0);
    const _spCutState = resolveCutState(
      { zBottomMm: _spZTop - beam.params.depth, zTopMm: _spZTop, category: 'beam' },
      _spDs.viewRange,
    );
    const { lineWidthPx: _spPx, color: _spCol } = resolveSubcategoryStyle({
      category: 'beam', subcategoryKey: 'section-profile',
      cutState: _spCutState, scaleDenominator: _spDs.drawingScale,
      dpi: 96, objectStyles: _spDs.objectStyles,
      elementOverride: beam.styleOverride, layerOverride: _spLayerOverride,
    });

    const [sp, ep] = getBimEntityKeyPoints2D(beam);

    const startS = this.worldToScreen(sp);
    const endS = this.worldToScreen(ep);
    const dx = endS.x - startS.x;
    const dy = endS.y - startS.y;
    const len = Math.hypot(dx, dy);
    if (len < SECTION_MIN_BEAM_LEN_PX) return;

    // Phase 5.5j — scale-adaptive symbol size: proportional to beam screen
    // width, clamped to [W_MIN, W_MAX] px.
    const beamWidthPx = beam.params.width * this.transform.scale;
    const symW = Math.min(
      Math.max(beamWidthPx * SECTION_SYMBOL_BEAM_W_RATIO, SECTION_SYMBOL_W_MIN_PX),
      SECTION_SYMBOL_W_MAX_PX,
    );
    const symH = symW * (SECTION_PROFILE_H_PX / SECTION_PROFILE_W_PX);
    const symWebW = symW * (SECTION_WEB_W_PX / SECTION_PROFILE_W_PX);
    const symFlangeT = symW * (SECTION_FLANGE_T_PX / SECTION_PROFILE_W_PX);
    const symHFlangeT = symW * (SECTION_H_FLANGE_T_PX / SECTION_PROFILE_W_PX);
    const symOffset = SECTION_OFFSET_PX + (symW - SECTION_PROFILE_W_PX) * 0.3;

    // Perpendicular unit vector (screen space).
    const perpX = -dy / len;
    const perpY = dx / len;

    const midS = { x: (startS.x + endS.x) / 2, y: (startS.y + endS.y) / 2 };
    const beamHalfWidthPx = beamWidthPx / 2;
    const cx = midS.x + perpX * (beamHalfWidthPx + symOffset);
    const cy = midS.y + perpY * (beamHalfWidthPx + symOffset);

    const screenAngle = Math.atan2(dy, dx);
    const isHBeam = (beam.params.sectionType ?? 'I') === 'H';
    const outline = isHBeam
      ? computeHProfileOutline(symW, symH, symWebW, symHFlangeT)
      : computeIProfileOutline(symW, symH, symWebW, symFlangeT);

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(screenAngle + Math.PI / 2);
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.moveTo(outline[0].x, outline[0].y);
    for (let i = 1; i < outline.length; i++) {
      this.ctx.lineTo(outline[i].x, outline[i].y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = SECTION_FILL_COLOR;
    this.ctx.fill();
    this.ctx.strokeStyle = _spCol ?? SECTION_STROKE_COLOR;
    this.ctx.lineWidth = _spPx;
    this.ctx.stroke();
    this.ctx.restore();

    if (beam.params.profileDesignation) {
      const labelOffsetPx = symW / 2 + 8;
      const labelX = cx + perpX * labelOffsetPx;
      const labelY = cy + perpY * labelOffsetPx;
      this.ctx.save();
      this.ctx.font = 'bold 8px sans-serif';
      this.ctx.fillStyle = SECTION_STROKE_COLOR;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(beam.params.profileDesignation, labelX, labelY);
      this.ctx.restore();
    }
  }

  /**
   * Phase 5.5j — pulsing highlight ring at beam anchor points (start / end).
   *
   * Draws a sin-modulated stroke ring at each endpoint while the beam is
   * highlighted. Uses `performance.now()` so the ring pulses when the canvas
   * is in an active RAF loop; falls back to a static glow otherwise. Pure ctx,
   * zero subscriptions — ADR-040 compliant.
   */
  private drawAnchorPulse(beam: BeamEntity): void {
    const t = performance.now() / 1000;
    const alpha = Math.max(0, 0.15 + 0.25 * Math.sin(t * Math.PI * 2 * ANCHOR_PULSE_HZ));

    const pts = getBimEntityKeyPoints2D(beam);
    this.ctx.save();
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = `rgba(30, 60, 160, ${alpha.toFixed(2)})`;
    this.ctx.lineWidth = ANCHOR_PULSE_LINE_W_PX;
    for (const wp of pts) {
      const s = this.worldToScreen(wp);
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, ANCHOR_PULSE_RADIUS_PX, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.restore();
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
