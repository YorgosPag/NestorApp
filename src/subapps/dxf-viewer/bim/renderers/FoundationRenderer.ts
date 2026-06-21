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
import { isStructuralComponentVisible } from '../visibility/structural-component-visibility';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { FOUNDATION_KIND_FILL, FOUNDATION_KIND_STROKE } from '../foundations/foundation-render-palette';
import { getFoundationGrips } from '../foundations/foundation-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { drawEntityDimLabel } from '../labels/bim-dim-labels';
// ADR-507 Φ7 — unified material poché (αντικαθιστά το foundation-hatch-patterns engine).
import { computeMaterialHatchSegments } from '../geometry/shared/material-hatch-geometry';
import { paintMaterialHatchSegments } from './shared/material-hatch-paint';

/** Hidden-line dash pattern (CSS px) — foundation-plan «below grade» σύμβαση. */
const HIDDEN_LINE_DASH: readonly number[] = [6, 4];

/** Centerline dash-dot pattern (CSS px) — άξονας πεδιλοδοκού/συνδετήριας (ISO). */
const CENTERLINE_DASH_DOT: readonly number[] = [12, 3, 3, 3];

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

    // ADR-470 — core (σώμα πεδίλου) component gate. Κρυμμένο → παραλείπουμε το σχέδιο
    // του σώματος· ο οπλισμός θεμελίωσης (scene-level overlay) προβάλλεται ανεξάρτητα.
    if (!isStructuralComponentVisible('core', foundation)) {
      this.finalizeRender(entity, options);
      return;
    }

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
    // ADR-445 — per-kind fill (pad/strip/tie-beam ΔΙΑΚΡΙΤΑ). NOTE: the category
    // V/G tint is intentionally NOT consulted here — it returns ONE sienna for the
    // whole category (frozen in persisted objectStyles) and would erase the per-kind
    // distinction (Giorgio: «συνδετήριες == πεδιλοδοκοί»). Per-element/layer overrides
    // are honoured by the stroke; the fill follows the kind identity.
    this.ctx.fillStyle = FOUNDATION_KIND_FILL[foundation.kind];
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // Concrete (RC) hatch — clipped στο footprint.
    this.drawConcreteHatch(foundation);

    // Dashed hidden-line outline (color + weight via SSoT subcategory resolver).
    const _layerOverride = _layer ? {
      lineweightMm: isConcreteLineweight(_layer.lineweight) ? _layer.lineweight : undefined,
      color: _layer.color ?? undefined,
    } : undefined;
    // Weight via SSoT resolver; COLOUR via per-kind sienna palette (ADR-445 —
    // pad/strip/tie-beam must read as DISTINCT shades· explicit element/layer
    // overrides still win, see kindStrokeColor).
    const { lineWidthPx } = resolveSubcategoryStyle({
      category: 'foundation', subcategoryKey: 'hidden-lines',
      cutState: 'cut', scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      dpi: 96, objectStyles: _styles,
      elementOverride: foundation.styleOverride, layerOverride: _layerOverride,
    });
    this.ctx.lineWidth = lineWidthPx;
    this.ctx.strokeStyle = this.kindStrokeColor(foundation, _layer);
    this.ctx.setLineDash(HIDDEN_LINE_DASH as number[]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    this.ctx.restore();

    // Κεντρικός σταυρός (column footprint indicator) — μόνο pad.
    if (foundation.kind === 'pad') {
      this.drawCenterCross(foundation);
    }

    // Centerline (dash-dot άξονας) — μόνο line-based kinds (strip / tie-beam).
    if (foundation.kind !== 'pad') {
      this.drawCenterline(foundation);
    }

    // Revit-style centred dimension pill (hover/select) — shared SSoT.
    if (phaseState.phase === 'highlighted' || options.selected) {
      drawEntityDimLabel(this.ctx, foundation, foundation.geometry.bbox, (p) => this.worldToScreen(p));
    }

    this.finalizeRender(entity, options);
  }

  /**
   * Concrete poché inside footprint (ADR-507 Φ7 unified). Το θεμέλιο είναι πάντα
   * σκυρόδεμα σε τομή → AR-CONC μέσω του `MATERIAL_HATCH_MAP` SSoT. Τα segments
   * έρχονται ήδη clipped στο footprint (μηδέν `ctx.clip()`). Skip σε zoom-out.
   */
  private drawConcreteHatch(foundation: FoundationEntity): void {
    if (this.transform.scale < 0.001) return;
    const segments = computeMaterialHatchSegments(
      [foundation.geometry.footprint.vertices], 'concrete', 'cut',
    );
    paintMaterialHatchSegments(this.ctx, segments, (p) => this.worldToScreen(p));
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

  /**
   * Centerline (dash-dot άξονας) για line-based πέδιλα (strip / tie-beam) — ISO
   * foundation-plan σύμβαση (διακεκομμένο band + κεντρικός άξονας). Color +
   * weight μέσω SSoT subcategory resolver (`'centerline'`).
   */
  private drawCenterline(foundation: FoundationEntity): void {
    const { params } = foundation;
    if (params.kind === 'pad') return;
    const a = this.worldToScreen({ x: params.start.x, y: params.start.y });
    const b = this.worldToScreen({ x: params.end.x, y: params.end.y });
    const { lineWidthPx } = resolveSubcategoryStyle({
      category: 'foundation', subcategoryKey: 'centerline',
      cutState: 'cut', scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      dpi: 96, objectStyles: useDrawingScaleStore.getState().objectStyles,
      elementOverride: foundation.styleOverride,
    });
    this.ctx.save();
    this.ctx.lineWidth = lineWidthPx;
    this.ctx.strokeStyle = this.kindStrokeColor(foundation);
    this.ctx.setLineDash(CENTERLINE_DASH_DOT as number[]);
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
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

  /**
   * Per-kind sienna stroke (ADR-445) — pad/strip/tie-beam read as DISTINCT shades
   * (`FOUNDATION_KIND_STROKE` SSoT). Explicit per-element (`styleOverride.color`)
   * and Layer colours still win, mirroring the V/G-override precedence; the V/G
   * *category* colour is intentionally superseded by the per-kind identity.
   */
  private kindStrokeColor(
    foundation: FoundationEntity,
    layer: ReturnType<typeof getLayer> = foundation.layerId ? getLayer(foundation.layerId) : null,
  ): string {
    return foundation.styleOverride?.color
      ?? layer?.color
      ?? FOUNDATION_KIND_STROKE[foundation.kind];
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
