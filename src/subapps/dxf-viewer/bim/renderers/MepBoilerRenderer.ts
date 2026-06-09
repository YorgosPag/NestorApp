/**
 * MepBoilerRenderer — ADR-408 Εύρος Β #2.
 *
 * 2D plan-view renderer for `MepBoilerEntity`. Reads `entity.geometry`
 * (populated by `computeMepBoilerGeometry()` — SSoT) and draws:
 *   - the cabinet footprint outline (rectangle)
 *   - a translucent warm-red fill
 *   - the boiler symbol strokes (horizontal divider + flame glyph + supply/return
 *     stubs), from the `buildMepBoilerSymbol` SSoT (shared with the placement ghost)
 *   - a hover halo when highlighted
 *
 * ADR-040 micro-leaf compliance: pure renderer class with ZERO subscriptions —
 * state read synchronously at draw time via `useDrawingScaleStore.getState()`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isMepBoilerEntity } from '../../types/entities';
import type { MepBoilerEntity } from '../types/mep-boiler-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { buildMepBoilerSymbol } from '../mep-boilers/mep-boiler-symbol';
import { resolveBoilerTagLines } from '../mep-boilers/mep-boiler-tag';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';

/**
 * Boiler palette — hydronic heating source (warm red). A boiler is the SOURCE of a
 * hydronic supply network, so it keeps a fixed warm-red identity matching the
 * radiator palette — both are "heating equipment" regardless of the pipe circuit
 * colours on its connectors.
 */
const BOILER_STROKE = '#dc2626';
const BOILER_FILL = 'rgba(220, 38, 38, 0.16)';

// ─── Plan-tag styling (Revit «Mechanical Equipment Tag») ─────────────────────
// Fixed-pixel / zoom-invariant, mirroring `MepSegmentRenderer.drawSlopeIndicatorScreen`.
/** Below this zoom scale the tag is hidden to reduce clutter (mirrors `OPENING_TAG_MIN_ZOOM`). */
const TAG_MIN_ZOOM = 0.1;
/** Screen-px push of the tag box away from the boiler bbox corner (leader length). */
const TAG_LEADER_OFFSET_PX = 24;
/** Tag text font (screen-px, sans-serif) — same family/scale family as the slope label. */
const TAG_FONT = '11px sans-serif';
/** Screen-px line height for stacked tag lines. */
const TAG_LINE_HEIGHT_PX = 14;
/** Screen-px padding inside the tag box. */
const TAG_PADDING_PX = 5;
/** Neutral translucent background so the tag stays legible over geometry. */
const TAG_BG_COLOR = 'rgba(255, 255, 255, 0.92)';
/** Dark neutral text colour. */
const TAG_TEXT_COLOR = '#1f2937';

