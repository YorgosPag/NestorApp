/**
 * SlabRenderer — ADR-363 Phase 3 + 3.5 + 3.6.
 *
 * 2D plan-view renderer για `SlabEntity`. Reads `entity.geometry`
 * (populated by `computeSlabGeometry()` — SSoT) και draws:
 *   - closed polygon outline (stroke per-kind colour)
 *   - translucent fill per kind
 *   - reinforcement hatch (Phase 3.6) clipped by polygon path:
 *       · one-way → parallel lines (200mm) along the X axis
 *       · two-way → orthogonal grid (300mm)
 *       · waffle  → dense cross-hatch (150mm)
 *       · flat    → dotted grid (250mm)
 *
 * Per-kind palette (industry convention — warm για συμπαγή στοιχεία, cool
 * για ψυχρές επιφάνειες, RC = γκρι):
 *   - floor       → warm grey (γενική πλάκα ορόφου)
 *   - ceiling     → cool blue-grey
 *   - roof        → red-brown (κεραμίδι / RC roof)
 *   - ground      → dark green (έδαφος)
 *   - foundation  → dark grey (RC θεμελίωση)
 *
 * Phase 3.6 NOT implemented (deferred Phase 3.7+):
 *   - Boolean cutout για slab-openings (όταν slab-opening entity εισαχθεί)
 *   - maxFreeSpan analytical (1D beam-direction span detection)
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions
 * σε high-frequency stores. Called by canvas με entity resolved upstream.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.6
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BimFootprintRenderer } from './bim-footprint-renderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isSlabEntity } from '../../types/entities';
import type { SlabEntity, SlabReinforcement } from '../types/slab-types';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { isStructuralComponentVisible } from '../visibility/structural-component-visibility';
import { resolveBimBodyFill, fillBimBodyPath, isArmedSelectedHighlight, BIM_ARMED_BODY_FILL } from '../utils/bim-body-fill';
import { topFacePlanFill } from '../utils/bim-face-plan-fill';
import { bimDashPx } from '../../config/bim-dash-resolver';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getSlabGrips } from '../slabs/slab-grips';
import {
  strokePolygonOutline, polygonBboxHitTest, mapBimGrips, fillPolygonScreen,
} from './bim-polygon-render';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import { KIND_STROKE, KIND_FILL } from '../slabs/slab-render-palette';
// ADR-531 Φ5b.4 — «Μόνο κάτοψη DXF» plan-lines όψη (view flag).
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { getWallCoveringColor } from '../wall-coverings/wall-covering-material-catalog';
import { isFinishActive } from '../finishes/structural-finish-types';
import { hexToRgba } from '../utils/bim-vg-fill-tint';
import { adaptFillTintForCanvas, liveStrokeInk } from '../../config/adaptive-entity-color';
import { paintClippedAreaHatch, type AreaHatchMotif } from './shared/canvas-hatch-fill';

/**
 * Μοτίβο ανά οικογένεια οπλισμού — «hint» στην κάτοψη (το αχνό μελάνι και το πάχος ζουν στο `canvas-hatch-fill`):
 * one-way παράλληλες · two-way / waffle κάνναβος · flat πλέγμα τελειών ακτίνας 1 px.
 */
const HATCH_MOTIF: Readonly<Record<SlabReinforcement, AreaHatchMotif>> = {
  'one-way': 'lines',
  'two-way': 'grid',
  'waffle':  'grid',
  'flat':    { dotRadiusPx: 1 },
};

/** World-space spacing (mm) per reinforcement family. */
const HATCH_SPACING_MM: Readonly<Record<SlabReinforcement, number>> = {
  'one-way': 200,
  'two-way': 300,
  'waffle':  150,
  'flat':    250,
};

/** ADR-363 Phase 3.7 — per-frame slab-opening index keyed by host slab id. */
export type SlabOpeningsBySlab = ReadonlyMap<string, ReadonlyArray<SlabOpeningEntity>>;

export class SlabRenderer extends BimFootprintRenderer {
  /**
   * ADR-363 Phase 3.7 — per-frame map of slab-openings keyed by host slab id.
   * Forwarded by `EntityRendererComposite.setSlabOpeningsBySlab()` ώστε ο
   * renderer να τρυπάει boolean cutouts στο slab fill σε κάθε hosted
   * opening outline (visual "hole" κατ' αντιστοιχία με WallRenderer Phase 2.5).
   *
   * Empty map ⇒ legacy behaviour (no cutout). Renderer never subscribes —
   * caller rebuilds the map once per frame and pushes via setter (micro-leaf
   * compliant, ADR-040).
   */
  private slabOpeningsBySlab: SlabOpeningsBySlab = new Map();

