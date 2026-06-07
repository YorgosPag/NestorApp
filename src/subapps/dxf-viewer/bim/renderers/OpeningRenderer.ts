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
import type { OpeningEntity } from '../types/opening-types';
import { isHingedKind, isGlazedKind } from '../types/opening-types';
import type { Point3D } from '../types/bim-base';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { linePatternToDashArray } from '../../config/bim-line-patterns';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { getOpeningGrips } from '../walls/opening-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { HINGE_ARC_SUBDIVISIONS } from '../geometry/opening-geometry';
import { OPENING_KIND_STROKE } from './opening-kind-style';
import {
  OpeningTagRenderer,
  computeTagCenter,
  computeWallNormal,
  TAG_INITIAL_SCREEN_PX,
} from './OpeningTagRenderer';
import { isOpeningTagLayerVisible } from '../../systems/layers/opening-tag-layer';

const HINGE_DASH: readonly [number, number] = [4, 3];
const SLIDING_DASH: readonly [number, number] = [10, 4];
const GLAZING_INSET_RATIO = 0.25; // 25% of thickness inset for double-line glass
/** ADR-375 — dashed outline for an opening projected as "<Beyond>" (not cut). */
const BEYOND_DASH: readonly number[] = [6, 4];

export class OpeningRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isOpeningEntity(entity)) return;
    const opening = entity as OpeningEntity;

    // ADR-382 — Unified visibility check (V/G + Layer + Floor + Building).
    const _opLayer = opening.layerId ? getLayer(opening.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'opening', layerId: opening.layerId, discipline: opening.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer: _opLayer,
      },
    )) return;

    if (!opening.geometry || !opening.params) return;

    // ADR-375 — cut-plane gating (Revit parity). Compute the opening's display
    // state against the active view range BEFORE drawing:
    //   · hidden            → not drawn at all,
    //   · cut               → full plan symbol (swing / glazing) + solid outline,
    //   · projection/beyond → dashed "<Beyond>" outline, NO cut symbol.
    // The host-wall punch (WallRenderer) gates on the same rule, so an opening
    // above/below the cut plane leaves a solid wall instead of a wrong hole.
    const _opDs = useDrawingScaleStore.getState();
    const _opCutState = resolveCutState(
      { zBottomMm: opening.params.sillHeight, zTopMm: opening.params.sillHeight + opening.params.height, category: 'opening' },
      _opDs.viewRange,
    );
    if (_opCutState === 'hidden') return;
    const _isCut = _opCutState === 'cut';

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
    this.ctx.strokeStyle = OPENING_KIND_STROKE[opening.kind];
    const _opLayerOverride = _opLayer ? {
      lineweightMm: isConcreteLineweight(_opLayer.lineweight) ? _opLayer.lineweight : undefined,
      color: _opLayer.color ?? undefined,
    } : undefined;
    // ADR-377 C.3 — per-kind subcategory style resolution.
    const _rso = (subcat: string) => resolveSubcategoryStyle({
      category: 'opening', subcategoryKey: subcat,
      cutState: _opCutState, scaleDenominator: _opDs.drawingScale,
      dpi: 96, objectStyles: _opDs.objectStyles,
      elementOverride: opening.styleOverride, layerOverride: _opLayerOverride,
    });
    const _outlineS = _rso(openingOutlineSubcat(opening.kind));
    const _overlayS = _rso(openingOverlaySubcat(opening.kind));

    this.ctx.lineWidth = _outlineS.lineWidthPx;
    // Cut → subcategory line pattern (solid poché jambs). Beyond → dashed.
    this.ctx.setLineDash(
      _isCut ? (linePatternToDashArray(_outlineS.linePattern) as number[]) : (BEYOND_DASH as number[]),
    );
    if (_outlineS.color !== null) this.ctx.strokeStyle = _outlineS.color;
    this.drawOutline(opening);
    // Plan symbol (swing arc / glazing / slide track) only when actually cut.
    if (_isCut) this.drawKindOverlay(opening, _overlayS.lineWidthPx);

    // ADR-376 Phase A — paint instance Mark tag overlay (canvas-pill SSoT).
    // Layer toggle gating is read μέσω the dedicated module; tag renderer
    // itself enforces per-opening + zoom + mark-present checks.
    OpeningRenderer.tagRenderer.render({
      ctx: this.ctx,
      transform: this.transform,
      viewport: this.tagViewport(),
      opening,
      layerVisible: isOpeningTagLayerVisible(),
    });

    this.finalizeRender(entity, options);
  }

  private static readonly tagRenderer = new OpeningTagRenderer();

  private tagViewport(): { width: number; height: number } {
    const rect = this.ctx.canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-363 Phase 2.5 — full wall-parity grips: move (centre) + rotation (flip)
    // + 4 corner width-resize. Mirror of `FurnitureRenderer.getGrips`: move/rotation
    // handles get their icon glyph from the shared `gripGlyphShape` registry SSoT,
    // corners stay square. Commit routed through `applyOpeningGripDrag()` +
    // `UpdateOpeningParamsCommand` by `commitOpeningGripDrag`.
    if (!isOpeningEntity(entity)) return [];
    return getOpeningGrips(entity as OpeningEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'center' ? ('center' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
      shape: gripGlyphShape(g.openingGripKind),
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, _tolerance: number): boolean {
    if (!isOpeningEntity(entity)) return false;
    const opening = entity as OpeningEntity;

    // Tag pill hit — check first so the larger pill area extends selectability.
    if (opening.params.mark && isOpeningTagLayerVisible()) {
      if (this.hitTestTagPill(opening, point)) return true;
    }

    // ADR-363 Bug 1 fix — polygon containment against the 4-vertex outline
    // (cached στο `geometry.outline.vertices`), όχι το bbox. Opening πρέπει
    // να κερδίζει hit-test τιe-break έναντι του host wall όταν ο cursor είναι
    // εντός του cutout rectangle.
    const verts = opening.geometry?.outline?.vertices;
    if (!verts || verts.length < 3) return false;
    return isPointInPolygon(point, verts.map((v) => ({ x: v.x, y: v.y })));
  }

  private hitTestTagPill(opening: OpeningEntity, worldPoint: Point2D): boolean {
    const clickScreen = this.worldToScreen(worldPoint);
    const anchorWorld = computeTagCenter(opening);
    const anchorScreen = this.worldToScreen({ x: anchorWorld.x, y: anchorWorld.y });
    const { ux, uy } = computeWallNormal(opening);
    const offset = opening.params.tagOffset ?? { dx: 0, dy: 0 };
    const draggedWorld = { x: anchorWorld.x + offset.dx, y: anchorWorld.y + offset.dy };
    const draggedScreen = this.worldToScreen(draggedWorld);
    const tagScreen = {
      x: anchorScreen.x + ux * TAG_INITIAL_SCREEN_PX + (draggedScreen.x - anchorScreen.x),
      y: anchorScreen.y + (-uy) * TAG_INITIAL_SCREEN_PX + (draggedScreen.y - anchorScreen.y),
    };
    // Approximate pill half-size: mark length × ~6px per char at 9px font + padding + tolerance.
    const mark = opening.params.mark ?? '';
    const halfW = mark.length * 5 + 10;
    const halfH = 12;
    return (
      clickScreen.x >= tagScreen.x - halfW &&
      clickScreen.x <= tagScreen.x + halfW &&
      clickScreen.y >= tagScreen.y - halfH &&
      clickScreen.y <= tagScreen.y + halfH
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

  private drawKindOverlay(opening: OpeningEntity, baseLineWidth: number): void {
    if (isHingedKind(opening.kind)) {
      this.drawHingeArc(opening, baseLineWidth);
      return;
    }
    if (opening.kind === 'sliding-door') {
      this.drawSlidingIndicator(opening, baseLineWidth);
      return;
    }
    if (isGlazedKind(opening.kind)) {
      this.drawGlazing(opening, baseLineWidth);
    }
  }

  /**
   * Dashed quarter-arc swing indicator + solid leaf line(s) for door / french-door.
   *
   * Industry-standard plan convention (AutoCAD/Revit): door = swing arc (dashed)
   * + leaf line (solid). The leaf line represents the door panel σε 90°-open
   * position — connects the hinge anchor (pivot) με την άκρη του arc.
   *
   * Geometry contract:
   *   - `arc.points[0..HINGE_ARC_SUBDIVISIONS]`: first arc (closed → 90°-open)
   *   - `arc.points[HINGE_ARC_SUBDIVISIONS]`: 90°-open tip του first leaf
   *   - french-door only: `arc.points[HINGE_ARC_SUBDIVISIONS+1]`: 90°-open tip
   *     του second leaf (first point of the reversed second-arc loop, sin=1).
   */
  private drawHingeArc(opening: OpeningEntity, baseLineWidth: number): void {
    const arc = opening.geometry.hingeArc;
    const hinge = opening.geometry.hingeAnchor;
    if (!arc || arc.points.length < 2 || !hinge) return;

    this.ctx.save();
    // Dashed swing arc.
    this.ctx.setLineDash(HINGE_DASH as unknown as number[]);
    this.ctx.lineWidth = baseLineWidth;
    this.drawPolyline(arc.points);

    // Solid leaf line(s) — door panel at 90°-open position.
    this.ctx.setLineDash([]);
    this.ctx.lineWidth = baseLineWidth;
    this.drawLeafLine(hinge, arc.points[HINGE_ARC_SUBDIVISIONS]);

    const hinge2 = opening.geometry.hingeAnchor2;
    if (hinge2 && arc.points.length > HINGE_ARC_SUBDIVISIONS + 1) {
      this.drawLeafLine(hinge2, arc.points[HINGE_ARC_SUBDIVISIONS + 1]);
    }
    this.ctx.restore();
  }

  private drawLeafLine(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const a = this.worldToScreen({ x: from.x, y: from.y });
    const b = this.worldToScreen({ x: to.x, y: to.y });
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }

  /** Sliding-door visual cue: long-dashed line down the middle. */
  private drawSlidingIndicator(opening: OpeningEntity, baseLineWidth: number): void {
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
    this.ctx.lineWidth = baseLineWidth;
    this.drawPolyline([trackStart, trackEnd]);
    this.ctx.restore();
  }

  /** Glazed visual: inset double-line inside the outline. */
  private drawGlazing(opening: OpeningEntity, baseLineWidth: number): void {
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
    this.ctx.lineWidth = baseLineWidth;
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

// ─── ADR-377 C.3 — subcategory key helpers ──────────────────────────────────

function openingOutlineSubcat(kind: string): string {
  if (kind === 'window' || kind === 'fixed') return 'window-opening';
  if (kind === 'wall-cutout') return 'wall-cutout-jambs';
  return 'door-opening'; // door, french-door, sliding-door
}

function openingOverlaySubcat(kind: string): string {
  if (kind === 'window' || kind === 'fixed') return 'window-glass';
  if (kind === 'sliding-door') return 'sliding-track';
  return 'door-plan-swing'; // door, french-door
}