export class MepBoilerRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isMepBoilerEntity(entity)) return;
    const boiler = entity as MepBoilerEntity;

    // ADR-382/405 — unified visibility check (V/G + Layer + Floor + Building +
    // Discipline). 'mep-boiler' → plumbing via DISCIPLINE_BY_CATEGORY.
    const layer = boiler.layerId ? getLayer(boiler.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'mep-boiler', layerId: boiler.layerId, discipline: boiler.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer,
      },
    )) return;

    if (!boiler.geometry || !boiler.params) return;
    const verts = boiler.geometry.footprint.vertices;
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

    // Fill + outline — warm-red heating equipment (boiler = hydronic source).
    this.ctx.fillStyle = BOILER_FILL;
    this.drawPolygonPath(verts);
    this.ctx.fill();
    this.ctx.strokeStyle = BOILER_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.drawPolygonPath(verts);
    this.ctx.stroke();

    // Boiler symbol — connector-driven pipe stubs + flue vent glyph + divider/flame glyph.
    const symbol = buildMepBoilerSymbol(boiler.params, boiler.geometry);
    for (const stroke of symbol.strokes) {
      this.drawStroke(stroke);
    }
    // Combustion flue (καπναγωγός) vent glyph — same warm-red stroke, NORMAL weight so the
    // exhaust duct reads as a connector (its chevron arrowhead distinguishes it from pipes).
    for (const stroke of symbol.ventStrokes) {
      this.drawStroke(stroke);
    }
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    for (const stroke of symbol.glyphStrokes) {
      this.drawStroke(stroke);
    }

    this.ctx.restore();

    // Plan tag (Revit «Mechanical Equipment Tag») — leader + boxed model/power/fuel/flue.
    this.drawTag(boiler);

    this.finalizeRender(entity, options);
  }

  getGrips(_entity: EntityModel): GripInfo[] {
    // ADR-408 Εύρος Β #2 — grips (move/rotation/resize) are handled by a separate
    // agent slice (mep-boiler-grips.ts + UpdateMepBoilerParamsCommand). This renderer
    // returns an empty array until that slice lands; the grip system falls through
    // gracefully (no grips shown = no crash).
    return [];
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isMepBoilerEntity(entity)) return false;
    const boiler = entity as MepBoilerEntity;
    const bb = boiler.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    return pointInPolygon(point, boiler.geometry.footprint.vertices);
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** Stroke a world-space polyline (symbol stub / glyph) at the current style. */
  private drawStroke(stroke: ReadonlyArray<{ x: number; y: number }>): void {
    if (stroke.length < 2) return;
    this.ctx.beginPath();
    const start = this.worldToScreen({ x: stroke[0].x, y: stroke[0].y });
    this.ctx.moveTo(start.x, start.y);
    for (let i = 1; i < stroke.length; i++) {
      const s = this.worldToScreen({ x: stroke[i].x, y: stroke[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.stroke();
  }

  /**
   * Draw the plan tag in SCREEN space (fixed-pixel, zoom-invariant): a leader from
   * the boiler bbox top-right corner to a boxed, left-aligned stack of lines
   * (model / power kW / fuel / flue Ø). Content comes from the `mep-boiler-tag`
   * SSoT; this method owns layout + styling only. Hidden below `TAG_MIN_ZOOM`.
   */
  private drawTag(boiler: MepBoilerEntity): void {
    if (this.transform.scale < TAG_MIN_ZOOM) return;
    const lines = resolveBoilerTagLines(boiler.params);
    if (lines.length === 0) return;
    const bb = boiler.geometry?.bbox;
    if (!bb) return;

    // Anchor = bbox top-right corner; the box sits up-and-right of it.
    const anchor = this.worldToScreen({ x: bb.max.x, y: bb.max.y });
    const boxLeft = anchor.x + TAG_LEADER_OFFSET_PX;
    const boxBottom = anchor.y - TAG_LEADER_OFFSET_PX;

    this.ctx.save();
    this.ctx.setLineDash([]);
    this.ctx.font = TAG_FONT;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    let maxWidth = 0;
    for (const line of lines) {
      maxWidth = Math.max(maxWidth, this.ctx.measureText(line).width);
    }
    const boxW = maxWidth + TAG_PADDING_PX * 2;
    const boxH = lines.length * TAG_LINE_HEIGHT_PX + TAG_PADDING_PX * 2;
    const boxTop = boxBottom - boxH;

    // Leader from the boiler corner to the box bottom-left corner.
    this.ctx.strokeStyle = BOILER_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.ctx.beginPath();
    this.ctx.moveTo(anchor.x, anchor.y);
    this.ctx.lineTo(boxLeft, boxBottom);
    this.ctx.stroke();

    // Box background + warm-red border.
    this.ctx.fillStyle = TAG_BG_COLOR;
    this.ctx.fillRect(boxLeft, boxTop, boxW, boxH);
    this.ctx.strokeRect(boxLeft, boxTop, boxW, boxH);

    // Text lines.
    this.ctx.fillStyle = TAG_TEXT_COLOR;
    const textX = boxLeft + TAG_PADDING_PX;
    for (let i = 0; i < lines.length; i++) {
      const textY = boxTop + TAG_PADDING_PX + i * TAG_LINE_HEIGHT_PX;
      this.ctx.fillText(lines[i], textX, textY);
    }
    this.ctx.restore();
  }

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
