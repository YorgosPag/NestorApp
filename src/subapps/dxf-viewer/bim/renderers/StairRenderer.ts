/**
 * StairRenderer — ADR-358 Phase 5b + Phase 7b1 (G15 + §6.2 partial).
 *
 * 2D plan-view renderer for a `StairEntity`. Reads `entity.geometry`
 * (populated by `computeStairGeometry()` — the SSoT) and draws:
 *   - treads (solid polygons, below-cut)
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
 * Risers, treadsAboveCut (dashed), cutLine zigzag, and tread labels still
 * land in later phases when the full §6.2 pipeline is wired.
 *
 * ADR-363 Phase 0.5 — moved from rendering/entities/StairRenderer.ts to
 * bim/renderers/StairRenderer.ts. Backward-compat barrel stub kept at old path.
 */

import { BaseEntityRenderer } from '../../rendering/entities/BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../../rendering/types/Types';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../rendering/types/Types';
import type { StairEntity } from '../../types/stair';
import type { Entity } from '../../types/entities';
import { isStairEntity } from '../../types/entities';
import { getStairGrips } from '../../systems/stairs/stair-grips';
import { DEFAULT_CUT_PLANE_HEIGHT } from '../../systems/stairs/stair-geometry-shared';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
import { HOVER_HIGHLIGHT } from '../../config/color-config';

const TREAD_FILL_ALPHA = 0.12;
const WALKLINE_DASH: readonly [number, number] = [6, 4];
const HANDRAIL_DASH: readonly [number, number] = [3, 3];
const ARROW_HEAD_PX = 10;
const ARROW_HEAD_HALF_WIDTH_PX = 5;
const LABEL_OFFSET_PX = 8;

/** ADR-358 §3.6 + §5.1 — ADA top handrail extension is 305 mm horizontal. */
const ADA_TOP_EXTENSION_MM = 305;

