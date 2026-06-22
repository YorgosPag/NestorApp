/**
 * RoofRenderer — ADR-417 Φ1 vertical slice.
 *
 * 2D plan-view renderer για `RoofEntity`. Διαβάζει `entity.geometry`
 * (populated by `computeRoofGeometry()` — SSoT) και draws:
 *   - κάθε «νερό» (face) με translucent fill + stroke (warm red-brown palette)
 *   - γραμμές κορφιά / hip / λουκιού (ridge lines) με dashed stroke
 *   - hover halo γύρω από το footprint polygon (HOVER_HIGHLIGHT SSoT)
 *
 * Παλέτα (industry convention — warm red-brown για κεραμίδια / RC roof):
 *   - stroke  → #a04a2b  (warm red-brown, ίδιο με slab kind='roof')
 *   - fill    → rgba(160,74,43,0.18)
 *   - ridge   → #7a3420  (σκούρο κόκκινο-καφέ, dashed)
 *
 * ADR-040 micro-leaf compliance: pure renderer class με ZERO subscriptions
 * σε high-frequency stores. Called by canvas με entity resolved upstream.
 *
 * Visibility (ADR-382 SSoT, §10 #4): own V/G category `'roof'` resolved via
 * `resolveIsEntityVisible` (V/G + Layer + Floor + Building + discipline), 1:1 με
 * SlabRenderer — plus a cheap per-element `roof.visible === false` short-circuit.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §Φ1
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions, Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isRoofEntity } from '../../types/entities';
import type { RoofEntity } from '../types/roof-types';
import type { Point3D } from '../types/bim-base';
import { getRoofGrips } from '../roofs/roof-grips';
import { getSelectedRoofEdge } from '../roofs/roof-edge-selection-store';
import { pointInPolygon } from '../geometry/shared/polygon-utils';
import { buildRoofEaveDetail } from '../geometry/roof-eave-detail';
import {
  DEFAULT_EAVE_MATERIAL_ID,
  DEFAULT_FASCIA_HEIGHT_MM,
  DEFAULT_SOFFIT_MODE,
} from '../types/roof-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { HOVER_HIGHLIGHT, UI_COLORS_BASE } from '../../config/color-config';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';
import { resolveIsEntityVisible } from '../visibility/visibility-resolver';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { getLayer } from '../../stores/LayerStore';

// ─── Palette constants ────────────────────────────────────────────────────────

/** Stroke colour για το περίγραμμα κάθε face (ίδιο με slab kind='roof'). */
const ROOF_FACE_STROKE = '#a04a2b';

/** Translucent fill για κάθε face (~18% opacity). */
const ROOF_FACE_FILL = 'rgba(160,74,43,0.18)';

/** Stroke colour για γραμμές κορφιά / hip / λουκιού. */
const ROOF_RIDGE_STROKE = '#7a3420';

/** lineWidth (px) για ridge/hip/valley lines. */
const ROOF_RIDGE_LINE_WIDTH = 1.5;

/** Dash array [on, off] για ridge lines. */
const ROOF_RIDGE_DASH: readonly number[] = [6, 4];

/** Stroke colour της προεξοχής γείσου (ίδια οικογένεια, λεπτό συμπαγές). */
const ROOF_EAVE_STROKE = '#a04a2b';

/** lineWidth (px) για το περίγραμμα προεξοχής γείσου. */
const ROOF_EAVE_LINE_WIDTH = 1;

/** Χρώμα highlight της ακμής υπό επεξεργασία — SSoT token (ribbon «Κλίση ανά νερό»). */
const ROOF_EDGE_HIGHLIGHT_STROKE = UI_COLORS_BASE.EDIT_EDGE_HIGHLIGHT;

/** lineWidth (px) του edge highlight — χοντρό ώστε να ξεχωρίζει από το face stroke. */
const ROOF_EDGE_HIGHLIGHT_LINE_WIDTH = 3.5;

// ─── Renderer ─────────────────────────────────────────────────────────────────

