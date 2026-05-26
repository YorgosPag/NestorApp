/**
 * WallRenderer — ADR-363 Phase 1 (G1).
 *
 * 2D plan-view renderer για `WallEntity`. Reads `entity.geometry`
 * (populated by `computeWallGeometry()` — the SSoT) and draws:
 *   - outer + inner edges (solid polylines, lineweight by category)
 *   - translucent category fill (concrete / brick / stone tint)
 *   - axis polyline (dashed thin, optional — visual SSoT for the centerline)
 *
 * Phase 1 keeps it deterministic — no per-layer hatch patterns, no opening
 * cutout (Phase 2). Hover halo follows the stair pattern: OBB outline around
 * the wall footprint via a single `drawPerimeterOutline()` pass.
 *
 * ADR-040 micro-leaf compliance: pure renderer class; ZERO subscriptions to
 * high-frequency stores. Called by the canvas with the entity already
 * resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §5.9
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../../rendering/types/Types';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { WallCategory, WallEntity } from '../types/wall-types';
import type { OpeningEntity } from '../types/opening-types';
import type { Point3D } from '../types/bim-base';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { linePatternToDashArray } from '../../config/bim-line-patterns';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getWallGrips } from '../walls/wall-grips';
import {
  computeWallHatchPlan,
  resolveWallMaterialKey,
  HATCH_STROKE_RGBA,
  RC_DOT_RADIUS_PX,
  WALL_HATCH_LINE_WIDTH_PX,
} from '../walls/wall-hatch-patterns';

/** Translucent fill colour per category (CAD industry convention). */
const CATEGORY_FILL: Readonly<Record<WallCategory, string>> = {
  exterior:  'rgba(120, 144, 156, 0.18)', // concrete slate
  interior:  'rgba(205, 158, 110, 0.16)', // brick warm
  partition: 'rgba(205, 158, 110, 0.10)', // brick lighter
  parapet:   'rgba(120, 144, 156, 0.22)', // concrete deeper
  fence:     'rgba(141, 110, 99, 0.18)',  // stone brown
};


const AXIS_DASH: readonly [number, number] = [6, 4];

/** ADR-363 Phase 2.5 — per-frame opening index keyed by host wall id. */
export type OpeningsByWall = ReadonlyMap<string, ReadonlyArray<OpeningEntity>>;

export class WallRenderer extends BaseEntityRenderer {
  /**
   * ADR-363 Phase 2.5 — per-frame map of openings keyed by host wall id.
   * Forwarded by `EntityRendererComposite.setOpeningsByWall()` so the renderer
   * can punch a boolean cutout into the wall fill at each hosted opening's
   * outline (visual "hole" replacing the Phase 2 "draw-on-top" approximation).
   *
   * Empty map ⇒ legacy behaviour (no cutout). Renderer never subscribes — the
   * caller rebuilds the map once per frame and pushes via setter (micro-leaf
   * compliant, ADR-040).
   */
  private openingsByWall: OpeningsByWall = new Map();

  /** Inject per-frame opening index. Composite calls this once per render. */
  setOpeningsByWall(map: OpeningsByWall): void {
    this.openingsByWall = map;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isWallEntity(entity)) return;
    const wall = entity as WallEntity;
    if (!wall.geometry || !wall.params) return;