  /** Inject per-frame slab-opening index. Composite calls this once per render. */
  setSlabOpeningsBySlab(map: SlabOpeningsBySlab): void {
    this.slabOpeningsBySlab = map;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isSlabEntity(entity)) return;
    const slab = entity as SlabEntity;

    // ADR-382 — Unified visibility check (V/G + Layer + Floor + Building).
    const _slabLayer = slab.layerId ? getLayer(slab.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'slab', layerId: slab.layerId, discipline: slab.discipline }, _slabLayer)) return;

    if (!slab.geometry || !slab.params) return;
    const verts = slab.geometry.polygon.vertices;
    if (verts.length < 3) return;

    // ADR-531 Φ5b.4 — «Μόνο κάτοψη DXF»: μόνο το περίγραμμα της πλάκας (καθαρή γραμμή),
    // χωρίς γέμισμα/διαγράμμιση/οπλισμό — όπως το top-view του Τέκτονα.
    if (useBimRenderSettingsStore.getState().planLinesOnly) {
      strokePolygonOutline(this.ctx, (p) => this.worldToScreen(p), verts, slab.color ?? KIND_STROKE[slab.kind]);
      this.finalizeRender(entity, options);
      return;
    }

    // ADR-470 — core (σώμα πλάκας) component gate. Κρυμμένο → παραλείπουμε το σχέδιο.
    if (!isStructuralComponentVisible('core', slab)) {
      this.finalizeRender(entity, options);
      return;
    }

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo via outline thicker glow.
    this.paintHoverHalo(verts, phaseState.phase === 'highlighted');

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();
    // ADR-375 v2.12 — V/G category color tints the body fill (SSoT helper).
    const _slabStyles = useDrawingScaleStore.getState().objectStyles;
    const _slabZTop = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
    const _slabCutState = resolveCutState(
      { zBottomMm: _slabZTop - slab.params.thickness, zTopMm: _slabZTop, category: 'slab' },
      useDrawingScaleStore.getState().viewRange,
    );
    // Fill first, hatch clipped inside, stroke on top so outline stays sharp.
    // FULL SSoT (bim-body-fill) — ίδιος κώδικας body-fill με όλα τα BIM (V/G tint ??
    // παλέτα → background-adaptive boost ⇒ ΙΔΙΑ διαφάνεια σε κάθε φόντο).
    // ADR-539 Φ3e — η βαμμένη ΑΝΩ όψη (Cinema 4D «Polygon Mode») γίνεται το χρώμα γεμίσματος
    // στην κάτοψη (top cap = ό,τι βλέπουμε από πάνω)· αλλιώς το legacy V/G body fill.
    // Revit background+foreground pattern (bim-body-fill) — opaque base occludes
    // drawing aids beneath the slab, poché tint on top.
    // Armed-transform selection wins over the top-face paint + V/G tint → orange poché.
    const _slabArmed = isArmedSelectedHighlight(options);
    const _slabBodyFill = _slabArmed
      ? BIM_ARMED_BODY_FILL
      : (topFacePlanFill(slab) ?? resolveBimBodyFill('slab', _slabCutState, _slabStyles, KIND_FILL[slab.kind]));
    this.drawPolygonPath(verts);
    fillBimBodyPath(this.ctx, _slabBodyFill, _slabCutState);

    // ADR-534 Φ4 — soffit finish swatch (reflected ceiling plan): tint πάνω από το body fill.
    this.drawSoffitFinishTint(slab, verts);

    if (slab.params.reinforcement) {
      this.drawReinforcementHatch(slab);
    }

    // ADR-363 Phase 3.7 — subtract hosted slab-opening outlines από το fill.
    this.punchHostedSlabOpenings(slab);

    const _slabLayerOverride = _slabLayer ? {
      lineweightMm: isConcreteLineweight(_slabLayer.lineweight) ? _slabLayer.lineweight : undefined,
      color: _slabLayer.color ?? undefined,
    } : undefined;
    const { lineWidthPx: _slabLwPx, linePattern: _slabPattern, color: _slabColor } = resolveSubcategoryStyle({
      category: 'slab', subcategoryKey: 'common-edges',
      cutState: _slabCutState, scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      dpi: 96, objectStyles: _slabStyles,
      elementOverride: slab.styleOverride, layerOverride: _slabLayerOverride,
    });
    this.ctx.lineWidth = _slabLwPx;
    this.ctx.setLineDash(bimDashPx(_slabPattern, this.transform.scale));
    // Armed-selection keeps the ORANGE stroke from applyPhaseStyle (skip category override).
    // ADR-909 Γ2.8 — η εφεδρεία χρώματος ρωτά την πολιτική εκτύπωσης (το `_slabColor` την έχει ήδη περάσει).
    if (!_slabArmed) this.ctx.strokeStyle = _slabColor ?? liveStrokeInk(KIND_STROKE[slab.kind]);
    this.drawPolygonPath(verts);
    this.ctx.stroke();
    this.ctx.restore();

    this.finalizeRender(entity, options);
  }

  /**
   * ADR-534 Φ4 — RCP swatch: λεπτό tint στο χρώμα του soffit finish (μόνο ceiling πλάκα).
   * FULL SSoT reuse (`getWallCoveringColor` + `hexToRgba` + `adaptFillTintForCanvas`, ΙΔΙΟ με
   * `FloorFinishRenderer`). No-op όταν δεν είναι ceiling ή δεν έχει finish (raw σκυρόδεμα).
   */
  private drawSoffitFinishTint(slab: SlabEntity, verts: readonly Point2D[]): void {
    // ADR-534 Φ5 (Απόφαση Β) — suppress όταν ενεργός `finish` (σοβάς πλάκας): ο σοβάς είναι το
    // φινίρισμα της κάτω παρειάς· το `soffitFinish` paint καταστέλλεται (μηδέν διπλή στρώση, 2Δ↔3Δ
    // parity με το `attachSoffitFinish`). Ανενεργός finish → byte-for-byte η προ-Φ5 συμπεριφορά.
    if (slab.kind !== 'ceiling' || !slab.params.soffitFinish || isFinishActive(slab.params.finish)) return;
    const hex = getWallCoveringColor(slab.params.soffitFinish.materialId);
    this.ctx.save();
    this.ctx.fillStyle = adaptFillTintForCanvas(hexToRgba(hex, 0.18) ?? hex);
    this.drawPolygonPath(verts);
    this.ctx.fill();
    this.ctx.restore();
  }

  /**
   * ADR-363 Phase 3.7 — subtract κάθε hosted slab-opening outline από το ήδη
   * ζωγραφισμένο slab fill via `destination-out`. Scoped save/restore κρατά
   * το composite mode τοπικά. Silent skip όταν δεν υπάρχουν openings
   * (legacy behaviour preserved). Mirrors WallRenderer.punchHostedOpenings.
   */
  private punchHostedSlabOpenings(slab: SlabEntity): void {
    const openings = this.slabOpeningsBySlab.get(slab.id);
    if (!openings || openings.length === 0) return;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    for (const opening of openings) {
      const verts = opening.geometry?.polygon.vertices;
      if (!verts || verts.length < 3) continue;
      fillPolygonScreen(this.ctx, (p) => this.worldToScreen(p), verts);
    }
    this.ctx.restore();
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-363 Phase 3.5 + 3.6 — parametric slab grips (per-vertex translate +
    // edge-midpoint vertex insertion). Commit routed through
    // `applySlabGripDrag()` + `UpdateSlabParamsCommand` by `commitSlabGripDrag`
    // (grip-commit-adapter), with Shift driving rectilinear quantization.
    if (!isSlabEntity(entity)) return [];
    return mapBimGrips(getSlabGrips(entity as SlabEntity));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isSlabEntity(entity)) return false;
    const slab = entity as SlabEntity;
    const bb = slab.geometry?.bbox;
    if (!bb) return false;
    // Bbox quick-reject (tolerance) + ray-cast point-in-polygon — shared SSoT.
    return polygonBboxHitTest(bb, slab.geometry.polygon.vertices, point, tolerance);
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /**
   * Phase 3.6 — light hatch hint per reinforcement family. Drawn in world
   * space, clipped by the polygon outline so the pattern never bleeds
   * outside the slab. Stroke kept faint (0.15 opacity) so the outline +
   * fill stay readable.
   */
  private drawReinforcementHatch(slab: SlabEntity): void {
    const reinforcement = slab.params.reinforcement;
    if (!reinforcement) return;
    // ADR-909 Γ2.6β — clip + μελάνι (ρωτά την πολιτική εκτύπωσης) + μοτίβο ζουν ΜΙΑ φορά στο `canvas-hatch-fill`·
    // εδώ μόνο το mapping οικογένειας οπλισμού → μοτίβο + βήμα.
    paintClippedAreaHatch(
      this.ctx, (p) => this.worldToScreen(p), slab.geometry.polygon.vertices, slab.geometry.bbox,
      HATCH_SPACING_MM[reinforcement], HATCH_MOTIF[reinforcement],
    );
  }
}
