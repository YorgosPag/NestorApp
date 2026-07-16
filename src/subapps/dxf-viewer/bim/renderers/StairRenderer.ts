/**
 * StairRenderer — ADR-358 Phase 5b + Phase 7b1 (G15 + §6.2 partial).
 *
 * 2D plan-view renderer for a `StairEntity`. Reads `entity.geometry`
 * (populated by `computeStairGeometry()` — the SSoT) and draws:
 *   - treads (solid polygons, below-cut)
 *   - treadsAboveCut (dashed outline, no fill — hidden-line convention)
 *   - walkline (dashed polyline)
 *   - inner / outer stringers (solid bold)
 *   - handrails (dashed thin, with ADA extensions when codeProfile === 'ada')
 *   - arrow + UP/DOWN label
 *   - parametric grips (5 kinds, §5.12)
 *
 * Phase 7b1 adds handrail render derived from stringers + params.handrails.
 * ADA-driven extensions (305mm top horizontal, one-tread bottom) extend
 * the handrail polyline beyond the stringer ends along the local tangent.
 *
 * Risers, cutLine zigzag land in later phases when the full §6.2 pipeline is
 * wired. Above-cut treads now render (dashed hidden-line, 2026-07-10, ADR-619).
 *
 * ADR-363 Phase 0.5 — moved from rendering/entities/StairRenderer.ts to
 * bim/renderers/StairRenderer.ts. Backward-compat barrel stub kept at old path.
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../../rendering/types/Types';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../rendering/types/Types';
import type { StairEntity } from '../types/stair-types';
import type { Entity } from '../../types/entities';
import { isStairEntity } from '../../types/entities';
import { getStairGrips, stairGripGlyphShape } from '../stairs/stair-grips';
import { gripKindOf } from '../../hooks/grip-kinds';
// ADR-637 Φ4-D — fuchsia identity colour for the rest-landing (πλατύσκαλο) grips (Giorgio «φουξ»).
import { GRIP_REST_LANDING_COLOR } from '../../config/color-config';
import { resolveSubcategoryStyle } from '../../config/bim-line-weight-resolver';
import { resolveBimPlanVisibility } from '../visibility/bim-plan-visibility';
import { isStructuralComponentVisible } from '../visibility/structural-component-visibility';
import { resolveVgFillTint } from '../utils/bim-vg-fill-tint';
import { type LinePatternKey } from '../../config/bim-line-patterns';
import { bimDashPx } from '../../config/bim-dash-resolver';
import { type CutState } from '../../config/bim-view-range';
import { clipStairGeometryAtSection } from '../geometry/stairs/stair-section-clip';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { getLayer } from '../../stores/LayerStore';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
// ADR-358 Phase 7c — per-structureType plan symbology lives in a dedicated
// module so the per-style branches (monolithic / stringer-1side / central /
// cantilever / suspended / glass / grating) stay testable in isolation and
// this file stays under the 500-line SRP limit.
import {
  renderStringersForStructure,
  renderTreadsForStructure,
  type StairStyleContext,
} from './stair-render-structure-style';
// ADR-358 Phase 7b1 — pure handrail-extension helpers live in a sibling module so
// this file stays under the 500-line SRP limit (N.7.1 / ADR-623 Φ2).
import {
  pickTopExtensionMm,
  pickBottomExtensionMm,
  extendPolylineEnds,
} from './stair-handrail-extension';
// ADR-358 Q19 Φ3a — 2D per-tread selection highlight (reads the SHARED sub-element
// store; low-freq redraw via the canvas leaf subscription — "3D mirrors 2D").
import { drawStairSubElementHighlight } from './stair-sub-element-highlight-2d';
import {
  useStairSubElementSelectionStore,
  getStairSubElementHover,
} from '../stairs/stair-sub-element-selection-store';
// ADR-358 Phase 8 — hover/highlight halo geometry (footprint outline + OBB fallback)
// lives in a sibling module (file-size SRP split, N.7.1).
import { drawStairPerimeterOutline } from './stair-perimeter-outline';

const ARROW_HEAD_PX = 10;
const ARROW_HEAD_HALF_WIDTH_PX = 5;
const LABEL_OFFSET_PX = 8;

export class StairRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isStairEntity(entity)) return;
    const stair = entity as StairEntity;

    // ADR-382 — Unified visibility check (V/G + Layer + Floor + Building).
    const _stairLayer = stair.layerId ? getLayer(stair.layerId) : null;
    if (!resolveBimPlanVisibility({ category: 'stair', layerId: stair.layerId, discipline: stair.discipline }, _stairLayer)) return;
    // ADR-358 Phase 8 — defensive: legacy / partially-serialized stair entries
    // can arrive without `geometry` (e.g. Storage scene blob saved before the
    // ADR §G6 contract was enforced). Skip render rather than crash so the
    // rest of the scene renders normally; the entity is also dropped from
    // hit-testing via the matching guard in HitTestingService.
    if (!stair.geometry || !stair.params) return;

    // ADR-470 — core (σώμα σκάλας) component gate. Κρυμμένο → παραλείπουμε το σχέδιο.
    if (!isStructuralComponentVisible('core', stair)) {
      this.finalizeRender(entity, options);
      return;
    }
    // ADR-401 Phase G.2 — attach-to-structural NO-OP στο 2D (mirror `ColumnRenderer`
    // F.2). Ο 2D renderer είναι ADR-040 leaf — ΔΕΝ σκανάρει hosts (δοκάρια/πλάκες).
    // Το re-step μιας `attached` σκάλας (resolved `stepCount`/`rise`) εφαρμόζεται
    // στους consumers που έχουν host context: 3D (`BimSceneLayer.syncStairs`) +
    // BOQ (`stair-boq-sync`), μέσω της SSoT `resolveEffectiveStairParams`. Η κάτοψη
    // ζωγραφίζει το persisted (nominal) `geometry`. (Effective plan = G.3 αν χρειαστεί.)
    const { geometry } = stair;

    // ADR-358 Phase 8 — manual phase pipeline.
    // We CANNOT use the SSoT `renderWithPhases` helper as-is: it calls
    // `renderGeometry()` once during the glow pre-pass and again for the main
    // pass. For lines/circles that is fine (stroke-only), but the stair
    // renders multiple FILLED tread polygons in the same callback. The fill
    // grey rgba painted during the glow pre-pass covers the glow stroke of
    // adjacent treads, leaving the stair without the hover halo (regression
    // observed 2026-05-17). Solution: keep the same phase semantics but
    // suppress the tread fill during the glow pre-pass — only the outlines
    // are stroked with the hover-glow colour. The main pass restores the
    // normal style + full fill+stroke, identical to the non-hover render.
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
      // Industry pattern for composite entities (AutoCAD/Revit blocks &
      // groups): the hover halo is the bounding-box outline rather than a
      // per-primitive glow. A per-primitive halo on a stair gets clobbered
      // by the next tread's fill before it reaches the screen — only the
      // outermost ring survives. Drawing the bbox once gives a guaranteed
      // continuous magenta halo around the whole stair, identical in
      // perceived weight to the per-line glow of simpler entities.
      drawStairPerimeterOutline(this.ctx, (p) => this.worldToScreen(p), stair);
      this.ctx.restore();
    }

    // Main pass — phase-appropriate style + full fill+stroke render.
    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);

    // ADR-375 Phase B (2026-05-26) — resolve line weight ONCE per render.
    // All stair plan lines (treads, stringers, walkline, handrails, arrow)
    // share the same resolver-computed width. Visual differentiation stays
    // via dash patterns (walkline / handrails / suspended stringers); pixel
    // width itself is scale + objectStyles reactive (NOT section-slider reactive —
    // the stair convention is fixed, ADR-619 Bug #4).
    const ds = useDrawingScaleStore.getState();
    // ADR-619 Bug #4 — Decouple the stair plan CONVENTION from the section slider.
    // Plan symbology is resolved at a FIXED 'cut' state (a stair is a cut element
    // in plan by Revit convention), so moving the «Επίπεδο τομής» slider never
    // restyles the stair — lineweight / color / pattern stay stable. The slider
    // acts ONLY as a visibility clip (applied to the geometry below).
    const cutState: CutState = 'cut';
    const _stairLayerOverride = _stairLayer ? {
      lineweightMm: isConcreteLineweight(_stairLayer.lineweight) ? _stairLayer.lineweight : undefined,
      color: _stairLayer.color ?? undefined,
    } : undefined;
    // ADR-377 C.3 — per-subcategory style resolution.
    const _rss = (subcat: string) => resolveSubcategoryStyle({
      category: 'stair', subcategoryKey: subcat,
      cutState, scaleDenominator: ds.drawingScale, dpi: 96, objectStyles: ds.objectStyles,
      elementOverride: stair.styleOverride, layerOverride: _stairLayerOverride,
    });
    const _treadsS    = _rss('treads');
    const _stringersS = _rss('outlines');
    const _walklineS  = _rss('walkline');
    const _handrailsS = _rss('handrails');
    const _arrowLabel = geometry.arrowSymbol.label;
    const _arrowS     = _rss(_arrowLabel === 'UP' ? 'up-arrows' : 'down-arrows');

    const scx: StairStyleContext = {
      ctx: this.ctx,
      worldToScreen: (p) => this.worldToScreen(p),
      baseLineWidth: _treadsS.lineWidthPx,
      treadsLineWidth: _treadsS.lineWidthPx,
      stringersLineWidth: _stringersS.lineWidthPx,
      // ADR-375 v2.12 — V/G category color tints stair treads (SSoT helper).
      vgFillTint: resolveVgFillTint('stair', cutState, ds.objectStyles),
    };
    // ADR-619 Bug #5 (Giorgio) — ΟΛΑ τα σκαλιά ΙΔΙΑ: solid + γεμάτα + με νούμερα.
    // Το εσωτερικό cut plane (1200 mm, `splitTreadsByCutPlane`) ΔΕΝ διαφοροποιεί
    // πλέον την εμφάνιση — ενοποιούμε below+above σε ΕΝΑ solid+fill πέρασμα (τέλος
    // το hidden-line διακεκομμένο των πάνω πατημάτων).
    const allTreads = [...geometry.treadsBelowCut, ...(geometry.treadsAboveCut ?? [])];
    // ADR-619 Bug #4 — Section slider = καθαρό visibility clip (Giorgio Option B):
    // κόβει σκαλιά / stringers / walkline πάνω από τη στάθμη τομής, ανά-σκαλί, χωρίς
    // restyle. Ανενεργός → Infinity → identity (πλήρης σκάλα, μηδέν κόστος).
    const sectionMaxZMm = ds.cutPlaneActive ? ds.viewRange.cutPlaneMm : Infinity;
    const clipped = clipStairGeometryAtSection(
      { treads: allTreads, stringers: geometry.stringers, walkline: geometry.walkline },
      sectionMaxZMm,
    );

    renderTreadsForStructure(scx, stair.params.structureType, clipped.treads);
    // ADR-358 Q19 Φ3a/Φ3c — highlight the sub-selected tread + faint hover pre-
    // highlight (topmost pass over the fill). Global build-order `allTreads` so the
    // store index aligns with 3D. Hover is read imperatively from the singleton;
    // the canvas leaf subscription drives the redraw (ADR-040).
    drawStairSubElementHighlight(
      this.ctx,
      (p) => this.worldToScreen(p),
      allTreads,
      stair.id,
      useStairSubElementSelectionStore.getState().selected,
      getStairSubElementHover(),
      geometry.landings, // ADR-637 Φ5 — rest-landing halo (part:'landing')
    );
    renderStringersForStructure(
      scx,
      stair.params.structureType,
      { ...geometry, stringers: clipped.stringers, walkline: clipped.walkline },
    );
    this.drawHandrails(stair, clipped.stringers, _handrailsS.lineWidthPx, _handrailsS.linePattern);
    this.drawWalkline(clipped.walkline, _walklineS.lineWidthPx, _walklineS.linePattern);
    this.drawArrow(
      geometry.arrowSymbol.start,
      geometry.arrowSymbol.end,
      _arrowLabel,
      _arrowS.lineWidthPx,
    );
    this.drawTreadLabels(stair, sectionMaxZMm);

    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isStairEntity(entity)) return [];
    const stair = entity as StairEntity;
    if (!stair.params || !stair.geometry) return [];
    return getStairGrips(stair).map((g) => {
      const stairKind = gripKindOf(g, 'stair');
      // ADR-637 Φ4-D (Giorgio 2026-07-11 «φουξ») — the rest-landing (πλατύσκαλο) handles
      // (slide + length-lo/hi) get a distinct FUCHSIA identity so they read apart from every
      // other stair grip. `customColor` (ADR-047) overrides temperature in GripColorManager.
      const isRestLandingGrip = stairKind?.startsWith('stair-rest-landing') ?? false;
      return {
        id: `${g.entityId}-grip-${g.gripIndex}`,
        position: g.position,
        type: 'vertex' as const,
        entityId: g.entityId,
        isVisible: true,
        gripIndex: g.gripIndex,
        // ADR-393 v2 — carry the icon glyph for the move/rotation handles.
        shape: stairGripGlyphShape(stairKind),
        ...(isRestLandingGrip ? { customColor: GRIP_REST_LANDING_COLOR } : {}),
      };
    });
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isStairEntity(entity)) return false;
    const stair = entity as StairEntity;
    const bb = stair.geometry?.bbox;
    if (!bb) return false;
    return (
      point.x >= bb.min.x - tolerance &&
      point.x <= bb.max.x + tolerance &&
      point.y >= bb.min.y - tolerance &&
      point.y <= bb.max.y + tolerance
    );
  }

  // ─── Internal drawing helpers ───────────────────────────────────────────

  private drawWalkline(walkline: ReadonlyArray<Point3D>, lineWidthPx: number, linePattern: LinePatternKey): void {
    if (walkline.length < 2) return;
    this.ctx.save();
    this.ctx.setLineDash(bimDashPx(linePattern, this.transform.scale));
    this.ctx.lineWidth = lineWidthPx;
    this.drawPolyline3D(walkline);
    this.ctx.restore();
  }

  /**
   * ADR-358 Phase 7b1 — Handrail render derived from stringers + params.
   * Plan-view 2D: handrail polyline shares the stringer path (handrail sits
   * above stringer in elevation). Rendered with thin dashed stroke to
   * distinguish from the structural stringer. ADA-driven extensions
   * (305mm top horizontal + one-tread bottom) extend the polyline tangent
   * past the stringer ends.
   *
   * Geometry SSoT promotion (compute handrail polylines inside
   * StairGeometryService per kind) deferred to Phase 7b2/9.
   */
  private drawHandrails(
    stair: StairEntity,
    stringers: StairEntity['geometry']['stringers'],
    lineWidthPx: number,
    linePattern: LinePatternKey,
  ): void {
    const { handrails } = stair.params;
    if (!handrails.inner && !handrails.outer) return;
    const treadStepMm = stair.params.tread;
    const isAda = stair.params.codeProfile === 'ada';
    const topExtMm = pickTopExtensionMm(handrails.topExtension, isAda);
    const bottomExtMm = pickBottomExtensionMm(
      handrails.bottomExtension,
      treadStepMm,
      isAda,
    );

    this.ctx.save();
    this.ctx.setLineDash(bimDashPx(linePattern, this.transform.scale));
    this.ctx.lineWidth = lineWidthPx;

    if (handrails.inner) {
      const extended = extendPolylineEnds(stringers.inner, topExtMm, bottomExtMm);
      this.drawPolyline3D(extended);
    }
    if (handrails.outer) {
      const extended = extendPolylineEnds(stringers.outer, topExtMm, bottomExtMm);
      this.drawPolyline3D(extended);
    }

    this.ctx.restore();
  }

  /**
   * ADR-358 G21 — tread + landing numbering (Phase 3e, 2026-05-17). Reads
   * the SSoT `geometry.treadLabels` populated by `computeStairGeometry()`
   * — text, position, kind ('tread' | 'landing') and display/'nth' filter
   * already resolved by the factory. `fillStyle` inherits the upstream phase
   * style (normal entity color / hover glow).
   *
   * ADR-619 Bug #5 (Giorgio) — EVERY tread carries its number (the internal
   * 1200 mm cut no longer hides the upper labels). The only gate is the section
   * slider (`sectionMaxZMm`): a label above the active cut elevation is hidden
   * in lock-step with its (clipped-away) tread.
   */
  private drawTreadLabels(stair: StairEntity, sectionMaxZMm: number): void {
    const params = stair.params;
    if (params.treadLabelDisplay === 'none') return;
    const labels = stair.geometry.treadLabels;
    if (!labels || labels.length === 0) return;

    const heightWorld = params.treadLabelHeight ?? 0.08;
    const fontPx = Math.max(8, Math.min(64, heightWorld * this.transform.scale));

    this.ctx.save();
    this.ctx.font = `${fontPx}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = this.ctx.strokeStyle;

    for (const label of labels) {
      if (label.position.z > sectionMaxZMm) continue;
      const screen = this.worldToScreen({ x: label.position.x, y: label.position.y });
      this.ctx.fillText(label.text, screen.x, screen.y);
    }

    this.ctx.restore();
  }

  private drawArrow(
    startW: Point3D,
    endW: Point3D,
    label: 'UP' | 'DOWN',
    lineWidthPx: number,
  ): void {
    const start = this.worldToScreen({ x: startW.x, y: startW.y });
    const end = this.worldToScreen({ x: endW.x, y: endW.y });
    this.ctx.lineWidth = lineWidthPx;
    // strokeStyle inherited from `renderWithPhases` (hover/selected SSoT).
    // fillStyle aligned with stroke so the arrow head + UP/DOWN label pick up
    // the same hover/selection colour as the rest of the stair.
    this.ctx.fillStyle = this.ctx.strokeStyle;

    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) {
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const tipX = end.x;
      const tipY = end.y;
      const baseX = tipX - ARROW_HEAD_PX * ux;
      const baseY = tipY - ARROW_HEAD_PX * uy;
      this.ctx.beginPath();
      this.ctx.moveTo(tipX, tipY);
      this.ctx.lineTo(baseX + ARROW_HEAD_HALF_WIDTH_PX * px, baseY + ARROW_HEAD_HALF_WIDTH_PX * py);
      this.ctx.lineTo(baseX - ARROW_HEAD_HALF_WIDTH_PX * px, baseY - ARROW_HEAD_HALF_WIDTH_PX * py);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.font = '11px sans-serif';
    // fillStyle still matches strokeStyle from above (hover/selected SSoT).
    this.ctx.fillText(label, end.x + LABEL_OFFSET_PX, end.y - LABEL_OFFSET_PX);
  }

  private drawPolyline3D(points: ReadonlyArray<Point3D>): void {
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
