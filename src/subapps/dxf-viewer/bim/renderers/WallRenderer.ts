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
import { closedRingFromEdges } from '../geometry/shared/polygon-utils';
import type { Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import type { WallEntity } from '../types/wall-types';
import { WALL_CATEGORY_FILL, WALL_LINE_CONTRAST, wallFootprintSubcategory } from '../walls/wall-render-palette';
import type { OpeningEntity } from '../types/opening-types';
import type { Point3D } from '../types/bim-base';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { resolveSubcategoryStyle, type BimLayerOverride } from '../../config/bim-line-weight-resolver';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { isStructuralComponentVisible } from '../visibility/structural-component-visibility';
import { resolveBimBodyFill } from '../utils/bim-body-fill';
import { bimDashPx } from '../../config/bim-dash-resolver';
import { resolveCutState } from '../../config/bim-view-range';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
// ADR-509 — background-adaptive entity color (near-black wall visible on dark canvas).
import { adaptEntityColorForCanvas, adaptStructuralLineColorForCanvas } from '../../config/adaptive-entity-color';
import { getWallGrips, wallGripGlyphShape } from '../walls/wall-grips';
import { drawEntityDimLabel } from '../labels/bim-dim-labels';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
// ADR-507 Φ7 — unified material poché (αντικαθιστά το wall-hatch-patterns engine).
import { computeMaterialHatchSegments } from '../geometry/shared/material-hatch-geometry';
import {
  paintMaterialHatchSegments,
  MATERIAL_HATCH_STROKE_RGBA,
} from './shared/material-hatch-paint';
import { wallCutPlaneShiftCanvas } from '../geometry/cut-plane-tilt';
import { drawCutPlaneTiltProjection, cutPlaneShiftScreenDelta } from './cut-plane-tilt-projection';
import { wallLayerBoundaryPolylines } from '../walls/wall-layer-lines-2d';
// N.7.1 split — pure Canvas2D path-tracing helpers extracted to keep this renderer <500 lines.
import { traceWallBody, strokePerimeterOutline, strokePolyline } from './wall-render-paths';
// ADR-509 §axis-clip — κόβει τον άξονα στην παρειά κολώνας (reuse segment-polygon-coverage SSoT).
import { clipPolylineOutsidePolygons } from '../walls/wall-axis-clip';

const AXIS_DASH: readonly [number, number] = [6, 4];

/** ADR-404 Phase 3 — muted slate για το cut-plane projection outline + connectors. */
const TILT_PROJECTION_STROKE = '#5b6478';

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

  /**
   * ADR-509 §axis-clip — per-frame λίστα column footprints (plan space). Ο άξονας
   * (dashed centerline) κόβεται στην παρειά αυτών των σωμάτων ώστε να μη «διαπερνά»
   * την κολώνα (Revit/AutoCAD location-line behaviour). Empty ⇒ legacy (χωρίς clip).
   * Renderer never subscribes — ο composite το σπρώχνει μία φορά/frame (ADR-040).
   */
  private columnFootprints: readonly (readonly Point2D[])[] = [];

  /** Inject per-frame column footprints (axis clip). Composite calls once per render. */
  setColumnFootprints(footprints: readonly (readonly Point2D[])[]): void {
    this.columnFootprints = footprints;
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isWallEntity(entity)) return;
    const wall = entity as WallEntity;

    // ADR-382 — Unified visibility check (V/G + Layer + Floor + Building).
    // Layer fetched here is reused για BimLayerOverride downstream (zero extra cost).
    // Runs BEFORE the geometry/params guard so V/G + Layer suppression applies
    // uniformly even σε partially-loaded entities (mirror του ADR-375 v2.6 order).
    const _wLayer = wall.layerId ? getLayer(wall.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'wall', layerId: wall.layerId, discipline: wall.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer: _wLayer,
      },
    )) return;

    if (!wall.geometry || !wall.params) return;

    // ADR-470 — core (σώμα τοίχου) component gate. Κρυμμένο → παραλείπουμε το σχέδιο
    // του σώματος· ο σοβάς (scene-level silhouette) προβάλλεται ανεξάρτητα.
    if (!isStructuralComponentVisible('core', wall)) {
      this.finalizeRender(entity, options);
      return;
    }

    // ADR-404 Phase 3 — Revit cut-plane προβολή του battered τοίχου. Το πλήρες σώμα
    // (cut στυλ) μεταφέρεται στο **cut plane** (⟂ run)· η **βάση** ζωγραφίζεται λεπτή
    // + connecting lines μετά (cut=βαρύ/base=ελαφρύ). Render-time μόνο — ΟΧΙ μέσα στο
    // `computeWallGeometry` (μοιράζεται με 3Δ/grips/hit/BOQ).
    const _tiltShift = wallCutPlaneShiftCanvas(
      wall.params,
      useDrawingScaleStore.getState().viewRange.cutPlaneMm,
    );
    if (_tiltShift) {
      const d = cutPlaneShiftScreenDelta(_tiltShift, (p) => this.worldToScreen(p));
      this.ctx.save();
      this.ctx.translate(d.x, d.y);
    }

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
      strokePerimeterOutline(
        this.ctx, (p) => this.worldToScreen(p),
        wall.geometry.outerEdge.points, wall.geometry.innerEdge.points,
      );
      this.ctx.restore();
    }

    // Main pass — phase style + fill + hatch + stroke.
    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    const _wLayerOverride: BimLayerOverride | undefined = _wLayer ? {
      lineweightMm: isConcreteLineweight(_wLayer.lineweight) ? _wLayer.lineweight : undefined,
      color: _wLayer.color ?? undefined,
    } : undefined;
    const _edgeColorRaw = this.drawFootprint(wall, _wLayerOverride);
    this.drawMaterialHatch(wall, _wLayerOverride);
    this.drawDnaLayerLines(wall);
    this.drawAxis(wall, _edgeColorRaw);

    // ADR-404 Phase 3 — κλείσιμο translate (cut σώμα)· βάση λεπτή + connecting lines.
    // Το ring = outer (fwd) + inner (reversed), ίδιο με το footprint του τοίχου.
    if (_tiltShift) {
      this.ctx.restore();
      const outer = wall.geometry.outerEdge.points;
      const inner = wall.geometry.innerEdge.points;
      if (outer.length >= 2 && inner.length >= 2) {
        const ring = closedRingFromEdges(outer, inner);
        drawCutPlaneTiltProjection(
          this.ctx, ring, _tiltShift, (p) => this.worldToScreen(p), TILT_PROJECTION_STROKE,
        );
      }
    }

    // Revit-style centred dimension pill (hover/select) — shared SSoT.
    if (phaseState.phase === 'highlighted' || options.selected) {
      drawEntityDimLabel(this.ctx, wall, wall.geometry.bbox, (p) => this.worldToScreen(p));
    }

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
      // ADR-363 Phase 1C-ter — carry the icon glyph for the move/rotation handles
      // (midpoint → 4-arrow, wall-rotation → curved arrow), mirror StairRenderer.
      shape: wallGripGlyphShape(g.wallGripKind),
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
    const ring: Point2D[] = closedRingFromEdges(outer, inner).map((p) => ({ x: p.x, y: p.y }));
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
  private drawFootprint(wall: WallEntity, layerOverride?: BimLayerOverride): string | null {
    const outer = wall.geometry.outerEdge.points;
    const inner = wall.geometry.innerEdge.points;
    // ADR-458 — DERIVED footprint κομμένο στις παρειές τεμνόντων κολωνών («η κολόνα νικάει»).
    // Απών → πλήρες outer+inner ring (μηδέν regression)· `[]` = τοίχος εξ ολοκλήρου μέσα σε
    // κολόνα (δεν σχεδιάζεται)· ≥1 rings = τα κομμάτια που απομένουν.
    const pieces = wall.geometry.displayFootprint;
    if (pieces === undefined && (outer.length < 2 || inner.length < 2)) return null;
    if (pieces !== undefined && pieces.length === 0) return null;

    const cat = wall.params.category;
    const _styles = useDrawingScaleStore.getState().objectStyles;
    // ADR-401 B3c — cut-state = nominal `baseOffset + height` ΣΚΟΠΙΜΑ (όχι attached
    // top profile). Είναι render leaf (ADR-040 — ΔΕΝ σκανάρει hosts). Το cut plane
    // (~1.2m) πέφτει πάντα μεταξύ base και attached top (~2.5m) όσο και του nominal →
    // η cut-state μένει 'cut' και στις δύο περιπτώσεις = NO-OP. (Θα διέφερε μόνο αν
    // ένα δοκάρι κατέβαζε την κορυφή κάτω από το cut plane — extreme edge case που θα
    // απαιτούσε host scan σε leaf· εκτός scope, δες ADR-401 §5 B3c.)
    const _cutState = resolveCutState(
      { zBottomMm: wall.params.baseOffset ?? 0, zTopMm: (wall.params.baseOffset ?? 0) + wall.params.height, category: 'wall' },
      useDrawingScaleStore.getState().viewRange,
    );
    // ADR-375 C.9 — εσωτ./διαχωριστικός τοίχος → subcategory `interior` (γκρι line color)·
    // εξωτ./parapet/fence → `common-edges` (κενό color → parent = εξωτ. βαρύ χρώμα).
    const { lineWidthPx: _edgePx, linePattern: _edgePattern, color: _edgeColor } = resolveSubcategoryStyle({
      category: 'wall', subcategoryKey: wallFootprintSubcategory(cat),
      cutState: _cutState, scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      dpi: 96, objectStyles: _styles,
      elementOverride: wall.styleOverride, layerOverride,
    });
    // ADR-375 v2.12 — V/G category color tints the body fill (SSoT helper).
    // ADR-509 / FULL SSoT (bim-body-fill) — ίδιος κώδικας body-fill με κολώνα & όλα τα
    // BIM: V/G tint ?? παλέτα → background-adaptive boost ⇒ ΙΔΙΑ διαφάνεια σε κάθε φόντο.
    this.ctx.fillStyle = resolveBimBodyFill('wall', _cutState, _styles, WALL_CATEGORY_FILL[cat]);
    this.ctx.lineWidth = _edgePx;
    this.ctx.setLineDash(bimDashPx(_edgePattern, this.transform.scale));

    // Build closed polygon: outer (start→end) + inner (end→start) reverses
    // so the perimeter is well-oriented for fill. ADR-458 — cut pieces όταν τέμνεται
    // από κολόνα (multi-subpath), αλλιώς το πλήρες ring.
    traceWallBody(this.ctx, (p) => this.worldToScreen(p), outer, inner, pieces);
    this.ctx.fill();

    // ADR-363 Phase 2.5 — subtract hosted opening outlines from the fill.
    this.punchHostedOpenings(wall);

    // ADR-396 fix — `punchHostedOpenings` issues its own `beginPath()` calls, so
    // the current canvas path is now the LAST opening rectangle, NOT the wall
    // ring (save/restore does NOT restore the path). Re-trace the ring before
    // stroking, else the wall outline + mitred corners vanish when an opening
    // is hosted (the stroke would draw the opening rect instead).
    traceWallBody(this.ctx, (p) => this.worldToScreen(p), outer, inner, pieces);
    // ADR-509 — background-adaptive + σαφώς φωτεινό δομικό γκρι (WALL_LINE_CONTRAST), χωρίς
    // ξέπλυμα ζωηρών V/G overrides: near-black #2b2f36 → ανοιχτό γκρι· κόκκινο override → μένει.
    if (_edgeColor !== null) this.ctx.strokeStyle = adaptStructuralLineColorForCanvas(_edgeColor, WALL_LINE_CONTRAST);
    this.ctx.stroke();
    return _edgeColor;
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

    // ADR-375 — only an opening genuinely CUT by the active plane punches a hole
    // in the wall fill. An opening above/below the cut plane (e.g. a high window,
    // sill 2000mm vs cut 1200mm) must read as a solid wall (Revit parity) — the
    // OpeningRenderer draws its dashed "<Beyond>" projection instead. Pre-filter
    // BEFORE switching composite mode so a wall with only off-plane openings
    // never enters the destination-out pass at all.
    const _viewRange = useDrawingScaleStore.getState().viewRange;
    const cutOpenings = openings.filter((o) =>
      resolveCutState(
        { zBottomMm: o.params.sillHeight, zTopMm: o.params.sillHeight + o.params.height, category: 'opening' },
        _viewRange,
      ) === 'cut',
    );
    if (cutOpenings.length === 0) return;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    // The wall fill was painted with the translucent category tint (alpha ≈ 0.18)
    // and the phase `globalAlpha`. `destination-out` erases dst·(1 − src.alpha),
    // so inheriting those low alphas would clear only ~18% of the fill → the hole
    // is imperceptible (the "wall doesn't open at the doorway" bug). Force a fully
    // opaque source so the punch removes 100% of the wall pixels (clean doorway).
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = '#000';
    for (const opening of cutOpenings) {
      // ADR-396 — η τρύπα στον τοίχο = STRUCTURAL outline (free + reveal margin) ώστε
      // η περιμετρική μόνωση Z4 να γεμίζει το δαχτυλίδι σε ΤΡΥΠΑ, όχι πάνω σε γεμάτο
      // τοίχο. Χωρίς reveal → revealOutline undefined → free outline (αμετάβλητο).
      const verts = opening.geometry?.revealOutline?.vertices ?? opening.geometry?.outline.vertices;
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

  /**
   * Axis polyline rendered dashed-thin (centerline visual aid). ADR-509 — η γραμμή άξονα
   * δεν είχε explicit χρώμα (κληρονομούσε το τελευταίο stroke)· τώρα παίρνει το **ίδιο
   * background-adaptive φωτεινό** χρώμα με το outline (`WALL_LINE_CONTRAST`) ώστε να ξεχωρίζει.
   *
   * ADR-509 §axis-clip — ο άξονας κόβεται στην παρειά τυχόν κολώνας που τον σκεπάζει
   * (Revit/AutoCAD location line σταματά στο σώμα, δεν το διαπερνά). Το clip γίνεται μέσω
   * του ΕΝΟΣ `coveredIntervals`/`exposedComplement` SSoT (segment-polygon-coverage). Χωρίς
   * column footprints (default) → ένα run = ο άξονας αυτούσιος (μηδέν regression).
   */
  private drawAxis(wall: WallEntity, edgeColor: string | null): void {
    const axis = wall.geometry.axisPolyline.points;
    if (axis.length < 2) return;
    this.ctx.save();
    this.ctx.setLineDash(AXIS_DASH as unknown as number[]);
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    if (edgeColor !== null) {
      this.ctx.strokeStyle = adaptStructuralLineColorForCanvas(edgeColor, WALL_LINE_CONTRAST);
    }
    const runs = clipPolylineOutsidePolygons(axis, this.columnFootprints);
    for (const run of runs) {
      strokePolyline(this.ctx, (p) => this.worldToScreen(p), run);
    }
    this.ctx.restore();
  }

  /**
   * Phase 4.5e-B — per-material hatch inside wall body clip.
   * Skip for DNA-bearing walls (per-layer DNA rendering governs materials).
   * Skip at extreme zoom-out (scale < 0.001, perf saver).
   */
  private drawMaterialHatch(wall: WallEntity, layerOverride?: BimLayerOverride): void {
    if (wall.params.dna) return;
    if (this.transform.scale < 0.001) return;

    const outer = wall.geometry.outerEdge.points;
    const inner = wall.geometry.innerEdge.points;
    if (outer.length < 2 || inner.length < 2) return;

    const _hatchCutState = resolveCutState(
      { zBottomMm: wall.params.baseOffset ?? 0, zTopMm: (wall.params.baseOffset ?? 0) + wall.params.height, category: 'wall' },
      useDrawingScaleStore.getState().viewRange,
    );

    // ADR-507 Φ7 — υλικό + cutState → PAT pattern (MATERIAL_HATCH_MAP). Όριο = το wall
    // body ring (outer + reversed inner ως ΕΝΑ closed polygon)· τα segments έρχονται
    // ήδη clipped (μηδέν `ctx.clip()`).
    // ADR-458 — όταν τέμνεται από κολόνα, το hatch κλιπάρεται στα cut pieces (`displayFootprint`),
    // αλλιώς το hatch θα γέμιζε την περιοχή της κολόνας και θα έκρυβε το cut. `[]` = πλήρης
    // κατανάλωση → κανένα hatch.
    const pieces = wall.geometry.displayFootprint;
    const boundary: Point3D[][] = pieces
      ? pieces.map((r) => r.map((p) => ({ x: p.x, y: p.y, z: 0 })))
      : [closedRingFromEdges(outer, inner)];
    if (boundary.length === 0) return;
    const segments = computeMaterialHatchSegments(boundary, wall.params.material, _hatchCutState);
    if (segments.length === 0) return;

    // V/G cut-pattern override (color + line pattern) διατηρείται (wall-specific).
    const { linePattern: _hatchPattern, color: _hatchColor } = resolveSubcategoryStyle({
      category: 'wall', subcategoryKey: 'cut-pattern',
      cutState: _hatchCutState, scaleDenominator: useDrawingScaleStore.getState().drawingScale,
      objectStyles: useDrawingScaleStore.getState().objectStyles,
      elementOverride: wall.styleOverride, layerOverride,
    });

    // ADR-509 — background-adaptive hatch stroke (visible on dark canvas).
    paintMaterialHatchSegments(this.ctx, segments, (p) => this.worldToScreen(p), {
      strokeStyle: adaptEntityColorForCanvas(_hatchColor ?? MATERIAL_HATCH_STROKE_RGBA),
      dashPx: bimDashPx(_hatchPattern, this.transform.scale),
    });
  }

  /**
   * ADR-413/447 · ADR-449 — per-layer boundary lines για DNA τοίχους σε κάτοψη.
   * Συμπληρώνει το `drawMaterialHatch` (που παρακάμπτει DNA τοίχους): ζωγραφίζει τις
   * εσωτερικές γραμμές διαχωρισμού στρώσεων (σοβάς|πυρήνας|σοβάς) ώστε η ζώνη σοβά να
   * φαίνεται στην κάτοψη — συνεπές με το finish περίγραμμα της κολόνας στη συμβολή.
   * REUSE pure SSoT `wallLayerBoundaryPolylines`. Skip σε extreme zoom-out (perf, mirror hatch).
   */
  private drawDnaLayerLines(wall: WallEntity): void {
    if (!wall.params.dna) return;
    if (this.transform.scale < 0.001) return;
    const outer = wall.geometry.outerEdge.points;
    const inner = wall.geometry.innerEdge.points;
    if (outer.length < 2 || inner.length < 2) return;
    const lines = wallLayerBoundaryPolylines(outer, inner, wall.params.dna);
    if (lines.length === 0) return;

    this.ctx.save();
    this.ctx.strokeStyle = MATERIAL_HATCH_STROKE_RGBA;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    this.ctx.setLineDash([]);
    for (const poly of lines) strokePolyline(this.ctx, (p) => this.worldToScreen(p), poly);
    this.ctx.restore();
  }
}