    // Hover halo via OBB outline (stair pattern). Per-edge glow loses to the
    // category fill rectangle in the main pass, so a dedicated outline pass
    // guarantees a continuous halo around the wall footprint.
    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);
    if (phaseState.phase === 'highlighted') {
      const entityLineWidth = Math.max(
        1,
        (entity as EntityModel & { lineWidth?: number }).lineWidth || 1,
      );
      this.ctx.save();
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = entityLineWidth + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawPerimeterOutline(wall);
      this.ctx.restore();
    }

    // Main pass — phase style + fill + hatch + stroke.
    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.drawFootprint(wall);
    this.drawMaterialHatch(wall);
    this.drawAxis(wall);

    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-363 Phase 1C — parametric wall grips (endpoint / midpoint / thickness
    // / curve / polyline-vertex). Commit routed through `applyWallGripDrag()`
    // + `UpdateWallParamsCommand` by `commitWallGripDrag` (grip-commit-adapter).
    if (!isWallEntity(entity)) return [];
    return getWallGrips(entity as WallEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: 'vertex' as const,
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, _tolerance: number): boolean {
    if (!isWallEntity(entity)) return false;
    const wall = entity as WallEntity;
    // ADR-363 Bug 1 fix — polygon containment της outer+inner edge ένωσης
    // (mirror του buildWallShape pattern σε BimToThreeConverter), όχι bbox.
    // Επιτρέπει στο opening (priority=75) να κερδίζει tie-break όταν ο cursor
    // είναι εντός του opening outline, καθώς το wall hit-test πλέον δεν
    // overshoots πέρα από τις outer/inner edges.
    const outer = wall.geometry?.outerEdge?.points;
    const inner = wall.geometry?.innerEdge?.points;
    if (!outer || !inner || outer.length < 2 || inner.length < 2) return false;
    const ring: Point2D[] = [
      ...outer.map((p) => ({ x: p.x, y: p.y })),
      ...[...inner].reverse().map((p) => ({ x: p.x, y: p.y })),
    ];
    if (ring.length < 3) return false;
    return isPointInPolygon(point, ring);
  }

  // ─── Internal drawing helpers ──────────────────────────────────────────────

  /**
   * Draws the outer + inner edges as a closed polygon, filled translucent
   * with the category tint, then stroked at category-specific line weight.
   *
   * ADR-363 Phase 2.5 — Boolean cutout: when openings are registered for this
   * wall (via `setOpeningsByWall`), each opening outline is subtracted from
   * the wall fill with `globalCompositeOperation='destination-out'`. The
   * cutout pass is scoped (save/restore) so neither the upcoming stroke nor
   * neighbouring renderers see the temporary composite mode. Strokes follow
   * the cutout so the wall outline stays intact around the opening jambs.
   */
  private drawFootprint(wall: WallEntity): void {
    const outer = wall.geometry.outerEdge.points;
    const inner = wall.geometry.innerEdge.points;
    if (outer.length < 2 || inner.length < 2) return;

    const cat = wall.params.category;
    this.ctx.fillStyle = CATEGORY_FILL[cat];
    const _cutState = resolveCutState(
      { zBottomMm: wall.params.baseOffset ?? 0, zTopMm: (wall.params.baseOffset ?? 0) + wall.params.height, category: 'wall' },
      useDrawingScaleStore.getState().viewRange,
    );
    const { lineWidthPx: _edgePx, linePattern: _edgePattern, color: _edgeColor } = resolveSubcategoryStyle({
      category: 'wall', subcategoryKey: 'common-edges',
      cutState: _cutState, scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      dpi: 96, objectStyles: useDrawingScaleStore.getState().objectStyles,
      elementOverride: wall.styleOverride,
    });
    this.ctx.lineWidth = _edgePx;
    this.ctx.setLineDash(linePatternToDashArray(_edgePattern) as number[]);

    // Build closed polygon: outer (start→end) + inner (end→start) reverses
    // so the perimeter is well-oriented for fill.
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: outer[0].x, y: outer[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < outer.length; i++) {
      const s = this.worldToScreen({ x: outer[i].x, y: outer[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    for (let i = inner.length - 1; i >= 0; i--) {
      const s = this.worldToScreen({ x: inner[i].x, y: inner[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
    this.ctx.fill();

    // ADR-363 Phase 2.5 — subtract hosted opening outlines from the fill.
    this.punchHostedOpenings(wall);

    if (_edgeColor !== null) this.ctx.strokeStyle = _edgeColor;
    this.ctx.stroke();
  }

  /**
   * ADR-363 Phase 2.5 — subtract each hosted opening's outline from the
   * already-painted wall fill via `destination-out`. Scoped save/restore
   * keeps the composite mode local to this pass. Skips silently when no
   * openings are registered (legacy behaviour preserved).
   */
  private punchHostedOpenings(wall: WallEntity): void {
    const openings = this.openingsByWall.get(wall.id);
    if (!openings || openings.length === 0) return;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    for (const opening of openings) {
      const verts = opening.geometry?.outline.vertices;
      if (!verts || verts.length < 3) continue;
      this.ctx.beginPath();
      const start = this.worldToScreen({ x: verts[0].x, y: verts[0].y });
      this.ctx.moveTo(start.x, start.y);
      for (let i = 1; i < verts.length; i++) {
        const s = this.worldToScreen({ x: verts[i].x, y: verts[i].y });
        this.ctx.lineTo(s.x, s.y);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  /** Axis polyline rendered dashed-thin (centerline visual aid). */
  private drawAxis(wall: WallEntity): void {
    const axis = wall.geometry.axisPolyline.points;
    if (axis.length < 2) return;
    this.ctx.save();
    this.ctx.setLineDash(AXIS_DASH as unknown as number[]);
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.drawPolyline(axis);
    this.ctx.restore();
  }

  /**
   * Hover halo: tight OBB of the footprint vertices (outer + inner). Stair
   * pattern (ADR-358 §G15) — per-edge halo on composite entities is clobbered
   * by the next stroke, so a single OBB pass guarantees a continuous halo.
   */
  private drawPerimeterOutline(wall: WallEntity): void {
    const outer = wall.geometry.outerEdge.points;
    const inner = wall.geometry.innerEdge.points;
    if (outer.length < 2 || inner.length < 2) return;

    this.ctx.beginPath();
    const first = this.worldToScreen({ x: outer[0].x, y: outer[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < outer.length; i++) {
      const s = this.worldToScreen({ x: outer[i].x, y: outer[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    for (let i = inner.length - 1; i >= 0; i--) {
      const s = this.worldToScreen({ x: inner[i].x, y: inner[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  /**
   * Phase 4.5e-B — per-material hatch inside wall body clip.
   * Skip for DNA-bearing walls (per-layer DNA rendering governs materials).
   * Skip at extreme zoom-out (scale < 0.001, perf saver).
   */
  private drawMaterialHatch(wall: WallEntity): void {
    if (wall.params.dna) return;
    if (this.transform.scale < 0.001) return;
    const key = resolveWallMaterialKey(wall.params.material);
    const plan = computeWallHatchPlan(wall.geometry.bbox, key);
    if (plan.lines.length === 0 && plan.dots.length === 0) return;

    const outer = wall.geometry.outerEdge.points;
    const inner = wall.geometry.innerEdge.points;
    if (outer.length < 2 || inner.length < 2) return;

    const _hatchCutState = resolveCutState(
      { zBottomMm: wall.params.baseOffset ?? 0, zTopMm: (wall.params.baseOffset ?? 0) + wall.params.height, category: 'wall' },
      useDrawingScaleStore.getState().viewRange,
    );
    const { linePattern: _hatchPattern, color: _hatchColor } = resolveSubcategoryStyle({
      category: 'wall', subcategoryKey: 'cut-pattern',
      cutState: _hatchCutState, scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      objectStyles: useDrawingScaleStore.getState().objectStyles,
      elementOverride: wall.styleOverride,
    });
    const _hatchStroke = _hatchColor ?? HATCH_STROKE_RGBA;

    this.ctx.save();
    // Clip to wall body polygon (same path as drawFootprint).
    this.ctx.beginPath();
    const first = this.worldToScreen({ x: outer[0].x, y: outer[0].y });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < outer.length; i++) {
      const s = this.worldToScreen({ x: outer[i].x, y: outer[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    for (let i = inner.length - 1; i >= 0; i--) {
      const s = this.worldToScreen({ x: inner[i].x, y: inner[i].y });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
    this.ctx.clip();

    this.ctx.strokeStyle = _hatchStroke;
    this.ctx.fillStyle = _hatchStroke;
    this.ctx.lineWidth = WALL_HATCH_LINE_WIDTH_PX[key];
    this.ctx.setLineDash(linePatternToDashArray(_hatchPattern) as number[]);

    for (const seg of plan.lines) {
      const a = this.worldToScreen(seg.start);
      const b = this.worldToScreen(seg.end);
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
