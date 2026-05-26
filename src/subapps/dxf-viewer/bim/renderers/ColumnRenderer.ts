/**
 * ColumnRenderer — ADR-363 Phase 4.
 *
 * 2D plan-view renderer για `ColumnEntity`. Reads `entity.geometry`
 * (populated by `computeColumnGeometry()` — SSoT) και draws:
 *   - closed footprint polygon outline (stroke per-kind colour)
 *   - translucent fill per kind
 *   - per-material hatch (Phase 4.5c.2/4.5c.3)
 *   - variant dimension labels for L/T when highlighted (Phase 4.5c.3)
 *
 * Per-kind palette (industry convention — RC συμπαγή φόντα, steel cooler):
 *   - rectangular → cool grey (γενική RC κολώνα)
 *   - circular    → RC grey (φέροντα κολώνα)
 *   - L-shape     → ochre (γωνία)
 *   - T-shape     → steel-blue
 *   - polygon     → warm green (decorative, ADR-363 Phase 8)
 *   - shear-wall  → deep RC grey (structural emphasis, ADR-363 Phase 8)
 *   - I-shape     → cool steel (industrial, ADR-363 Phase 8)
 *
 * Phase 4.5 (DONE): center / rotation / width / depth grips.
 * Phase 4.5b (DONE): variant-specific grips (L-shape arm / T-shape flange).
 * Phase 4.5c.1 (DONE): anchor ghost preview via `ColumnAnchorGhostRenderer`.
 * Phase 4.5c.2 (DONE): per-material hatch for non-circular kinds.
 * Phase 4.5c.3 (DONE): circular column hatch (RC concentric rings; steel/masonry/
 *   wood via bbox clip) + variant dimension labels for L/T highlighted state.
 * Phase 4.5c.4 (deferred): snap-to-wall-corners + grid-intersections.
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isColumnEntity } from '../../types/entities';
import type { ColumnEntity, ColumnKind } from '../types/column-types';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveLineWeightPx, resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getColumnGrips } from '../columns/column-grips';
import {
  computeHatchPlan,
  computeCircularHatchPlan,
  resolveMaterialKey,
  HATCH_STROKE_RGBA,
  HATCH_LINE_WIDTH_PX,
  RC_DOT_RADIUS_PX,
  type ColumnMaterialKey,
  type HatchPlan,
} from '../columns/column-hatch-patterns';
import {
  computeLProfileOutline,
  computeTProfileOutline,
  COL_SECTION_OFFSET_PX,
  COL_SECTION_MIN_SCALE,
  COL_SECTION_MIN_FOOTPRINT_PX,
  COL_SECTION_FILL_COLOR,
  COL_SECTION_STROKE_COLOR,
  COL_SECTION_LINE_WIDTH_PX,
} from '../columns/column-section-profile';
import {
  formatColumnDimLabels,
  drawColumnDimPill,
  COLUMN_LABEL_MIN_FOOTPRINT_PX,
} from '../columns/column-dim-labels';

/** Stroke colour per kind. */
const KIND_STROKE: Readonly<Record<ColumnKind, string>> = {
  'rectangular': '#5b6478',
  'circular':    '#3a3a40',
  'L-shape':     '#a07a2b',
  'T-shape':     '#3a5a78',
  'polygon':     '#5c8a3a',
  'shear-wall':  '#3a4048',
  'I-shape':     '#4a4a52',
};

/** Translucent fill (rgba) per kind. ~22% opacity. */
const KIND_FILL: Readonly<Record<ColumnKind, string>> = {
  'rectangular': 'rgba(140, 158, 178, 0.22)',
  'circular':    'rgba(96, 96, 102, 0.22)',
  'L-shape':     'rgba(192, 148, 56, 0.22)',
  'T-shape':     'rgba(110, 140, 178, 0.22)',
  'polygon':     'rgba(120, 170, 90, 0.22)',
  'shear-wall':  'rgba(70, 80, 90, 0.25)',
  'I-shape':     'rgba(95, 95, 110, 0.20)',
};

