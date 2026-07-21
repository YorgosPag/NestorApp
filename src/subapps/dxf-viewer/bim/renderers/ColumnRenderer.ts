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

import { BimFootprintRenderer } from './bim-footprint-renderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isColumnEntity } from '../../types/entities';
import type { ColumnEntity } from '../types/column-types';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { isStructuralComponentVisible } from '../visibility/structural-component-visibility';
import { resolveCutState } from '../../config/bim-view-range';
import { resolveBimBodyFill, fillBimBodyPath, isArmedSelectedHighlight, BIM_ARMED_BODY_FILL } from '../utils/bim-body-fill';
import { topFacePlanFill } from '../utils/bim-face-plan-fill';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { getColumnGrips } from '../columns/column-grips';
import { gripGlyphShape } from '../grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { drawEntityDimLabel } from '../labels/bim-dim-labels';
import { KIND_STROKE, KIND_FILL } from '../columns/column-render-palette';
import { isWallColumnKind } from '../columns/column-from-faces';
import { columnCutPlaneShiftCanvas } from '../geometry/cut-plane-tilt';
import { drawCutPlaneTiltProjection, applyCutPlaneTranslate } from './cut-plane-tilt-projection';
import { strokePolygonOutline, polygonBboxHitTest, mapBimGrips } from './bim-polygon-render';
import {
  drawColumnMaterialHatch,
  drawColumnVariantDimensionLabels,
  drawColumnSectionProfile,
} from './column-renderer-overlays';

// ADR-449 Slice X2 μέρος Β — το per-element 2Δ finish injection (`setColumnFinishFaces` +
// `FinishFacesByColumn`) αφαιρέθηκε: ο σοβάς σχεδιάζεται ως ΕΝΑ scene-level merged-silhouette
// pass στον `DxfRenderer` (κοινή SSoT με 3Δ). Ο πυρήνας της κολόνας εδώ είναι αμετάβλητος.