export class StairRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isStairEntity(entity)) return;
    const stair = entity as StairEntity;
    // ADR-358 Phase 8 — defensive: legacy / partially-serialized stair entries
    // can arrive without `geometry` (e.g. Storage scene blob saved before the
    // ADR §G6 contract was enforced). Skip render rather than crash so the
    // rest of the scene renders normally; the entity is also dropped from
    // hit-testing via the matching guard in HitTestingService.
    if (!stair.geometry || !stair.params) return;
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
      this.drawPerimeterOutline(stair);
      this.ctx.restore();
    }

    // Main pass — phase-appropriate style + full fill+stroke render.
    this.phaseManager.applyPhaseStyle(entity as Entity, phaseState);
    this.drawTreads(geometry.treadsBelowCut);
    this.drawStringers(geometry.stringers.inner, geometry.stringers.outer);
    this.drawHandrails(stair);
    this.drawWalkline(geometry.walkline);
    this.drawArrow(
      geometry.arrowSymbol.start,
      geometry.arrowSymbol.end,
      geometry.arrowSymbol.label,
    );
    this.drawTreadLabels(stair);

    this.finalizeRender(entity, options);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (!isStairEntity(entity)) return [];
    const stair = entity as StairEntity;
    if (!stair.params || !stair.geometry) return [];
    return getStairGrips(stair).map((g) => ({
      id: `${g.entityId}-grip-${g.gripIndex}`,
      position: g.position,
      type: 'vertex' as const,
      entityId: g.entityId,
      isVisible: true,
      gripIndex: g.gripIndex,
    }));
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

  /**
   * Glow halo for hover/highlight (ADR-358 Phase 8). Computes a tight
   * Oriented Bounding Box (OBB) by projecting every tread + stringer vertex
   * into the stair's local frame (rotated by `direction`), taking
   * `min/max` in that frame, and projecting the four OBB corners back to
   * world space.
   *
   * Why include treads + stringers (not stringers alone): stringers end at
   * the throat of the top tread — the top riser sticks out beyond the
   * stringer endpoint. Excluding the tread vertices leaves the top tread
   * outside the halo (regression observed 2026-05-17). Folding every
   * vertex into the bbox guarantees the halo wraps the full visible
   * footprint regardless of variant kind.
   *
   * Industry pattern (AutoCAD/Revit blocks): hover halo on composite
   * entities is a tight OBB along the entity's local frame, not the
   * axis-aligned bbox.
   */
  private drawPerimeterOutline(stair: StairEntity): void {
    const params = stair.params;
    const dirRad = (params.direction * Math.PI) / 180;
    const cos = Math.cos(dirRad);
    const sin = Math.sin(dirRad);
    const bp = params.basePoint;

    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    const fold = (px: number, py: number): void => {
      const dx = px - bp.x;
      const dy = py - bp.y;
      const u = cos * dx + sin * dy;
      const v = -sin * dx + cos * dy;
      if (u < uMin) uMin = u;
      if (u > uMax) uMax = u;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    };

    for (const tread of stair.geometry.treadsBelowCut) {
      for (const p of tread) fold(p.x, p.y);
    }
    for (const p of stair.geometry.stringers.outer) fold(p.x, p.y);
    for (const p of stair.geometry.stringers.inner) fold(p.x, p.y);

    if (uMin === Infinity) return; // no vertices — defensive

    const localCorners = [
      { u: uMin, v: vMin },
      { u: uMax, v: vMin },
      { u: uMax, v: vMax },
      { u: uMin, v: vMax },
    ];
    this.ctx.beginPath();
    const first = this.worldToScreen({
      x: bp.x + cos * localCorners[0].u - sin * localCorners[0].v,
      y: bp.y + sin * localCorners[0].u + cos * localCorners[0].v,
    });
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < localCorners.length; i++) {
      const c = localCorners[i];
      const s = this.worldToScreen({
        x: bp.x + cos * c.u - sin * c.v,
        y: bp.y + sin * c.u + cos * c.v,
      });
      this.ctx.lineTo(s.x, s.y);
    }
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private drawTreads(
    treads: ReadonlyArray<ReadonlyArray<Point3D>>,
    options: { skipFill?: boolean } = {},
  ): void {
    if (treads.length === 0) return;
    // strokeStyle is set upstream by `renderWithPhases` (hover glow / phase
    // setupStyle SSoT) — DO NOT overwrite here, otherwise the yellow hover
    // pass is lost. Only the stair-specific fill (translucent slate) stays
    // locally because it is not part of the entity style pipeline.
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    if (!options.skipFill) {
      this.ctx.fillStyle = `rgba(120, 144, 156, ${TREAD_FILL_ALPHA})`;
    }

    for (const tread of treads) {
      if (tread.length < 3) continue;
      this.ctx.beginPath();
      const first = this.worldToScreen({ x: tread[0].x, y: tread[0].y });
      this.ctx.moveTo(first.x, first.y);
      for (let i = 1; i < tread.length; i++) {
        const s = this.worldToScreen({ x: tread[i].x, y: tread[i].y });
        this.ctx.lineTo(s.x, s.y);
      }
      this.ctx.closePath();
      if (!options.skipFill) this.ctx.fill();
      this.ctx.stroke();
    }
  }

  private drawStringers(inner: ReadonlyArray<Point3D>, outer: ReadonlyArray<Point3D>): void {
    // strokeStyle inherited from `renderWithPhases` (hover/selected SSoT).
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THICK;
    this.drawPolyline3D(inner);
    this.drawPolyline3D(outer);
  }

  private drawWalkline(walkline: ReadonlyArray<Point3D>): void {
    if (walkline.length < 2) return;
    this.ctx.save();
    this.ctx.setLineDash(WALKLINE_DASH as unknown as number[]);
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    // strokeStyle inherited from `renderWithPhases` (hover/selected SSoT).
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
  private drawHandrails(stair: StairEntity): void {
    const { handrails } = stair.params;
    if (!handrails.inner && !handrails.outer) return;
    const { stringers } = stair.geometry;
    const treadStepMm = stair.params.tread;
    const isAda = stair.params.codeProfile === 'ada';
    const topExtMm = pickTopExtensionMm(handrails.topExtension, isAda);
    const bottomExtMm = pickBottomExtensionMm(
      handrails.bottomExtension,
      treadStepMm,
      isAda,
    );

    this.ctx.save();
    this.ctx.setLineDash(HANDRAIL_DASH as unknown as number[]);
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;
    // strokeStyle inherited from `renderWithPhases` (hover/selected SSoT).

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
   * already resolved by the factory. Convention α: labels above the cut
   * plane are not rendered (AutoCAD / Revit standard). `fillStyle`
   * inherits the upstream phase style (normal entity color / hover glow).
   */
  private drawTreadLabels(stair: StairEntity): void {
    const params = stair.params;
    if (params.treadLabelDisplay === 'none') return;
    const labels = stair.geometry.treadLabels;
    if (!labels || labels.length === 0) return;

    const cutPlane = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
    const heightWorld = params.treadLabelHeight ?? 0.08;
    const fontPx = Math.max(8, Math.min(64, heightWorld * this.transform.scale));

    this.ctx.save();
    this.ctx.font = `${fontPx}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = this.ctx.strokeStyle;

    for (const label of labels) {
      if (label.position.z >= cutPlane) continue;
      const screen = this.worldToScreen({ x: label.position.x, y: label.position.y });
      this.ctx.fillText(label.text, screen.x, screen.y);
    }

    this.ctx.restore();
  }

  private drawArrow(startW: Point3D, endW: Point3D, label: 'UP' | 'DOWN'): void {
    const start = this.worldToScreen({ x: startW.x, y: startW.y });
    const end = this.worldToScreen({ x: endW.x, y: endW.y });
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
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

// ─── ADR-358 Phase 7b1 — Handrail extension pure helpers ──────────────────────

function pickTopExtensionMm(
  override: number | undefined,
  isAda: boolean,
): number {
  if (typeof override === 'number' && override > 0) return override;
  return isAda ? ADA_TOP_EXTENSION_MM : 0;
}

function pickBottomExtensionMm(
  override: 'one-tread' | number | undefined,
  treadStepMm: number,
  isAda: boolean,
): number {
  if (typeof override === 'number' && override > 0) return override;
  if (override === 'one-tread') return treadStepMm;
  return isAda ? treadStepMm : 0;
}

/**
 * Extends a polyline past its first and last vertices along the local
 * tangent of the adjacent segment. Returns a NEW array; input untouched.
 * No-op when `front`/`back` are 0 or the polyline has < 2 points.
 */
function extendPolylineEnds(
  poly: ReadonlyArray<Point3D>,
  topMm: number,
  bottomMm: number,
): ReadonlyArray<Point3D> {
  if (poly.length < 2) return poly;
  const head = poly[0];
  const next = poly[1];
  const tail = poly[poly.length - 1];
  const prev = poly[poly.length - 2];

  const result: Point3D[] = [];
  if (bottomMm > 0) {
    const ext = extendOutward(next, head, bottomMm);
    if (ext) result.push(ext);
  }
  for (const p of poly) result.push(p);
  if (topMm > 0) {
    const ext = extendOutward(prev, tail, topMm);
    if (ext) result.push(ext);
  }
  return result;
}

function extendOutward(
  inside: Point3D,
  edge: Point3D,
  distanceMm: number,
): Point3D | null {
  const dx = edge.x - inside.x;
  const dy = edge.y - inside.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x: edge.x + ux * distanceMm,
    y: edge.y + uy * distanceMm,
    z: edge.z,
  };
}