export class ColumnRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isColumnEntity(entity)) return;
    const column = entity as ColumnEntity;
    if (!column.geometry || !column.params) return;
    const verts = column.geometry.footprint.vertices;
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
    // Fill first, hatch clipped inside, stroke on top so outline stays sharp.
    this.ctx.fillStyle = KIND_FILL[column.kind];
    this.drawPolygonPath(verts);
    this.ctx.fill();

    // Phase 4.5c.2/4.5c.3 — per-material hatch (all kinds, incl. circular).
    this.drawMaterialHatch(column);

    this.ctx.strokeStyle = KIND_STROKE[column.kind];
    const _colCutState = resolveCutState(
      { zBottomMm: column.params.baseOffset ?? 0, zTopMm: (column.params.baseOffset ?? 0) + column.params.height, category: 'column' },
      useDrawingScaleStore.getState().viewRange,
    );
    this.ctx.lineWidth = resolveLineWeightPx({ category: 'column', cutState: _colCutState, scaleDenominator: useDrawingScaleStore.getState().drawingScale, dpi: 96, objectStyles: useDrawingScaleStore.getState().objectStyles });
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.restore();

    // Phase 4.5c.3 + 4.5c.6 — variant labels + section-profile symbol (L/T when highlighted).
    if (phaseState.phase === 'highlighted') {
      this.drawVariantDimensionLabels(column);
      this.drawSectionProfile(column);
    }

    // Phase 8F — centred dimension pill (Revit-style): visible when hovered OR selected.
    if (phaseState.phase === 'highlighted' || options.selected) {
      this.drawCenterDimLabel(column);
    }

    this.finalizeRender(entity, options);
  }

  /**
   * Phase 4.5c.2/4.5c.3 — per-material hatch pattern inside footprint clip.
   * Mirror του `SlabRenderer.drawReinforcementHatch` pattern.
   *
   * Circular kind (Phase 4.5c.3): routes through `computeCircularHatchPlan()`
   *   which returns concentric arcs for RC, bbox-clipped lines for others.
   * Non-circular: routes through `computeHatchPlan(bbox, key)` (Phase 4.5c.2).
   * Skip: `transform.scale < 0.001` (invisible zoom-out, perf saver).
   */
  private drawMaterialHatch(column: ColumnEntity): void {
    if (this.transform.scale < 0.001) return;

    const key: ColumnMaterialKey = resolveMaterialKey(column.params.material);
    const plan: HatchPlan = column.kind === 'circular'
      ? computeCircularHatchPlan(
          { x: column.params.position.x, y: column.params.position.y },
          column.params.width / 2,
          key,
        )
      : computeHatchPlan(column.geometry.bbox, key);

    if (plan.lines.length === 0 && plan.dots.length === 0 && plan.arcs.length === 0) return;

    this.ctx.save();
    this.drawPolygonPath(column.geometry.footprint.vertices);
    this.ctx.clip();
    this.ctx.strokeStyle = HATCH_STROKE_RGBA;
    this.ctx.fillStyle = HATCH_STROKE_RGBA;
    this.ctx.lineWidth = HATCH_LINE_WIDTH_PX[key];
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
      this.ctx.arc(s.x, s.y, RC_DOT_RADIUS_PX, 0, Math.PI * 2);
      this.ctx.fill();
    }
    for (const arc of plan.arcs) {
      const s = this.worldToScreen(arc.center);
      const rPx = arc.radiusMm * this.transform.scale;
      if (rPx < 0.5) continue;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, rPx, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  /**
   * Phase 4.5c.3 — Draw dimension labels for L-shape (armLength + armWidth)
   * and T-shape (flangeLength + webThickness) when column is highlighted.
   *
   * Uses footprint vertex midpoints to position labels; vertex order matches
   * `buildLshapeLocal` and `buildTshapeLocal` in `column-geometry.ts`.
   * Pure canvas draw — ZERO store subscriptions (ADR-040 compliant).
   */
  private drawVariantDimensionLabels(column: ColumnEntity): void {
    if (!hasVariantLabels(column.kind)) return;
    const verts = column.geometry.footprint.vertices;

    this.ctx.save();
    this.ctx.font = '8px sans-serif';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    if (column.kind === 'L-shape' && verts.length === 6) {
      this.drawDimLabel(verts[3], verts[4], `${Math.round(column.params.depth / 3)} `);
      this.drawDimLabel(verts[0], verts[3], `${Math.round(column.params.width / 3)} `);
    } else if (column.kind === 'T-shape' && verts.length === 8) {
      const fl = column.params.tshape?.flangeLength ?? column.params.width;
      const wt = column.params.tshape?.webThickness ?? Math.round(column.params.depth / 3);
      this.drawDimLabel(verts[4], verts[5], `${Math.round(fl)} `);
      this.drawDimLabel(verts[1], verts[2], `${Math.round(wt)} `);
    } else if (column.kind === 'polygon' && verts.length >= 3) {
      this.drawPolygonSideLabel(column, verts);
    } else if (column.kind === 'I-shape' && verts.length === 12) {
      this.drawIShapeLabels(column, verts);
    }

    this.ctx.restore();
  }

  /**
   * ADR-363 Phase 8 — polygon `N=k` annotation centred above the top vertex.
   * `params.polygon.sides` falls back to the rendered vertex count when the
   * override is absent (clamped already by `column-geometry`).
   */
  private drawPolygonSideLabel(
    column: ColumnEntity,
    verts: ReadonlyArray<{ x: number; y: number }>,
  ): void {
    const sides = column.params.polygon?.sides ?? verts.length;
    const topIdx = pickTopVertexIndex(verts);
    const top = verts[topIdx];
    const s = this.worldToScreen({ x: top.x, y: top.y });
    this.ctx.fillText(`N=${sides}`, s.x, s.y - 10);
  }

  /**
   * ADR-363 Phase 8 — I-shape dimensions. Vertex 0 lives at (-b/2, -h/2) and
   * vertex 6 at (+b/2, +h/2) for the canonical 12-vertex CCW outline emitted
   * by `buildIShapeLocal()`. Flange width spans verts[0]↔verts[1]; section
   * depth spans verts[1]↔verts[6] across the right flange-edge.
   */
  private drawIShapeLabels(
    column: ColumnEntity,
    verts: ReadonlyArray<{ x: number; y: number }>,
  ): void {
    this.drawDimLabel(verts[0], verts[1], `b=${Math.round(column.params.width)} `);
    this.drawDimLabel(verts[1], verts[6], `h=${Math.round(column.params.depth)} `);
  }

  /**
   * Draw a small dimension label at the midpoint of segment [a, b] with a
   * short perpendicular tick mark.
   */
  private drawDimLabel(
    a: Readonly<{ x: number; y: number }>,
    b: Readonly<{ x: number; y: number }>,
    text: string,
  ): void {
    const sa = this.worldToScreen(a);
    const sb = this.worldToScreen(b);
    const mx = (sa.x + sb.x) / 2;
    const my = (sa.y + sb.y) / 2;
    const dx = sb.x - sa.x;
    const dy = sb.y - sa.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 6) return;
    const nx = -dy / len;
    const ny = dx / len;
    const OFFSET_PX = 9;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    this.ctx.lineWidth = 0.7;
    this.ctx.setLineDash([2, 2]);
    this.ctx.beginPath();
    this.ctx.moveTo(sa.x, sa.y);
    this.ctx.lineTo(sb.x, sb.y);
    this.ctx.stroke();
    this.ctx.restore();

    this.ctx.fillText(text, mx + nx * OFFSET_PX, my + ny * OFFSET_PX);
  }

  /**
   * Phase 4.5c.6 — L/T section-profile symbol (hover + selection only).
   *
   * Draws a fixed-size section symbol (∟ for L-shape, ⊤ for T-shape) to the
   * right of the column bbox, vertically centred on the column. Symbol shape
   * follows `flipY` so it matches the mirrored orientation set by Phase 7.2.
   * Steel material only (non-steel L/T columns show dimension labels from Phase
   * 4.5c.3 — section symbol would add visual noise without structural meaning).
   * ADR-040 compliant: ZERO new store subscriptions, pure ctx.
   */
  private drawSectionProfile(column: ColumnEntity): void {
    if (column.kind !== 'L-shape' && column.kind !== 'T-shape') return;
    if (resolveMaterialKey(column.params.material) !== 'steel') return;
    if (this.transform.scale < COL_SECTION_MIN_SCALE) return;

    const _spDs = useDrawingScaleStore.getState();
    const _spCutState = resolveCutState(
      { zBottomMm: column.params.baseOffset ?? 0, zTopMm: (column.params.baseOffset ?? 0) + column.params.height, category: 'column' },
      _spDs.viewRange,
    );
    const { lineWidthPx: _spPx, color: _spCol } = resolveSubcategoryStyle({
      category: 'column', subcategoryKey: 'section-profile',
      cutState: _spCutState, scaleDenominator: _spDs.drawingScale,
      dpi: 96, objectStyles: _spDs.objectStyles,
    });

    const bb = column.geometry.bbox;
    const minS = this.worldToScreen({ x: bb.min.x, y: bb.min.y });
    const maxS = this.worldToScreen({ x: bb.max.x, y: bb.max.y });
    const footprintSpan = Math.max(Math.abs(maxS.x - minS.x), Math.abs(maxS.y - minS.y));
    if (footprintSpan < COL_SECTION_MIN_FOOTPRINT_PX) return;

    // Symbol centre: to the right of bbox, vertically centred in screen space.
    const rightX = Math.max(minS.x, maxS.x);
    const centerY = (minS.y + maxS.y) / 2;
    const cx = rightX + COL_SECTION_OFFSET_PX;
    const cy = centerY;

    const flipY = column.kind === 'L-shape'
      ? (column.params.lshape?.flipY ?? false)
      : (column.params.tshape?.flipY ?? false);

    const outline = column.kind === 'L-shape'
      ? computeLProfileOutline(undefined, undefined, undefined, flipY)
      : computeTProfileOutline(undefined, undefined, undefined, undefined, flipY);

    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.moveTo(outline[0].x, outline[0].y);
    for (let i = 1; i < outline.length; i++) {
      this.ctx.lineTo(outline[i].x, outline[i].y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = COL_SECTION_FILL_COLOR;
    this.ctx.fill();
    this.ctx.strokeStyle = _spCol ?? COL_SECTION_STROKE_COLOR;
    this.ctx.lineWidth = _spPx;
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Phase 8F — Revit-style centred dimension pill.
   * Drawn at bbox centre in screen space; hidden when footprint is < threshold.
   */
  private drawCenterDimLabel(column: ColumnEntity): void {
    const bb = column.geometry.bbox;
    const minS = this.worldToScreen({ x: bb.min.x, y: bb.min.y });
    const maxS = this.worldToScreen({ x: bb.max.x, y: bb.max.y });
    const span = Math.max(Math.abs(maxS.x - minS.x), Math.abs(maxS.y - minS.y));
    if (span < COLUMN_LABEL_MIN_FOOTPRINT_PX) return;
    const lines = formatColumnDimLabels(column.params);
    if (lines.length === 0) return;
    drawColumnDimPill(this.ctx, lines, (minS.x + maxS.x) / 2, (minS.y + maxS.y) / 2);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-363 Phase 4.5 + 4.5b — parametric column grips:
    //   base (4): center / rotation / width / depth
    //   L-shape (+2): arm-length / arm-width (Phase 4.5b)
    //   T-shape (+2): flange-length / web-thickness (Phase 4.5b)
    //   circular (2): center / width-as-diameter
    // Commit routed through `applyColumnGripDrag()` + `UpdateColumnParamsCommand`
    // by `commitColumnGripDrag` (grip-parametric-commits). Phase 4.5c+ will
    // add hatch patterns, anchor-cycle preview, snap-to-wall corners.
    if (!isColumnEntity(entity)) return [];
    return getColumnGrips(entity as ColumnEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isColumnEntity(entity)) return false;
    const column = entity as ColumnEntity;
    const bb = column.geometry?.bbox;
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
    const verts = column.geometry.footprint.vertices;
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

/** Kinds whose highlighted state shows dimension annotations. shear-wall stays
 *  unannotated — its rectangular outline is self-explanatory. */
function hasVariantLabels(kind: ColumnKind): boolean {
  return kind === 'L-shape' || kind === 'T-shape' || kind === 'polygon' || kind === 'I-shape';
}

/** Index of the vertex with the maximum world Y (top of polygon). */
function pickTopVertexIndex(
  verts: ReadonlyArray<{ x: number; y: number }>,
): number {
  let idx = 0;
  let topY = verts[0].y;
  for (let i = 1; i < verts.length; i++) {
    if (verts[i].y > topY) {
      topY = verts[i].y;
      idx = i;
    }
  }
  return idx;
}