export class RoofRenderer extends BaseEntityRenderer {

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isRoofEntity(entity)) return;
    const roof = entity as RoofEntity;

    // Per-element override short-circuit (Revit "hide element in view").
    if (roof.visible === false) return;

    // ADR-382 — unified V/G visibility (own 'roof' category + Layer + discipline).
    const _roofLayer = roof.layerId ? getLayer(roof.layerId) : null;
    if (!resolveIsEntityVisible(
      { category: 'roof', layerId: roof.layerId, discipline: roof.discipline },
      {
        objectStyles: useDrawingScaleStore.getState().objectStyles,
        disciplineVisibility: useDrawingScaleStore.getState().disciplineVisibility,
        layer: _roofLayer,
      },
    )) return;

    if (!roof.geometry || !roof.params) return;
    const footprintVerts = roof.geometry.footprint.vertices;
    if (footprintVerts.length < 3) return;

    const phaseState = this.phaseManager.determinePhase(entity as Entity, options);

    // Hover halo: glow stroke around footprint polygon outline.
    if (phaseState.phase === 'highlighted') {
      this.ctx.save();
      this.ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
      this.ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
      this.ctx.setLineDash([]);
      this.drawPolygonPath(footprintVerts);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.ctx.save();

    // Eave overhang outline (γείσο) — projects beyond the footprint. Drawn first
    // so the face fills read on top (Revit plan: overhang = outer thin line).
    this.drawEaveOverhangs(roof);

    // Draw each roof face: fill + stroke outline.
    for (const face of roof.geometry.faces) {
      if (face.outline.length < 3) continue;
      this.drawFace(face.outline);
    }

    // Draw ridge / hip / valley / eave lines.
    this.drawRidgeLines(roof);

    // ADR-417 Φ-per-edge — live highlight της ακμής υπό επεξεργασία (ribbon
    // «Κλίση ανά νερό»). ΜΟΝΟ όταν `options.selected` (δυναμικό uncached pass —
    // τα selected entities ΔΕΝ μπαίνουν στο cached bitmap, DxfRenderer skip· άρα
    // το highlight δεν «ψήνεται» στο cache). Event-time getter read (ADR-040,
    // μηδέν subscription)· το redraw trigger ρέει μέσω `renderOptions.selectedRoofEdge`.
    if (options.selected === true) {
      this.drawSelectedEdgeHighlight(roof);
    }

    this.ctx.restore();

    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    // ADR-417 Φ1-part-2 #2 — parametric roof grips (per-vertex translate +
    // edge-midpoint vertex insertion, Revit «Edit Footprint»). Commit routed
    // through `applyRoofGripDrag()` + `UpdateRoofParamsCommand` by
    // `commitRoofGripDrag` (grip-commit-adapter), with Shift driving rectilinear
    // quantization. Mirror of `SlabRenderer.getGrips`.
    if (!isRoofEntity(entity)) return [];
    return getRoofGrips(entity as RoofEntity).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: g.type === 'midpoint' ? ('midpoint' as const) : ('vertex' as const),
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (!isRoofEntity(entity)) return false;
    const roof = entity as RoofEntity;
    const bb = roof.geometry?.bbox;
    if (!bb) return false;

    // Bbox quick-reject (xy only — z in bbox is metres, irrelevant for 2D).
    if (
      point.x < bb.min.x - tolerance ||
      point.x > bb.max.x + tolerance ||
      point.y < bb.min.y - tolerance ||
      point.y > bb.max.y + tolerance
    ) {
      return false;
    }

    // Detailed point-in-polygon test on footprint (ray casting).
    return pointInPolygon(point, roof.geometry.footprint.vertices);
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /**
   * Fills + strokes a single face outline polygon.
   * Vertices are Point3D (canvas-unit xy, mm z) — only xy used for 2D.
   */
  private drawFace(vertices: readonly Point3D[]): void {
    this.drawPolygonPath(vertices);
    // FULL SSoT (bim-body-fill) — κοινό adaptive layer με όλα τα BIM body fills.
    this.ctx.fillStyle = adaptFillTintForCanvas(ROOF_FACE_FILL);
    this.ctx.fill();

    this.ctx.strokeStyle = ROOF_FACE_STROKE;
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    this.ctx.setLineDash([]);
    this.ctx.stroke();
  }

  /**
   * Draws all ridge / hip / valley / eave lines από `geometry.ridges`.
   * Dashed line, warm dark-red, lineWidth 1.5.
   */
  private drawRidgeLines(roof: RoofEntity): void {
    if (roof.geometry.ridges.length === 0) return;

    this.ctx.save();
    this.ctx.strokeStyle = ROOF_RIDGE_STROKE;
    this.ctx.lineWidth = ROOF_RIDGE_LINE_WIDTH;
    this.ctx.setLineDash(ROOF_RIDGE_DASH as number[]);

    for (const ridge of roof.geometry.ridges) {
      const a = this.worldToScreen({ x: ridge.a.x, y: ridge.a.y });
      const b = this.worldToScreen({ x: ridge.b.x, y: ridge.b.y });
      this.ctx.beginPath();
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * ADR-417 Φ-per-edge — strokes the footprint edge currently being edited in
   * the «Κλίση ανά νερό» ribbon panel (hybrid dropdown + highlight). Reads the
   * `roofEdgeSelectionStore` getter at render-time (event-time, zero React);
   * guarded by `roofId` so only the active roof's edge lights. No-op when no
   * edge is selected for THIS roof or the index is out of range.
   */
  private drawSelectedEdgeHighlight(roof: RoofEntity): void {
    const sel = getSelectedRoofEdge();
    if (!sel || sel.roofId !== roof.id) return;
    const verts = roof.geometry.footprint.vertices;
    const n = verts.length;
    if (n < 2 || sel.edgeIndex < 0 || sel.edgeIndex >= n) return;
    const a = verts[sel.edgeIndex];
    const b = verts[(sel.edgeIndex + 1) % n];
    const sa = this.worldToScreen({ x: a.x, y: a.y });
    const sb = this.worldToScreen({ x: b.x, y: b.y });

    this.ctx.save();
    this.ctx.strokeStyle = ROOF_EDGE_HIGHLIGHT_STROKE;
    this.ctx.lineWidth = ROOF_EDGE_HIGHLIGHT_LINE_WIDTH;
    this.ctx.lineCap = 'round';
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.moveTo(sa.x, sa.y);
    this.ctx.lineTo(sb.x, sb.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * ADR-417 Φ2b — draws the eave overhang projection (γείσο) as the outer ring
   * formed by each perimeter edge's outer points. Consumes the SAME pure SSoT
   * (`buildRoofEaveDetail`) as the 3D converter — one source of truth for 2D+3D.
   * No-op when there is no overhang (flat δώμα with 0 overhang → empty ring).
   */
  private drawEaveOverhangs(roof: RoofEntity): void {
    const detail = buildRoofEaveDetail({
      outline: roof.geometry.footprint.vertices,
      edges: roof.params.edges,
      ridges: roof.geometry.ridges, // split rake/αέτωμα στον κορφιά → ακολουθεί την κλίση
      slopeUnit: roof.params.slopeUnit,
      basePivotZ: roof.params.basePivotZ,
      thicknessMm: roof.params.thickness,
      s: mmToSceneUnits(roof.params.sceneUnits ?? 'mm'),
      fasciaHeightMm: roof.params.fasciaHeightMm ?? DEFAULT_FASCIA_HEIGHT_MM,
      soffitMode: roof.params.soffitMode ?? DEFAULT_SOFFIT_MODE,
      overhangMaterialId: DEFAULT_EAVE_MATERIAL_ID,
      fasciaMaterialId: DEFAULT_EAVE_MATERIAL_ID,
      soffitMaterialId: DEFAULT_EAVE_MATERIAL_ID,
    });
    // Outer ring exists only when at least one edge has a real overhang.
    const hasOverhang = roof.params.edges.some((e) => e.overhangMm > 0);
    if (!hasOverhang || detail.overhangEdges.length === 0) return;

    this.ctx.save();
    this.ctx.strokeStyle = ROOF_EAVE_STROKE;
    this.ctx.lineWidth = ROOF_EAVE_LINE_WIDTH;
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    const ring = detail.overhangEdges;
    const first = this.worldToScreen({ x: ring[0].o0.x, y: ring[0].o0.y });
    this.ctx.moveTo(first.x, first.y);
    for (const e of ring) {
      const a = this.worldToScreen({ x: e.o0.x, y: e.o0.y });
      const b = this.worldToScreen({ x: e.o1.x, y: e.o1.y });
      this.ctx.lineTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Builds a closed canvas path from a vertex array (xy only — z ignored for 2D).
   * Mirror of SlabRenderer.drawPolygonPath.
   */
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
