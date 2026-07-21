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
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { isArmedSelectedHighlight } from '../utils/bim-body-fill';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { bimDashPx } from '../../config/bim-dash-resolver';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { getOpeningGrips } from '../walls/opening-grips';
import { paintPolygonHoverHalo, mapBimGrips, tracePolygonScreenPath } from './bim-polygon-render';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { drawEntityDimLabel } from '../labels/bim-dim-labels';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import { OPENING_KIND_STROKE } from './opening-kind-style';
import { drawOpeningPlanOverlay, drawOpeningFrameOutlines } from './opening-overlay-drawing';
import { resolveOpeningMaterial } from '../family-types/resolve-opening-material';
import { getMaterialFlatColorHex } from '../materials/material-catalog-defs';
import {
  OpeningTagRenderer,
  computeTagCenter,
  computeWallNormal,
  TAG_INITIAL_SCREEN_PX,
} from './OpeningTagRenderer';
import { isOpeningTagLayerVisible } from '../../systems/layers/opening-tag-layer';
// ADR-531 Φ5b.3 — «Μόνο κάτοψη DXF»: gate την πινακίδα (tag) ώστε να μένουν μόνο καθαρές γραμμές.
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';

/** ADR-375 — dashed outline for an opening projected as "<Beyond>" (not cut). */
const BEYOND_DASH: readonly number[] = [6, 4];