export class ColumnRenderer extends BimFootprintRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isColumnEntity(entity)) return;
    const column = entity as ColumnEntity;

    // ADR-382 — Unified visibility check (V/G + Layer + Floor + Building).
    const _colLayer = column.layerId ? getLayer(column.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'column', layerId: column.layerId, discipline: column.discipline }, _colLayer)) return;

    if (!column.geometry || !column.params) return;
    const verts = column.geometry.footprint.vertices;
    if (verts.length < 3) return;

    // ADR-531 Φ5b.5 — «Μόνο κάτοψη DXF»: μόνο το περίγραμμα της κολώνας/τοιχίου (καθαρή γραμμή),
    // χωρίς γέμισμα/διαγράμμιση/οπλισμό — όπως το top-view του Τέκτονα (mirror SlabRenderer/WallRenderer).
    if (useBimRenderSettingsStore.getState().planLinesOnly) {
      strokePolygonOutline(this.ctx, (p) => this.worldToScreen(p), verts, column.color ?? KIND_STROKE[column.kind]);
      this.finalizeRender(entity, options);
      return;
    }

    // ADR-470 — core (σώμα σκυροδέματος) component gate. Όταν κρυμμένο (per-view ή
    // per-element override), παραλείπουμε ΟΛΟ το σχέδιο του σώματος (fill/hatch/
    // outline). Ο σοβάς + ο οπλισμός είναι ΑΝΕΞΑΡΤΗΤΑ scene-level passes στον
    // DxfRenderer, ώστε «μόνο οπλισμός» / «μόνο σοβάς» να προβάλλεται κανονικά.
    // finalizeRender κρατά grips/selection (το στοιχείο παραμένει επιλέξιμο).
    if (!isStructuralComponentVisible('core', column)) {
      this.finalizeRender(entity, options);
      return;
    }

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // ADR-404 Phase 3 — Revit cut-plane προβολή: το πλήρες σώμα (cut στυλ) μεταφέρεται
    // στο cut plane· η βάση ζωγραφίζεται λεπτή + connecting lines μετά. Render-time μόνο
    // (ΟΧΙ στο `computeColumnGeometry`: 3Δ/grips/hit/BOQ). Μη-tilted → `null` → no-op.
    const _tiltShift = columnCutPlaneShiftCanvas(
      column.params,
      useDrawingScaleStore.getState().viewRange.cutPlaneMm,
    );
    applyCutPlaneTranslate(this.ctx, _tiltShift, (p) => this.worldToScreen(p));

    // Hover halo via outline thicker glow.
    this.paintHoverHalo(verts, phaseState.phase === 'highlighted');

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();
    // ADR-375 v2.12 — V/G category color tints the body fill (SSoT helper).
    const _colStyles = useDrawingScaleStore.getState().objectStyles;
    // ADR-401 F.2 — cut-state = nominal `baseOffset + height` ΣΚΟΠΙΜΑ (όχι attached
    // top/base profile). Render leaf (ADR-040 — ΔΕΝ σκανάρει hosts), όπως ο τοίχος
    // (WallRenderer B3c). Το cut plane (~1.2m) πέφτει πάντα μεταξύ base και attached
    // top (~2.5m) όσο και του nominal → cut-state 'cut' και στις δύο = NO-OP. Θα
    // διέφερε μόνο αν host κατέβαζε την κορυφή κάτω από το cut plane (extreme edge
    // case, host scan σε leaf) → εκτός scope, δες ADR-401 §5 F.2.
    const _colCutState = resolveCutState(
      { zBottomMm: column.params.baseOffset ?? 0, zTopMm: (column.params.baseOffset ?? 0) + column.params.height, category: 'column' },
      useDrawingScaleStore.getState().viewRange,
    );
    // Fill first, hatch clipped inside, stroke on top so outline stays sharp.
    // ADR-509 / FULL SSoT (bim-body-fill) — ίδιος κώδικας body-fill με τον τοίχο &
    // όλα τα BIM: V/G tint ?? παλέτα → background-adaptive boost ⇒ ΙΔΙΑ διαφάνεια.
    // ADR-539 Φ3e — η βαμμένη ΑΝΩ όψη (Cinema 4D «Polygon Mode») γίνεται το χρώμα γεμίσματος
    // στην κάτοψη (top cap = ό,τι βλέπουμε από πάνω)· αλλιώς το legacy V/G body fill.
    // Revit background+foreground pattern (bim-body-fill) — opaque base occludes
    // drawing aids beneath the column, poché tint on top.
    // Armed-transform selection wins over the top-face paint + V/G tint → orange poché.
    const _colArmed = isArmedSelectedHighlight(options);
    const _colBodyFill = _colArmed
      ? BIM_ARMED_BODY_FILL
      : (topFacePlanFill(column) ?? resolveBimBodyFill('column', _colCutState, _colStyles, KIND_FILL[column.kind]));
    this.drawPolygonPath(verts);
    fillBimBodyPath(this.ctx, _colBodyFill, _colCutState);

    // ADR-507 Φ7 — unified per-material poché (all kinds, incl. circular). cutState
    // → surface vs cut pattern μέσω MATERIAL_HATCH_MAP.
    drawColumnMaterialHatch(this.ctx, column, this.transform.scale, (p) => this.worldToScreen(p), _colCutState);

    const _colLayerOverride = _colLayer ? {
      lineweightMm: isConcreteLineweight(_colLayer.lineweight) ? _colLayer.lineweight : undefined,
      color: _colLayer.color ?? undefined,
    } : undefined;
    // ADR-375 C.9 — τοιχίο Ω.Σ. (shear-wall/composite/U-shape) → subcategory
    // `shear-wall` (σκούρο μπλε-RC)· κανονική κολώνα → `common-edges` (parent slate).
    const _colSubcat = isWallColumnKind(column.kind) ? 'shear-wall' : 'common-edges';
    const { lineWidthPx: _colLwPx, color: _colColor } = resolveSubcategoryStyle({
      category: 'column', subcategoryKey: _colSubcat,
      cutState: _colCutState, scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      dpi: 96, objectStyles: _colStyles,
      elementOverride: column.styleOverride, layerOverride: _colLayerOverride,
    });
    this.ctx.lineWidth = _colLwPx;
    // Armed-selection keeps the ORANGE stroke from applyPhaseStyle (skip category override).
    if (_colColor !== null && !_colArmed) this.ctx.strokeStyle = _colColor;
    // Solid footprint outline (continuous linetype, ίδιο με committed). Ρητό reset
    // ώστε ο renderer να είναι self-contained: στο shared PreviewCanvas ένα
    // προηγούμενο tracking/polar paint αφήνει ενεργό dash pattern στο context, που
    // χωρίς αυτό «διέρρεε» μέσα στο WYSIWYG column ghost → διακεκομμένο περίγραμμα.
    // Mirror WallRenderer + του hover-halo path παραπάνω (setLineDash([]) πριν stroke).
    this.ctx.setLineDash([]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.restore();

    // ADR-449 Slice X2 μέρος Β — ο σοβάς (2Δ) σχεδιάζεται ως ΕΝΑ scene-level merged-silhouette
    // pass στον DxfRenderer (κοινή SSoT με 3Δ) — όχι πλέον per-column εδώ.

    // Phase 4.5c.3 + 4.5c.6 — variant labels + section-profile symbol (L/T when highlighted).
    if (phaseState.phase === 'highlighted') {
      drawColumnVariantDimensionLabels(this.ctx, column, (p) => this.worldToScreen(p));
      drawColumnSectionProfile(this.ctx, column, this.transform.scale, (p) => this.worldToScreen(p));
    }

    // Phase 8F — centred dimension pill (Revit-style): visible when hovered OR selected.
    if (phaseState.phase === 'highlighted' || options.selected) {
      this.drawCenterDimLabel(column);
    }

    // ADR-404 Phase 3 — κλείσιμο translate (cut σώμα)· βάση λεπτή + connecting lines.
    if (_tiltShift) {
      this.ctx.restore();
      // ADR-375 C.9 — η όψη κλίσης ακολουθεί το resolved outline χρώμα (SSoT)·
      // fallback στην per-kind παλέτα μόνο αν ο χρήστης μηδένισε το V/G color.
      drawCutPlaneTiltProjection(this.ctx, verts, _tiltShift, (p) => this.worldToScreen(p), _colColor ?? KIND_STROKE[column.kind]);
    }

    this.finalizeRender(entity, options);
  }

  /**
   * Phase 8F — Revit-style dimension pill. Routed through the shared
   * `drawEntityDimLabel` SSoT (bbox + min-footprint gate + formatter + `drawDimPill`).
   * Columns place it `top-mid` — on the line joining the top-face mid-point to the
   * centre, halfway along it (Giorgio 2026-06-19) — instead of the default centre-below.
   */
  private drawCenterDimLabel(column: ColumnEntity): void {
    drawEntityDimLabel(this.ctx, column, column.geometry.bbox, (p) => this.worldToScreen(p), 'top-mid');
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
    // ADR-397 — move/rotation handles (column-center → 4-arrow, column-rotation →
    // curved arrow) get their icon glyph from the shared registry SSoT; other grips
    // stay square. Mapping itself is the shared BIM SSoT (mapBimGrips).
    return mapBimGrips(getColumnGrips(entity as ColumnEntity), (g) => gripGlyphShape(gripKindOf(g, 'column')));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isColumnEntity(entity)) return false;
    const column = entity as ColumnEntity;
    const bb = column.geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject (tolerance) + ray-cast point-in-polygon — shared SSoT.
    return polygonBboxHitTest(bb, column.geometry.footprint.vertices, point, tolerance);
  }

}
