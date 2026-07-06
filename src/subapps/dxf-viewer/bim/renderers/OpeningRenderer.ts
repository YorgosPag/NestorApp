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
import { isWindowKind, isSlidingKind } from '../types/opening-types';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { bimDashPx } from '../../config/bim-dash-resolver';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { getOpeningGrips } from '../walls/opening-grips';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { drawEntityDimLabel } from '../labels/bim-dim-labels';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import { OPENING_KIND_STROKE } from './opening-kind-style';
import { drawOpeningPlanOverlay } from './opening-overlay-drawing';
import {
  OpeningTagRenderer,
  computeTagCenter,
  computeWallNormal,
  TAG_INITIAL_SCREEN_PX,
} from './OpeningTagRenderer';
import { isOpeningTagLayerVisible } from '../../systems/layers/opening-tag-layer';

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
      _isCut ? bimDashPx(_outlineS.linePattern, this.transform.scale) : (BEYOND_DASH as number[]),
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

    // Revit-style centred dimension pill (hover/select) — shared SSoT. The Mark
    // tag (above) is offset along the wall normal; the dim pill is bbox-centred,
    // so they separate. w×h is the opening's meaningful primary dimension.
    if (phaseState.phase === 'highlighted' || options.selected) {
      drawEntityDimLabel(this.ctx, opening, opening.geometry.bbox, (p) => this.worldToScreen(p));
    }

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
    return isPointInPolygon(point, projectVerticesTo2D(verts));
  }

  private hitTestTagPill(opening: OpeningEntity, worldPoint: Point2D): boolean {
    const clickScreen = this.worldToScreen(worldPoint);
    const anchorWorld = computeTagCenter(opening);
    const anchorScreen = this.worldToScreen({ x: anchorWorld.x, y: anchorWorld.y });
    const { ux, uy } = computeWallNormal(opening);
    const offset = opening.params.tagOffset ?? { dx: 0, dy: 0 };
    const draggedWorld = translatePoint(anchorWorld, { x: offset.dx, y: offset.dy });
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

  /**
   * Kind-specific plan symbol overlay (swing arc / sliding rail / folding /
   * overhead / revolving / glazing + operation marks / bay). Dispatched through
   * the pure `opening-overlay-drawing` SSoT (ADR-421 §A5) — the renderer just
   * supplies the canvas context + world→screen mapper.
   */
  private drawKindOverlay(opening: OpeningEntity, baseLineWidth: number): void {
    drawOpeningPlanOverlay(opening, {
      ctx: this.ctx,
      toScreen: (p) => this.worldToScreen({ x: p.x, y: p.y }),
      lineWidth: baseLineWidth,
    });
  }
}

// ─── ADR-377 C.3 — subcategory key helpers ──────────────────────────────────

function openingOutlineSubcat(kind: OpeningKind | 'wall-cutout'): string {
  if (kind === 'wall-cutout') return 'wall-cutout-jambs';
  return isWindowKind(kind) ? 'window-opening' : 'door-opening';
}

function openingOverlaySubcat(kind: OpeningKind | 'wall-cutout'): string {
  if (kind === 'wall-cutout') return 'door-plan-swing';
  if (isWindowKind(kind)) return 'window-glass';
  if (isSlidingKind(kind)) return 'sliding-track';
  return 'door-plan-swing'; // hinged / folding / overhead / revolving doors
}