export class OpeningRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isOpeningEntity(entity)) return;
    const opening = entity as OpeningEntity;

    // ADR-382 — Unified visibility check (V/G + Layer + Floor + Building).
    const _opLayer = opening.layerId ? getLayer(opening.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'opening', layerId: opening.layerId, discipline: opening.discipline }, _opLayer)) return;

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
    paintPolygonHoverHalo(
      this.ctx, (p) => this.worldToScreen(p),
      opening.geometry.outline.vertices, phaseState.phase === 'highlighted',
    );

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    // Armed-transform selection keeps the ORANGE stroke from applyPhaseStyle throughout the
    // opening's outline + overlay passes (skip every category-colour override). Giorgio 2026-07-21.
    const _opArmed = isArmedSelectedHighlight(options);
    if (!_opArmed) this.ctx.strokeStyle = OPENING_KIND_STROKE[opening.kind];
    const _opLayerOverride = _opLayer ? {
      lineweightMm: isConcreteLineweight(_opLayer.lineweight) ? _opLayer.lineweight : undefined,
      color: _opLayer.color ?? undefined,
    } : undefined;

    // ADR-669 2D/3D material parity — the per-opening material (κάσα/υαλοστάσιο)
    // drives the 2D plan colour, mirroring the 3D pipeline's
    // `resolveOpeningMaterial()` + `getMaterialFlatColorHex()` (same SSoT the
    // structural-finish 2D plan geometry already uses for `mat-*`/`bmat_*` ids —
    // Revit-style «one material, 2D + 3D»). The resolved colour is threaded in
    // as an `elementOverride.color` FALLBACK (ADR-375 C.5 hook — the resolver's
    // own «elem > sub Object Style > … » precedence), so a real per-instance
    // style override (opening.styleOverride.color) still wins over material,
    // exactly as it already wins over everything else today.
    //
    // ZERO REGRESSION: `DEFAULT_OBJECT_STYLES` bakes a non-null category colour
    // into EVERY opening subcategory (door-opening/window-opening/…), which is
    // `sub Object Style` priority — ABOVE the parent-DEFAULT fallback but BELOW
    // `elem`. That colour therefore already wins over the plain
    // `OPENING_KIND_STROKE` baseline for every existing opening. Only openings
    // that carry an EXPLICIT instance material (`params.material` /
    // `params.materials`) synthesize an `elem`-level override at all — legacy
    // openings pass `opening.styleOverride` through UNCHANGED, so `_outlineS`/
    // `_overlayS` resolve identically to before this change.
    const _hasMaterialOverride = Boolean(opening.params.material) || Boolean(opening.params.materials);
    const _withMaterialFallback = (fallbackColor: string): typeof opening.styleOverride => {
      if (!_hasMaterialOverride || opening.styleOverride?.color !== undefined) return opening.styleOverride;
      return { ...opening.styleOverride, color: fallbackColor };
    };
    let _outlineElementOverride = opening.styleOverride;
    let _overlayElementOverride = opening.styleOverride;
    if (_hasMaterialOverride) {
      const _resolvedMats = resolveOpeningMaterial(opening.params);
      const _frameColor = getMaterialFlatColorHex(_resolvedMats.frame);
      const _glassColor = getMaterialFlatColorHex(_resolvedMats.glass);
      _outlineElementOverride = _withMaterialFallback(_frameColor);
      _overlayElementOverride = _withMaterialFallback(isWindowKind(opening.kind) ? _glassColor : _frameColor);
    }

    // ADR-377 C.3 — per-kind subcategory style resolution.
    const _rso = (subcat: string, elementOverride: typeof opening.styleOverride) => resolveSubcategoryStyle({
      category: 'opening', subcategoryKey: subcat,
      cutState: _opCutState, scaleDenominator: _opDs.drawingScale,
      dpi: 96, objectStyles: _opDs.objectStyles,
      elementOverride, layerOverride: _opLayerOverride,
    });
    const _outlineS = _rso(openingOutlineSubcat(opening.kind), _outlineElementOverride);
    const _overlayS = _rso(openingOverlaySubcat(opening.kind), _overlayElementOverride);

    this.ctx.lineWidth = _outlineS.lineWidthPx;
    // Cut → subcategory line pattern (solid poché jambs). Beyond → dashed.
    this.ctx.setLineDash(
      _isCut ? bimDashPx(_outlineS.linePattern, this.transform.scale) : (BEYOND_DASH as number[]),
    );
    if (_outlineS.color !== null && !_opArmed) this.ctx.strokeStyle = _outlineS.color;
    this.drawOutline(opening);
    // ADR-611 — constant-cross-section κάσα jambs, drawn with the resolved opening
    // outline style (reuse — no dedicated frame subcategory). Cut symbol only.
    if (_isCut) this.drawFrameOutlines(opening, _outlineS.lineWidthPx);
    // Plan symbol (swing arc / glazing / slide track) only when actually cut.
    // Only re-apply the (independently resolved) overlay colour when a material
    // override is active — otherwise `_overlayS.color` resolves to the SAME
    // DEFAULT_OBJECT_STYLES category colour as `_outlineS.color` for every
    // existing kind/subcat pairing, so skipping the re-assignment when no
    // material is set keeps the exact current single-stroke-inherits-from-
    // outline code path (byte-identical legacy behaviour).
    if (_isCut) {
      if (_hasMaterialOverride && _overlayS.color !== null && !_opArmed) {
        this.ctx.strokeStyle = _overlayS.color;
      }
      this.drawKindOverlay(opening, _overlayS.lineWidthPx);
    }

    // ADR-376 Phase A — paint instance Mark tag overlay (canvas-pill SSoT).
    // Layer toggle gating is read μέσω the dedicated module; tag renderer
    // itself enforces per-opening + zoom + mark-present checks.
    // ADR-531 Φ5b.3 — στο «Μόνο κάτοψη DXF» η πινακίδα κρύβεται (μόνο καθαρές γραμμές).
    if (!useBimRenderSettingsStore.getState().planLinesOnly) {
      OpeningRenderer.tagRenderer.render({
        ctx: this.ctx,
        transform: this.transform,
        viewport: this.tagViewport(),
        opening,
        layerVisible: isOpeningTagLayerVisible(),
      });
    }

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
    return mapBimGrips(getOpeningGrips(entity as OpeningEntity), (g) => gripGlyphShape(gripKindOf(g, 'opening')));
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
    if (opening.geometry.outline.vertices.length < 3) return;
    tracePolygonScreenPath(this.ctx, (p) => this.worldToScreen(p), opening.geometry.outline.vertices);
    this.ctx.stroke();
  }

  /**
   * ADR-611 — κάσα frame jambs (constant cross-section). Delegates to the pure
   * `opening-overlay-drawing` SSoT; the renderer supplies the resolved outline
   * line width + world→screen mapper. `strokeStyle` is already set to the resolved
   * opening outline colour by `render()`.
   */
  private drawFrameOutlines(opening: OpeningEntity, lineWidth: number): void {
    drawOpeningFrameOutlines(opening, {
      ctx: this.ctx,
      toScreen: (p) => this.worldToScreen({ x: p.x, y: p.y }),
      lineWidth,
    });
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
