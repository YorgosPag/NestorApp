/**
 * FoundationRenderer — ADR-436 Slice 1.
 *
 * 2D foundation-plan renderer για `FoundationEntity`. Reads `entity.geometry`
 * (populated by `computeFoundationGeometry()` — SSoT) και draws τη διεθνή
 * σύμβαση κάτοψης θεμελίωσης (ISO/DIN/ANSI foundation plan):
 *
 *   - κλειστό footprint polygon με **διακεκομμένη (hidden)** γραμμή — το πέδιλο
 *     είναι κάτω από τη στάθμη, άρα κρυμμένο κάτω από το έδαφος.
 *   - ημιδιάφανο fill (per-kind palette).
 *   - concrete (RC) hatch clipped στο footprint.
 *   - κεντρικός σταυρός (column footprint indicator) — μόνο `pad`.
 *
 * Total over `FoundationKind`: το ίδιο footprint-based draw path καλύπτει pad +
 * strip + tie-beam (το footprint είναι ορθογώνιο και στα 3). Τα line-based kinds
 * (centerline dash-dot) θα προστεθούν στο Slice 2.
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isFoundationEntity } from '../../types/entities';
import type { FoundationEntity } from '../types/foundation-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { resolveVgFillTint } from '../utils/bim-vg-fill-tint';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { FOUNDATION_KIND_FILL } from '../foundations/foundation-render-palette';
import { getFoundationGrips } from '../foundations/foundation-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import {
  computeFoundationHatchPlan,
  FOUNDATION_HATCH_DOT_RADIUS_PX,
  FOUNDATION_HATCH_LINE_WIDTH_PX,
  FOUNDATION_HATCH_STROKE_RGBA,
} from '../foundations/foundation-hatch-patterns';

/** Hidden-line dash pattern (CSS px) — foundation-plan «below grade» σύμβαση. */
const HIDDEN_LINE_DASH: readonly number[] = [6, 4];

/** Κεντρικός σταυρός (column footprint indicator) μισό-μήκος σε CSS px. */
const CENTER_CROSS_HALF_PX = 7;

export class FoundationRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isFoundationEntity(entity)) return;
    const foundation = entity as FoundationEntity;

    // ADR-382 — Unified visibility check (V/G + Layer + Floor + Building).
    const _layer = foundation.layerId ? getLayer(foundation.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'foundation', layerId: foundation.layerId, discipline: foundation.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer: _layer,
      },
    )) return;

    if (!foundation.geometry || !foundation.params) return;
    const verts = foundation.geometry.footprint.vertices;
    if (verts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo via outline thicker glow (solid — δεν διακεκομμένο για ευκρίνεια).
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

    // Fill first, hatch clipped inside, dashed stroke on top.
    const _styles = useDrawingScaleStore.getState().objectStyles;
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = resolveVgFillTint('foundation', 'cut', _styles) ?? FOUNDATION_KIND_FILL[foundation.kind];
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // Concrete (RC) hatch — clipped στο footprint.
    this.drawConcreteHatch(foundation);

    // Dashed hidden-line outline (color + weight via SSoT subcategory resolver).
    const _layerOverride = _layer ? {
      lineweightMm: isConcreteLineweight(_layer.lineweight) ? _layer.lineweight : undefined,
      color: _layer.color ?? undefined,
    } : undefined;
    const { lineWidthPx, color } = resolveSubcategoryStyle({
      category: 'foundation', subcategoryKey: 'hidden-lines',
      cutState: 'cut', scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      dpi: 96, objectStyles: _styles,
      elementOverride: foundation.styleOverride, layerOverride: _layerOverride,
    });
    this.ctx.lineWidth = lineWidthPx;
    if (color !== null) this.ctx.strokeStyle = color;
    this.ctx.setLineDash(HIDDEN_LINE_DASH as number[]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();

    // Κεντρικός σταυρός (column footprint indicator) — μόνο pad.
    if (foundation.kind === 'pad') {
      this.drawCenterCross(foundation);
    }

    this.finalizeRender(entity, options);
  }

  /**
   * Concrete (RC) dot-grid hatch inside footprint clip. Mirror του
   * `ColumnRenderer.drawMaterialHatch` (RC branch). Skip σε invisible zoom-out.
   */
  private drawConcreteHatch(foundation: FoundationEntity): void {
    if (this.transform.scale < 0.001) return;
    const plan = computeFoundationHatchPlan(foundation.geometry.bbox);
    if (plan.dots.length === 0 && plan.lines.length === 0) return;

    this.ctx.save();
    this.drawPolygonPath(foundation.geometry.footprint.vertices);
    this.ctx.clip();
    this.ctx.strokeStyle = FOUNDATION_HATCH_STROKE_RGBA;
    this.ctx.fillStyle = FOUNDATION_HATCH_STROKE_RGBA;
    this.ctx.lineWidth = FOUNDATION_HATCH_LINE_WIDTH_PX;
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
      this.ctx.arc(s.x, s.y, FOUNDATION_HATCH_DOT_RADIUS_PX, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  /**
   * Κεντρικός σταυρός στο `position` του pad — υποδηλώνει το ίχνος της κολώνας
   * που εδράζεται πάνω στο πέδιλο (foundation-plan convention).
   */
  private drawCenterCross(foundation: FoundationEntity): void {
    if (foundation.params.kind !== 'pad') return;
    const c = this.worldToScreen({
      x: foundation.params.position.x,
      y: foundation.params.position.y,
    });
    this.ctx.save();
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    this.ctx.lineWidth = 0.8;
    this.ctx.beginPath();
    this.ctx.moveTo(c.x - CENTER_CROSS_HALF_PX, c.y);
    this.ctx.lineTo(c.x + CENTER_CROSS_HALF_PX, c.y);
    this.ctx.moveTo(c.x, c.y - CENTER_CROSS_HALF_PX);
    this.ctx.lineTo(c.x, c.y + CENTER_CROSS_HALF_PX);
    this.ctx.stroke();
    this.ctx.restore();
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-436 Slice 1b — parametric foundation pad grips (rotation / width / length).
    // Commit routed through `applyFoundationGripDrag()` + `UpdateFoundationParamsCommand`
    // by `commitFoundationGripDrag` (grip-parametric-commits). Declutter: central
    // MOVE grip not emitted — Alt+drag moves the pad. strip/tie-beam = Slice 2.
    if (!isFoundationEntity(entity)) return [];
    return getFoundationGrips(entity as FoundationEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: 'vertex' as const,
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
      // ADR-397 — rotation handle gets the curved-arrow glyph via the shared
      // registry SSoT; width/length stay square.
      shape: gripGlyphShape(g.foundationGripKind),
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isFoundationEntity(entity)) return false;
    const foundation = entity as FoundationEntity;
    const bb = foundation.geometry?.bbox;
    if (!bb) return false;
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }
    return pointInPolygon(point, foundation.geometry.footprint.vertices);
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
